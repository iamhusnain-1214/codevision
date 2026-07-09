-- Run this once in Supabase Dashboard -> SQL Editor.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username varchar(50) unique not null,
  is_premium boolean default false,
  created_at timestamp default now()
);

create table runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  module varchar(30) not null,
  algorithm varchar(50) not null,
  input_data text,
  trace_data text,
  created_at timestamp default now()
);

create table snippets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(100),
  language varchar(10),
  code text not null,
  created_at timestamp default now()
);

alter table profiles enable row level security;
alter table runs enable row level security;
alter table snippets enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own runs" on runs for all using (auth.uid() = user_id);
create policy "own snippets" on snippets for all using (auth.uid() = user_id);
