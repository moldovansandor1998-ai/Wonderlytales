-- One shared admission budget for this Studio. Reservations survive failed requests.
-- This is not a RunPod account billing cap. External/manual jobs and subscriptions
-- are outside this ledger. Service ceilings must be verified before enabling paid jobs.
create schema if not exists production_private;
create table production_private.budget_policy (
 id boolean primary key default true check (id),
 daily_limit_usd numeric not null check (daily_limit_usd > 0),
 timezone text not null,
 service_ceilings jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
insert into production_private.budget_policy(id,daily_limit_usd,timezone)
values(true,100,'Asia/Saigon');
create table production_private.budget_reservations (
 id uuid primary key default gen_random_uuid(),
 budget_day date not null,
 service text not null,
 amount_usd numeric not null check(amount_usd > 0),
 requested_by uuid,
 created_at timestamptz not null default now()
);
alter table production_private.budget_policy enable row level security;
alter table production_private.budget_reservations enable row level security;
revoke all on schema production_private from public, anon, authenticated;
revoke all on all tables in schema production_private from public, anon, authenticated;

-- Internal privileged function: no caller-supplied rate, day, or limit.
create function production_private.budget_access(p_service text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p production_private.budget_policy%rowtype; d date; used numeric; ceiling numeric; reservation uuid;
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','studio')
    and coalesce(auth.jwt()->>'role','') <> 'service_role' then
   raise exception 'FORBIDDEN';
 end if;
 select * into strict p from production_private.budget_policy where id = true for update;
 d := (statement_timestamp() at time zone p.timezone)::date;
 select coalesce(sum(amount_usd),0) into used from production_private.budget_reservations where budget_day=d;
 if p_service is not null then
   ceiling := (p.service_ceilings->>p_service)::numeric;
   if ceiling is null or ceiling <= 0 then raise exception 'BUDGET_SERVICE_CEILING_UNVERIFIED'; end if;
   if used + ceiling > p.daily_limit_usd then raise exception 'DAILY_BUDGET_EXCEEDED'; end if;
   insert into production_private.budget_reservations(budget_day,service,amount_usd,requested_by)
   values(d,p_service,ceiling,auth.uid()) returning id into reservation;
   used := used + ceiling;
 end if;
 return jsonb_build_object('daily_limit_usd',p.daily_limit_usd,'timezone',p.timezone,
   'budget_day',d,'reserved_usd',used,'remaining_usd',greatest(0,p.daily_limit_usd-used),
   'reservation_id',reservation,'configured_services',p.service_ceilings,
   'provider_billing_cap_verified',false);
end $$;
revoke all on function production_private.budget_access(text) from public,anon,authenticated;
grant usage on schema production_private to authenticated,service_role;
grant execute on function production_private.budget_access(text) to authenticated,service_role;
create function public.production_budget_status() returns jsonb
language sql security invoker set search_path = '' as $$ select production_private.budget_access(null); $$;
create function public.reserve_production_budget(p_service text) returns jsonb
language sql security invoker set search_path = '' as $$ select production_private.budget_access(p_service); $$;
revoke all on function public.production_budget_status() from public,anon;
revoke all on function public.reserve_production_budget(text) from public,anon;
grant execute on function public.production_budget_status() to authenticated,service_role;
grant execute on function public.reserve_production_budget(text) to authenticated,service_role;
