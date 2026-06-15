-- Extend documents table to support generated documents from templates

alter table documents
  add column if not exists type text,
  add column if not exists uploaded_by uuid references profiles(id),
  add column if not exists source text default 'upload' check (source in ('upload', 'template', 'client_upload')),
  add column if not exists body text;

-- category constraint was too narrow — widen it to include doc template types
alter table documents drop constraint if exists documents_category_check;
alter table documents add constraint documents_category_check
  check (category in ('corporate', 'contracts', 'court', 'identity', 'vakalatnama', 'agreement', 'notice', 'petition', 'affidavit', 'general', 'other'));

-- status constraint — add 'uploaded' for template-generated docs
alter table documents drop constraint if exists documents_status_check;
alter table documents add constraint documents_status_check
  check (status in ('requested', 'uploading', 'under_review', 'verified', 'uploaded'));
