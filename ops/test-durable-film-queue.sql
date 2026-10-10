-- Run against the real database; rolls back all fixtures. No paid provider requests.
begin;
set local request.jwt.claims = '{"app_metadata":{"role":"studio"}}';
do $$
declare rid uuid; rid2 uuid; task uuid; manifest jsonb; response jsonb; ep uuid;
begin
 select id into ep from public.episodes limit 1;
 manifest:=jsonb_build_object('fps',24,'frames',2,'jobs',jsonb_build_array(jsonb_build_object(
  'operation','RENDER_NATIVE_FRAMES','scene_id','INTEGRATION_TEST','scene_key','native/S1E1/test.blend',
  'scene_sha256',repeat('a',64),'renderer_revision',repeat('b',40),'frame_start',1,'frame_end',2,
  'width',1920,'height',1080,'samples',48,'episode_start_frame',1)));
 rid:=public.enqueue_film(ep,'Rollback queue test','DIAGNOSTIC',manifest,'{"production_approved":true}');
 rid2:=public.enqueue_film(ep,'Duplicate','DIAGNOSTIC',manifest,'{}');
 if rid<>rid2 or (select count(*) from public.film_tasks where run_id=rid)<>1 then raise exception 'Idempotency failed'; end if;
 if (select quality_report->>'production_approved' from public.film_runs where id=rid)<>'false' then raise exception 'Client approved own film'; end if;
 begin
  perform public.enqueue_film(ep,'Too short','FEATURE',manifest,'{}');
  raise exception 'Short feature incorrectly accepted';
 exception when others then if sqlerrm='Short feature incorrectly accepted' then raise; end if; end;
 select id into task from public.film_tasks where run_id=rid;
 update public.film_tasks set status='SUBMITTING',attempts=1,request_id=-987001,request_kind='SUBMIT',request_at=now()-interval '5 minutes' where id=task;
 perform film_private.tick();
 if (select status from public.film_tasks where id=task)<>'BLOCKED' then raise exception 'Ambiguous submit not blocked'; end if;
 update public.film_tasks set status='REMOTE',endpoint_id='aaaaaaaaaaaaaa',external_job_id='existing-provider-job',request_id=-987002,request_kind='POLL',request_at=now()-interval '5 minutes' where id=task;
 perform film_private.tick();
 if (select external_job_id from public.film_tasks where id=task)<>'existing-provider-job' or (select attempts from public.film_tasks where id=task)<>1 then raise exception 'Restart duplicated provider job'; end if;
 response:=jsonb_build_object('status','COMPLETED','output',jsonb_build_object('status','RENDERED',
  'source_sha256',repeat('a',64),'renderer_revision',repeat('b',40),'frame_start',1,'frame_end',2,'frames',2,'fps',24,'native_frame_step',1,'width',1920,'height',1080,'outputs',jsonb_build_array('{}'::jsonb,'{}'::jsonb),
  'clip',jsonb_build_object('key','renders/native/S1E1/'||repeat('a',64)||'/test/clip.mp4','sha256',repeat('c',64),'bytes',500,'verified_frames',2,'verified_fps',24,'verified_width',1920,'verified_height',1080)));
 insert into net._http_response(id,status_code,content) values(-987003,200,response::text);
 update public.film_tasks set request_id=-987003,request_kind='POLL',request_at=now() where id=task;
 update public.film_runs set status='ACTIVE' where id=rid;
 perform film_private.tick();
 if (select status from public.film_tasks where id=task)<>'DONE' or (select status from public.film_runs where id=rid)<>'REVIEW' then raise exception 'Completed render not sent to review'; end if;
 if (select attempts from public.film_tasks where id=task)<>1 then raise exception 'Finished scene rendered again'; end if;
 set local request.jwt.claims = '{"app_metadata":{"role":"viewer"}}';
 begin
  perform public.enqueue_film(ep,'Denied','DIAGNOSTIC',manifest,'{}');raise exception 'Viewer incorrectly authorized';
 exception when others then if sqlerrm<>'FORBIDDEN' then raise; end if;end;
end $$;
rollback;
