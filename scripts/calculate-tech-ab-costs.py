"""Reproducible, non-billing price scenarios. No provider calls or purchases.

Prices checked against official provider pages 2026-10-10 UTC / 2026-10-11 HU user's day.
Attempts include the first successful generation; artistically rejected outputs
still count. These are sensitivity scenarios, NOT measured acceptance rates.
"""
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'production/technology_trials/TECH_AB_V001'
MODELS = [
    ('runway_seedance25', 'Runway Dev / Seedance 2.5', '.68', 68,
     '1080p', 'https://docs.dev.runwayml.com/guides/pricing/'),
    ('runway_seedance2', 'Runway Dev / Seedance 2.0', '.40', 40,
     '1080p', 'https://docs.dev.runwayml.com/guides/pricing/'),
    ('runway_wan3', 'Runway Dev / WAN 3.0', '.20', 20,
     '1080p', 'https://docs.dev.runwayml.com/guides/pricing/'),
    ('fal_kling_o3_pro', 'fal API / Kling O3 Pro references, audio off', '.112', None,
     'Pro', 'https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video'),
    ('fal_kling_o3_pro_v2v', 'fal API / Kling O3 Pro video reference', '.168', None,
     'Pro', 'https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/reference'),
    ('google_veo31', 'Google API / Veo 3.1 Standard, audio on', '.40', None,
     '1080p', 'https://ai.google.dev/gemini-api/docs/pricing'),
    ('google_veo31_fast', 'Google API / Veo 3.1 Fast, audio on', '.12', None,
     '1080p', 'https://ai.google.dev/gemini-api/docs/pricing'),
    ('google_veo31_lite', 'Google API / Veo 3.1 Lite, audio on', '.08', None,
     '1080p', 'https://ai.google.dev/gemini-api/docs/pricing'),
    ('fal_wan22', 'fal API / Wan 2.2 A14B', '.08', None,
     '720p, charged seconds at 16fps; not equivalent to 1080p24', 'https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video'),
]

def cost(seconds, attempts, rate):
    return float((Decimal(str(seconds)) * Decimal(str(attempts)) * Decimal(rate)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))

def main():
    rows = []
    for identity, name, rate, credits, res, source in MODELS:
        row = dict(id=identity, name=name, resolution=res, usd_per_generated_second=float(rate),
            runway_api_credits_per_second=credits, price_source=source,
            trials={}, film_60_minutes={}, exclusions=['tax', 'input-video charges', 'audio/lip-sync/post', 'character/rig work', 'human labor', 'storage', 'GPU', 'subscription'])
        for n in (1, 3, 5):
            # 1080p Veo is 8s per clip; other models can partition 20/24/30.
            billed = [24, 24, 32] if identity.startswith('google_veo') else [20, 24, 30]
            row['trials'][str(n)] = {str(t): dict(billed_seconds=b, usd=cost(b, n, rate),
                runway_api_credits=b*n*credits if credits else None) for t, b in zip((20,24,30), billed)}
            row['film_60_minutes'][str(n)] = dict(generated_seconds=3600*n, usd=cost(3600,n,rate),
                runway_api_credits=3600*n*credits if credits else None,
                minimum_200usd_budget_days=int((Decimal(str(cost(3600,n,rate)))/200).to_integral_value(rounding='ROUND_CEILING')))
        rows.append(row)
    # Four common shots are 8,4,8,4 s. Veo 1080p must generate 8s per shot.
    common = {r[0]: {'generated_seconds_per_pass':32 if r[0].startswith('google_veo') else 24,
        'three_attempts_usd':cost(32 if r[0].startswith('google_veo') else 24, 3, r[2])} for r in MODELS}
    report = dict(checked_date='2026-10-11', timezone='Asia/Saigon', currency='USD',
        status='SCENARIOS_NOT_A_QUOTE', trials_seconds=[20,24,30], film_seconds=3600,
        attempt_multipliers=[1,3,5], formula='billed_generated_seconds * total_attempts * unit_price',
        prices_are_not_quality_rankings=True, actual_quality_measured=False,
        no_purchase=True, new_paid_jobs=0, models=rows, common_four_shot_trial=common,
        seedance25_video_reference_surcharge=dict(usd_per_input_second=.34, credits_per_input_second=34,
            same_length_video_ref_three_attempts_24s_usd=cost(24,3,'1.02'),
            same_length_video_ref_three_attempts_60min_usd=cost(3600,3,'1.02')),
        seedance25_draft_then_final=dict(formula='three 480p drafts + one 1080p final per accepted duration',
            trial24_usd=cost(24,1,'1.28'), film60_usd=cost(3600,1,'1.28'),
            note='No rejected 1080p finals assumed; enhancement itself must be reviewed.'),
        production_budget_formula='video generation + input media + post/lip-sync + render/storage + licenses + labor_hours * hourly_rate + taxes',
        illustrative_labor_only=dict(not_an_estimate=True, hours=300, hourly_rate_usd=30, total_usd=9000),
        continuity_stress_test=dict(shots=12, seconds_per_shot=6, total_seconds=72, status='NOT_RUN'))
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'costs.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('SCENARIOS_WRITTEN',len(rows))
    for r in rows:
        print(r['id'],r['trials']['3']['24']['usd'],[r['film_60_minutes'][str(n)]['usd'] for n in (1,3,5)])

if __name__=='__main__': main()
