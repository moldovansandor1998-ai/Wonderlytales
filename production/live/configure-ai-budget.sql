-- Verified 2026-10-14 against https://developers.openai.com/api/docs/models/gpt-6.1-sol
-- and https://vercel.com/ai-gateway/models/gpt-6.1-sol:
-- $2/M input, $2.50/M cache writes, $10/M reasoning + output (standard tier).
-- ai.ts pins this model, caps serialized message bytes at 20,000 and output
-- at 800 combined reasoning/output tokens. $0.06 covers byte-token worst case,
-- cache-write pricing and framing. It is a reservation, not actual billed spend.
-- Each dialogue uses at most two separately reserved calls: draft + editorial
-- review, or draft + repair when invalid. The daily limit is unchanged.
update production_private.budget_policy
set service_ceilings = service_ceilings || '{"live_ai": 0.06}'::jsonb,
    updated_at = now()
where id = true;
