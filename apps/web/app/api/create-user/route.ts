import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, phone, role } = await req.json();
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['client', 'lawyer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Update profile (handle_new_user trigger creates it automatically)
    if (data.user) {
      await adminSupabase.from('profiles').update({ full_name, phone: phone || null, role }).eq('id', data.user.id);
    }

    // Send onboarding email to new clients
    if (role === 'client' && data.user) {
      await fetch(`${req.nextUrl.origin}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_slug: 'onboarding',
          to_email:      email,
          to_name:       full_name,
          client_id:     data.user.id,
          vars: {
            client_name:  full_name,
            client_email: email,
            temp_password: password,
          },
        }),
      }).catch(() => {}); // non-blocking — don't fail user creation if email fails
    }

    return NextResponse.json({ id: data.user?.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
