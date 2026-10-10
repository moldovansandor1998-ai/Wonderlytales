-- Actual Supabase queue integration test. Fixtures roll back; no dispatch/tick/GPU call.
begin;
set local request.jwt.claims = '{"app_metadata":{"role":"studio"}}';
create temporary table feature_stress_result(result jsonb) on commit drop;
do $$
declare ep uuid; rid uuid; duplicate uuid; jobs jsonb; manifest jsonb; started timestamptz:=clock_timestamp();
begin
 select id into ep from public.episodes order by id limit 1;
 select jsonb_agg(jsonb_build_object('operation','RENDER_NATIVE_FRAMES','scene_id','STRESS_'||i,
  'scene_key','native/S1E1/stress/scene_'||i||'.blend','scene_sha256',repeat('a',64),
  'renderer_revision',repeat('b',40),'frame_start',1,'frame_end',288,
  'width',1920,'height',1080,'samples',48,'episode_start_frame',(i-1)*288+1) order by i)
 into jobs from generate_series(1,300) i;
 manifest:=jsonb_build_object('fps',24,'frames',86400,'jobs',jobs,
  'audio_key','audio/S1E1/stress/full_hu.wav','audio_sha256',repeat('c',64));
 rid:=public.enqueue_film(ep,'Rollback 300-scene 60-minute test','FEATURE',manifest,'{"production_approved":true}');
 duplicate:=public.enqueue_film(ep,'Duplicate','FEATURE',manifest,'{}');
 if duplicate<>rid then raise exception 'Retry duplicated run'; end if;
 if (select count(*) from public.film_tasks where run_id=rid)<>301 then raise exception 'Missing tasks'; end if;
 if (select sum(frames) from public.film_tasks where run_id=rid and kind='RENDER')<>86400 then raise exception 'Missing frame coverage'; end if;
 if (select scene_count from public.film_runs where id=rid)<>300 then raise exception 'Missing scenes'; end if;
 if exists(select 1 from public.film_tasks where run_id=rid and (attempts<>0 or external_job_id is not null)) then raise exception 'Unexpected provider work'; end if;
 if (select status from public.film_runs where id=rid)<>'HELD' then raise exception 'Feature bypassed hold'; end if;
 if (select quality_report->>'production_approved' from public.film_runs where id=rid)<>'false' then raise exception 'Forged quality approval'; end if;
 insert into feature_stress_result values(jsonb_build_object('scenes',300,'render_tasks',300,'assembly_tasks',1,
  'frames',86400,'minutes',60,'idempotency_pass',true,'quality_gate_pass',true,'paid_jobs',0,
  'elapsed_ms',extract(epoch from clock_timestamp()-started)*1000,'fixtures_rolled_back',true));
end $$;
select result from feature_stress_result;
rollback;
