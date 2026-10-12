-- WonderlyTales ONLY. DML applied 2026-10-11 after official provider pricing review.
-- Does not change the shared daily limit or other service ceilings.
update production_private.budget_policy
set service_ceilings = service_ceilings || '{"wavespeed_kling":1.68,"wavespeed_transcript":0.03}'::jsonb,
    updated_at = now()
where id = true and daily_limit_usd = 200
  and exists (select 1 from public.projects
    where id = 'a2b6d64a-08a0-474f-b7c0-fa71121b00ab' and name = 'Wonderly Tales');

-- Audio vocal isolation is $0.001/second; cut clips are at most 10 seconds.
-- Conservative $0.03 reservation; leaves the existing daily and user cut caps unchanged.
update production_private.budget_policy
set service_ceilings=service_ceilings || '{"wavespeed_audio_cleanup":0.03}'::jsonb,
    updated_at=now()
where id=true and daily_limit_usd=200
  and exists(select 1 from public.projects
    where id='a2b6d64a-08a0-474f-b7c0-fa71121b00ab' and name='Wonderly Tales');
