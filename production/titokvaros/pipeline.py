"""Content-addressed, resumable shot ledger; works without a GPU or secrets.

plan manifest.json --state ledger.sqlite --source-sha SHA
Only plans tasks. It never submits billable work. A dispatcher must reserve
budget, claim one job, persist the provider job id, then poll that same id.
"""
import argparse,hashlib,json,re,sqlite3
from pathlib import Path


def validate(manifest):
    if manifest.get('series')!='TITOKVAROS' or manifest.get('fps')!=24:raise ValueError('Wrong series or frame rate')
    shots=manifest.get('shots',[])
    if not 1<=len(shots)<=500:raise ValueError('Expected 1–500 shots')
    next_frame=1;ids=set()
    for shot in shots:
        if not re.fullmatch(r'TV_[A-Z0-9_]+',shot['id']) or shot['id'] in ids:raise ValueError('Invalid or repeated shot id')
        ids.add(shot['id'])
        if type(shot['start']) is not int or type(shot['end']) is not int or shot['start']!=next_frame or shot['end']<shot['start']:raise ValueError('Gap, overlap, or invalid authored frame range')
        next_frame=shot['end']+1
    if next_frame-1!=manifest['duration_frames']:raise ValueError('Timeline duration does not match shots')


def identity(shot,assets,render):
    return hashlib.sha256(json.dumps({'shot':shot,'assets':assets,'render':render},sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()


def database(path):
    db=sqlite3.connect(path);db.row_factory=sqlite3.Row;db.execute('pragma journal_mode=WAL')
    db.execute('create table if not exists tasks (identity text primary key,shot_id text not null,revision text not null,start integer not null,end integer not null,state text not null default \'PLANNED\',provider_job_id text,artifact_key text,artifact_sha256 text,active integer not null default 1)')
    db.execute('create unique index if not exists provider_unique on tasks(provider_job_id) where provider_job_id is not null')
    return db


def plan(db,manifest,source_sha,chunk_frames=144):
    validate(manifest)
    if not re.fullmatch('[a-f0-9]{64}',source_sha):raise ValueError('Immutable source hash required')
    if not 1<=chunk_frames<=360:raise ValueError('Worker frame bound exceeded')
    current=[]
    with db:
        for shot in manifest['shots']:
            shot_source=shot.get('source_sha256',source_sha)
            if not re.fullmatch('[a-f0-9]{64}',shot_source):raise ValueError('Invalid per-shot source hash')
            revision=identity(shot,manifest.get('assets',{}),{'fps':24,'source_sha256':shot_source})
            for start in range(shot['start'],shot['end']+1,chunk_frames):
                end=min(shot['end'],start+chunk_frames-1)
                key=hashlib.sha256(f'{revision}:{start}:{end}:1920:1080:48'.encode()).hexdigest();current.append(key)
                db.execute('insert into tasks(identity,shot_id,revision,start,end) values(?,?,?,?,?) on conflict(identity) do update set active=1',(key,shot['id'],revision,start,end))
        # Preserve superseded records and their evidence; never erase old renders.
        db.execute('update tasks set active=0 where identity not in ('+','.join('?' for _ in current)+')',current)
    return current


def claim(db,key):
    with db:
        if db.execute("update tasks set state='SUBMITTING' where identity=? and active=1 and state='PLANNED'",(key,)).rowcount!=1:raise ValueError('Task already claimed; reconcile instead of resubmitting')


def submitted(db,key,job):
    with db:
        if db.execute("update tasks set state='IN_PROGRESS',provider_job_id=? where identity=? and state='SUBMITTING' and provider_job_id is null",(job,key)).rowcount!=1:raise ValueError('Invalid provider transition')


def complete(db,key,artifact,sha,frames):
    row=db.execute('select * from tasks where identity=?',(key,)).fetchone()
    if not row or row['state']!='IN_PROGRESS' or frames!=row['end']-row['start']+1 or not re.fullmatch('[a-f0-9]{64}',sha):raise ValueError('Incomplete/unverified render')
    if not artifact.startswith('renders/native/S1E1/'):raise ValueError('Wrong artifact namespace')
    with db:db.execute("update tasks set state='RENDERED_PENDING_QC',artifact_key=?,artifact_sha256=? where identity=?",(artifact,sha,key))


def main():
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--state',required=True);p.add_argument('--source-sha',required=True);a=p.parse_args()
    db=database(a.state);keys=plan(db,json.loads(Path(a.manifest).read_text()),a.source_sha)
    print(json.dumps({'planned_active_tasks':len(keys),'states':[dict(r) for r in db.execute('select state,count(*) as count from tasks where active=1 group by state')],'paid_submissions':0},indent=2))
if __name__=='__main__':main()
