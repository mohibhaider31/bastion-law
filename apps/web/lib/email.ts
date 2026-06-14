export interface FirmSettings {
  from_email: string;
  from_name: string;
  reply_to: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  firm_address: string | null;
}

export interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body_html: string;
  is_auto: boolean;
  trigger_event: string | null;
  variables: string[];
}

export function replaceVars(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{{${k}}}`, v ?? ''),
    template,
  );
}

export function buildEmailHtml(bodyHtml: string, settings: FirmSettings): string {
  const header = settings.logo_url
    ? `<img src="${settings.logo_url}" height="36" alt="${settings.from_name}" style="display:block;border:0;max-height:36px;">`
    : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${settings.from_name}</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background:#F6F1EA;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1EA;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${settings.primary_color};padding:28px 40px;">
            ${header}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;color:#241D1C;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#F6F1EA;color:#8A817B;font-size:12px;line-height:1.6;border-top:1px solid #ECE4D9;">
            <strong style="color:#6E635F;">${settings.from_name}</strong>
            ${settings.firm_address ? `<br>${settings.firm_address}` : ''}
            <br><br>
            This is an automated notification from ${settings.from_name}. Please do not reply directly to this email.
            ${settings.reply_to ? `<br>For assistance, contact <a href="mailto:${settings.reply_to}" style="color:${settings.primary_color};">${settings.reply_to}</a>` : ''}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderEmail(
  template: Pick<EmailTemplate, 'subject' | 'body_html'>,
  vars: Record<string, string>,
  settings: FirmSettings,
): { subject: string; html: string } {
  const allVars = {
    ...vars,
    firm_name:     settings.from_name,
    from_email:    settings.from_email,
    primary_color: settings.primary_color,
    accent_color:  settings.accent_color,
  };
  const subject = replaceVars(template.subject, allVars);
  const body    = replaceVars(template.body_html, allVars);
  const html    = buildEmailHtml(body, settings);
  return { subject, html };
}

// Variable metadata for the UI variable reference panel
export const TEMPLATE_VARIABLES: Record<string, { label: string; example: string }> = {
  client_name:      { label: 'Client Name',       example: 'Tariq Enterprises Ltd' },
  client_email:     { label: 'Client Email',       example: 'client@example.pk' },
  temp_password:    { label: 'Temp Password',      example: 'TempP@ss123' },
  matter_ref:       { label: 'Matter Reference',   example: 'MAT-2026-001' },
  matter_type:      { label: 'Matter Type',        example: 'Commercial Dispute' },
  new_stage:        { label: 'New Stage',          example: 'Filing' },
  custom_message:   { label: 'Custom Message',     example: 'Your documents have been reviewed.' },
  lawyer_name:      { label: 'Lawyer Name',        example: 'Zara Hussain' },
  invoice_ref:      { label: 'Invoice Reference',  example: 'INV-2026-042' },
  amount_pkr:       { label: 'Amount (PKR)',        example: 'PKR 150,000' },
  due_date:         { label: 'Due Date',            example: '30 June 2026' },
  appointment_date: { label: 'Appointment Date',   example: '25 June 2026, 3:00 PM' },
  meeting_type:     { label: 'Meeting Type',       example: 'Video Call' },
  video_room_url:   { label: 'Video Room URL',     example: 'https://meet.jit.si/bastion-...' },
  task_title:       { label: 'Task Title',         example: 'Submit signed affidavit' },
  firm_name:        { label: 'Firm Name',          example: 'Bastion Law' },
  from_email:       { label: 'Firm Email',         example: 'noreply@bastionlaw.pk' },
  primary_color:    { label: 'Primary Color',      example: '#6B1E2B' },
};
