-- Industrial Engineering Academy — initial schema.
-- Reference data (curriculum, skills, challenge definitions) is world-readable and
-- written only with the service role. Learner data is owned by auth.users and
-- protected by row-level security.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  current_tier text not null default 'tier-1' check (current_tier in ('tier-1', 'tier-2')),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- reference: curriculum
create table public.learning_pathways (
  id text primary key,
  title text not null,
  subtitle text not null,
  description text not null,
  sort_order int not null
);

create table public.curriculum_modules (
  id text primary key,
  pathway_id text not null references public.learning_pathways (id),
  sort_order int not null,
  title text not null,
  summary text not null,
  status text not null check (status in ('available', 'planned'))
);

create table public.lessons (
  slug text primary key,
  module_id text not null references public.curriculum_modules (id),
  title text not null,
  content_version text not null,
  review_status text not null check (review_status in ('draft', 'pending-technical-review', 'reviewed')),
  estimated_minutes int not null check (estimated_minutes > 0),
  -- Full lesson document (sections, knowledge check) validated by the app's Zod schema.
  content jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.skills (
  id text primary key,
  name text not null,
  tier text not null,
  category text not null,
  description text not null
);

create table public.skill_prerequisites (
  skill_id text not null references public.skills (id) on delete cascade,
  prerequisite_id text not null references public.skills (id) on delete cascade,
  primary key (skill_id, prerequisite_id),
  check (skill_id <> prerequisite_id)
);

create table public.challenge_definitions (
  id text not null,
  version int not null check (version > 0),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  primary key (id, version)
);

create table public.achievements (
  id text primary key,
  title text not null,
  description text not null
);

-- ------------------------------------------------------------ learner data
create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_slug text not null references public.lessons (slug),
  status text not null check (status in ('in-progress', 'completed')),
  content_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_slug)
);

-- Knowledge checks and other assessments.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_slug text not null references public.lessons (slug),
  content_version text not null,
  score numeric(5, 4) not null check (score between 0 and 1),
  passed boolean not null,
  taken_at timestamptz not null default now()
);

-- Attempts are immutable evidence: insert + select only for learners.
create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id text not null,
  definition_version int not null,
  seed bigint not null check (seed >= 0),
  mode text not null check (mode in ('guided', 'independent', 'timed', 'mastery')),
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  duration_seconds numeric not null check (duration_seconds >= 0),
  hints_used int not null default 0,
  passed boolean not null,
  score int not null,
  safety_score int not null,
  safety_passed boolean not null,
  -- Full action log + answers so the server can replay and verify the result.
  actions jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  diagnosis text,
  wrong_diagnoses int not null default 0,
  safety_codes text[] not null default '{}',
  -- Set by a trusted server-side replay; client-reported results are unverified until then.
  verified_at timestamptz,
  foreign key (challenge_id, definition_version) references public.challenge_definitions (id, version)
);
create index challenge_attempts_user_idx on public.challenge_attempts (user_id, submitted_at desc);

-- Derived cache of the evidence model; recomputed from attempts.
create table public.skill_mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null references public.skills (id),
  level text not null check (level in ('not-started', 'developing', 'proficient', 'mastered')),
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.saved_circuits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  preset text not null,
  bench jsonb not null,
  saved_at timestamptz not null default now()
);
create index saved_circuits_user_idx on public.saved_circuits (user_id, saved_at desc);

-- ----------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.learning_pathways enable row level security;
alter table public.curriculum_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.skills enable row level security;
alter table public.skill_prerequisites enable row level security;
alter table public.challenge_definitions enable row level security;
alter table public.achievements enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assessments enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.skill_mastery enable row level security;
alter table public.user_achievements enable row level security;
alter table public.saved_circuits enable row level security;

-- Reference data: readable by everyone, writable only by the service role (which bypasses RLS).
create policy "reference read" on public.learning_pathways for select using (true);
create policy "reference read" on public.curriculum_modules for select using (true);
create policy "reference read" on public.lessons for select using (true);
create policy "reference read" on public.skills for select using (true);
create policy "reference read" on public.skill_prerequisites for select using (true);
create policy "reference read" on public.challenge_definitions for select using (true);
create policy "reference read" on public.achievements for select using (true);

-- Profiles.
create policy "own profile read" on public.profiles for select using ((select auth.uid()) = id);
create policy "own profile insert" on public.profiles for insert with check ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Lesson progress.
create policy "own lesson progress read" on public.lesson_progress for select using ((select auth.uid()) = user_id);
create policy "own lesson progress insert" on public.lesson_progress for insert with check ((select auth.uid()) = user_id);
create policy "own lesson progress update" on public.lesson_progress for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Assessments and attempts: append-only evidence.
create policy "own assessments read" on public.assessments for select using ((select auth.uid()) = user_id);
create policy "own assessments insert" on public.assessments for insert with check ((select auth.uid()) = user_id);
create policy "own attempts read" on public.challenge_attempts for select using ((select auth.uid()) = user_id);
create policy "own attempts insert" on public.challenge_attempts for insert with check ((select auth.uid()) = user_id and verified_at is null);

-- Mastery and achievements are derived server-side; learners can only read them.
create policy "own mastery read" on public.skill_mastery for select using ((select auth.uid()) = user_id);
create policy "own achievements read" on public.user_achievements for select using ((select auth.uid()) = user_id);

-- Saved circuits: full ownership.
create policy "own circuits read" on public.saved_circuits for select using ((select auth.uid()) = user_id);
create policy "own circuits insert" on public.saved_circuits for insert with check ((select auth.uid()) = user_id);
create policy "own circuits update" on public.saved_circuits for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own circuits delete" on public.saved_circuits for delete using ((select auth.uid()) = user_id);

-- Create a profile automatically for new users.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
