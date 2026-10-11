-- Preserve previous films, reports, tasks and media; only tag archive ownership.
update public.film_runs set quality_report=quality_report || '{"archived":true,"archive_reason":"User requested creative reset to independent TITOKVAROS; retain all old media"}'::jsonb
where id in ('1a554319-3432-4c7e-a935-8e34e53a1f4d','7c3cd73e-f5ac-4931-82b4-117a80360e95','8caf0f3c-a0b0-49e5-b7f8-0e0137315c16');
