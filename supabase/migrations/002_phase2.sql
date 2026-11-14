-- Pied Piper Phase 2: additive migration. Apply after 001_initial.sql.
-- Real accounts only. Agent-to-agent AI investigations remain limited to fictional
-- demo profiles; nothing here stores AI transcripts or interview text.
begin;

-- Ready to Connect: a paused person ("readyToConnect": false in their own profile
-- data) cannot be newly connected. Existing matches and messages are unaffected
-- because can_access_match() does not depend on eligibility. Same rules as
-- 001 otherwise; only an explicit JSON false pauses (malformed values never error).
create or replace function public.eligible_pair(a uuid,b uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare pa jsonb; pb jsonb; viewer jsonb; candidate jsonb; dimension text; i int;
begin
  if a=b or public.is_blocked(a,b) then return false; end if;
  select data into pa from public.profiles where id=a and approved;
  select data into pb from public.profiles where id=b and approved;
  if pa is null or pb is null then return false; end if;
  if pa->'readyToConnect'='false'::jsonb or pb->'readyToConnect'='false'::jsonb then return false; end if;
  for i in 1..2 loop
    if i=1 then viewer:=pa; candidate:=pb; else viewer:=pb; candidate:=pa; end if;
    if not coalesce((candidate->>'age')::int between (viewer#>>'{preferences,minAge}')::int and (viewer#>>'{preferences,maxAge}')::int,false) then return false; end if;
    if not coalesce((viewer#>'{preferences,genders}') ? (candidate->>'gender'),false) then return false; end if;
    if viewer#>>'{preferences,locationMode}'='local' and lower(trim(viewer->>'city'))<>lower(trim(candidate->>'city')) then return false; end if;
    if (viewer#>>'{preferences,strictIntent}')::boolean and viewer->>'intent'<>candidate->>'intent' then return false; end if;
    for dimension in select jsonb_array_elements_text(viewer#>'{preferences,hard}') loop
      if viewer#>>array['preferences','desired',dimension] is not null and candidate#>>array['attributes',dimension] is not null
        and viewer#>>array['preferences','desired',dimension]<>candidate#>>array['attributes',dimension] then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;

-- General weekly availability and first-date preferences. Kept OUT of profiles.data
-- because approved profiles are readable by other eligible members.
create table public.member_planning (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  availability jsonb,
  date_preferences jsonb not null default '{"budget":null,"activityTypes":[]}'::jsonb,
  -- Explicit consent to show availability + date preferences to mutual matches.
  share_availability boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint planning_shape check (
    (availability is null or (
      jsonb_typeof(availability)='object'
      and jsonb_typeof(availability->'slots')='array'
      and jsonb_array_length(availability->'slots') between 1 and 28
      and jsonb_typeof(availability->'timeZone')='string'
      and length(availability::text) < 8000))
    and jsonb_typeof(date_preferences)='object'
    and length(date_preferences::text) < 2000
  )
);

-- True when the caller and `other` share an unblocked mutual match.
create function public.shares_match_with(other uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and other<>auth.uid() and exists(
    select 1 from public.matches m
    where auth.uid() in (m.user_a,m.user_b) and other in (m.user_a,m.user_b)
      and not public.is_blocked(m.user_a,m.user_b));
$$;

create table public.date_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('coffee','restaurant','museum','walk','sport','cultural-event','shared-interest')),
  title text not null check (length(trim(title)) between 1 and 100),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- 'proposed' is never a confirmed date; only 'accepted' by the other person is.
  status text not null default 'proposed' check (status in ('proposed','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '6 hours')
);
create index date_proposals_match_time on public.date_proposals(match_id,created_at);

-- Only the other participant may accept/decline an open proposal. Either
-- participant may withdraw (cancel) a proposed or accepted plan.
create function public.respond_date_proposal(proposal uuid,response text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.date_proposals;
begin
  select * into p from public.date_proposals where id=proposal for update;
  if auth.uid() is null or p.id is null or not public.can_access_match(p.match_id) then raise exception 'Not authorized'; end if;
  if response in ('accepted','declined') then
    if p.status<>'proposed' or p.proposer_id=auth.uid() then raise exception 'Only the other person can answer an open proposal'; end if;
  elsif response='withdrawn' then
    if p.status not in ('proposed','accepted') then raise exception 'This proposal is closed'; end if;
  else
    raise exception 'Invalid response';
  end if;
  update public.date_proposals set status=response,updated_at=now() where id=p.id;
end;
$$;

alter table public.member_planning enable row level security;
alter table public.date_proposals enable row level security;

create policy planning_own on public.member_planning for all to authenticated
  using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy planning_match_read on public.member_planning for select to authenticated
  using(share_availability and public.shares_match_with(owner_id));
create policy proposal_read on public.date_proposals for select to authenticated
  using(public.can_access_match(match_id));
create policy proposal_insert on public.date_proposals for insert to authenticated
  with check(proposer_id=auth.uid() and status='proposed' and public.can_access_match(match_id));

grant select,insert,update,delete on public.member_planning to authenticated;
grant select,insert on public.date_proposals to authenticated;
revoke all on function public.shares_match_with(uuid),public.respond_date_proposal(uuid,text) from public,anon;
grant execute on function public.shares_match_with(uuid),public.respond_date_proposal(uuid,text) to authenticated;
commit;
