-- ── Firm settings (one row, upserted) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firm_settings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email    text        NOT NULL DEFAULT 'noreply@bastionlaw.pk',
  from_name     text        NOT NULL DEFAULT 'Bastion Law',
  reply_to      text,
  logo_url      text,
  primary_color text        NOT NULL DEFAULT '#6B1E2B',
  accent_color  text        NOT NULL DEFAULT '#B68A4E',
  firm_address  text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE firm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner can manage firm settings" ON firm_settings
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');

INSERT INTO firm_settings (from_email, from_name, primary_color, accent_color)
VALUES ('noreply@bastionlaw.pk', 'Bastion Law', '#6B1E2B', '#B68A4E')
ON CONFLICT DO NOTHING;

-- ── Email templates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        NOT NULL UNIQUE,
  name          text        NOT NULL,
  subject       text        NOT NULL,
  body_html     text        NOT NULL,
  is_auto       boolean     NOT NULL DEFAULT false,
  trigger_event text,
  variables     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner can manage templates" ON email_templates
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');

-- ── Email logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid        REFERENCES email_templates(id) ON DELETE SET NULL,
  to_email    text        NOT NULL,
  to_name     text,
  subject     text        NOT NULL,
  client_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  matter_id   uuid        REFERENCES matters(id) ON DELETE SET NULL,
  sent_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  resend_id   text,
  status      text        NOT NULL DEFAULT 'sent',
  error       text,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner can read email logs" ON email_logs
  FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');
CREATE POLICY "service role can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (true);

-- ── Seed default templates ────────────────────────────────────────────────────
INSERT INTO email_templates (slug, name, subject, body_html, is_auto, trigger_event, variables) VALUES

('onboarding',
 'Client Onboarding',
 'Welcome to {{firm_name}} — Your Account is Ready',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Welcome to {{firm_name}}</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">Your client account has been created. You can now access the {{firm_name}} portal to track your case, communicate with your lawyer, and manage documents.</p>
<div style="background:#F6F1EA;border-left:3px solid {{primary_color}};border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0 0 8px;font-size:13px;color:#8A817B;text-transform:uppercase;letter-spacing:0.05em;">Your Login Details</p>
  <p style="margin:0 0 6px;"><strong>Email:</strong> {{client_email}}</p>
  <p style="margin:0;"><strong>Temporary Password:</strong> {{temp_password}}</p>
</div>
<p style="margin:0 0 16px;">Please change your password after your first login.</p>
<p style="margin:0;">If you have any questions, please contact us at <a href="mailto:{{from_email}}" style="color:{{primary_color}};">{{from_email}}</a>.</p>',
 true, 'user.created',
 '["client_name","client_email","temp_password","firm_name","from_email","primary_color"]'::jsonb),

('matter_opened',
 'Matter Opened',
 'Your Matter Has Been Opened — {{matter_ref}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Your Matter Has Been Opened</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">We have opened a new matter for you. Here are the details:</p>
<div style="background:#F6F1EA;border-radius:8px;padding:20px;margin:24px 0;">
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Matter Reference</td><td style="padding:6px 0;font-weight:600;text-align:right;">{{matter_ref}}</td></tr>
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Type</td><td style="padding:6px 0;text-align:right;">{{matter_type}}</td></tr>
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Status</td><td style="padding:6px 0;text-align:right;">Intake</td></tr>
  </table>
</div>
<p style="margin:0 0 16px;">Your assigned lawyer will be in touch shortly. You can track progress in real time through the Bastion Law client app.</p>
<p style="margin:0;">Regards,<br><strong>{{firm_name}}</strong></p>',
 true, 'matter.created',
 '["client_name","matter_ref","matter_type","firm_name","primary_color"]'::jsonb),

('status_update',
 'Case Status Update',
 'Update on Your Matter — {{matter_ref}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Case Status Update</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">There has been an update on your matter <strong>{{matter_ref}}</strong>.</p>
<div style="background:#F6F1EA;border-left:3px solid {{primary_color}};border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0 0 6px;font-size:13px;color:#8A817B;text-transform:uppercase;letter-spacing:0.05em;">New Status</p>
  <p style="margin:0;font-size:18px;font-weight:600;color:{{primary_color}};">{{new_stage}}</p>
</div>
<p style="margin:0 0 16px;">{{custom_message}}</p>
<p style="margin:0 0 16px;">Please log in to the Bastion Law app for full details.</p>
<p style="margin:0;">Regards,<br><strong>{{lawyer_name}}</strong><br>{{firm_name}}</p>',
 true, 'matter.stage_changed',
 '["client_name","matter_ref","new_stage","custom_message","lawyer_name","firm_name","primary_color"]'::jsonb),

('invoice',
 'Invoice',
 'Invoice {{invoice_ref}} from {{firm_name}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Invoice {{invoice_ref}}</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">Please find your invoice details for matter <strong>{{matter_ref}}</strong> below.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0;background:#F6F1EA;border-radius:8px;overflow:hidden;">
  <tr style="border-bottom:1px solid #ECE4D9;">
    <td style="padding:14px 20px;color:#8A817B;font-size:13px;">Invoice Number</td>
    <td style="padding:14px 20px;font-weight:600;text-align:right;">{{invoice_ref}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ECE4D9;">
    <td style="padding:14px 20px;color:#8A817B;font-size:13px;">Matter</td>
    <td style="padding:14px 20px;text-align:right;">{{matter_ref}}</td>
  </tr>
  <tr style="border-bottom:1px solid #ECE4D9;">
    <td style="padding:14px 20px;color:#8A817B;font-size:13px;">Amount Due</td>
    <td style="padding:14px 20px;font-weight:700;font-size:18px;color:{{primary_color}};text-align:right;">{{amount_pkr}}</td>
  </tr>
  <tr>
    <td style="padding:14px 20px;color:#8A817B;font-size:13px;">Due Date</td>
    <td style="padding:14px 20px;text-align:right;">{{due_date}}</td>
  </tr>
</table>
<p style="margin:0 0 16px;">Please make payment via bank transfer. Once payment is confirmed by our office, your invoice status will be updated in the app.</p>
<p style="margin:0;">Regards,<br><strong>{{firm_name}}</strong></p>',
 false, null,
 '["client_name","invoice_ref","matter_ref","amount_pkr","due_date","firm_name","primary_color"]'::jsonb),

('appointment_confirmation',
 'Appointment Confirmation',
 'Your Appointment is Confirmed — {{appointment_date}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Appointment Confirmed</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">Your appointment has been confirmed. Please see the details below:</p>
<div style="background:#F6F1EA;border-radius:8px;padding:20px;margin:24px 0;">
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Date & Time</td><td style="padding:6px 0;font-weight:600;text-align:right;">{{appointment_date}}</td></tr>
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Type</td><td style="padding:6px 0;text-align:right;">{{meeting_type}}</td></tr>
    <tr><td style="padding:6px 0;color:#8A817B;font-size:13px;">Lawyer</td><td style="padding:6px 0;text-align:right;">{{lawyer_name}}</td></tr>
  </table>
</div>
{{#video}}<p style="margin:0 0 16px;"><a href="{{video_room_url}}" style="display:inline-block;background:{{primary_color}};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Join Video Call</a></p>{{/video}}
<p style="margin:0;">Please be available 5 minutes before your scheduled time.</p>',
 true, 'appointment.confirmed',
 '["client_name","appointment_date","meeting_type","lawyer_name","video_room_url","firm_name","primary_color"]'::jsonb),

('due_date_reminder',
 'Due Date Reminder',
 'Reminder: Action Required on {{matter_ref}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Action Required</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">This is a reminder that the following action on your matter requires your attention:</p>
<div style="background:#FDF0EE;border-left:3px solid #C0392B;border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0 0 8px;font-weight:600;font-size:16px;color:#241D1C;">{{task_title}}</p>
  <p style="margin:0 0 4px;font-size:13px;color:#8A817B;">Matter: {{matter_ref}}</p>
  <p style="margin:0;font-size:13px;color:#C0392B;font-weight:600;">Due: {{due_date}}</p>
</div>
<p style="margin:0;">Please log in to the Bastion Law app to complete this action before the deadline.</p>',
 true, 'task.due_soon',
 '["client_name","task_title","matter_ref","due_date","firm_name","primary_color"]'::jsonb),

('lawyer_assigned',
 'Lawyer Assigned',
 'Your Lawyer Has Been Assigned — {{matter_ref}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Your Lawyer Has Been Assigned</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">We are pleased to inform you that a lawyer has been assigned to your matter <strong>{{matter_ref}}</strong>.</p>
<div style="background:#F6F1EA;border-left:3px solid {{primary_color}};border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0 0 4px;font-size:13px;color:#8A817B;">Your Assigned Lawyer</p>
  <p style="margin:0;font-size:18px;font-weight:600;">{{lawyer_name}}</p>
</div>
<p style="margin:0 0 16px;">Your lawyer will be in touch shortly. You can also message them directly through the Bastion Law client app.</p>
<p style="margin:0;">Regards,<br><strong>{{firm_name}}</strong></p>',
 true, 'matter.lawyer_assigned',
 '["client_name","matter_ref","lawyer_name","firm_name","primary_color"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;
