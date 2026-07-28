-- Utility Impianti V2 ? eseguire una volta nel Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'technician');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  technician_name text,
  role public.app_role not null default 'technician',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  categories text[] not null default '{}',
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references public.profiles(id)
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  comune text not null default '',
  via text not null default '',
  cap text not null default '',
  amministratore text not null default '',
  technician_name text not null default 'Non assegnato',
  assigned_to uuid references public.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  type text not null,
  performed_at timestamptz not null default now(),
  season_id uuid references public.seasons(id),
  performed_by uuid not null references public.profiles(id)
);

create table public.consumptions (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants(id) on delete cascade,
  season_id uuid references public.seasons(id),
  gas_start numeric,
  gas_end numeric,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  unique (plant_id, season_id)
);

create table public.energy_meters (
  id uuid primary key default gen_random_uuid(),
  consumption_id uuid not null references public.consumptions(id) on delete cascade,
  zone text not null,
  start_value numeric,
  end_value numeric,
  sort_order integer not null default 0
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active); $$;

create or replace function public.can_operate_plant(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() or exists(select 1 from public.plants where id = target and assigned_to = auth.uid()); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name, technician_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'technician_name',
    case when lower(new.email) = 'graziano.garlaschelli@cfsfacility.it' then 'admin'::public.app_role else 'technician'::public.app_role end
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.plants enable row level security;
alter table public.interventions enable row level security;
alter table public.consumptions enable row level security;
alter table public.energy_meters enable row level security;
alter table public.app_config enable row level security;

create policy "authenticated read profiles" on public.profiles for select to authenticated using (active);
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.sync_profile_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.technician_name is not null then
    update public.plants set assigned_to = new.id, updated_at = now()
    where lower(technician_name) = lower(new.technician_name);
  end if;
  return new;
end; $$;

create trigger on_profile_assignment after insert or update of technician_name on public.profiles
for each row execute procedure public.sync_profile_assignment();

create policy "authenticated read plants" on public.plants for select to authenticated using (true);
create policy "admins manage plants" on public.plants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read seasons" on public.seasons for select to authenticated using (true);
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read config" on public.app_config for select to authenticated using (true);
create policy "admins manage config" on public.app_config for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read interventions" on public.interventions for select to authenticated using (true);
create policy "assigned insert interventions" on public.interventions for insert to authenticated
with check (performed_by = auth.uid() and public.can_operate_plant(plant_id));
create policy "owner or admin update interventions" on public.interventions for update to authenticated
using (performed_by = auth.uid() or public.is_admin()) with check (public.can_operate_plant(plant_id));
create policy "owner or admin delete interventions" on public.interventions for delete to authenticated
using (performed_by = auth.uid() or public.is_admin());

create policy "authenticated read consumptions" on public.consumptions for select to authenticated using (true);
create policy "assigned insert consumptions" on public.consumptions for insert to authenticated
with check (updated_by = auth.uid() and public.can_operate_plant(plant_id));
create policy "assigned update consumptions" on public.consumptions for update to authenticated
using (public.can_operate_plant(plant_id)) with check (updated_by = auth.uid() and public.can_operate_plant(plant_id));
create policy "admins delete consumptions" on public.consumptions for delete to authenticated using (public.is_admin());

create policy "authenticated read meters" on public.energy_meters for select to authenticated using (true);
create policy "assigned manage meters" on public.energy_meters for all to authenticated
using (exists(select 1 from public.consumptions c where c.id = consumption_id and public.can_operate_plant(c.plant_id)))
with check (exists(select 1 from public.consumptions c where c.id = consumption_id and public.can_operate_plant(c.plant_id)));

alter publication supabase_realtime add table public.profiles, public.seasons, public.plants, public.interventions, public.consumptions, public.energy_meters, public.app_config;

insert into public.app_config(key, value) values
('active_campaign_by_type', '{"manutenzione":null,"verifica":null,"prova-fumi":null,"preaccensione":null,"accensione":null,"spegnimento":null}'),
('active_consumption_campaign', 'null')
on conflict (key) do nothing;
