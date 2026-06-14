import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderEmail, type FirmSettings } from '../../../lib/email';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: NextRequest) {
  try {
    const {
      template_slug,
      to_email,
      to_name,
      vars = {},
      client_id,
      matter_id,
      sent_by,
    }: {
      template_slug: string;
      to_email: string;
      to_name?: string;
      vars?: Record<string, string>;
      client_id?: string;
      matter_id?: string;
      sent_by?: string;
    } = await req.json();

    if (!template_slug || !to_email) {
      return NextResponse.json({ error: 'template_slug and to_email are required' }, { status: 400 });
    }

    // Fetch template + firm settings in parallel
    const [tplRes, settingsRes] = await Promise.all([
      adminSupabase.from('email_templates').select('*').eq('slug', template_slug).single(),
      adminSupabase.from('firm_settings').select('*').limit(1).single(),
    ]);

    if (tplRes.error || !tplRes.data) {
      return NextResponse.json({ error: `Template '${template_slug}' not found` }, { status: 404 });
    }

    const settings: FirmSettings = settingsRes.data ?? {
      from_email:    'noreply@bastionlaw.pk',
      from_name:     'Bastion Law',
      reply_to:      null,
      logo_url:      null,
      primary_color: '#6B1E2B',
      accent_color:  '#B68A4E',
      firm_address:  null,
    };

    const { subject, html } = renderEmail(tplRes.data, vars, settings);

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Dev mode: log to console, still record in DB
      console.log(`[EMAIL DEV] To: ${to_email} | Subject: ${subject}`);
    }

    let resendId: string | null = null;
    let status = 'sent';
    let errorMsg: string | null = null;

    if (resendKey) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${settings.from_name} <${settings.from_email}>`,
          to: to_name ? [`${to_name} <${to_email}>`] : [to_email],
          reply_to: settings.reply_to ?? undefined,
          subject,
          html,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        status = 'failed';
        errorMsg = resendData.message ?? JSON.stringify(resendData);
      } else {
        resendId = resendData.id;
      }
    }

    // Log to DB
    await adminSupabase.from('email_logs').insert({
      template_id: tplRes.data.id,
      to_email,
      to_name: to_name ?? null,
      subject,
      client_id:  client_id ?? null,
      matter_id:  matter_id ?? null,
      sent_by:    sent_by ?? null,
      resend_id:  resendId,
      status,
      error:      errorMsg,
    });

    if (status === 'failed') {
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    return NextResponse.json({ ok: true, resend_id: resendId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
