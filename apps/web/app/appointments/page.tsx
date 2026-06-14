'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Check, X, Clock } from 'lucide-react';

interface Appointment {
  id: string; status: string; type: string; proposed_at: string;
  duration_minutes: number; agenda: string | null;
  client: { full_name: string };
  lawyer: { full_name: string };
  matter: { matter_ref: string; title: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-[#F6ECD8] text-[#9A6B1E]',
  confirmed: 'bg-[#EAF1EC] text-[#3F7A5B]',
  rejected: 'bg-[#FDF0EE] text-[#C0392B]',
  cancelled: 'bg-[#F3EDE3] text-[#A89F99]',
  completed: 'bg-[#F3EDE3] text-[#6E635F]',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('id, status, type, proposed_at, duration_minutes, agenda, client:profiles!client_id(full_name), lawyer:profiles!lawyer_id(full_name), matter:matters(matter_ref, title)')
      .order('proposed_at', { ascending: false });
    if (data) setAppointments(data as unknown as Appointment[]);
    setLoading(false);
  }

  async function respond(id: string, status: 'confirmed' | 'rejected') {
    await supabase.from('appointments').update({ status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null }).eq('id', id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  }

  const filtered = appointments.filter((a) => filter === 'all' || a.status === filter);

  return (
    <PageShell title="Appointments">
      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'confirmed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-[#6B1E2B] text-white' : 'bg-white border border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div> : (
        <div className="space-y-3">
          {filtered.map((appt) => (
            <div key={appt.id} className="bg-white border border-[#ECE4D9] rounded-2xl p-5 flex items-start gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[appt.status] ?? 'bg-[#F3EDE3] text-[#8A817B]'}`}>{appt.status}</span>
                  <span className="text-xs text-[#A89F99]">{appt.type === 'video' ? 'Video Call' : 'In-Person'} · {appt.duration_minutes} min</span>
                </div>
                <p className="font-semibold text-[#241D1C] text-sm mb-1">
                  {appt.client.full_name} → {appt.lawyer.full_name}
                </p>
                {appt.matter && <p className="text-xs text-[#A89F99] mb-2">{appt.matter.matter_ref} · {appt.matter.title}</p>}
                <p className="text-sm text-[#6E635F]">
                  {new Date(appt.proposed_at).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                {appt.agenda && <p className="text-xs text-[#8A817B] mt-2 line-clamp-2">{appt.agenda}</p>}
              </div>
              {appt.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => respond(appt.id, 'confirmed')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EAF1EC] border border-[#3F7A5B]/30 text-[#3F7A5B] text-xs font-semibold hover:bg-[#3F7A5B] hover:text-white transition-colors">
                    <Check size={13} /> Accept
                  </button>
                  <button onClick={() => respond(appt.id, 'rejected')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FDF0EE] border border-[#C0392B]/30 text-[#C0392B] text-xs font-semibold hover:bg-[#C0392B] hover:text-white transition-colors">
                    <X size={13} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-[#A89F99] py-12">No appointments found.</p>}
        </div>
      )}
    </PageShell>
  );
}
