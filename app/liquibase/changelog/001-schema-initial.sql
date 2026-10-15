--liquibase formatted sql

-- =============================================
-- 001 : schéma initial de la porte magique
--
-- Un PASSAGE (le trou dans la clôture) réunit deux FAMILLES. Chaque famille a
-- sa PORTE, de son côté : le passage n'est ouvert que si les deux portes sont
-- déverrouillées. Une famille commande sa porte et voit celle de l'autre.
--
-- On entre dans une famille en créant le passage (create_passage) ou par un
-- lien d'invitation (accept_invitation). Une invitation sans famille est celle
-- du voisin : elle crée la seconde famille du passage, avec sa porte.
--
-- La passerelle (la carte branchée dans chaque maison) n'a pas de compte :
-- elle se présente avec la clé de sa porte, dont la base ne garde que
-- l'empreinte SHA-256, et appelle gateway_sync() toutes les quelques secondes.
--
-- Le RLS est le seul verrou. Les écritures sensibles passent par des RPC qui
-- vérifient l'appartenance à la famille de la porte.
-- =============================================

--changeset porte:001-profiles
create table if not exists public.profiles (
    id               uuid primary key references auth.users(id) on delete cascade,
    display_name     text not null,
    -- Notifications voulues par la personne, sur tous ses appareils
    notify_requests  boolean not null default true,
    notify_neighbour boolean not null default true,
    notify_battery   boolean not null default true,
    created_at       timestamptz not null default now()
);
alter table public.profiles enable row level security;
--rollback drop table if exists public.profiles;

--changeset porte:001-fn-handle-new-user splitStatements:false
create or replace function public.handle_new_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $func$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$func$;
--rollback drop function if exists public.handle_new_user();

--changeset porte:001-trigger-handle-new-user
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
--rollback drop trigger if exists on_auth_user_created on auth.users;

--changeset porte:001-passages-families
create table if not exists public.passages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null default 'Porte magique' check (length(trim(name)) between 1 and 40),
    -- Fuseau dans lequel s'entendent les horaires
    timezone   text not null default 'Europe/Paris' check (length(timezone) between 1 and 60),
    created_at timestamptz not null default now()
);

create table if not exists public.families (
    id         uuid primary key default gen_random_uuid(),
    passage_id uuid not null references public.passages(id) on delete cascade,
    name       text not null check (length(trim(name)) between 1 and 40),
    created_at timestamptz not null default now(),
    unique (id, passage_id)
);
create index if not exists families_passage_idx on public.families (passage_id);

create table if not exists public.family_members (
    family_id  uuid not null references public.families(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    -- admin : invite et retire des membres · membre : tout le reste
    role       text not null default 'membre' check (role in ('admin', 'membre')),
    joined_at  timestamptz not null default now(),
    primary key (family_id, user_id)
);
create index if not exists family_members_user_idx on public.family_members (user_id);

alter table public.passages enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
--rollback drop table if exists public.family_members;
--rollback drop table if exists public.families;
--rollback drop table if exists public.passages;

-- Fonctions d'appartenance en SECURITY DEFINER : les policies de
-- family_members s'appuient dessus, une sous-requête directe tournerait en
-- récursion RLS.
--changeset porte:001-fn-is-passage-member splitStatements:false
create or replace function public.is_passage_member(p_passage uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1
        from public.family_members m
        join public.families f on f.id = m.family_id
        where f.passage_id = p_passage and m.user_id = auth.uid()
    )
$$;
--rollback drop function if exists public.is_passage_member(uuid);

--changeset porte:001-fn-is-family-member splitStatements:false
create or replace function public.is_family_member(p_family uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1 from public.family_members m
        where m.family_id = p_family and m.user_id = auth.uid()
    )
$$;
--rollback drop function if exists public.is_family_member(uuid);

--changeset porte:001-fn-is-family-admin splitStatements:false
create or replace function public.is_family_admin(p_family uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1 from public.family_members m
        where m.family_id = p_family and m.user_id = auth.uid() and m.role = 'admin'
    )
$$;
--rollback drop function if exists public.is_family_admin(uuid);

-- Deux comptes partagent-ils un passage ? (lecture des prénoms des deux familles)
--changeset porte:001-fn-shares-passage splitStatements:false
create or replace function public.shares_passage(p_user uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
as $$
    select exists (
        select 1
        from public.family_members mine
        join public.families fm on fm.id = mine.family_id
        join public.families ft on ft.passage_id = fm.passage_id
        join public.family_members theirs on theirs.family_id = ft.id
        where mine.user_id = auth.uid() and theirs.user_id = p_user
    )
$$;
--rollback drop function if exists public.shares_passage(uuid);

--changeset porte:001-fn-family-passage splitStatements:false
create or replace function public.family_passage(p_family uuid)
    returns uuid
    language sql
    stable
    security definer
    set search_path = public
as $$
    select passage_id from public.families where id = p_family
$$;
--rollback drop function if exists public.family_passage(uuid);

--changeset porte:001-grant-membership-fns
revoke execute on function public.is_passage_member(uuid) from public, anon;
revoke execute on function public.is_family_member(uuid) from public, anon;
revoke execute on function public.is_family_admin(uuid) from public, anon;
revoke execute on function public.shares_passage(uuid) from public, anon;
revoke execute on function public.family_passage(uuid) from public, anon;
grant execute on function public.is_passage_member(uuid) to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.shares_passage(uuid) to authenticated;
grant execute on function public.family_passage(uuid) to authenticated;
--rollback revoke execute on function public.family_passage(uuid) from authenticated;
--rollback revoke execute on function public.shares_passage(uuid) from authenticated;
--rollback revoke execute on function public.is_family_admin(uuid) from authenticated;
--rollback revoke execute on function public.is_family_member(uuid) from authenticated;
--rollback revoke execute on function public.is_passage_member(uuid) from authenticated;

--changeset porte:001-rls-profiles-families
create policy "profiles_select" on public.profiles
    for select to authenticated
    using (id = auth.uid() or public.shares_passage(id));
create policy "profiles_update" on public.profiles
    for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());

create policy "passages_select" on public.passages
    for select to authenticated using (public.is_passage_member(id));
create policy "passages_update" on public.passages
    for update to authenticated using (public.is_passage_member(id));

create policy "families_select" on public.families
    for select to authenticated using (public.is_passage_member(passage_id));
create policy "families_update" on public.families
    for update to authenticated using (public.is_family_admin(id));

-- Pas de policy d'insert : on entre par create_passage() ou accept_invitation().
-- On quitte sa famille soi-même, ou un admin vous retire.
create policy "family_members_select" on public.family_members
    for select to authenticated using (public.is_passage_member(public.family_passage(family_id)));
create policy "family_members_delete" on public.family_members
    for delete to authenticated
    using (user_id = auth.uid() or public.is_family_admin(family_id));
--rollback drop policy if exists "family_members_delete" on public.family_members;
--rollback drop policy if exists "family_members_select" on public.family_members;
--rollback drop policy if exists "families_update" on public.families;
--rollback drop policy if exists "families_select" on public.families;
--rollback drop policy if exists "passages_update" on public.passages;
--rollback drop policy if exists "passages_select" on public.passages;
--rollback drop policy if exists "profiles_update" on public.profiles;
--rollback drop policy if exists "profiles_select" on public.profiles;

-- L'id de l'invitation EST le jeton du lien (/invitation/{id}). Avec une
-- famille : on la rejoint. Sans famille : c'est l'invitation du voisin, qui
-- crée la seconde famille du passage (une seule fois).
--changeset porte:001-invitations
create table if not exists public.invitations (
    id         uuid primary key default gen_random_uuid(),
    passage_id uuid not null references public.passages(id) on delete cascade,
    family_id  uuid references public.families(id) on delete cascade,
    created_by uuid references public.profiles(id) on delete set null,
    expires_at timestamptz not null default (now() + interval '7 days'),
    created_at timestamptz not null default now()
);
create index if not exists invitations_passage_idx on public.invitations (passage_id);
alter table public.invitations enable row level security;

create policy "invitations_select" on public.invitations
    for select to authenticated using (public.is_passage_member(passage_id));
create policy "invitations_delete" on public.invitations
    for delete to authenticated
    using (created_by = auth.uid() or (family_id is not null and public.is_family_admin(family_id)));
--rollback drop table if exists public.invitations;

-- Une porte par famille.
-- - desired / desired_at : le dernier ordre donné depuis l'appli ;
-- - open_until : ouverture « pour un moment », refermée à cette heure ;
-- - lock_state, door_closed, battery_mv, last_seen_at : ce que la passerelle
--   rapporte (null tant qu'elle ne s'est jamais présentée) ;
-- - gateway_key_hash : empreinte SHA-256 (hex) de la clé de la passerelle.
--changeset porte:001-doors
create table if not exists public.doors (
    id               uuid primary key default gen_random_uuid(),
    passage_id       uuid not null,
    family_id        uuid not null unique,
    desired          text not null default 'ferme' check (desired in ('ouvert', 'ferme')),
    desired_at       timestamptz not null default now(),
    desired_by       uuid references public.profiles(id) on delete set null,
    open_until       timestamptz,
    lock_state       text check (lock_state in ('ouvert', 'ferme', 'bloque')),
    door_closed      boolean,
    battery_mv       integer check (battery_mv between 0 and 6000),
    last_seen_at     timestamptz,
    angle_closed     smallint not null default 0 check (angle_closed between 0 and 180),
    angle_open       smallint not null default 90 check (angle_open between 0 and 180),
    -- Mode montage : le servo reste en position fermée, horaires ignorés
    assembly_mode    boolean not null default false,
    gateway_key_hash text check (gateway_key_hash ~ '^[0-9a-f]{64}$'),
    updated_at       timestamptz not null default now(),
    unique (id, family_id),
    foreign key (family_id, passage_id) references public.families(id, passage_id) on delete cascade
);
create index if not exists doors_passage_idx on public.doors (passage_id);
alter table public.doors enable row level security;

create policy "doors_select" on public.doors
    for select to authenticated using (public.is_passage_member(passage_id));
create policy "doors_update" on public.doors
    for update to authenticated
    using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));

-- On ne modifie directement que les réglages ; les ordres passent par
-- command_door() et l'état de la porte par gateway_sync().
revoke update on public.doors from authenticated, anon;
grant update (angle_closed, angle_open, assembly_mode) on public.doors to authenticated;
--rollback drop table if exists public.doors;

--changeset porte:001-fn-touch-updated-at splitStatements:false
create or replace function public.touch_updated_at()
    returns trigger
    language plpgsql
as $func$
begin
    new.updated_at := now();
    return new;
end;
$func$;
--rollback drop function if exists public.touch_updated_at();

--changeset porte:001-trigger-doors-touch
create trigger doors_touch_updated_at
    before update on public.doors
    for each row execute function public.touch_updated_at();
--rollback drop trigger if exists doors_touch_updated_at on public.doors;

-- Horaires d'ouverture d'une porte : jours ISO (1 = lundi … 7 = dimanche),
-- heure de début et de fin dans le fuseau du passage.
--changeset porte:001-schedules
create table if not exists public.schedules (
    id         uuid primary key default gen_random_uuid(),
    door_id    uuid not null,
    family_id  uuid not null,
    weekdays   smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
    starts_at  time not null,
    ends_at    time not null check (ends_at > starts_at),
    created_at timestamptz not null default now(),
    foreign key (door_id, family_id) references public.doors(id, family_id) on delete cascade
);
create index if not exists schedules_door_idx on public.schedules (door_id);
alter table public.schedules enable row level security;

create policy "schedules_select" on public.schedules
    for select to authenticated using (public.is_passage_member(public.family_passage(family_id)));
create policy "schedules_insert" on public.schedules
    for insert to authenticated with check (public.is_family_member(family_id));
create policy "schedules_update" on public.schedules
    for update to authenticated
    using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "schedules_delete" on public.schedules
    for delete to authenticated using (public.is_family_member(family_id));
--rollback drop table if exists public.schedules;

-- Journal du passage. Rempli seulement par les RPC (ordres, demandes des
-- enfants, batterie faible) : pas de policy d'insert.
--changeset porte:001-events
create table if not exists public.events (
    id         bigint generated always as identity primary key,
    passage_id uuid not null references public.passages(id) on delete cascade,
    door_id    uuid references public.doors(id) on delete cascade,
    kind       text not null check (kind in ('ouverture', 'fermeture', 'demande', 'batterie_faible')),
    actor      uuid references public.profiles(id) on delete set null,
    detail     jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists events_passage_idx on public.events (passage_id, created_at desc);
alter table public.events enable row level security;

create policy "events_select" on public.events
    for select to authenticated using (public.is_passage_member(passage_id));
--rollback drop table if exists public.events;

-- Ce que la porte doit faire maintenant. Le dernier événement l'emporte :
-- l'ordre donné dans l'appli, la fin d'une ouverture « pour un moment », ou
-- le dernier début ou la dernière fin d'un horaire. Le mode montage force la
-- position fermée. Exposée à l'appli comme colonne calculée de doors
-- (`select=*,door_target`) et lue par gateway_sync().
--changeset porte:001-fn-door-target splitStatements:false
create or replace function public.door_target(d public.doors)
    returns text
    language plpgsql
    stable
    set search_path = public
as $func$
declare
    v_state text := d.desired;
    v_at    timestamptz := d.desired_at;
    v_tz    text;
    v_now   timestamptz := now();
    v_today date;
    v_day   date;
    v_start timestamptz;
    v_end   timestamptz;
    s       record;
begin
    if d.assembly_mode then
        return 'ferme';
    end if;

    if d.open_until is not null and d.open_until <= v_now and d.open_until > v_at then
        v_state := 'ferme';
        v_at := d.open_until;
    end if;

    select p.timezone into v_tz from public.passages p where p.id = d.passage_id;
    v_tz := coalesce(v_tz, 'Europe/Paris');
    v_today := (v_now at time zone v_tz)::date;

    for s in select weekdays, starts_at, ends_at from public.schedules where door_id = d.id loop
        for i in 0..7 loop
            v_day := v_today - i;
            if extract(isodow from v_day)::smallint = any (s.weekdays) then
                v_start := (v_day + s.starts_at) at time zone v_tz;
                v_end := (v_day + s.ends_at) at time zone v_tz;
                if v_start <= v_now and v_start > v_at then
                    v_state := 'ouvert';
                    v_at := v_start;
                end if;
                if v_end <= v_now and v_end > v_at then
                    v_state := 'ferme';
                    v_at := v_end;
                end if;
            end if;
        end loop;
    end loop;

    return v_state;
end;
$func$;
--rollback drop function if exists public.door_target(public.doors);

-- Crée le passage, la famille de l'appelant (admin) et sa porte.
--changeset porte:001-fn-create-passage splitStatements:false
create or replace function public.create_passage(p_family_name text, p_passage_name text default null)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_passage uuid;
    v_family uuid;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;

    insert into public.passages (name)
    values (coalesce(nullif(trim(p_passage_name), ''), 'Porte magique'))
    returning id into v_passage;

    insert into public.families (passage_id, name)
    values (v_passage, trim(p_family_name))
    returning id into v_family;

    insert into public.family_members (family_id, user_id, role) values (v_family, v_user, 'admin');
    insert into public.doors (passage_id, family_id) values (v_passage, v_family);

    return v_passage;
end;
$func$;
--rollback drop function if exists public.create_passage(text, text);

-- p_neighbour : invitation du voisin (crée la seconde famille), sinon
-- invitation dans sa propre famille.
--changeset porte:001-fn-create-invitation splitStatements:false
create or replace function public.create_invitation(p_neighbour boolean default false)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_family uuid;
    v_passage uuid;
    v_id uuid;
begin
    select f.id, f.passage_id into v_family, v_passage
    from public.family_members m
    join public.families f on f.id = m.family_id
    where m.user_id = v_user and m.role = 'admin'
    order by m.joined_at desc
    limit 1;

    if v_family is null then
        raise exception 'not_admin' using errcode = '42501';
    end if;

    if p_neighbour and (select count(*) from public.families where passage_id = v_passage) >= 2 then
        raise exception 'passage_complet' using errcode = 'P0001';
    end if;

    insert into public.invitations (passage_id, family_id, created_by)
    values (v_passage, case when p_neighbour then null else v_family end, v_user)
    returning id into v_id;

    return v_id;
end;
$func$;
--rollback drop function if exists public.create_invitation(boolean);

-- Appelable sans compte : la page d'invitation présente le passage avant de
-- proposer l'inscription.
--changeset porte:001-fn-invitation-preview splitStatements:false
create or replace function public.invitation_preview(p_invitation uuid)
    returns table (passage_name text, family_name text, inviter_family text, invited_by text, is_neighbour boolean, expires_at timestamptz, is_valid boolean)
    language sql
    stable
    security definer
    set search_path = public
as $$
    select
        pa.name,
        fam.name,
        inviter_fam.name,
        pr.display_name,
        i.family_id is null,
        i.expires_at,
        i.expires_at > now()
            and (i.family_id is not null or (select count(*) from public.families f where f.passage_id = i.passage_id) < 2)
    from public.invitations i
    join public.passages pa on pa.id = i.passage_id
    left join public.families fam on fam.id = i.family_id
    left join public.profiles pr on pr.id = i.created_by
    left join lateral (
        select f.name from public.family_members m join public.families f on f.id = m.family_id
        where m.user_id = i.created_by and f.passage_id = i.passage_id limit 1
    ) inviter_fam on true
    where i.id = p_invitation
$$;
--rollback drop function if exists public.invitation_preview(uuid);

--changeset porte:001-fn-accept-invitation splitStatements:false
create or replace function public.accept_invitation(p_invitation uuid, p_family_name text default null)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_inv record;
    v_family uuid;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;

    select * into v_inv from public.invitations where id = p_invitation and expires_at > now();
    if not found then
        raise exception 'invitation_invalid' using errcode = 'P0002';
    end if;

    -- Déjà dans une famille de ce passage : rien à faire
    if public.is_passage_member(v_inv.passage_id) then
        return v_inv.passage_id;
    end if;

    if v_inv.family_id is not null then
        insert into public.family_members (family_id, user_id, role)
        values (v_inv.family_id, v_user, 'membre')
        on conflict (family_id, user_id) do nothing;
        return v_inv.passage_id;
    end if;

    -- Invitation du voisin : crée la seconde famille, une seule fois
    perform 1 from public.passages where id = v_inv.passage_id for update;
    if (select count(*) from public.families where passage_id = v_inv.passage_id) >= 2 then
        raise exception 'passage_complet' using errcode = 'P0001';
    end if;
    if nullif(trim(p_family_name), '') is null then
        raise exception 'family_name_required' using errcode = '22023';
    end if;

    insert into public.families (passage_id, name)
    values (v_inv.passage_id, trim(p_family_name))
    returning id into v_family;
    insert into public.family_members (family_id, user_id, role) values (v_family, v_user, 'admin');
    insert into public.doors (passage_id, family_id) values (v_inv.passage_id, v_family);

    return v_inv.passage_id;
end;
$func$;
--rollback drop function if exists public.accept_invitation(uuid, text);

-- Ordre donné depuis l'appli. p_minutes : ouverture pour un moment.
-- Renvoie la famille de l'autre côté, pour la prévenir.
--changeset porte:001-fn-command-door splitStatements:false
create or replace function public.command_door(p_door uuid, p_open boolean, p_minutes integer default null)
    returns table (passage_id uuid, family_id uuid, target text)
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_door public.doors;
begin
    select * into v_door from public.doors where id = p_door;
    if v_door.id is null or not public.is_family_member(v_door.family_id) then
        raise exception 'not_allowed' using errcode = '42501';
    end if;
    if p_minutes is not null and (p_minutes < 1 or p_minutes > 24 * 60) then
        raise exception 'invalid_duration' using errcode = '22023';
    end if;

    update public.doors set
        desired    = case when p_open then 'ouvert' else 'ferme' end,
        desired_at = now(),
        desired_by = v_user,
        open_until = case when p_open and p_minutes is not null then now() + make_interval(mins => p_minutes) end
    where id = p_door
    returning * into v_door;

    insert into public.events (passage_id, door_id, kind, actor, detail)
    values (
        v_door.passage_id, v_door.id,
        case when p_open then 'ouverture' else 'fermeture' end,
        v_user,
        case when p_minutes is not null and p_open then jsonb_build_object('minutes', p_minutes) else '{}'::jsonb end
    );

    return query select v_door.passage_id, v_door.family_id, public.door_target(v_door);
end;
$func$;
--rollback drop function if exists public.command_door(uuid, boolean, integer);

-- Nouvelle clé de passerelle, montrée une seule fois : la base n'en garde que
-- l'empreinte. Une nouvelle clé remplace l'ancienne.
--changeset porte:001-fn-new-gateway-key splitStatements:false
create or replace function public.new_gateway_key(p_door uuid)
    returns text
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_family uuid;
    v_key text;
begin
    select family_id into v_family from public.doors where id = p_door;
    if v_family is null or not public.is_family_member(v_family) then
        raise exception 'not_allowed' using errcode = '42501';
    end if;

    v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.doors
    set gateway_key_hash = encode(sha256(convert_to(v_key, 'UTF8')), 'hex')
    where id = p_door;
    return v_key;
end;
$func$;
--rollback drop function if exists public.new_gateway_key(uuid);

-- Appelée par la passerelle toutes les quelques secondes, sans compte (clé
-- anon + clé de la porte). Elle rapporte l'état de la porte et reçoit ce
-- qu'elle doit faire. Les horaires sont joints : elle les applique seule si
-- internet tombe.
--changeset porte:001-fn-gateway-sync splitStatements:false
create or replace function public.gateway_sync(
    p_door uuid,
    p_key text,
    p_lock text default null,
    p_door_closed boolean default null,
    p_battery_mv integer default null
)
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_door public.doors;
    v_other public.doors;
    v_tz text;
    v_lock text := case when p_lock in ('ouvert', 'ferme', 'bloque') then p_lock end;
    v_battery integer := case when p_battery_mv between 0 and 6000 then p_battery_mv end;
begin
    select * into v_door from public.doors
    where id = p_door and gateway_key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
    if not found then
        raise exception 'unknown_gateway' using errcode = '28000';
    end if;

    -- On n'écrit que si l'état change, ou toutes les 30 s pour « vue à l'instant » :
    -- moins d'écritures, et l'appli n'est pas réveillée toutes les 5 s.
    if v_door.last_seen_at is null or v_door.last_seen_at < now() - interval '30 seconds'
       or (v_lock is not null and v_lock is distinct from v_door.lock_state)
       or (p_door_closed is not null and p_door_closed is distinct from v_door.door_closed) then
        update public.doors set
            lock_state   = coalesce(v_lock, lock_state),
            door_closed  = coalesce(p_door_closed, door_closed),
            battery_mv   = coalesce(v_battery, battery_mv),
            last_seen_at = now()
        where id = p_door
        returning * into v_door;
    end if;

    select * into v_other from public.doors where passage_id = v_door.passage_id and id <> v_door.id limit 1;
    select timezone into v_tz from public.passages where id = v_door.passage_id;

    return jsonb_build_object(
        'target', public.door_target(v_door),
        'passage_open', v_door.lock_state = 'ouvert' and coalesce(v_other.lock_state = 'ouvert', false),
        'other_lock', v_other.lock_state,
        'angle_closed', v_door.angle_closed,
        'angle_open', v_door.angle_open,
        'assembly_mode', v_door.assembly_mode,
        'timezone', coalesce(v_tz, 'Europe/Paris'),
        'now', extract(epoch from now())::bigint,
        'schedules', coalesce((
            select jsonb_agg(jsonb_build_object('days', s.weekdays, 'start', to_char(s.starts_at, 'HH24:MI'), 'end', to_char(s.ends_at, 'HH24:MI')))
            from public.schedules s where s.door_id = v_door.id
        ), '[]'::jsonb)
    );
end;
$func$;
--rollback drop function if exists public.gateway_sync(uuid, text, text, boolean, integer);

-- Événement venu de la porte (bouton des enfants, batterie faible), appelé
-- par /api/passerelle avant d'envoyer les notifications. Une demande moins
-- d'une minute après la précédente est ignorée (deliver = false).
--changeset porte:001-fn-gateway-event splitStatements:false
create or replace function public.gateway_event(p_door uuid, p_key text, p_kind text)
    returns table (passage_id uuid, family_id uuid, deliver boolean)
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_door public.doors;
    v_recent boolean;
begin
    select * into v_door from public.doors
    where id = p_door and gateway_key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex');
    if v_door.id is null then
        raise exception 'unknown_gateway' using errcode = '28000';
    end if;
    if p_kind not in ('demande', 'batterie_faible') then
        raise exception 'invalid_kind' using errcode = '22023';
    end if;

    select exists (
        select 1 from public.events e
        where e.door_id = v_door.id and e.kind = p_kind
          and e.created_at > now() - case when p_kind = 'demande' then interval '1 minute' else interval '20 hours' end
    ) into v_recent;

    if not v_recent then
        insert into public.events (passage_id, door_id, kind) values (v_door.passage_id, v_door.id, p_kind);
    end if;

    return query select v_door.passage_id, v_door.family_id, not v_recent;
end;
$func$;
--rollback drop function if exists public.gateway_event(uuid, text, text);

-- Rien qu'une lecture, pour /api/keepalive (le projet gratuit s'endort sinon)
--changeset porte:001-fn-ping splitStatements:false
create or replace function public.ping()
    returns text
    language sql
    stable
as $$ select 'ok'::text $$;
--rollback drop function if exists public.ping();

--changeset porte:001-grant-rpcs
revoke execute on function public.create_passage(text, text) from public, anon;
revoke execute on function public.create_invitation(boolean) from public, anon;
revoke execute on function public.accept_invitation(uuid, text) from public, anon;
revoke execute on function public.command_door(uuid, boolean, integer) from public, anon;
revoke execute on function public.new_gateway_key(uuid) from public, anon;
grant execute on function public.create_passage(text, text) to authenticated;
grant execute on function public.create_invitation(boolean) to authenticated;
grant execute on function public.accept_invitation(uuid, text) to authenticated;
grant execute on function public.command_door(uuid, boolean, integer) to authenticated;
grant execute on function public.new_gateway_key(uuid) to authenticated;
grant execute on function public.invitation_preview(uuid) to anon, authenticated;
grant execute on function public.gateway_sync(uuid, text, text, boolean, integer) to anon, authenticated;
grant execute on function public.gateway_event(uuid, text, text) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
--rollback revoke execute on function public.ping() from anon, authenticated;
--rollback revoke execute on function public.gateway_event(uuid, text, text) from anon, authenticated;
--rollback revoke execute on function public.gateway_sync(uuid, text, text, boolean, integer) from anon, authenticated;
--rollback revoke execute on function public.invitation_preview(uuid) from anon, authenticated;
--rollback revoke execute on function public.new_gateway_key(uuid) from authenticated;
--rollback revoke execute on function public.command_door(uuid, boolean, integer) from authenticated;
--rollback revoke execute on function public.accept_invitation(uuid, text) from authenticated;
--rollback revoke execute on function public.create_invitation(boolean) from authenticated;
--rollback revoke execute on function public.create_passage(text, text) from authenticated;

-- Notifications sur le téléphone : un abonnement Web Push par appareil
-- (repris de Fridge). L'envoi lit la table avec la clé serveur.
--changeset porte:001-push-subscriptions
create table if not exists public.push_subscriptions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.profiles(id) on delete cascade,
    endpoint     text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
    p256dh       text not null check (length(p256dh) <= 200),
    auth         text not null check (length(auth) <= 100),
    device_label text check (device_label is null or length(device_label) <= 60),
    created_at   timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select" on public.push_subscriptions
    for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions_delete" on public.push_subscriptions
    for delete to authenticated using (user_id = auth.uid());
--rollback drop table if exists public.push_subscriptions;

--changeset porte:001-fn-save-push-subscription splitStatements:false
create or replace function public.save_push_subscription(
    p_endpoint text,
    p_p256dh text,
    p_auth text,
    p_device_label text default null
)
    returns uuid
    language plpgsql
    security definer
    set search_path = public
as $func$
declare
    v_user uuid := auth.uid();
    v_id uuid;
begin
    if v_user is null then
        raise exception 'not_authenticated' using errcode = '28000';
    end if;

    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
    values (v_user, p_endpoint, p_p256dh, p_auth, left(p_device_label, 60))
    on conflict (endpoint) do update set
        user_id      = excluded.user_id,
        p256dh       = excluded.p256dh,
        auth         = excluded.auth,
        device_label = excluded.device_label,
        last_seen_at = now()
    returning id into v_id;

    return v_id;
end;
$func$;
--rollback drop function if exists public.save_push_subscription(text, text, text, text);

--changeset porte:001-grant-save-push-subscription
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
--rollback revoke execute on function public.save_push_subscription(text, text, text, text) from authenticated;

-- L'appli suit les portes et le journal en direct
--changeset porte:001-realtime
alter publication supabase_realtime add table public.doors, public.events, public.schedules;
--rollback alter publication supabase_realtime drop table public.doors, public.events, public.schedules;

--changeset porte:001-reload-schema-cache
select pg_notify('pgrst', 'reload schema');
--rollback select pg_notify('pgrst', 'reload schema');
