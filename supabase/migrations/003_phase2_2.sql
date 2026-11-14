-- Phase 2.2 (additive): verified venue references on date proposals, and an
-- optional Instagram username kept OUT of profiles.data.
--
-- profiles.data is readable by approved, unblocked members (001), so a hidden
-- username must not live there. member_social is owner-controlled and is
-- readable by others only while the owner keeps visibility switched on.

alter table public.date_proposals
  add column if not exists venue jsonb
  check (
    venue is null or (
      jsonb_typeof(venue) = 'object'
      and venue ? 'id' and venue ? 'name' and venue ? 'kind'
      and venue->>'kind' in ('place', 'event')
      and length(venue->>'name') between 1 and 160
      and pg_column_size(venue) <= 2048
    )
  );

create table if not exists public.member_social (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  instagram_handle text not null check (
    instagram_handle ~ '^[a-z0-9._]{1,30}$'
    and instagram_handle !~ '^\.|\.$|\.\.'
  ),
  instagram_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.member_social enable row level security;

create policy social_own on public.member_social for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Others see a username only when it is visible, the owner's profile is
-- approved, and neither person has blocked the other.
create policy social_visible_read on public.member_social for select to authenticated
  using (
    instagram_visible
    and exists (select 1 from public.profiles p where p.id = owner_id and p.approved)
    and not public.is_blocked(auth.uid(), owner_id)
  );

grant select, insert, update, delete on public.member_social to authenticated;
