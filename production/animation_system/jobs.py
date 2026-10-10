"""Durable SQLite queue: atomic claim, leases, bounded retries and content cache."""
import json, sqlite3, time, uuid
from contextlib import contextmanager
from pathlib import Path
from .spec import canonical, digest

class RenderQueue:
 def __init__(self,path):
  self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True)
  with self.connect() as db:
   db.executescript('''PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
      lease_until REAL, token TEXT, next_attempt REAL NOT NULL DEFAULT 0,
      output TEXT, output_sha256 TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, job TEXT,
      at REAL NOT NULL, status TEXT NOT NULL, detail TEXT);
   ''')
 @contextmanager
 def connect(self):
  db=sqlite3.connect(self.path,timeout=30);db.row_factory=sqlite3.Row;db.execute('PRAGMA synchronous=FULL')
  try:
   with db:yield db
  finally:db.close()
 def enqueue(self,jobs):
  with self.connect() as db:
   for job in jobs:
    value=canonical(job);row=db.execute('SELECT payload FROM jobs WHERE id=?',(job['id'],)).fetchone()
    if row and row['payload']!=value:raise ValueError('Immutable job id has different input')
    db.execute('INSERT OR IGNORE INTO jobs(id,payload) VALUES(?,?)',(job['id'],value))
 def claim(self,now=None,lease_seconds=1800,max_attempts=3,allowed_ids=None):
  now=time.time() if now is None else now;token=uuid.uuid4().hex
  with self.connect() as db:
   db.execute('BEGIN IMMEDIATE')
   db.execute("UPDATE jobs SET status=CASE WHEN attempts>=? THEN 'FAILED' ELSE 'PENDING' END, token=NULL, error='Worker lease expired' WHERE status='RUNNING' AND lease_until<?",(max_attempts,now))
   candidates=db.execute("SELECT * FROM jobs WHERE status='PENDING' AND next_attempt<=? AND attempts<? ORDER BY rowid",(now,max_attempts)).fetchall()
   allowed=set(allowed_ids) if allowed_ids is not None else None
   row=next((r for r in candidates if allowed is None or r['id'] in allowed),None)
   if not row:return None
   db.execute("UPDATE jobs SET status='RUNNING', attempts=attempts+1, token=?, lease_until=? WHERE id=?",(token,now+lease_seconds,row['id']))
   db.execute('INSERT INTO events(job,at,status,detail) VALUES(?,?,?,?)',(row['id'],now,'RUNNING',token))
   return {'id':row['id'],'token':token,'attempt':row['attempts']+1,'payload':json.loads(row['payload'])}
 def heartbeat(self,job,lease_seconds=1800):
  with self.connect() as db:
   if db.execute("UPDATE jobs SET lease_until=? WHERE id=? AND token=? AND status='RUNNING'",(time.time()+lease_seconds,job['id'],job['token'])).rowcount!=1:raise RuntimeError('Lost job lease')
 def finish(self,job,output,verified):
  if not verified.get('decoded') or verified.get('frames')!=job['payload']['frames']:raise ValueError('Unverified output cannot finish a job')
  sha=digest(output)
  with self.connect() as db:
   if db.execute("UPDATE jobs SET status='DONE', output=?, output_sha256=?, token=NULL, lease_until=NULL, error=NULL WHERE id=? AND token=? AND status='RUNNING'",(str(Path(output).resolve()),sha,job['id'],job['token'])).rowcount!=1:raise RuntimeError('Stale worker cannot finish job')
   db.execute('INSERT INTO events(job,at,status,detail) VALUES(?,?,?,?)',(job['id'],time.time(),'DONE',sha))
 def fail(self,job,error,max_attempts=3,now=None):
  now=time.time() if now is None else now;status='FAILED' if job['attempt']>=max_attempts else 'PENDING'
  with self.connect() as db:
   if db.execute("UPDATE jobs SET status=?, error=?, token=NULL, lease_until=NULL, next_attempt=? WHERE id=? AND token=? AND status='RUNNING'",(status,str(error)[:2000],now+min(60,2**job['attempt']),job['id'],job['token'])).rowcount!=1:raise RuntimeError('Stale worker cannot fail job')
   db.execute('INSERT INTO events(job,at,status,detail) VALUES(?,?,?,?)',(job['id'],now,status,str(error)[:2000]))
 def outputs(self,ordered_jobs):
  result=[]
  with self.connect() as db:
   for job in ordered_jobs:
    row=db.execute('SELECT * FROM jobs WHERE id=?',(job['id'],)).fetchone()
    if not row or row['status']!='DONE':raise RuntimeError('Assembly requires every job DONE')
    path=Path(row['output'])
    if not path.is_file() or digest(path)!=row['output_sha256']:raise RuntimeError('Cached clip changed; explicit retry required')
    result.append(path)
  return result
 def summary(self,allowed_ids=None):
  with self.connect() as db:
   if allowed_ids is None:return {row['status']:row['n'] for row in db.execute('SELECT status,count(*) n FROM jobs GROUP BY status')}
   allowed=set(allowed_ids);result={}
   for row in db.execute('SELECT id,status FROM jobs'):
    if row['id'] in allowed:result[row['status']]=result.get(row['status'],0)+1
   return result
 def recover_corrupt_outputs(self,allowed_ids=None):
  recovered=[]
  allowed=set(allowed_ids) if allowed_ids is not None else None
  with self.connect() as db:
   for row in db.execute("SELECT * FROM jobs WHERE status='DONE'").fetchall():
    if allowed is not None and row['id'] not in allowed:continue
    p=Path(row['output'])
    if not p.is_file() or digest(p)!=row['output_sha256']:
     db.execute("UPDATE jobs SET status='PENDING', attempts=0, output=NULL, output_sha256=NULL, next_attempt=0, error='Output missing or corrupt; rerender required' WHERE id=?",(row['id'],));recovered.append(row['id'])
     db.execute('INSERT INTO events(job,at,status,detail) VALUES(?,?,?,?)',(row['id'],time.time(),'PENDING','Corrupt output recovered'))
  return recovered
