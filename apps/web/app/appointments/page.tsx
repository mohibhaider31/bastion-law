'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Check, X, Video, MapPin } from 'lucide-react';

interface Appointment {
  id: string; status: string; type: string; proposed_at: string;
  duration_minutes: number; agenda: string | null;
  video_room_url: string | null;
  client: { full_name: string };
  lawyer: { full_name: string };
  matter: { matter_ref: string; title: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending:          'bg-[#F6ECD8] text-[#9A6B1E]',
  counter_proposed: 'bg-[#F6ECD8] text-[#9A6B1E]',
  confirmed:        'bg-[#EAF1EC] text-[#3F7A5B]',
  rejected:         'bg-[#FDF0EE] text-[#C0392B]',
  cancelled:        'bg-[#F3EDE3] text-[#A89F99]',
  completed:        'bg-[#F3EDE3] text-[#6E635F]',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('id, status, type, proposed_at, duration_minutes, agenda, video_room_url, client:profiles!client_id(full_name), lawyer:profiles!lawyer_id(full_name), matter:matters(matter_ref, title)')
      .order('proposed_at', { ascending: false });
    if (data) setAppointments(data as unknown as Appointment[]);
    setLoading(false);
  }

  async function respond(id: string, status: 'confirmed' | 'rejected') {
    const appt = appointments.find((a) => a.id === id);
    const videoRoomUrl = (status === 'confirmed' && appt?.type === 'video')
      ? `https://meet.jit.si/bastion-${id.replace(/-/g, '').slice(0, 16)}`
      : null;
    const update: Record<string, unknown> = { status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null };
    if (videoRoomUrl) update.video_room_url = videoRoomUrl;
    await supabase.from('appointments').update(update).eq('id', id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status, video_room_url: videoRoomUrl ?? a.video_room_url } : a));
  }

  async function markCompleted(id: string) {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'completed' } : a));
  }

  const filtered = appointments.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return a.status === 'pending' || a.status === 'counter_proposed';
    return a.status === filter;
  });

  const pendingCount = appointments.filter((a) => a.status === 'pending' || a.status === 'counter_proposed').length;

  return (
    <PageShell title="Appointments">
      <div className="flex gap-2 mb-5">
        {([
          { key: 'all', label: 'All' },
          { key: 'pending', label: pendingCount > 0 ? `Pending (${pendingCount})` : 'Pending' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'completed', label: 'Completed' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === key ? 'bg-[#6B1E2B] text-white' : 'bg-white border border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div> : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const isPast = new Date(appt.proposed_at) < new Date();
            return (
              <div key={appt.id} className="bg-white border border-[#ECE4D9] rounded-2xl p-5 flex items-start gap-5">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[appt.status] ?? 'bg-[#F3EDE3] text-[#8A817B]'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#A89F99]">
                      {appt.type === 'video' ? <Video size={11} /> : <MapPin size={11} />}
                      {appt.type === 'video' ? 'Video Call' : 'In-Person'} · {appt.duration_minutes} min
                    </span>
                    {isPast && appt.status === 'confirmed' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F6ECD8] text-[#9A6B1E]">Past</span>
                    )}
                  </div>
                  <p className="font-semibold text-[#241D1C] text-sm mb-1">
                    {appt.client.full_name} → {appt.lawyer.full_name}
                  </p>
                  {appt.matter && <p className="text-xs text-[#A89F99] mb-2">{appt.matter.matter_ref} · {appt.matter.title}</p>}
                  <p className="text-sm text-[#6E635F]">
                    {new Date(appt.proposed_at).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {appt.agenda && <p className="text-xs text-[#8A817B] mt-2 line-clamp-2 italic">"{appt.agenda}"</p>}

                  {/* Video room link for confirmed video appointments */}
                  {appt.status === 'confirmed' && appt.type === 'video' && appt.video_room_url && (
                    <a href={appt.video_room_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-[#6B1E2B] text-white text-xs font-semibold hover:bg-[#4A141E] transition-colors">
                      <Video size={12} /> Join Video Call
                    </a>
                  )}
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {(appt.status === 'pending' || appt.status === 'counter_proposed') && (
                    <>
                      <button onClick={() => respond(appt.id, 'confirmed')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EAF1EC] border border-[#3F7A5B]/30 text-[#3F7A5B] text-xs font-semibold hover:bg-[#3F7A5B] hover:text-white transition-colors">
                        <Check size={13} /> Accept
                      </button>
                      <button onClick={() => respond(appt.id, 'rejected')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FDF0EE] border border-[#C0392B]/30 text-[#C0392B] text-xs font-semibold hover:bg-[#C0392B] hover:text-white transition-colors">
                        <X size={13} /> Reject
                      </button>
                    </>
                  )}
                  {appt.status === 'confirmed' && isPast && (
                    <button onClick={() => markCompleted(appt.id)}
                      className="px-3 py-2 rounded-xl bg-[#F3EDE3] border border-[#ECE4D9] text-[#8A817B] text-xs font-semibold hover:bg-[#ECE4D9] transition-colors">
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-sm text-[#A89F99] py-12">No appointments found.</p>}
        </div>
      )}
    </PageShell>
  );
}
