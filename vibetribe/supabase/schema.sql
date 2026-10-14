-- =====================================================================
-- VibeTribe schema + Row Level Security
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Reference data: sports (add a row to add a sport) ----------
create table public.sports (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,30}$'),
  name text not null,
  emoji text not null default '🏟️',
  sort_order int not null default 100
);

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- Sample fixtures (always demo data) ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  sport text not null references public.sports(slug),
  team_a text not null,
  team_b text not null,
  competition text,
  status text not null check (status in ('upcoming','live','finished')),
  score_a text,
  score_b text,
  status_note text,
  venue text,
  starts_at timestamptz not null,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Rooms ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 200),
  sport text not null references public.sports(slug),
  match_id uuid references public.matches(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null, -- null = seeded demo room
  -- MVP is public-only. To add private rooms later: relax this check and
  -- tighten the rooms/messages/room_members policies below.
  visibility text not null default 'public' check (visibility = 'public'),
  created_at timestamptz not null default now()
);
create index rooms_sport_idx on public.rooms (sport);
create index rooms_match_idx on public.rooms (match_id);
create index rooms_created_by_idx on public.rooms (created_by, created_at desc);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);

-- ---------- Messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  moderation_status text not null default 'approved'
    check (moderation_status in ('approved','under_review','removed')),
  is_demo boolean not null default false,   -- seeded demonstration content
  demo_author text,
  constraint messages_author_chk check (
    (is_demo = false and sender_id is not null) or (is_demo = true and demo_author is not null)
  )
);
create index messages_room_created_idx on public.messages (room_id, created_at desc, id desc);

-- ---------- Reactions ----------
create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade, -- denormalised so realtime can filter
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('🔥','👏','😮','😂','😭','🤯')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);
create index message_reactions_message_idx on public.message_reactions (message_id);
create index message_reactions_room_idx on public.message_reactions (room_id);
alter table public.message_reactions replica identity full; -- DELETE events carry full old row

-- ---------- Reports ----------
create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('abuse','personal_info','spam','other')),
  details text check (details is null or char_length(details) <= 200),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);
create index message_reports_message_idx on public.message_reports (message_id);

-- ---------- Moderation: strikes, audit log, summary cache (server-only) ----------
create table public.room_strikes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  strikes int not null default 0,
  banned_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Structured decisions for debugging. NEVER stores message text or matched PII.
create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('allow','block')),
  category text not null,
  source text not null,          -- validation | rules | llm | fallback
  reason text not null,
  counts_as_strike boolean not null default false,
  created_at timestamptz not null default now()
);
create index moderation_events_room_idx on public.moderation_events (room_id, created_at desc);

create table public.catchup_cache (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  last_message_id uuid not null,
  message_count int not null,
  summary jsonb not null,
  source text not null,
  created_at timestamptz not null default now()
);

-- ---------- Helper functions ----------
create or replace function public.is_room_member(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = rid and user_id = auth.uid());
$$;

create or replace function public.is_room_banned(rid uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_strikes where room_id = rid and user_id = uid and banned_at is not null);
$$;

-- Atomically add a strike; ban + remove membership at the limit. Server (service_role) only.
create or replace function public.register_strike(p_room uuid, p_user uuid, p_max int default 3)
returns table (out_strikes int, out_banned boolean)
language plpgsql security definer set search_path = public as $$
declare s int;
begin
  insert into public.room_strikes (room_id, user_id, strikes) values (p_room, p_user, 1)
  on conflict (room_id, user_id)
  do update set strikes = public.room_strikes.strikes + 1, updated_at = now()
  returning public.room_strikes.strikes into s;

  if s >= p_max then
    update public.room_strikes set banned_at = coalesce(banned_at, now())
      where room_id = p_room and user_id = p_user;
    delete from public.room_members where room_id = p_room and user_id = p_user;
  end if;
  return query select s, (s >= p_max);
end $$;
revoke all on function public.register_strike(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.register_strike(uuid, uuid, int) to service_role;

-- ---------- Triggers ----------
-- New auth user -> profile (no email-derived names, to minimise personal data)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare n text;
begin
  n := left(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', ''), '[^A-Za-z0-9 _.-]', '', 'g'), 24);
  if char_length(btrim(n)) < 2 then n := 'Fan' || substr(new.id::text, 1, 4); end if;
  insert into public.profiles (id, display_name) values (new.id, btrim(n));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Room creator automatically becomes its owner
create or replace function public.add_room_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.room_members (room_id, user_id, role) values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_room_created after insert on public.rooms
  for each row execute function public.add_room_owner();

-- 3 distinct reporters hide a message pending review
create or replace function public.on_report_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter_id) from public.message_reports where message_id = new.message_id) >= 3 then
    update public.messages set moderation_status = 'under_review'
      where id = new.message_id and moderation_status = 'approved';
  end if;
  return new;
end $$;
create trigger on_report_created after insert on public.message_reports
  for each row execute function public.on_report_created();

-- ---------- Public aggregate view (counts only, no private data) ----------
create or replace view public.room_stats with (security_invoker = false) as
select
  r.id as room_id,
  (select count(*) from public.room_members m where m.room_id = r.id)::int as member_count,
  (select count(*) from public.messages x
     where x.room_id = r.id and x.moderation_status = 'approved'
       and x.created_at > now() - interval '24 hours')::int as recent_messages,
  (select max(x.created_at) from public.messages x where x.room_id = r.id) as last_message_at
from public.rooms r
where r.visibility = 'public';
grant select on public.room_stats to anon, authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.sports            enable row level security;
alter table public.profiles          enable row level security;
alter table public.matches           enable row level security;
alter table public.rooms             enable row level security;
alter table public.room_members      enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reports   enable row level security;
alter table public.room_strikes      enable row level security;
alter table public.moderation_events enable row level security;
alter table public.catchup_cache     enable row level security;

-- Reference data is world-readable, never client-writable
create policy sports_read  on public.sports  for select using (true);
create policy matches_read on public.matches for select using (true);

-- Profiles: signed-in users can read names; you can only edit your own row
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Rooms: public rooms are readable; creators manage their own
create policy rooms_read on public.rooms for select using (visibility = 'public');
create policy rooms_insert on public.rooms for insert to authenticated
  with check (
    created_by = auth.uid() and visibility = 'public'
    and (match_id is null or exists (
      select 1 from public.matches m where m.id = rooms.match_id and m.sport = rooms.sport))
  );
create policy rooms_update_owner on public.rooms for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid() and visibility = 'public');
create policy rooms_delete_owner on public.rooms for delete to authenticated
  using (created_by = auth.uid());

-- Membership: see your own rooms' members; join public rooms as yourself unless banned; leave any time
create policy members_read on public.room_members for select to authenticated
  using (user_id = auth.uid() or public.is_room_member(room_id));
create policy members_join on public.room_members for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'member'
    and exists (select 1 from public.rooms r where r.id = room_members.room_id and r.visibility = 'public')
    and not public.is_room_banned(room_members.room_id, auth.uid())
  );
create policy members_leave on public.room_members for delete to authenticated
  using (user_id = auth.uid());

-- Messages: members can READ. There is deliberately NO insert/update/delete policy:
-- the only write path is the server route, which moderates first (service_role bypasses RLS).
create policy messages_read on public.messages for select to authenticated
  using (public.is_room_member(room_id));
revoke insert, update, delete on public.messages from anon, authenticated;

-- Reactions: members react as themselves, inside the message's own room
create policy reactions_read on public.message_reactions for select to authenticated
  using (public.is_room_member(room_id));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_room_member(room_id)
    and exists (select 1 from public.messages m
                where m.id = message_reactions.message_id and m.room_id = message_reactions.room_id)
  );
create policy reactions_delete_own on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Reports: members report other people's real messages; you only see your own reports
create policy reports_insert on public.message_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.messages m
                where m.id = message_reports.message_id and public.is_room_member(m.room_id)
                  and m.is_demo = false and m.sender_id is distinct from auth.uid())
  );
create policy reports_read_own on public.message_reports for select to authenticated
  using (reporter_id = auth.uid());

-- Strikes: you can see your own count; only the server writes
create policy strikes_read_own on public.room_strikes for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.room_strikes from anon, authenticated;

-- Moderation log + summary cache: no policies = invisible to clients (service_role only)
revoke all on public.moderation_events from anon, authenticated;
revoke all on public.catchup_cache from anon, authenticated;

-- ---------- Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
