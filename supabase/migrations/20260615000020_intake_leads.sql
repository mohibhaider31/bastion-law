-- Intake CRM pipeline: track potential clients before they become formal matters

create table if not exists intake_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  source text default 'direct' check (source in ('direct', 'referral', 'website', 'walk_in', 'other')),
  matter_type text default 'corporate' check (matter_type in ('corporate', 'civil', 'criminal', 'family', 'property', 'other')),
  summary text,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'consultation', 'proposal', 'won', 'lost')),
  assigned_to uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  converted_matter_id uuid references matters(id)
);

alter table intake_leads enable row level security;

-- Owner can manage all leads
create policy "owner manages leads" on intake_leads
  for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );

-- Lawyers can view leads assigned to them
create policy "lawyer views own leads" on intake_leads
  for select
  using (
    assigned_to = auth.uid() or
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
