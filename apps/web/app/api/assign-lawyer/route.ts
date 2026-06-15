import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: NextRequest) {
  try {
    const { matter_id, lawyer_id, assigned_by } = await req.json();
    if (!matter_id || !lawyer_id) {
      return NextResponse.json({ error: 'matter_id and lawyer_id are required' }, { status: 400 });
    }

    // Fetch matter + client + lawyer info
    const { data: matter, error: mErr } = await adminSupabase
      .from('matters')
      .select('id, matter_ref, title, client_id, lead_lawyer_id')
      .eq('id', matter_id)
      .single();

    if (mErr || !matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    if (matter.lead_lawyer_id) return NextResponse.json({ error: 'Lawyer already assigned' }, { status: 409 });

    const [{ data: lawyer }, { data: client }] = await Promise.all([
      adminSupabase.from('profiles').select('full_name').eq('id', lawyer_id).single(),
      adminSupabase.from('profiles').select('full_name, email').eq('id', matter.client_id).single(),
    ]);

    // Assign lawyer on the matter
    await adminSupabase.from('matters').update({
      lead_lawyer_id: lawyer_id,
      updated_at: new Date().toISOString(),
    }).eq('id', matter_id);

    // Add to matter_lawyers join table
    await adminSupabase.from('matter_lawyers').upsert({
      matter_id, lawyer_id, role: 'lead',
    }, { onConflict: 'matter_id,lawyer_id' });

    // Audit log
    await adminSupabase.from('audit_logs').insert({
      matter_id,
      actor_id:   assigned_by ?? null,
      action:     'lawyer_assigned',
      details:    { lawyer_id, lawyer_name: lawyer?.full_name, matter_ref: matter.matter_ref },
    });

    // In-app notification to client
    await adminSupabase.from('notifications').insert({
      user_id:   matter.client_id,
      type:      'case_update',
      title:     'Lawyer Assigned',
      body:      `${lawyer?.full_name ?? 'Your lawyer'} has been assigned to ${matter.matter_ref}.`,
      matter_id,
    });

    // Push notification (best-effort)
    await adminSupabase.functions.invoke('send-push', {
      body: {
        user_id: matter.client_id,
        title:   'Lawyer Assigned',
        body:    `${lawyer?.full_name ?? 'Your lawyer'} has been assigned to your matter.`,
      },
    }).catch(() => {});

    // Email notification (best-effort)
    if (client?.email) {
      await fetch(`${req.nextUrl.origin}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_slug: 'lawyer_assigned',
          to_email:      client.email,
          to_name:       client.full_name,
          client_id:     matter.client_id,
          matter_id,
          sent_by:       assigned_by ?? null,
          vars: {
            client_name: client.full_name,
            matter_ref:  matter.matter_ref,
            lawyer_name: lawyer?.full_name ?? 'Your lawyer',
          },
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
