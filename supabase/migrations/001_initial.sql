-- Pied Piper: real accounts only. Never insert guest fixtures or interview transcripts.
begin;
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  approved boolean generated always as ((data->>'approved')::boolean) stored,
  updated_at timestamptz not null default now(),
  constraint adult_real_profile check (
    jsonb_typeof(data)='object' and data->>'id'=id::text and data->>'fictional'='false'
    and coalesce((data->>'age')::int between 18 and 100,false)
    and length(coalesce(data->>'name','')) between 1 and 50
    and length(coalesce(data->>'city','')) between 1 and 100
    and data->>'gender' in ('woman','man','nonbinary')
    and data->>'intent' in ('long-term','life-partner','exploring')
    and jsonb_typeof(data->'approved')='boolean'
    and jsonb_typeof(data->'preferences')='object'
    and data->'blockedIds'='[]'::jsonb
  )
);
create table public.decisions (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check(decision in ('interested','pass')),
  created_at timestamptz not null default now(),
  primary key(owner_id,target_id), check(owner_id<>target_id)
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_a,user_b), check(user_a<user_b)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table public.blocks (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,target_id), check(owner_id<>target_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(), check(owner_id<>target_id)
);
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table public.compatibility_questions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  dimension text not null check(dimension in ('children','smoking','drinking','pace')),
  status text not null default 'pending' check(status in ('pending','shared','declined')),
  shared_answer text,
  created_at timestamptz not null default now(),
  unique(requester_id,subject_id,dimension),check(requester_id<>subject_id),
  check ((status='shared' and shared_answer is not null) or (status<>'shared' and shared_answer is null))
);
create index messages_match_time on public.messages(match_id,created_at);
create index decisions_target on public.decisions(target_id);
create index questions_subject on public.compatibility_questions(subject_id);
create index blocks_target on public.blocks(target_id);

create function public.is_blocked(a uuid,b uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select case when auth.uid() is null or auth.uid() not in(a,b) then true else exists(select 1 from public.blocks where (owner_id=a and target_id=b) or (owner_id=b and target_id=a)) end;
$$;
-- Mirrors hard eligibility rules in src/lib/matching.ts. Unknown attributes never count as confirmed conflicts.
create function public.eligible_pair(a uuid,b uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare pa jsonb; pb jsonb; viewer jsonb; candidate jsonb; dimension text; i int;
begin
  if a=b or public.is_blocked(a,b) then return false; end if;
  select data into pa from public.profiles where id=a and approved;
  select data into pb from public.profiles where id=b and approved;
  if pa is null or pb is null then return false; end if;
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
create function public.can_access_match(match uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.matches m where m.id=match and auth.uid() in (m.user_a,m.user_b)
    and not public.is_blocked(m.user_a,m.user_b));
$$;

alter table public.profiles enable row level security;
alter table public.decisions enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.feedback enable row level security;
alter table public.compatibility_questions enable row level security;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or (approved and not public.is_blocked(auth.uid(),id)));
create policy profile_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy decision_read on public.decisions for select to authenticated using(owner_id=auth.uid());
create policy match_read on public.matches for select to authenticated using(public.can_access_match(id));
create policy message_read on public.messages for select to authenticated using(public.can_access_match(match_id));
create policy message_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.can_access_match(match_id));
create policy block_read on public.blocks for select to authenticated using(owner_id=auth.uid());
create policy report_read on public.reports for select to authenticated using(owner_id=auth.uid());
create policy feedback_own on public.feedback for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy question_read on public.compatibility_questions for select to authenticated using(auth.uid() in(requester_id,subject_id) and not public.is_blocked(requester_id,subject_id));
create policy question_insert on public.compatibility_questions for insert to authenticated with check(
  requester_id=auth.uid() and status='pending' and shared_answer is null and public.eligible_pair(requester_id,subject_id)
  and exists(select 1 from public.profiles p where p.id=requester_id and p.data#>>array['preferences','desired',dimension] is not null)
  and exists(select 1 from public.profiles p where p.id=subject_id and p.data#>>array['attributes',dimension] is null)
);

-- Only this serialized transaction can create matches. Direct inserts into decisions/matches are forbidden.
create function public.record_decision(target uuid,choice text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare me uuid:=auth.uid(); lo uuid; hi uuid;
begin
  if me is null or me=target or choice not in ('interested','pass') then raise exception 'Invalid decision'; end if;
  lo:=least(me,target);hi:=greatest(me,target);
  perform pg_advisory_xact_lock(hashtextextended(lo::text||hi::text,0));
  if choice='interested' and not public.eligible_pair(me,target) then raise exception 'Ineligible introduction'; end if;
  insert into public.decisions(owner_id,target_id,decision) values(me,target,choice)
    on conflict(owner_id,target_id) do update set decision=excluded.decision,created_at=now();
  if choice='pass' then delete from public.matches where user_a=lo and user_b=hi;
  elsif exists(select 1 from public.decisions where owner_id=target and target_id=me and decision='interested') then
    insert into public.matches(user_a,user_b) values(lo,hi) on conflict do nothing;
  end if;
end;
$$;
create function public.block_person(target uuid,reason text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare me uuid:=auth.uid();
begin
  if me is null or me=target then raise exception 'Invalid block';end if;
  insert into public.blocks(owner_id,target_id)values(me,target)on conflict do nothing;
  if reason is not null then insert into public.reports(owner_id,target_id,reason)values(me,target,reason);end if;
end;
$$;
create function public.answer_question(question_id uuid,answer text,share boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.compatibility_questions; allowed text[];
begin
  select * into q from public.compatibility_questions where id=question_id for update;
  if auth.uid() is null or q.id is null or q.subject_id<>auth.uid() or q.status<>'pending' or public.is_blocked(q.requester_id,q.subject_id) then raise exception 'Not authorized';end if;
  if share then
    allowed:=case q.dimension when 'children' then array['yes','no','open'] when 'smoking' then array['yes','no'] when 'drinking' then array['socially','no','often'] when 'pace' then array['active','balanced','quiet'] end;
    if answer is null or not answer=any(allowed) then raise exception 'Invalid answer';end if;
    -- Consent applies to this profile attribute. Private transcripts are never stored.
    update public.profiles set data=jsonb_set(data,array['attributes',q.dimension],to_jsonb(answer)),updated_at=now() where id=q.subject_id;
    update public.compatibility_questions set status='shared',shared_answer=answer where id=q.id;
  else
    update public.compatibility_questions set status='declined',shared_answer=null where id=q.id;
  end if;
end;
$$;
create function public.delete_my_data() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated';end if;
  delete from public.profiles where id=auth.uid();
end;
$$;

-- Explicit grants: never depend on permissive default privileges.
revoke all on all tables in schema public from anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select on public.decisions,public.matches,public.blocks,public.reports to authenticated;
grant select,insert on public.messages,public.compatibility_questions to authenticated;
grant select,insert,update,delete on public.feedback to authenticated;
revoke all on function public.is_blocked(uuid,uuid),public.eligible_pair(uuid,uuid),public.can_access_match(uuid),public.record_decision(uuid,text),public.block_person(uuid,text),public.answer_question(uuid,text,boolean),public.delete_my_data() from public,anon;
grant execute on function public.is_blocked(uuid,uuid),public.eligible_pair(uuid,uuid),public.can_access_match(uuid),public.record_decision(uuid,text),public.block_person(uuid,text),public.answer_question(uuid,text,boolean),public.delete_my_data() to authenticated;
commit;
