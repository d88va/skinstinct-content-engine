create extension if not exists pgcrypto;

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  telegram_message_id bigint not null,
  telegram_chat_id bigint not null,
  raw_text text not null,
  status text not null default 'pending' check (status in ('pending', 'scored', 'rejected', 'drafted', 'error')),
  score numeric,
  score_reason text,
  keywords jsonb,
  created_at timestamptz not null default now()
);

alter table notes drop constraint if exists notes_status_check;
alter table notes add constraint notes_status_check check (status in ('pending', 'scored', 'rejected', 'drafted', 'error'));

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  content text not null,
  news_angle text,
  model text not null,
  telegram_message_id bigint,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists voice_skill (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  category text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notes_status on notes(status);
create index if not exists idx_drafts_telegram_message_id on drafts(telegram_message_id);
create index if not exists idx_drafts_status on drafts(status);
