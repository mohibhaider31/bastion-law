-- ============================================================
-- BASTION LAW — SEED DATA
-- Run this in the Supabase SQL editor AFTER pushing migrations.
-- Creates test users, a firm, matters, documents, messages, etc.
-- ============================================================

-- ── Test Users (inserted directly into auth) ──────────────────
-- Passwords are all: Bastion123!
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at, aud, role
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'ahmed@bastionlaw.pk',
    extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
    NOW(),
    '{"role": "owner", "full_name": "Ahmed Raza", "phone": "+92-21-111-222-333"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'zara@bastionlaw.pk',
    extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
    NOW(),
    '{"role": "lawyer", "full_name": "Zara Hussain", "phone": "+92-300-111-2222"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'faisal@bastionlaw.pk',
    extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
    NOW(),
    '{"role": "lawyer", "full_name": "Faisal Qureshi", "phone": "+92-300-333-4444"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'client1@example.pk',
    extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
    NOW(),
    '{"role": "client", "full_name": "Tariq Enterprises Ltd", "phone": "+92-21-555-6666"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'client2@example.pk',
    extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
    NOW(),
    '{"role": "client", "full_name": "Sana Mirza", "phone": "+92-333-777-8888"}',
    NOW(), NOW(), 'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- Profiles are auto-created by the trigger, but update extra fields
UPDATE profiles SET phone = '+92-21-111-222-333', cnic = '42101-1234567-1' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE profiles SET phone = '+92-300-111-2222',   cnic = '42201-2345678-2' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE profiles SET phone = '+92-300-333-4444',   cnic = '42301-3456789-3' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE profiles SET phone = '+92-21-555-6666',    cnic = '42401-4567890-4' WHERE id = '00000000-0000-0000-0000-000000000004';
UPDATE profiles SET phone = '+92-333-777-8888',   cnic = '42501-5678901-5' WHERE id = '00000000-0000-0000-0000-000000000005';

-- ── SLA Config ────────────────────────────────────────────────
INSERT INTO sla_configs (response_hours, escalation_hours, escalation_target_id)
VALUES (2, 4, '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- ── Matters ───────────────────────────────────────────────────
INSERT INTO matters (id, matter_ref, title, type, stage, status, client_id, lead_lawyer_id, cause_no, court, confidentiality, description, opened_at) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'BST-2026-001',
    'Tariq Enterprises — Corporate Merger with Malik Holdings',
    'corporate', 'hearing', 'active',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    '1247/2026', 'Karachi High Court', 'privileged',
    'Mergers & Acquisitions matter for acquisition of 60% stake in Malik Holdings Pvt Ltd.',
    NOW() - INTERVAL '45 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'BST-2026-002',
    'Mirza v. DHA — Property Dispute',
    'property', 'filing', 'active',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000003',
    '892/2026', 'Lahore High Court', 'standard',
    'Property boundary dispute regarding Plot 45-C, DHA Phase 6, Lahore.',
    NOW() - INTERVAL '20 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Matter Team ───────────────────────────────────────────────
INSERT INTO matter_lawyers (matter_id, lawyer_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lead'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'associate'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'lead')
ON CONFLICT DO NOTHING;

-- ── Documents ─────────────────────────────────────────────────
INSERT INTO documents (id, matter_id, name, category, status, requested_by, due_date, requires_esign) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Memorandum of Understanding', 'corporate', 'requested', '00000000-0000-0000-0000-000000000002', CURRENT_DATE + 3, FALSE),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Vakalatnama', 'court', 'requested', '00000000-0000-0000-0000-000000000002', CURRENT_DATE + 1, TRUE),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Company Registration Certificate', 'corporate', 'under_review', '00000000-0000-0000-0000-000000000002', NULL, FALSE),
  ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'CNIC — Authorized Signatory', 'identity', 'verified', '00000000-0000-0000-0000-000000000002', NULL, FALSE),
  ('dddddddd-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', 'Property Title Deed', 'court', 'requested', '00000000-0000-0000-0000-000000000003', CURRENT_DATE + 5, FALSE),
  ('dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', 'Survey Map', 'court', 'under_review', '00000000-0000-0000-0000-000000000003', NULL, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Messages ─────────────────────────────────────────────────
INSERT INTO messages (id, matter_id, sender_id, body, created_at) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Good morning! I have reviewed the draft MOU and have a few comments. Could you please schedule a call with the Malik Holdings team for next week?', NOW() - INTERVAL '2 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'Noted, Zara. We are available Tuesday or Wednesday afternoon. Preferably video call.', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Perfect. I will send a calendar invite for Wednesday 11 AM. Also, please upload the Vakalatnama before Friday — it is required for the court filing.', NOW() - INTERVAL '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Sana, the survey map has been submitted to the court. Next hearing is on 18th June. Please make sure to be available that day.', NOW() - INTERVAL '3 hours'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'Understood, Faisal. I will be there. Do I need to bring any original documents?', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ── Events ────────────────────────────────────────────────────
INSERT INTO events (id, matter_id, created_by, type, title, event_date, event_time, location, cause_no) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'hearing', 'Pre-Trial Conference — KHC', '2026-06-25', '10:30', 'Karachi High Court, Room 14', '1247/2026'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'deadline', 'Submit MOU Draft to Malik Holdings', '2026-06-20', '17:00', NULL, NULL),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'meeting', 'Strategy Call — Client + Opposing Counsel', '2026-06-18', '11:00', 'Video Call', NULL),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'hearing', 'Property Dispute Hearing — LHC', '2026-06-18', '09:00', 'Lahore High Court, Court 7', '892/2026'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'filing', 'File Survey Map with Registry', '2026-06-15', NULL, 'DHA Registration Office', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Appointments ─────────────────────────────────────────────
INSERT INTO appointments (id, matter_id, client_id, lawyer_id, status, type, proposed_at, duration_minutes, agenda, proposed_by) VALUES
  (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    'pending', 'video',
    NOW() + INTERVAL '6 days' + INTERVAL '11 hours',
    60,
    'Review MOU draft and discuss Malik Holdings negotiation strategy.',
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000003',
    'confirmed', 'in_person',
    NOW() + INTERVAL '6 days' + INTERVAL '9 hours',
    60,
    'Prepare for 18 June hearing. Review all documents.',
    '00000000-0000-0000-0000-000000000003'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Invoices ──────────────────────────────────────────────────
INSERT INTO invoices (id, invoice_ref, client_id, matter_id, status, amount_paisas, due_date, created_by) VALUES
  (
    'ffffffff-0000-0000-0000-000000000001',
    'INV-2026-001',
    '00000000-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'outstanding',
    15000000,  -- PKR 150,000 in paisas
    CURRENT_DATE + 14,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'ffffffff-0000-0000-0000-000000000002',
    'INV-2026-002',
    '00000000-0000-0000-0000-000000000005',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'paid',
    7500000,   -- PKR 75,000 in paisas
    CURRENT_DATE - 7,
    '00000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (invoice_id, description, quantity, unit_paisas) VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'Legal consultation — Corporate Merger (10 hrs)', 10, 1000000),
  ('ffffffff-0000-0000-0000-000000000001', 'Document drafting — MOU', 1, 5000000),
  ('ffffffff-0000-0000-0000-000000000002', 'Legal consultation — Property Dispute (5 hrs)', 5,  800000),
  ('ffffffff-0000-0000-0000-000000000002', 'Court filing fees', 1, 3500000)
ON CONFLICT DO NOTHING;

-- ── Time Entries ─────────────────────────────────────────────
INSERT INTO time_entries (matter_id, lawyer_id, description, hours, entry_date) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Client intake & initial case review', 2.5, CURRENT_DATE - 40),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'MOU drafting — first draft', 4.0, CURRENT_DATE - 30),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'KHC pre-trial preparation', 3.5, CURRENT_DATE - 5),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Document review — MOU annexures', 2.0, CURRENT_DATE - 28),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Client intake — property dispute', 1.5, CURRENT_DATE - 18),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Court filing — survey map submission', 3.0, CURRENT_DATE - 3)
ON CONFLICT DO NOTHING;

-- ── Private Notes ─────────────────────────────────────────────
INSERT INTO private_notes (matter_id, author_id, body) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Client is very price-sensitive. Do not mention the 20% contingency fee clause in the first meeting. Wait until trust is established.'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Opposing counsel (Salman & Co.) has a reputation for last-minute adjournments. Keep client expectations managed.'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Client has additional undisclosed encumbrances on the property. Need to clarify before next hearing.')
ON CONFLICT DO NOTHING;

-- ── Audit Logs ────────────────────────────────────────────────
INSERT INTO audit_logs (matter_id, actor_id, actor_type, action, metadata) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lawyer', 'Matter opened', '{"stage": "intake"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lawyer', 'Stage updated to Documentation', '{"from": "intake", "to": "documentation"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'client', 'Document uploaded: CNIC', '{"document_id": "dddddddd-0000-0000-0000-000000000004"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lawyer', 'Document verified: CNIC', '{"document_id": "dddddddd-0000-0000-0000-000000000004"}'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lawyer', 'Stage updated to Hearing', '{"from": "documentation", "to": "hearing"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'lawyer', 'Matter opened', '{"stage": "intake"}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', NULL, 'system', 'Hearing reminder sent to client', '{"event_id": "eeeeeeee-0000-0000-0000-000000000004", "days_before": 7}')
ON CONFLICT DO NOTHING;

-- ── Notifications ─────────────────────────────────────────────
INSERT INTO notifications (user_id, type, title, body, matter_id) VALUES
  ('00000000-0000-0000-0000-000000000004', 'document_requested', 'Document Required: Vakalatnama', 'Please upload and sign your Vakalatnama before Friday. It is needed for the court filing.', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'hearing_reminder', 'Hearing in 13 days — KHC', 'Your case BST-2026-001 has a Pre-Trial Conference at Karachi High Court on 25 June at 10:30 AM.', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'case_update', 'Case Stage Updated', 'Your matter has progressed to the Hearing stage. Your lawyer will brief you shortly.', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'appointment_confirmed', 'Appointment Confirmed', 'Your in-person meeting with Faisal Qureshi on 18 June at 9:00 AM is confirmed.', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000005', 'hearing_reminder', 'Hearing Tomorrow — LHC', 'Reminder: Property Dispute hearing at Lahore High Court tomorrow at 9:00 AM, Court 7.', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', 'sla_breach', 'SLA Warning — Tariq Enterprises', 'Message from Tariq Enterprises has been unanswered for 1h 45m. Auto-escalates at 2h.', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
