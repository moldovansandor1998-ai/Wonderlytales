create index if not exists assets_project_idx on assets(project_id);
create index if not exists series_project_idx on series(project_id);
create index if not exists render_jobs_shot_idx on render_jobs(shot_id);
create index if not exists render_jobs_output_asset_idx on render_jobs(output_asset_id) where output_asset_id is not null;
create index if not exists qc_results_render_job_idx on qc_results(render_job_id) where render_job_id is not null;
create index if not exists shots_preview_asset_idx on shots(current_preview_asset_id) where current_preview_asset_id is not null;
create index if not exists shots_final_asset_idx on shots(current_final_asset_id) where current_final_asset_id is not null;