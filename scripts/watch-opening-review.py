"""Resume bounded GPU review and assemble only its verified complete coverage.

Read-only polling can repeat; native render submissions are never retried.
The existing reservation is required before the one assembly submission.
"""
import argparse,json,pathlib,subprocess,sys,time
p=argparse.ArgumentParser();p.add_argument('--credentials',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
def run(script,*args):
    subprocess.run([sys.executable,str(root/'scripts'/script),*args,'--credentials',a.credentials],cwd=root,check=True)
deadline=time.monotonic()+3*3600
while time.monotonic()<deadline:
    run('run-native-review.py','poll','--manifest','ops/v024-opening-render-jobs.json')
    jobs=json.loads((root/'ops/v024-opening-render-jobs.json').read_text())['jobs']
    if any(j['status'] in ('FAILED','CANCELLED','TIMED_OUT','SUBMISSION_UNCERTAIN','SUBMITTING') for j in jobs):
        raise RuntimeError('Inspect terminal or uncertain render job; no automatic resubmission')
    if len(jobs)==9 and all(j['status']=='COMPLETED' for j in jobs):break
    time.sleep(60)
else:raise TimeoutError('Review remains incomplete; durable job IDs are saved')
path=root/'ops/v024-opening-assembly.json';doc=json.loads(path.read_text())
if doc['status']=='WAITING_FOR_CLIPS':
    run('assemble-opening-review.py','submit','--budget-reservation-id',doc['planned_budget_reservation_id'])
while time.monotonic()<deadline:
    run('assemble-opening-review.py','poll');doc=json.loads(path.read_text())
    if doc['status']=='COMPLETED':
        run('assemble-opening-review.py','download');print('REVIEW_DOWNLOADED_AND_DECODED',flush=True);break
    if doc['status'] in ('FAILED','CANCELLED','TIMED_OUT','SUBMISSION_UNCERTAIN','SUBMITTING'):
        raise RuntimeError('Inspect assembly state; no automatic resubmission')
    time.sleep(30)
else:raise TimeoutError('Assembly incomplete; durable job ID is saved')
