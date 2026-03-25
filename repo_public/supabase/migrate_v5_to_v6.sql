-- SETU v5 → v6 Migration
-- Run this in: supabase.com → SQL Editor → Run
--
-- What this does:
--   - Changes user_id from UUID foreign key to TEXT in memories, facts, api_keys
--   - Adds rate_limits table (new in v6)
--   - Adds anon_uid column to profiles
--   - Disables RLS on data tables (API server handles auth now)
--   - Safe to run even if already on v6 (uses IF EXISTS / IF NOT EXISTS)

-- ── Step 1: Add anon_uid to profiles if not already there ──
alter table public.profiles
  add column if not exists anon_uid text;

-- ── Step 2: Drop foreign key constraint on memories.user_id ──
-- First find and drop the constraint, then change the column type to text
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'memories'
    and kcu.column_name = 'user_id'
    and tc.constraint_type = 'FOREIGN KEY';
  if constraint_name is not null then
    execute 'alter table public.memories drop constraint ' || constraint_name;
  end if;
end $$;

alter table public.memories
  alter column user_id type text using user_id::text;

-- ── Step 3: Drop foreign key constraint on facts.user_id ──
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'facts'
    and kcu.column_name = 'user_id'
    and tc.constraint_type = 'FOREIGN KEY';
  if constraint_name is not null then
    execute 'alter table public.facts drop constraint ' || constraint_name;
  end if;
end $$;

alter table public.facts
  alter column user_id type text using user_id::text;

-- ── Step 4: Drop foreign key on api_keys.user_id if it exists ──
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
  where tc.table_name = 'api_keys'
    and kcu.column_name = 'user_id'
    and tc.constraint_type = 'FOREIGN KEY';
  if constraint_name is not null then
    execute 'alter table public.api_keys drop constraint ' || constraint_name;
  end if;
end $$;

alter table public.api_keys
  alter column user_id type text using user_id::text;

-- Also make user_id nullable on api_keys (anon keys have no registered user)
alter table public.api_keys
  alter column user_id drop not null;

-- Add daily_limit column if not present
alter table public.api_keys
  add column if not exists daily_limit int default 200;

-- ── Step 5: Create rate_limits table (new in v6) ──
create table if not exists public.rate_limits (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  date       date not null default current_date,
  count      int  not null default 0,
  unique(user_id, date)
);

-- ── Step 6: Add missing indexes ──
create index if not exists idx_memories_user    on public.memories(user_id, created_at desc);
create index if not exists idx_memories_topic   on public.memories(user_id, topic);
create index if not exists idx_facts_user       on public.facts(user_id);
create index if not exists idx_rate_limits_user on public.rate_limits(user_id, date);

-- ── Step 7: Disable RLS on data tables ──
-- API server uses service_role key and enforces user_id in application logic
alter table public.memories    disable row level security;
alter table public.facts       disable row level security;
alter table public.rate_limits disable row level security;
alter table public.api_keys    disable row level security;

-- Keep RLS on profiles (auth users only)
alter table public.profiles enable row level security;

-- ── Step 8: Verify ──
select
  'memories'   as table_name, data_type from information_schema.columns
  where table_name='memories'   and column_name='user_id'
union all
select
  'facts'      as table_name, data_type from information_schema.columns
  where table_name='facts'      and column_name='user_id'
union all
select
  'api_keys'   as table_name, data_type from information_schema.columns
  where table_name='api_keys'   and column_name='user_id';

-- Expected output: all three rows should show data_type = 'text'
-- If you see 'uuid' for any row, something went wrong — check the error above
