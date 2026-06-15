-- Custom fields on matters: flexible key-value pairs for firm-specific metadata

create table if not exists matter_custom_fields (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references matters(id) on delete cascade,
  field_name text not null,
  field_value text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (matter_id, field_name)
);

alter table matter_custom_fields enable row level security;

create policy "owner manages custom fields" on matter_custom_fields
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'owner'));

create policy "lawyers view custom fields" on matter_custom_fields
  for select
  using (
    exists (
      select 1 from matter_lawyers ml
      join profiles p on p.id = auth.uid()
      where ml.matter_id = matter_custom_fields.matter_id
        and (ml.lawyer_id = auth.uid() or p.role = 'owner')
    )
  );

-- Firm-level custom field definitions (for consistency)
create table if not exists custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'boolean')),
  hint text,
  created_at timestamptz default now()
);

alter table custom_field_definitions enable row level security;

create policy "owner manages field definitions" on custom_field_definitions
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'owner'));

create policy "lawyers view field definitions" on custom_field_definitions
  for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'lawyer')));

-- Seed common field definitions for a Pakistani law firm
insert into custom_field_definitions (name, field_type, hint) values
  ('Filing Fee (PKR)', 'number', 'Court filing fee in Pakistani Rupees'),
  ('Opposing Party', 'text', 'Full name of the opposing party'),
  ('Court Branch', 'text', 'Specific branch/division of the court'),
  ('Stamp Duty (PKR)', 'number', 'Stamp duty paid in Pakistani Rupees'),
  ('Jurisdiction', 'text', 'Jurisdictional basis for the matter'),
  ('Limitation Date', 'date', 'Date by which the matter must be filed'),
  ('FIR No.', 'text', 'First Information Report number (for criminal matters)'),
  ('PS (Police Station)', 'text', 'Police station (for criminal matters)')
on conflict (name) do nothing;
