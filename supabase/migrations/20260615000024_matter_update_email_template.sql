-- Add matter_update email template (used by stage-change notifications)
INSERT INTO email_templates (slug, name, subject, body_html, is_auto, trigger_event, variables) VALUES

('matter_update',
 'Matter Update',
 'Update on Your Matter — {{matter_ref}}',
 '<h2 style="color:{{primary_color}};margin:0 0 20px;font-size:22px;">Matter Update</h2>
<p style="margin:0 0 16px;">Dear {{client_name}},</p>
<p style="margin:0 0 16px;">There is an update on your matter <strong>{{matter_title}}</strong> ({{matter_ref}}).</p>
<div style="background:#F6F1EA;border-left:3px solid {{primary_color}};border-radius:8px;padding:20px;margin:24px 0;">
  <p style="margin:0;font-size:15px;color:#241D1C;line-height:1.6;">{{update_body}}</p>
</div>
<p style="margin:0 0 16px;">Please log in to the Bastion Law app for full details and to communicate with your lawyer.</p>
<p style="margin:0;">Regards,<br><strong>{{firm_name}}</strong></p>',
 true, 'matter.updated',
 '["client_name","matter_ref","matter_title","update_body","firm_name","primary_color"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;
