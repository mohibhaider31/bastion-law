-- Action items for the two seeded matters
INSERT INTO tasks (matter_id, client_id, created_by, assigned_to, type, title, description, status, priority, due_date) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'client', 'signature', 'Sign the Vakalatnama', 'Required before we can file on your behalf at Karachi High Court.', 'pending', 'high', CURRENT_DATE + 1),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'client', 'document', 'Upload Memorandum of Understanding', 'Latest signed copy with Malik Holdings.', 'pending', 'normal', CURRENT_DATE + 3),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'client', 'payment', 'Settle invoice INV-2026-001', 'PKR 150,000 outstanding for corporate merger work.', 'pending', 'high', CURRENT_DATE + 14),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'client', 'review', 'Review draft share purchase agreement', 'Sent to your email — confirm clauses 4 and 7.', 'done', 'normal', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'client', 'document', 'Upload Property Title Deed', 'Original title deed for Plot 45-C, DHA Phase 6.', 'pending', 'high', CURRENT_DATE + 5);

-- Firm-level (org) chat: a welcome message from the firm to each client
INSERT INTO messages (matter_id, client_id, sender_id, body, created_at) VALUES
  (NULL, '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Welcome to Bastion Law, Tariq Enterprises. This is your direct line to the firm for anything outside a specific case. How can we help?', NOW() - INTERVAL '1 day'),
  (NULL, '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Welcome to Bastion Law, Sana. Reach out here anytime for general questions or to be connected to the right lawyer.', NOW() - INTERVAL '2 days');
