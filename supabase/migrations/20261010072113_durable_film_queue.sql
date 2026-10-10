-- Long-lived Postgres control plane; Blender executes only on the configured native endpoint.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists film_private;
revoke all on schema film_private from public, anon, authenticated;

create table public.film_runs (
 id uuid primary key default gen_random_uuid(), episode_id uuid references public.episodes(id),
 title text not null, mode text not null check(mode in ('DIAGNOSTIC','FEATURE')),
 status text not null default 'HELD' check(status in ('HELD','ACTIVE','PAUSED','REVIEW','RELEASED','FAILED')),
 fps integer not null default 24 check(fps=24), frames integer not null check(frames>0),
 scene_count integer not null check(scene_count>0), manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 manifest jsonb not null, quality_report jsonb not null default '{}',
 output_key text, output_sha256 text, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(episode_id,manifest_sha256), check(mode<>'FEATURE' or frames>=57600)
);
create table public.film_tasks (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.film_runs(id),
 ordinal integer not null, scene_id text not null, kind text not null default 'RENDER' check(kind in ('RENDER','ASSEMBLY')),
 input_sha256 text not null check(input_sha256 ~ '^[a-f0-9]{64}$'), payload jsonb not null,
 frames integer not null check(frames>0), status text not null default 'PENDING'
 check(status in ('PENDING','SUBMITTING','REMOTE','DONE','FAILED','BLOCKED')),
 attempts integer not null default 0, max_attempts integer not null default 3 check(max_attempts between 1 and 5),
 endpoint_id text, external_job_id text, request_id bigint, request_kind text, request_at timestamptz,
 next_attempt_at timestamptz not null default now(), output_key text, output_sha256 text,
 result jsonb, error text, reservation_id uuid, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(run_id,ordinal),unique(run_id,input_sha256)
);
create index film_tasks_dispatch on public.film_tasks(status,next_attempt_at);
create index film_tasks_run on public.film_tasks(run_id);
create table public.film_events (
 id bigint generated always as identity primary key, run_id uuid references public.film_runs(id),
 task_id uuid references public.film_tasks(id), event text not null, detail jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index film_events_run on public.film_events(run_id,created_at);
create index film_events_task on public.film_events(task_id);
create table public.film_control_status (
 id boolean primary key default true check(id), scheduler_heartbeat timestamptz,
 dispatch_enabled boolean not null default false, endpoint_verified boolean not null default false,
 active_remote integer not null default 0, error text
);
insert into public.film_control_status(id,error) values(true,'Native endpoint and per-job cost ceiling not verified');
create table film_private.config (
 id boolean primary key default true check(id), api_secret_name text not null default 'wonderly_film_runpod',
 endpoint_id text, endpoint_verified boolean not null default false,
 dispatch_enabled boolean not null default false, max_remote integer not null default 1 check(max_remote between 1 and 4)
);
insert into film_private.config(id) values(true);
alter table film_private.config enable row level security;

alter table public.film_runs enable row level security;
alter table public.film_tasks enable row level security;
alter table public.film_events enable row level security;
alter table public.film_control_status enable row level security;
-- Read-only application tables: privileged writes go through narrowly scoped RPCs.
grant select on public.film_runs, public.film_tasks, public.film_events, public.film_control_status to authenticated;
create policy film_runs_read on public.film_runs for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','studio'));
create policy film_tasks_read on public.film_tasks for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','studio'));
create policy film_events_read on public.film_events for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','studio'));
create policy film_control_read on public.film_control_status for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','studio'));

create function film_private.require_studio() returns void language plpgsql set search_path='' as $$
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','') not in ('admin','studio') then raise exception 'FORBIDDEN'; end if;
end $$;

-- Cache identity covers complete canonical payload, including renderer build and native source.
create function film_private.enqueue(p_episode uuid,p_title text,p_mode text,p_manifest jsonb,p_quality jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; sha text; j jsonb; n integer:=0; total integer:=0; expected integer:=1; scene_ids text[]:='{}';
begin
 perform film_private.require_studio();
 if p_mode not in ('DIAGNOSTIC','FEATURE') or p_manifest->>'fps'<>'24' then raise exception 'INVALID_MANIFEST'; end if;
 if jsonb_array_length(p_manifest->'jobs') not between 1 and 20000 then raise exception 'INVALID_JOB_COUNT'; end if;
 sha:=encode(extensions.digest(convert_to(jsonb_build_object('mode',p_mode,'manifest',p_manifest)::text,'UTF8'),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(sha,0));
 select id into rid from public.film_runs where episode_id is not distinct from p_episode and manifest_sha256=sha;
 if rid is not null then return rid; end if;
 for j in select value from jsonb_array_elements(p_manifest->'jobs') loop
  if j->>'operation'<>'RENDER_NATIVE_FRAMES' or j->>'scene_key' !~ '^native/S1E1/[A-Za-z0-9_./-]+\.blend$'
   or position('..' in j->>'scene_key')>0 or j->>'scene_sha256' !~ '^[a-f0-9]{64}$'
   or j->>'renderer_revision' !~ '^[a-f0-9]{40}$'
   or (j->>'frame_start')::integer<1 or (j->>'frame_end')::integer-(j->>'frame_start')::integer+1 not between 1 and 360
   or (j->>'width',j->>'height') not in (('1920','1080'),('2560','1440'),('3840','2160'))
   or (j->>'samples')::integer not between 48 and 512
   or (j->>'episode_start_frame')::integer<>expected or nullif(j->>'scene_id','') is null
   or not (j ?& array['operation','scene_key','scene_sha256','renderer_revision','frame_start','frame_end','width','height','samples','episode_start_frame','scene_id'])
   then raise exception 'INVALID_NATIVE_JOB'; end if;
  total:=total+(j->>'frame_end')::integer-(j->>'frame_start')::integer+1; expected:=total+1;
  scene_ids:=array_append(scene_ids,j->>'scene_id');
 end loop;
 if p_mode='FEATURE' and (p_manifest->>'audio_key' !~ '^audio/S1E1/[A-Za-z0-9_./-]+\.wav$' or p_manifest->>'audio_sha256' !~ '^[a-f0-9]{64}$' or not(p_manifest ?& array['audio_key','audio_sha256'])) then raise exception 'FULL_HUNGARIAN_MIX_REQUIRED'; end if;
 if total<>(p_manifest->>'frames')::integer or (p_mode='FEATURE' and total<57600) then raise exception 'INVALID_FILM_DURATION'; end if;
 insert into public.film_runs(episode_id,title,mode,frames,scene_count,manifest_sha256,manifest,quality_report)
 values(p_episode,p_title,p_mode,total,(select count(distinct x) from unnest(scene_ids) x),sha,p_manifest,p_quality||jsonb_build_object('production_approved',false)) returning id into rid;
 for j in select value from jsonb_array_elements(p_manifest->'jobs') loop
  n:=n+1;
  insert into public.film_tasks(run_id,ordinal,scene_id,input_sha256,payload,frames)
  values(rid,n,j->>'scene_id',encode(extensions.digest(convert_to(j::text,'UTF8'),'sha256'),'hex'),j,(j->>'frame_end')::integer-(j->>'frame_start')::integer+1);
 end loop;
 if p_manifest ? 'audio_key' then
  insert into public.film_tasks(run_id,ordinal,scene_id,kind,input_sha256,payload,frames) values(rid,n+1,'FULL_FILM','ASSEMBLY',sha,jsonb_build_object('operation','ASSEMBLE_NATIVE_FILM','frames',total,'audio_key',p_manifest->>'audio_key','audio_sha256',p_manifest->>'audio_sha256'),total);
 end if;
 insert into public.film_events(run_id,event,detail) values(rid,'ENQUEUED_HELD',jsonb_build_object('tasks',n,'quality_approved',false));
 return rid;
end $$;
create function public.enqueue_film(p_episode uuid,p_title text,p_mode text,p_manifest jsonb,p_quality jsonb default '{}')
returns uuid language sql set search_path='' as $$select film_private.enqueue(p_episode,p_title,p_mode,p_manifest,p_quality);$$;

create function film_private.control(p_run uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.film_runs%rowtype;
begin
 perform film_private.require_studio();
 select * into strict r from public.film_runs where id=p_run for update;
 if p_action='PAUSE' then update public.film_runs set status='PAUSED',updated_at=now() where id=p_run and status='ACTIVE';
 elsif p_action='RESUME' then
  if r.status not in ('HELD','PAUSED') then raise exception 'INVALID_TRANSITION'; end if;
  if r.mode='FEATURE' and not coalesce((r.quality_report->>'production_approved')::boolean,false) then raise exception 'QUALITY_GATE_FAILED'; end if;
  if not exists(select 1 from film_private.config where dispatch_enabled and endpoint_verified) then raise exception 'NATIVE_WORKER_NOT_VERIFIED'; end if;
  if not exists(select 1 from production_private.budget_policy where (service_ceilings->>'native_render')::numeric>0) then raise exception 'BUDGET_SERVICE_CEILING_UNVERIFIED'; end if;
  update public.film_runs set status='ACTIVE',updated_at=now() where id=p_run;
 else raise exception 'INVALID_ACTION'; end if;
 insert into public.film_events(run_id,event) values(p_run,p_action);
end $$;
create function public.control_film(p_run uuid,p_action text) returns void language sql set search_path='' as $$select film_private.control(p_run,p_action);$$;

-- Native worker returned decode/checksum evidence is necessary; never equate DONE with artistic approval.
create function film_private.valid_result(p jsonb,r jsonb) returns boolean language sql immutable set search_path='' as $$
select case when p->>'operation'='ASSEMBLE_NATIVE_FILM' then coalesce(r->>'status'='ASSEMBLED' and r->>'decoded'='true' and r->>'frames'=p->>'frames' and r->>'fps'='24' and r->>'audio_sha256'=p->>'audio_sha256' and r->'clip'->>'verified_frames'=p->>'frames' and r->'clip'->>'sha256' ~ '^[a-f0-9]{64}$' and starts_with(r->'clip'->>'key','renders/native/S1E1/assembled/'),false) else coalesce(r->>'status'='RENDERED' and r->>'renderer_revision'=p->>'renderer_revision' and r->>'source_sha256'=p->>'scene_sha256'
 and (r->>'frame_start')::integer=(p->>'frame_start')::integer and (r->>'frame_end')::integer=(p->>'frame_end')::integer
 and (r->>'frames')::integer=(p->>'frame_end')::integer-(p->>'frame_start')::integer+1
 and r->>'fps'='24' and r->>'native_frame_step'='1'
 and r->>'width'=p->>'width' and r->>'height'=p->>'height'
 and r->'clip'->>'verified_frames'=r->>'frames' and r->'clip'->>'verified_fps'='24'
 and r->'clip'->>'verified_width'=p->>'width' and r->'clip'->>'verified_height'=p->>'height'
 and r->'clip'->>'sha256' ~ '^[a-f0-9]{64}$' and (r->'clip'->>'bytes')::bigint>0
 and starts_with(r->'clip'->>'key','renders/native/S1E1/'||(p->>'scene_sha256')||'/')
 and jsonb_array_length(r->'outputs')=(r->>'frames')::integer,false) end;$$;

-- pg_net request queues are unlogged. Our intent/provider ids are logged and retained.
-- An ambiguous submission is BLOCKED, never blindly resubmitted and double billed.
create function film_private.tick() returns void language plpgsql security definer set search_path='' as $$
declare c film_private.config%rowtype; t public.film_tasks%rowtype; response record; body jsonb; secret text; req bigint;
 policy production_private.budget_policy%rowtype; ceiling numeric; used numeric; d date; reservation uuid;
begin
 if not pg_try_advisory_xact_lock(71299123) then return; end if;
 select * into strict c from film_private.config where id=true;
 update public.film_control_status set scheduler_heartbeat=now(),dispatch_enabled=c.dispatch_enabled,endpoint_verified=c.endpoint_verified,
 active_remote=(select count(*) from public.film_tasks where status in ('SUBMITTING','REMOTE')) where id=true;
 for t in select * from public.film_tasks where request_id is not null order by request_at limit 32 for update skip locked loop
  select * into response from net._http_response where id=t.request_id;
  if not found then
   if t.request_at<now()-interval '2 minutes' then
    update public.film_tasks set request_id=null,request_kind=null,
     status=case when t.request_kind='SUBMIT' then 'BLOCKED' else status end,
     error=case when t.request_kind='SUBMIT' then 'Ambiguous submission: reconcile provider before retry' else 'Poll lost: retrying existing provider id' end,updated_at=now() where id=t.id;
   end if;
   continue;
  end if;
  begin body:=response.content::jsonb; exception when others then body:='{}'; end;
  if response.status_code=200 and coalesce(response.timed_out,false)=false and response.error_msg is null then
   if t.request_kind='SUBMIT' and nullif(body->>'id','') is not null then
    update public.film_tasks set external_job_id=body->>'id',status='REMOTE',error=null where id=t.id;
   elsif t.request_kind='POLL' then
    if body->>'status'='COMPLETED' then
     if film_private.valid_result(t.payload,body->'output') then
      update public.film_tasks set status='DONE',output_key=body->'output'->'clip'->>'key',output_sha256=body->'output'->'clip'->>'sha256',result=body->'output',error=null where id=t.id;
      if t.kind='ASSEMBLY' then update public.film_runs set output_key=body->'output'->'clip'->>'key',output_sha256=body->'output'->'clip'->>'sha256' where id=t.run_id; end if;
      insert into public.film_events(run_id,task_id,event) values(t.run_id,t.id,'RENDER_DECODED_REQUIRES_QC');
     else update public.film_tasks set status='BLOCKED',error='Native output evidence mismatches immutable input',result=body->'output' where id=t.id; end if;
    elsif body->>'status' in ('FAILED','CANCELLED','TIMED_OUT') then
     update public.film_tasks set status=case when attempts>=max_attempts then 'FAILED' else 'PENDING' end,
      next_attempt_at=now()+interval '1 minute'*power(2,attempts),external_job_id=null,error='Provider render failed; bounded retry',result=body where id=t.id;
    end if;
   end if;
  elsif t.request_kind='SUBMIT' then
   update public.film_tasks set status='BLOCKED',error='Submission uncertain or rejected; no automatic duplicate dispatch' where id=t.id;
  else update public.film_tasks set error='Provider poll unavailable; retaining external job id' where id=t.id; end if;
  update public.film_tasks set request_id=null,request_kind=null,request_at=null,updated_at=now() where id=t.id;
 end loop;
 select decrypted_secret into secret from vault.decrypted_secrets where name=c.api_secret_name;
 if secret is not null then
  for t in select * from public.film_tasks where status='REMOTE' and request_id is null order by updated_at limit 8 for update skip locked loop
   req:=net.http_get(url:='https://api.runpod.ai/v2/'||t.endpoint_id||'/status/'||t.external_job_id,headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=15000);
   update public.film_tasks set request_id=req,request_kind='POLL',request_at=now(),updated_at=now() where id=t.id;
  end loop;
 end if;
 update public.film_runs r set status='REVIEW',updated_at=now() where status='ACTIVE'
  and not exists(select 1 from public.film_tasks pending where pending.run_id=r.id and pending.status<>'DONE');
 update public.film_runs rr set status='FAILED',error='A render task exhausted its retry limit',updated_at=now() where status='ACTIVE' and exists(select 1 from public.film_tasks ff where ff.run_id=rr.id and ff.status='FAILED');
 if not c.dispatch_enabled or not c.endpoint_verified or c.endpoint_id is null or secret is null then return; end if;
 if (select count(*) from public.film_tasks where status in ('REMOTE','SUBMITTING'))>=c.max_remote then return; end if;
 select t0.* into t from public.film_tasks t0 join public.film_runs r on r.id=t0.run_id
  where t0.status='PENDING' and t0.attempts<t0.max_attempts and t0.next_attempt_at<=now() and r.status='ACTIVE'
  and (t0.kind='RENDER' or not exists(select 1 from public.film_tasks dep where dep.run_id=t0.run_id and dep.kind='RENDER' and dep.status<>'DONE'))
  and (r.mode='DIAGNOSTIC' or coalesce((r.quality_report->>'production_approved')::boolean,false))
  order by t0.created_at,t0.ordinal limit 1 for update of t0 skip locked;
 if not found then return; end if;
 if t.kind='ASSEMBLY' then
  t.payload:=t.payload||jsonb_build_object('clips',(select jsonb_agg(jsonb_build_object('key',cl.output_key,'sha256',cl.output_sha256,'frames',cl.frames) order by cl.ordinal) from public.film_tasks cl where cl.run_id=t.run_id and cl.kind='RENDER'));
  update public.film_tasks set payload=t.payload where id=t.id;
 end if;
 select * into strict policy from production_private.budget_policy where id=true for update;
 ceiling:=(policy.service_ceilings->>'native_render')::numeric;
 if ceiling is null or ceiling<=0 then
  update public.film_control_status set error='Native render per-job cost ceiling unverified' where id=true; return;
 end if;
 d:=(now() at time zone policy.timezone)::date;
 select coalesce(sum(amount_usd),0) into used from production_private.budget_reservations where budget_day=d;
 if used+ceiling>policy.daily_limit_usd then
  update public.film_control_status set error='Daily budget exhausted; queue preserved' where id=true; return;
 end if;
 insert into production_private.budget_reservations(budget_day,service,amount_usd) values(d,'native_render',ceiling) returning id into reservation;
 req:=net.http_post(url:='https://api.runpod.ai/v2/'||c.endpoint_id||'/run',body:=jsonb_build_object('input',t.payload),headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),timeout_milliseconds:=15000);
 update public.film_tasks set status='SUBMITTING',attempts=attempts+1,endpoint_id=c.endpoint_id,request_id=req,request_kind='SUBMIT',request_at=now(),reservation_id=reservation,updated_at=now() where id=t.id;
 insert into public.film_events(run_id,task_id,event,detail) values(t.run_id,t.id,'SUBMIT_INTENT',jsonb_build_object('attempt',t.attempts+1,'reservation_id',reservation));
 update public.film_control_status set error=null where id=true;
end $$;

revoke all on all tables in schema film_private from public,anon,authenticated;
revoke execute on all functions in schema film_private from public,anon,authenticated;
grant usage on schema film_private to authenticated;
grant execute on function film_private.enqueue(uuid,text,text,jsonb,jsonb),film_private.control(uuid,text) to authenticated;
revoke all on function public.enqueue_film(uuid,text,text,jsonb,jsonb),public.control_film(uuid,text) from public,anon;
grant execute on function public.enqueue_film(uuid,text,text,jsonb,jsonb),public.control_film(uuid,text) to authenticated;
select cron.schedule('wonderly-film-queue','* * * * *','select film_private.tick();');
