begin;
-- Preserve existing data while reconciling the original schema with Studio v4.
do $$ declare t text; begin
  foreach t in array array['character_versions','location_versions'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='version' and data_type='integer') then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_version_check');
      execute format('alter table public.%I alter column version type text using (''V'' || lpad(version::text,3,''0''))', t);
    execute format('alter table public.%I add constraint %I check (version ~ ''^V[0-9]{3}$'')', t, t || '_version_check');
    end if;
  end loop;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='character_versions' and column_name='facial_profile' and data_type='jsonb') then
    alter table public.character_versions alter column facial_profile drop default;
    alter table public.character_versions alter column facial_profile type text using case when jsonb_typeof(facial_profile)='string' then facial_profile #>> '{}' else facial_profile::text end;
    alter table public.character_versions alter column facial_profile set default '';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='qc_results' and column_name='details' and data_type='jsonb') then
    alter table public.qc_results alter column details drop default;
    alter table public.qc_results alter column details type text using case when jsonb_typeof(details)='string' then details #>> '{}' else details::text end;
    alter table public.qc_results alter column details set default '';
  end if;
end $$;
alter table public.render_jobs alter column render_type set default 'PREVIEW';
alter table public.render_jobs alter column worker_type set default 'runpod';
alter table public.render_jobs alter column gpu_seconds set default 0;
alter table public.qc_results alter column check_type set default 'UNSPECIFIED';
alter table public.assets alter column project_id drop not null;
alter table public.assets alter column storage_provider set default 's3';
alter table public.assets alter column object_key set default '';
alter table public.render_jobs add column if not exists external_job_id text;
alter table public.render_jobs add column if not exists submitted_at timestamptz;
alter table public.render_jobs add column if not exists result_metadata jsonb;
alter table public.qc_results drop constraint if exists qc_results_score_check;
update public.qc_results set score = score * 100 where score between 0 and 1;
alter table public.qc_results add constraint qc_results_score_check check (score between 0 and 100);
-- One shared Studio; only explicitly assigned members may access its data.
do $$ declare t text; begin
  foreach t in array array['projects','series','seasons','episodes','scenes','shots','characters','character_versions','voices','locations','location_versions','props','prop_versions','animations','dialogue_lines','localized_dialogue_lines','assets','continuity_states','render_jobs','qc_results','cost_events','translation_jobs','episode_localizations'] loop
    execute format('drop policy if exists studio_user_all on public.%I', t);
    execute format('create policy studio_user_all on public.%I for all to authenticated using ((select auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'',''studio'')) with check ((select auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'',''studio''))', t);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
