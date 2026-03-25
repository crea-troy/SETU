-- SETU v6 Database Schema
-- Run in: supabase.com → SQL Editor → Run
--
-- Key change from v5: anonymous UUID users no longer need auth.users row.
-- user_id is now TEXT (stores "setu_<uuid>") not a UUID foreign key to auth.users.
-- Registered users can optionally link their anonymous UUID to an auth account later.

-- ── Profiles (optional — only for registered users) ──
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text,
  name       text,
  plan       text default 'free',
  anon_uid   text,           -- links to their anonymous UUID if they upgrade
  created_at timestamptz default now()
);

-- ── Memories (text user_id — works for anon UUIDs AND auth UUIDs) ──
create table if not exists public.memories (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,  -- "setu_<uuid>" for anon, auth UUID string for registered
  platform   text not null,
  query      text not null,
  summary    text,
  topic      text default 'general',
  lang       text default 'en',
  intent     text default 'explain',
  tok_saved  int  default 0,
  created_at timestamptz default now()
);

-- ── Facts ──
create table if not exists public.facts (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  concept    text not null,
  value      text not null,
  updated_at timestamptz default now(),
  unique(user_id, concept)
);

-- ── API keys ──
create table if not exists public.api_keys (
  id          uuid default gen_random_uuid() primary key,
  user_id     text,           -- nullable — anon keys have no registered user
  key_hash    text unique not null,
  key_prefix  text not null,
  app_name    text default 'SETU Extension',
  plan        text default 'free',
  daily_limit int  default 200,
  created_at  timestamptz default now(),
  last_used   timestamptz
);

-- ── Rate limits (daily counters per user) ──
create table if not exists public.rate_limits (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  date       date not null default current_date,
  count      int  not null default 0,
  unique(user_id, date)
);

-- ── Indexes ──
create index if not exists idx_memories_user    on public.memories(user_id, created_at desc);
create index if not exists idx_memories_topic   on public.memories(user_id, topic);
create index if not exists idx_facts_user       on public.facts(user_id);
create index if not exists idx_rate_limits_user on public.rate_limits(user_id, date);

-- ── RLS — disabled for anon-UUID tables (API server handles auth) ──
-- memories, facts, rate_limits are accessed server-side only via service key.
-- No need for row-level policies on these tables since the API enforces user_id.
alter table public.memories    disable row level security;
alter table public.facts       disable row level security;
alter table public.rate_limits disable row level security;
alter table public.api_keys    disable row level security;

-- ── Profiles RLS (only for registered users) ──
alter table public.profiles enable row level security;
create policy if not exists "own_profile" on public.profiles for all using (auth.uid() = id);

-- ── Auto-create profile on signup ──
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles(id, email, name)
  values(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
