-- SETU v5 Database Schema
-- Run in: supabase.com → SQL Editor → Run

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text, name text, plan text default 'free', created_at timestamptz default now()
);
create table public.memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade,
  platform text not null, query text not null, summary text,
  topic text default 'general', lang text default 'en',
  intent text default 'explain', tok_saved int default 0,
  created_at timestamptz default now()
);
create table public.facts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade,
  concept text not null, value text not null, updated_at timestamptz default now(),
  unique(user_id, concept)
);
create table public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade,
  key_hash text unique not null, key_prefix text not null,
  app_name text default 'My App', plan text default 'free',
  requests int default 0, monthly_limit int default 10000,
  created_at timestamptz default now(), last_used timestamptz
);
alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.facts enable row level security;
alter table public.api_keys enable row level security;
create policy "own" on public.profiles for all using (auth.uid() = id);
create policy "own" on public.memories for all using (auth.uid() = user_id);
create policy "own" on public.facts for all using (auth.uid() = user_id);
create policy "own" on public.api_keys for all using (auth.uid() = user_id);
create or replace function public.handle_new_user() returns trigger as $$
begin insert into public.profiles(id,email,name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1))); return new; end;
$$ language plpgsql security definer;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create index idx_memories_user on public.memories(user_id, created_at desc);
create index idx_memories_topic on public.memories(user_id, topic);
create index idx_facts_user on public.facts(user_id);
