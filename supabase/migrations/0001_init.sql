-- Wonderly Tales Studio – kezdeti sémamigráció
create extension if not exists "pgcrypto";

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table series (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null, international_name text not null default '',
  bible text not null default '', age_range text not null default '4-9',
  fps int not null default 24 check (fps > 0),
  resolution text not null default '1920x1080',
  visual_style text not null default '', status text not null default 'ACTIVE'
);
create table seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  number int not null check (number > 0), title text not null,
  arc text not null default '', status text not null default 'PLANNED',
  unique(series_id, number)
);
create table episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  number int not null check (number > 0), title text not null,
  brief text not null default '', target_duration_sec int not null default 1200,
  master_language text not null default 'hu', script_version text not null default 'SCRIPT_V1',
  status text not null default 'DRAFT',
  estimated_cost numeric(10,2) not null default 0, actual_cost numeric(10,2) not null default 0,
  unique(season_id, number)
);
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  description text not null default '', variants jsonb not null default '["DAY"]',
  status text not null default 'ACTIVE'
);
create table scenes (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  number int not null check (number > 0), title text not null,
  location_id uuid references locations(id), summary text not null default '',
  unique(episode_id, number)
);
create table shots (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  shot_number int not null check (shot_number > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','SCRIPTED','READY_FOR_AUDIO','AUDIO_READY','READY_FOR_PREVIEW','PREVIEW_RENDERING','PREVIEW_READY','QC_RUNNING','QC_WARNING','QC_FAILED','APPROVED_FOR_FINAL','FINAL_RENDERING','FINAL_READY','LOCKED','CANCELLED')),
  revision int not null default 1 check (revision > 0),
  data jsonb not null,
  unique(scene_id, shot_number, revision)
);
create table characters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  type text not null check (type in ('CORE','RECURRING','GUEST')),
  species text not null default '', gender text,
  age_description text not null default '', personality text not null default '',
  visual_description text not null default '', speech_style text not null default '',
  status text not null default 'ACTIVE', thumbnail text
);
create table character_versions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  version text not null check (version ~ '^V[0-9]{3}$'),
  asset_id text not null unique, master_model_path text,
  rig_profile text not null default '', facial_profile text not null default '',
  viseme_profile text not null default '', hair_fur_meta jsonb not null default '{}',
  scale numeric not null default 1, costumes jsonb not null default '["default"]',
  expressions jsonb not null default '[]', retarget_profile text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','LOCKED')),
  locked_at timestamptz,
  unique(character_id, version)
);
create table voices (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  language text not null, provider text not null default 'mock',
  voice_id text not null, model text not null default '',
  stability numeric not null default 0.5, style numeric not null default 0,
  unique(character_id, language)
);
create table location_versions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  version text not null check (version ~ '^V[0-9]{3}$'),
  asset_id text not null unique, blender_asset_path text,
  fixed_layout boolean not null default true,
  status text not null default 'DRAFT' check (status in ('DRAFT','LOCKED')),
  locked_at timestamptz, unique(location_id, version)
);
create table props (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  description text not null default '', allowed_states jsonb not null default '["DEFAULT"]',
  status text not null default 'ACTIVE'
);
create table prop_versions (
  id uuid primary key default gen_random_uuid(),
  prop_id uuid not null references props(id) on delete cascade,
  version text not null check (version ~ '^V[0-9]{3}$'),
  asset_id text not null unique, asset_path text,
  status text not null default 'DRAFT' check (status in ('DRAFT','LOCKED')),
  locked_at timestamptz, unique(prop_id, version)
);
create table animations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null,
  category text not null, skeleton_profile text not null default '',
  source_asset text, duration_sec numeric not null default 1,
  loopable boolean not null default false,
  tags jsonb not null default '[]', compatibility jsonb not null default '[]'
);
create table dialogue_lines (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  shot_id uuid references shots(id) on delete set null,
  character_id uuid not null references characters(id),
  sequence int not null, text text not null, language text not null default 'hu',
  emotion text not null default 'neutral', audio_path text,
  unique(scene_id, sequence, language)
);
create table localized_dialogue_lines (
  id uuid primary key default gen_random_uuid(),
  dialogue_line_id uuid not null references dialogue_lines(id) on delete cascade,
  language text not null, text text not null, audio_path text,
  status text not null default 'MISSING' check (status in ('MISSING','TRANSLATION_PENDING','TRANSLATING','TEXT_READY','TTS_PENDING','TTS_READY','LIPSYNC_PENDING','GENERATING','READY','FAILED')),
  unique(dialogue_line_id, language)
);
create table assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null, version text not null, kind text not null,
  path text not null, metadata jsonb not null default '{}',
  unique(asset_code, version)
);
create table continuity_states (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  shot_id uuid references shots(id) on delete cascade,
  kind text not null check (kind in ('INPUT','OUTPUT')),
  state jsonb not null
);
create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references shots(id) on delete cascade,
  type text not null check (type in ('PREVIEW','FINAL','AUDIO','FACIAL','VFX','ASSEMBLY')),
  status text not null default 'QUEUED' check (status in ('QUEUED','CLAIMED','RUNNING','SUCCEEDED','FAILED','RETRY_WAIT','CANCELLED')),
  worker text not null default '', provider text not null default 'mock',
  attempt int not null default 0, max_attempts int not null default 3,
  input_snapshot jsonb not null, output_path text,
  gpu_seconds numeric not null default 0, cost_usd numeric(10,4) not null default 0,
  error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table qc_results (
  id uuid primary key default gen_random_uuid(),
  shot_id uuid not null references shots(id) on delete cascade,
  job_id uuid references render_jobs(id) on delete set null,
  check text not null, status text not null check (status in ('PENDING','PASS','WARNING','FAIL')),
  score numeric not null default 0, details text not null default '',
  created_at timestamptz not null default now()
);
create table cost_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id), series_id uuid references series(id),
  episode_id uuid references episodes(id), shot_id uuid references shots(id),
  job_id uuid references render_jobs(id) on delete set null,
  language text, retry boolean not null default false,
  category text not null check (category in ('GPU','TTS','STORAGE','GENVIDEO','TRANSLATION','LLM','RETRY')),
  provider text not null default 'mock', service text not null default '',
  amount_usd numeric(10,4) not null,
  quantity numeric not null default 1, unit text not null default '',
  unit_price_usd numeric(12,8), currency text not null default 'USD',
  created_at timestamptz not null default now()
);
create table translation_jobs (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  language text not null, status text not null default 'MISSING' check (status in ('MISSING','TRANSLATION_PENDING','TRANSLATING','TEXT_READY','TTS_PENDING','TTS_READY','LIPSYNC_PENDING','GENERATING','READY','FAILED')),
  provider text not null default 'mock', cost_usd numeric(10,4) not null default 0,
  unique(episode_id, language)
);
create table episode_localizations (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references episodes(id) on delete cascade,
  language text not null, status text not null default 'MISSING' check (status in ('MISSING','TRANSLATION_PENDING','TRANSLATING','TEXT_READY','TTS_PENDING','TTS_READY','LIPSYNC_PENDING','GENERATING','READY','FAILED')),
  audio_master_path text, subtitle_path text,
  unique(episode_id, language)
);

-- Indexek
create index idx_series_project on series(project_id);
create index idx_seasons_series on seasons(series_id);
create index idx_episodes_season on episodes(season_id);
create index idx_scenes_episode on scenes(episode_id);
create index idx_shots_scene on shots(scene_id);
create index idx_char_versions_char on character_versions(character_id);
create index idx_render_jobs_status on render_jobs(status);
create index idx_qc_results_shot on qc_results(shot_id);
create index idx_cost_events_episode on cost_events(episode_id);
create index idx_cost_events_created on cost_events(created_at);
create index idx_loc_lines_line on localized_dialogue_lines(dialogue_line_id);

-- RLS: bekapcsolva, authenticated Studio-user policy
alter table projects enable row level security;
alter table series enable row level security;
alter table seasons enable row level security;
alter table episodes enable row level security;
alter table scenes enable row level security;
alter table shots enable row level security;
alter table characters enable row level security;
alter table character_versions enable row level security;
alter table voices enable row level security;
alter table locations enable row level security;
alter table location_versions enable row level security;
alter table props enable row level security;
alter table prop_versions enable row level security;
alter table animations enable row level security;
alter table dialogue_lines enable row level security;
alter table localized_dialogue_lines enable row level security;
alter table assets enable row level security;
alter table continuity_states enable row level security;
alter table render_jobs enable row level security;
alter table qc_results enable row level security;
alter table cost_events enable row level security;
alter table translation_jobs enable row level security;
alter table episode_localizations enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','series','seasons','episodes','scenes','shots','characters','character_versions','voices','locations','location_versions','props','prop_versions','animations','dialogue_lines','localized_dialogue_lines','assets','continuity_states','render_jobs','qc_results','cost_events','translation_jobs','episode_localizations'] loop
    execute format('create policy studio_user_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Storage asset meta kiegészítés
alter table assets add column if not exists mime text;
alter table assets add column if not exists size bigint;
alter table assets add column if not exists sha256 text;

-- Profiles: Studio user szerepkörök (auth.users-hez kapcsolva)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'studio' check (role in ('admin','studio','viewer'))
);
alter table profiles enable row level security;
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin_all on profiles for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
