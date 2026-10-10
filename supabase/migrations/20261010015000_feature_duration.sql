-- Film target policy; measured draft/runtime fields remain independent.
alter table public.episodes alter column target_duration_sec set default 3600;
alter table public.episodes add constraint episodes_feature_target_minimum
  check (target_duration_sec >= 2400);
