"""Collect native/media receipts only after the complete movie QC passes."""
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();out=root/'episode-opening-v001';props=root/'episode-story-props-v001'
movie=json.loads((out/'movie_QC.json').read_text())
assert movie['status']=='VERIFIED_DRAFT_ENCODING'
paths=[out/'S1E1_OPENING_ANIMATION_V001_DRAFT.blend',out/'SUPPORTING_FILM_MATERIALS_V009_DRAFT.blend',out/'opening_mix_DRAFT.wav',out/'intro_music_V001_DRAFT.wav',props/'S1E1_STORY_PROPS_V001_DRAFT.blend',props/'Wonderly_Tales_S1E1_kellekek_V001_DRAFT.png',out/'opening_first_frame.png',*[out/x['file'] for x in movie['outputs']],root/'Wonderly_Tales_S1E1_HU_CURRENT_RECORDINGS_20261008.zip']
receipt={'status':'DELIVERED_BLOCKING_DRAFT','full_episode_completed':False,'artistic_quality_approved':False,'movie':movie,'scene':json.loads((out/'scene_QC.json').read_text()),'audio':json.loads((out/'audio_mix_QC.json').read_text()),'native_props':json.loads((props/'props_manifest.json').read_text()),'production':json.loads((out/'production_manifest.json').read_text()),'files':[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths]}
(out/'delivery_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print('DELIVERY_RECEIPT_CREATED',len(paths))
