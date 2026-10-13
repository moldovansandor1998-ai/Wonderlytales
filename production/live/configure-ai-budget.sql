-- Verified 2026-10-13 against https://ai-gateway.vercel.sh/v1/models:
-- openai/gpt-4.1-mini: $0.40 / 1M input, $1.60 / 1M output tokens.
-- ai.ts pins this model, caps serialized message bytes at 20,000 and output
-- at 800 tokens. $0.02 is a conservative per-attempt reservation, not actual
-- invoiced spend. No automatic retries; the existing daily limit is unchanged.
update production_private.budget_policy
set service_ceilings = service_ceilings || '{"live_ai": 0.02}'::jsonb,
    updated_at = now()
where id = true;
