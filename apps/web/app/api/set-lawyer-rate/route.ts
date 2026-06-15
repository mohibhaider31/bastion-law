import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: NextRequest) {
  try {
    const { lawyer_id, hourly_rate_pkr } = await req.json();
    if (!lawyer_id) return NextResponse.json({ error: 'lawyer_id required' }, { status: 400 });

    const rate = hourly_rate_pkr === '' || hourly_rate_pkr === null ? null : parseFloat(hourly_rate_pkr);
    if (rate !== null && isNaN(rate)) return NextResponse.json({ error: 'Invalid rate' }, { status: 400 });

    const { error } = await adminSupabase
      .from('profiles')
      .update({ hourly_rate_pkr: rate, updated_at: new Date().toISOString() })
      .eq('id', lawyer_id)
      .eq('role', 'lawyer');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
