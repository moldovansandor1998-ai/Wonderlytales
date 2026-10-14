-- Verified 2026-10-14 against https://vercel.com/ai-gateway/models/gpt-4.1:
-- openai/gpt-4.1: $2 / 1M input, $8 / 1M output tokens.
-- ai.ts pins this model, caps serialized message bytes at 20,000 and output
-- at 800 tokens. $0.05 conservatively covers byte-token worst case plus framing.
-- Each dialogue uses at most two separately reserved calls: draft + editorial
-- review, or draft + repair when invalid. The daily limit is unchanged.
update production_private.budget_policy
set service_ceilings = service_ceilings || '{"live_ai": 0.05}'::jsonb,
    updated_at = now()
where id = true;
