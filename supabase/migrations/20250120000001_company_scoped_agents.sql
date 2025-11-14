-- Company-scoped Agents Migration
-- ================================

-- 1) Platform admin authorization helpers
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id)
);

create or replace function public.is_platform_admin()
returns boolean
language sql stable as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- 2) Default catalog table
create table if not exists public.default_agents (
  id uuid primary key default gen_random_uuid(),
  agent_type_id uuid not null references public.agent_types(id) on delete restrict,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

alter table public.default_agents enable row level security;

create policy "platform admin full access default_agents" on public.default_agents
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 3) Make `agents` company-scoped (migration-safe sequence)
-- (a) Add company_id column if it doesn't exist
alter table public.agents add column if not exists company_id uuid references public.companies(id);

-- (b) Set company_id to not null after ensuring all records have it
-- First, update any null company_ids with a default company (if needed)
-- This assumes there's at least one company in the system
update public.agents 
set company_id = (select id from public.companies limit 1)
where company_id is null;

alter table public.agents alter column company_id set not null;

-- (d) Add indexes for performance
create index if not exists idx_agents_company_id on public.agents(company_id);
create index if not exists idx_agents_company_status on public.agents(company_id, status);

-- (e) Enable RLS and policies
alter table public.agents enable row level security;

-- Drop any existing policies first
drop policy if exists "platform admin full access agents" on public.agents;
drop policy if exists "company members read agents" on public.agents;
drop policy if exists "company admins insert agents" on public.agents;
drop policy if exists "company admins update agents" on public.agents;
drop policy if exists "company admins delete agents" on public.agents;

-- Platform admin full access
create policy "platform admin full access agents" on public.agents
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Company members can read their company's agents
create policy "company members read agents" on public.agents
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = public.agents.company_id
    )
  );

-- Simple RLS policy: users can only select agents from their own company
create policy "select own company agents only" on public.agents
  for select using (
    company_id = (
      select company_id 
      from public.profiles 
      where id = auth.uid()
    )
  );

-- Company admins can insert/update/delete their company's agents
create policy "company admins insert agents" on public.agents
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

create policy "company admins update agents" on public.agents
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

create policy "company admins delete agents" on public.agents
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.company_id = public.agents.company_id
    )
  );

-- 4) Seed defaults for new companies (trigger)
create or replace function public.seed_default_agents_for_company()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    NEW.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    NEW.created_by
  from public.default_agents da
  join public.agent_types at on at.id = da.agent_type_id
  where not exists (
    select 1 from public.agents a
    where a.company_id = NEW.id and a.agent_type_id = da.agent_type_id
  );
  return NEW;
end;$$;

drop trigger if exists trg_seed_default_agents on public.companies;
create trigger trg_seed_default_agents
after insert on public.companies
for each row execute function public.seed_default_agents_for_company();

-- 5) Create default agents from agent types (if default_agents table is empty)
insert into public.default_agents (agent_type_id, name, description, config, status, created_by)
select 
  at.id,
  at.name,
  at.description,
  jsonb_build_object(
    'instructions', 'You are a ' || at.name || ' assistant. ' || coalesce(at.description, ''),
    'ai_provider', 'openai',
    'ai_model', 'gpt-4o',
    'max_tokens', 2000,
    'web_access', false
  ),
  'active',
  (select id from auth.users limit 1)
from public.agent_types at
where not exists (select 1 from public.default_agents limit 1);

-- 6) Backfill all existing companies now
insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
select 
  c.id, 
  da.agent_type_id, 
  da.name, 
  at.name as role,
  da.description, 
  da.config as configuration, 
  coalesce(da.status::agent_status, 'active'::agent_status), 
  da.created_by
from public.companies c
cross join public.default_agents da
join public.agent_types at on at.id = da.agent_type_id
where not exists (
  select 1 from public.agents a
  where a.company_id = c.id and a.agent_type_id = da.agent_type_id
);

-- 7) RPCs for copying defaults into companies
create or replace function public.copy_default_agent_to_company(
  p_default_agent_id uuid,
  p_company_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_role text; v_company uuid; v_type uuid;
begin
  if not public.is_platform_admin() then
    select role, company_id into v_role, v_company from public.profiles where id = auth.uid();
    if v_role <> 'admin' or v_company <> p_company_id then
      raise exception 'not authorized';
    end if;
  end if;

  select agent_type_id into v_type from public.default_agents where id = p_default_agent_id;

  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    p_company_id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    auth.uid()
  from public.default_agents da
  join public.agent_types at on at.id = da.agent_type_id
  where da.id = p_default_agent_id
    and not exists (
      select 1 from public.agents a 
      where a.company_id = p_company_id and a.agent_type_id = da.agent_type_id
    )
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.agents a 
    where a.company_id = p_company_id and a.agent_type_id = v_type limit 1;
  end if;
  return v_id;
end;$$;

create or replace function public.seed_default_agent_to_all_companies(
  p_default_agent_id uuid
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; 
begin
  if not public.is_platform_admin() then raise exception 'not authorized'; end if;
  insert into public.agents (company_id, agent_type_id, name, role, description, configuration, status, created_by)
  select 
    c.id, 
    da.agent_type_id, 
    da.name, 
    at.name as role,
    da.description, 
    da.config as configuration, 
    coalesce(da.status::agent_status, 'active'::agent_status), 
    auth.uid()
  from public.companies c
  join public.default_agents da on da.id = p_default_agent_id
  join public.agent_types at on at.id = da.agent_type_id
  where not exists (
    select 1 from public.agents a 
    where a.company_id = c.id and a.agent_type_id = da.agent_type_id
  );
  get diagnostics v_count = row_count;
  return v_count;
end;$$;

-- 8) RLS for metrics (restrict by company via agent)
alter table public.agent_metrics enable row level security;

-- Drop existing policies if they exist
drop policy if exists "platform admin metrics" on public.agent_metrics;
drop policy if exists "company members read metrics" on public.agent_metrics;

create policy "platform admin metrics" on public.agent_metrics
  for select using (public.is_platform_admin());

create policy "company members read metrics" on public.agent_metrics
  for select using (
    exists (
      select 1 from public.agents a
      join public.profiles p on p.id = auth.uid() and p.company_id = a.company_id
      where a.id = public.agent_metrics.agent_id
    )
  );

-- 9) Add platform admin to the platform_admins table (you'll need to manually add your user ID)
-- Example: INSERT INTO public.platform_admins (user_id) VALUES ('your-user-uuid-here');
