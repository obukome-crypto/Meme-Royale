-- Meme Royale database schema for Supabase.
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- Run it once on a fresh project. Then run seed.sql to add example data.

-- ============================================================
-- 1. PROFILES (one row per logged-in user, linked to Supabase auth)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  wins int not null default 0,
  people_champ_wins int not null default 0,
  badges text[] not null default '{}',
  strikes int not null default 0,          -- reports that were upheld
  timeout_until timestamptz,               -- posting blocked until this time (null = no timeout)
  created_at timestamptz not null default now()
);

-- Make a profile automatically when someone signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, 'player_' || substr(new.id::text, 1, 8));
  insert into streaks (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2. DAILY TEMPLATES (one meme per day, same for everyone)
-- ============================================================
create table if not exists daily_templates (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,                -- the calendar day this template is for
  title text not null,
  image_url text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. CAPTIONS (max 2 per user per template, max 8 words each)
-- ============================================================
create table if not exists captions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references daily_templates(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  slot int not null check (slot in (1, 2)),
  text text not null check (char_length(text) between 1 and 200),
  eligible boolean not null default false, -- true once the author has voted enough
  flagged boolean not null default false,  -- set by the moderation hook
  hidden boolean not null default false,   -- hidden from the vote pool (flagged or reported)
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (template_id, user_id, slot)      -- enforces the "2 captions per day" limit
);

-- Enforce max 8 words at the database level too (the app checks it first)
alter table captions drop constraint if exists captions_max_8_words;
alter table captions add constraint captions_max_8_words
  check (array_length(regexp_split_to_array(trim(text), '\s+'), 1) <= 8);

-- ============================================================
-- 4. VOTES (head-to-head: one row per vote, winner beats loser)
-- ============================================================
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references daily_templates(id) on delete cascade,
  voter_id uuid not null references profiles(id) on delete cascade,
  winner_caption_id uuid not null references captions(id) on delete cascade,
  loser_caption_id uuid not null references captions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (winner_caption_id <> loser_caption_id)
);
create index if not exists votes_template_idx on votes (template_id);
create index if not exists votes_voter_idx on votes (voter_id, template_id);

-- ============================================================
-- 5. ELO RATINGS (one row per caption, updated after every vote)
-- ============================================================
create table if not exists elo_ratings (
  caption_id uuid primary key references captions(id) on delete cascade,
  template_id uuid not null references daily_templates(id) on delete cascade,
  rating int not null default 1500,
  raw_votes int not null default 0,        -- plain count of wins, used for "people's champ"
  matches int not null default 0
);
create index if not exists elo_template_idx on elo_ratings (template_id, rating desc);

-- ============================================================
-- 6. STREAKS (consecutive days a user submitted and voted)
-- ============================================================
create table if not exists streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_day date
);

-- ============================================================
-- 7. REPORTS (community flags on captions)
-- ============================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  caption_id uuid not null references captions(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (caption_id, reporter_id)         -- one report per person per caption
);

-- ============================================================
-- 8. DAILY RESULTS (the winner and people's champ for each day)
-- ============================================================
create table if not exists daily_results (
  template_id uuid primary key references daily_templates(id) on delete cascade,
  winner_caption_id uuid references captions(id),
  people_champ_caption_id uuid references captions(id),
  finalized_at timestamptz not null default now()
);

-- ============================================================
-- 9. PUSH SUBSCRIPTIONS (ready for notifications later)
-- ============================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Placeholder moderation hook. Returns true if the text should be flagged.
-- Replace the word list, or call an AI moderation check from an Edge Function later.
create or replace function moderate_text(p_text text) returns boolean
language plpgsql immutable as $$
declare
  blocked text[] := array['replace_me_bad_word_1', 'replace_me_bad_word_2'];
  w text;
begin
  foreach w in array blocked loop
    if lower(p_text) ~ ('\m' || w || '\M') then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- Runs on every new caption: flags it if the placeholder moderation says so
create or replace function check_new_caption() returns trigger
language plpgsql as $$
begin
  if moderate_text(new.text) then
    new.flagged := true;
    new.hidden := true;
  end if;
  return new;
end;
$$;

drop trigger if exists captions_moderation on captions;
create trigger captions_moderation
  before insert on captions
  for each row execute function check_new_caption();

-- Has this user voted enough today to unlock their captions?
create or replace function unlock_captions_if_ready(p_user uuid, p_template uuid) returns void
language plpgsql security definer as $$
declare
  vote_count int;
begin
  select count(*) into vote_count from votes
  where voter_id = p_user and template_id = p_template;

  if vote_count >= 5 then   -- keep in sync with MIN_VOTES_TO_UNLOCK in src/config.js
    update captions set eligible = true
    where user_id = p_user and template_id = p_template;
  end if;
end;
$$;

-- ============================================================
-- GAME ACTIONS (the app calls these with supabase.rpc)
-- ============================================================

-- Returns one random pair of captions the current user has NOT voted on yet.
-- Rules: not your own caption, both eligible, not hidden, not already voted on.
create or replace function get_next_pair(p_template uuid)
returns table (caption_a uuid, text_a text, caption_b uuid, text_b text)
language sql security definer as $$
  with pool as (
    select c.id, c.text
    from captions c
    where c.template_id = p_template
      and c.eligible
      and not c.hidden
      and c.user_id <> auth.uid()
      and not exists (
        select 1 from votes v
        where v.voter_id = auth.uid()
          and v.template_id = p_template
          and (v.winner_caption_id = c.id or v.loser_caption_id = c.id)
      )
  ),
  picked as (
    select id, text from pool order by random() limit 2
  )
  select
    (select id from picked order by id limit 1),
    (select text from picked order by id limit 1),
    (select id from picked order by id desc limit 1),
    (select text from picked order by id desc limit 1)
  where (select count(*) from picked) = 2;
$$;

-- Records one head-to-head vote and updates both Elo ratings.
-- Also checks the voter's streak and unlocks their captions when they hit the vote count.
create or replace function cast_vote(p_winner uuid, p_loser uuid)
returns void
language plpgsql security definer as $$
declare
  me uuid := auth.uid();
  tmpl uuid;
  w_owner uuid;
  l_owner uuid;
  rw int; rl int;
  ew numeric; el numeric;
  new_w int; new_l int;
begin
  select template_id, user_id into tmpl, w_owner from captions where id = p_winner;
  select user_id into l_owner from captions where id = p_loser;

  if tmpl is null or l_owner is null then
    raise exception 'caption not found';
  end if;
  if w_owner = me or l_owner = me then
    raise exception 'you cannot vote on your own caption';
  end if;
  if exists (select 1 from profiles where id = me and timeout_until > now()) then
    raise exception 'you are in a timeout';
  end if;
  if exists (select 1 from votes where voter_id = me and template_id = tmpl
             and ((winner_caption_id = p_winner and loser_caption_id = p_loser)
               or (winner_caption_id = p_loser and loser_caption_id = p_winner))) then
    raise exception 'you already voted on this pair';
  end if;

  insert into votes (template_id, voter_id, winner_caption_id, loser_caption_id)
  values (tmpl, me, p_winner, p_loser);

  -- make sure both captions have an Elo row
  insert into elo_ratings (caption_id, template_id) values (p_winner, tmpl), (p_loser, tmpl)
  on conflict (caption_id) do nothing;

  select rating into rw from elo_ratings where caption_id = p_winner;
  select rating into rl from elo_ratings where caption_id = p_loser;

  -- standard Elo math (K = 32)
  ew := 1 / (1 + power(10, (rl - rw) / 400.0));
  el := 1 / (1 + power(10, (rw - rl) / 400.0));
  new_w := round(rw + 32 * (1 - ew));
  new_l := round(rl + 32 * (0 - el));

  update elo_ratings set rating = new_w, raw_votes = raw_votes + 1, matches = matches + 1
    where caption_id = p_winner;
  update elo_ratings set rating = new_l, matches = matches + 1
    where caption_id = p_loser;

  perform unlock_captions_if_ready(me, tmpl);
end;
$$;

-- Lets a user report a caption. Repeat offenders get a timeout.
create or replace function report_caption(p_caption uuid, p_reason text)
returns void
language plpgsql security definer as $$
declare
  owner uuid;
  reports_now int;
begin
  select user_id into owner from captions where id = p_caption;
  if owner = auth.uid() then
    raise exception 'you cannot report your own caption';
  end if;

  insert into reports (caption_id, reporter_id, reason)
  values (p_caption, auth.uid(), p_reason)
  on conflict do nothing;

  select count(*) into reports_now from reports where caption_id = p_caption;
  update captions set report_count = reports_now where id = p_caption;

  -- 3 or more reports hides the caption from the vote pool
  if reports_now >= 3 then
    update captions set hidden = true where id = p_caption;
    -- the author gets a strike; repeat offenders are put in a timeout
    update profiles set strikes = strikes + 1 where id = owner;
    update profiles set timeout_until = now() + interval '24 hours'
      where id = owner and strikes >= 3;
  end if;
end;
$$;

-- ============================================================
-- DAILY ROLLOVER (runs at midnight via pg_cron, see below)
-- ============================================================
-- What it does, in order:
--   1. Finalize today's round: crown the highest Elo caption (winner)
--      and the most raw votes caption (people's champ).
--   2. Update winner and people's champ stats and badges.
--   3. Update streaks for users who submitted AND voted today.
--   4. Mark today's template finished, and make tomorrow's template live.
create or replace function daily_rollover() returns void
language plpgsql security definer as $$
declare
  today_t uuid;
  winner_c uuid;
  champ_c uuid;
  winner_user uuid;
  champ_user uuid;
begin
  -- 1. find the template that is live right now
  select id into today_t from daily_templates where status = 'live' limit 1;
  if today_t is null then
    -- nothing to finalize; just make tomorrow live below
    null;
  else
    -- winner = highest Elo among eligible, visible captions
    select e.caption_id into winner_c
    from elo_ratings e join captions c on c.id = e.caption_id
    where e.template_id = today_t and c.eligible and not c.hidden
    order by e.rating desc, e.raw_votes desc limit 1;

    -- people's champ = most raw votes
    select e.caption_id into champ_c
    from elo_ratings e join captions c on c.id = e.caption_id
    where e.template_id = today_t and c.eligible and not c.hidden
    order by e.raw_votes desc, e.rating desc limit 1;

    insert into daily_results (template_id, winner_caption_id, people_champ_caption_id)
    values (today_t, winner_c, champ_c)
    on conflict (template_id) do update
      set winner_caption_id = excluded.winner_caption_id,
          people_champ_caption_id = excluded.people_champ_caption_id;

    -- 2. stats and badges
    if winner_c is not null then
      select user_id into winner_user from captions where id = winner_c;
      update profiles set wins = wins + 1,
        badges = case when 'first_win' = any(badges) then badges else array_append(badges, 'first_win') end
        where id = winner_user;
    end if;
    if champ_c is not null then
      select user_id into champ_user from captions where id = champ_c;
      update profiles set people_champ_wins = people_champ_wins + 1,
        badges = case when 'people_champ' = any(badges) then badges else array_append(badges, 'people_champ') end
        where id = champ_user;
    end if;

    -- 3. streaks: a user is active today if they submitted a caption AND cast a vote
    update streaks s set
      current_streak = case
        when s.last_active_day = today_t_day() - 1 then s.current_streak + 1
        else 1 end,
      longest_streak = greatest(s.longest_streak,
        case when s.last_active_day = today_t_day() - 1 then s.current_streak + 1 else 1 end),
      last_active_day = today_t_day()
    where exists (select 1 from captions c where c.user_id = s.user_id and c.template_id = today_t)
      and exists (select 1 from votes v where v.voter_id = s.user_id and v.template_id = today_t);

    -- users who missed today reset to 0
    update streaks s set current_streak = 0
    where s.last_active_day is distinct from today_t_day()
      and not exists (select 1 from captions c where c.user_id = s.user_id and c.template_id = today_t);

    -- 4. close today
    update daily_templates set status = 'finished' where id = today_t;
  end if;

  -- make the next scheduled template live (the one for today's date, or the next one)
  update daily_templates set status = 'live'
  where id = (
    select id from daily_templates
    where status = 'scheduled' and day <= current_date
    order by day asc limit 1
  );
end;
$$;

-- Small helper: the calendar day of the currently live template
create or replace function today_t_day() returns date
language sql stable as $$
  select coalesce((select day from daily_templates where status = 'live' limit 1), current_date);
$$;

-- ============================================================
-- SCHEDULE THE ROLLOVER (midnight UTC, every day)
-- ============================================================
-- Supabase > Database > Extensions: enable "pg_cron", then run this line.
-- Change '0 0 * * *' if you want a different time (cron format: minute hour day month weekday).
-- select cron.schedule('capbattle-daily-rollover', '0 0 * * *', $$select daily_rollover();$$);

-- ============================================================
-- SECURITY (Row Level Security: who can read or write what)
-- ============================================================
alter table profiles enable row level security;
alter table daily_templates enable row level security;
alter table captions enable row level security;
alter table votes enable row level security;
alter table elo_ratings enable row level security;
alter table streaks enable row level security;
alter table reports enable row level security;
alter table daily_results enable row level security;
alter table push_subscriptions enable row level security;

-- Anyone logged in can read profiles, templates, elo (public game data)
create policy "profiles readable" on profiles for select to authenticated using (true);
create policy "profiles update own" on profiles for update to authenticated using (auth.uid() = id);
create policy "templates readable" on daily_templates for select to authenticated using (true);
create policy "elo readable" on elo_ratings for select to authenticated using (true);
create policy "results readable" on daily_results for select to authenticated using (true);
create policy "streaks readable" on streaks for select to authenticated using (true);

-- Captions: anyone logged in can read visible captions; you can write your own
create policy "captions readable" on captions for select to authenticated
  using (not hidden or user_id = auth.uid());
create policy "captions insert own" on captions for insert to authenticated
  with check (user_id = auth.uid());

-- Votes: you can only see and write your own votes (counts are hidden from others)
create policy "votes own read" on votes for select to authenticated using (voter_id = auth.uid());

-- Reports: you can file one yourself and see only your own
create policy "reports own" on reports for all to authenticated
  using (reporter_id = auth.uid()) with check (reporter_id = auth.uid());

-- Push subscriptions: private to each user
create policy "push own" on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
