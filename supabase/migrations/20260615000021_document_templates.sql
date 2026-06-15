-- Document template library for standard legal documents

create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general' check (category in ('vakalatnama', 'agreement', 'notice', 'petition', 'affidavit', 'general')),
  description text,
  body_template text not null,  -- template text with {{var}} placeholders
  variables text[] not null default '{}',  -- list of required variable names
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table document_templates enable row level security;

create policy "owner manages document templates" on document_templates
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'owner'));

create policy "lawyers can view document templates" on document_templates
  for select
  using (exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'lawyer')));

-- Seed some standard templates
insert into document_templates (name, category, description, body_template, variables) values
(
  'Vakalatnama',
  'vakalatnama',
  'Standard power of attorney granting legal representation',
  'VAKALATNAMA

I, {{client_name}}, son/daughter of {{guardian_name}}, residing at {{client_address}}, CNIC No. {{client_cnic}}, do hereby appoint and authorise {{lawyer_name}}, Advocate, and his/her associates, to appear, plead and act for me in the matter of:

Matter Reference: {{matter_ref}}
Case/Matter: {{matter_title}}
Court: {{court_name}}

AND to do all acts, deeds and things necessary or expedient for the conduct of the said matter including but not limited to filing of documents, making applications, and taking all other steps as may be necessary.

IN WITNESS WHEREOF I have signed this Vakalatnama this {{date}} day of {{month}}, {{year}}.

Signature: ____________________
Name: {{client_name}}

Witness 1: ____________________
Witness 2: ____________________',
  ARRAY['client_name', 'guardian_name', 'client_address', 'client_cnic', 'lawyer_name', 'matter_ref', 'matter_title', 'court_name', 'date', 'month', 'year']
),
(
  'Client Engagement Letter',
  'agreement',
  'Formal engagement letter confirming legal representation terms',
  'ENGAGEMENT LETTER

Date: {{date}}

To:
{{client_name}}
{{client_address}}

Dear {{client_name}},

Re: {{matter_title}} ({{matter_ref}})

We are pleased to confirm our engagement to represent you in the above matter. This letter sets out the terms of our engagement.

SCOPE OF WORK
We have been retained to advise and represent you in connection with {{matter_title}}. Our representation is limited to the scope described above.

FEES
Our professional fees for this matter will be charged at the rate of PKR {{hourly_rate}} per hour, plus applicable taxes and disbursements. We will issue invoices monthly or at such other intervals as may be agreed.

RETAINER
A retainer of PKR {{retainer_amount}} is payable upon signing this letter. This retainer will be applied against our final invoice.

CONFIDENTIALITY
All information you provide to us will be treated as strictly confidential.

Please sign and return one copy of this letter to indicate your acceptance of these terms.

Yours sincerely,

{{lawyer_name}}
Advocate
Bastion Law

I accept the above terms:

Signature: ____________________
Name: {{client_name}}
Date: ____________________',
  ARRAY['date', 'client_name', 'client_address', 'matter_title', 'matter_ref', 'hourly_rate', 'retainer_amount', 'lawyer_name']
),
(
  'Legal Notice',
  'notice',
  'Standard legal notice for breach of contract or dispute',
  'LEGAL NOTICE

Date: {{date}}

To:
{{recipient_name}}
{{recipient_address}}

TAKE NOTICE that our client, {{client_name}}, has instructed us to address you as follows:

1. That {{notice_body}}

2. You are hereby called upon to {{demanded_action}} within {{response_days}} days of receipt of this notice, failing which our client shall be constrained to initiate appropriate legal proceedings against you without further notice, at your risk, cost, and consequence.

3. This notice shall be treated as sufficient notice for all legal purposes.

BASTION LAW
{{lawyer_name}}, Advocate
On behalf of {{client_name}}

Date: {{date}}',
  ARRAY['date', 'recipient_name', 'recipient_address', 'client_name', 'notice_body', 'demanded_action', 'response_days', 'lawyer_name']
),
(
  'Affidavit',
  'affidavit',
  'Standard affidavit template',
  'AFFIDAVIT

I, {{deponent_name}}, son/daughter of {{guardian_name}}, age {{age}} years, residing at {{address}}, do hereby solemnly affirm and declare as under:

1. That I am the {{deponent_capacity}} in the above matter and am fully conversant with the facts deposed to herein.

2. {{affidavit_facts}}

3. That the above statements are true to the best of my knowledge and belief, and nothing material has been concealed therein.

DEPONENT

Verification: Verified on oath at {{city}} on this {{date}} day of {{month}}, {{year}} that the contents of the above affidavit are true and correct to the best of my knowledge and belief.

DEPONENT',
  ARRAY['deponent_name', 'guardian_name', 'age', 'address', 'deponent_capacity', 'affidavit_facts', 'city', 'date', 'month', 'year']
);
