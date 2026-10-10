create or replace function film_private.tick() returns void language plpgsql security definer set search_path='' as $$
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
 req:=net.http_post(url:='https://api.runpod.ai/v2/'||c.endpoint_id||'/run',body:=jsonb_build_object('input',t.payload,'policy',jsonb_build_object('executionTimeout',1800000,'ttl',3600000)),headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),timeout_milliseconds:=15000);
 update public.film_tasks set status='SUBMITTING',attempts=attempts+1,endpoint_id=c.endpoint_id,request_id=req,request_kind='SUBMIT',request_at=now(),reservation_id=reservation,updated_at=now() where id=t.id;
 insert into public.film_events(run_id,task_id,event,detail) values(t.run_id,t.id,'SUBMIT_INTENT',jsonb_build_object('attempt',t.attempts+1,'reservation_id',reservation));
 update public.film_control_status set error=null where id=true;
end $$;
