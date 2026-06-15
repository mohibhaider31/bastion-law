'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, Calendar, X, ChevronRight } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  type: string;
  location: string | null;
  matter_id: string;
  matter: { matter_ref: string; title: string; client: { full_name: string } } | null;
}

const TYPE_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  hearing:  { label: 'Hearing',  cls: 'bg-[#F6ECD8] text-[#9A6B1E]',  dot: 'bg-[#9A6B1E]' },
  deadline: { label: 'Deadline', cls: 'bg-[#FDF0EE] text-[#C0392B]',  dot: 'bg-[#C0392B]' },
  filing:   { label: 'Filing',   cls: 'bg-[#EAF1EC] text-[#3F7A5B]',  dot: 'bg-[#3F7A5B]' },
  meeting:  { label: 'Meeting',  cls: 'bg-[#FBF1EE] text-[#6B1E2B]',  dot: 'bg-[#6B1E2B]' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}
function isToday(iso: string) {
  return iso === new Date().toISOString().split('T')[0];
}
function isPast(iso: string) {
  return iso < new Date().toISOString().split('T')[0];
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showPast, setShowPast] = useState(false);
  const [modal, setModal] = useState(false);
  const [matters, setMatters] = useState<{ id: string; matter_ref: string; title: string }[]>([]);
  const [form, setForm] = useState({ matter_id: '', type: 'hearing', title: '', event_date: '', event_time: '', location: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [evRes, matRes] = await Promise.all([
      supabase.from('events').select('id, title, event_date, event_time, type, location, matter_id, matter:matters!matter_id(matter_ref, title, client:profiles!client_id(full_name))').order('event_date').order('event_time'),
      supabase.from('matters').select('id, matter_ref, title').eq('status', 'active').order('opened_at', { ascending: false }),
    ]);
    if (evRes.data) setEvents(evRes.data as unknown as Event[]);
    if (matRes.data) setMatters(matRes.data);
    setLoading(false);
  }

  async function addEvent() {
    if (!form.matter_id || !form.title || !form.event_date) return;
    setSaving(true);
    const { data: p } = await supabase.auth.getUser();
    await supabase.from('events').insert({
      matter_id: form.matter_id,
      type: form.type,
      title: form.title,
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location || null,
      created_by: p.user?.id,
    });
    setSaving(false);
    setModal(false);
    setForm({ matter_id: '', type: 'hearing', title: '', event_date: '', event_time: '', location: '' });
    load();
  }

  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);

  const filtered = (showPast ? [...upcoming, ...past] : upcoming).filter((e) => typeFilter === 'all' || e.type === typeFilter);

  // Group by date
  const grouped = new Map<string, Event[]>();
  for (const e of filtered) {
    if (!grouped.has(e.event_date)) grouped.set(e.event_date, []);
    grouped.get(e.event_date)!.push(e);
  }

  const upcomingCount = upcoming.length;
  const todayCount = events.filter((e) => isToday(e.event_date)).length;
  const overdueCount = events.filter((e) => isPast(e.event_date) && !isToday(e.event_date)).length;

  return (
    <PageShell title="Events & Calendar" action={
      <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> Add Event
      </button>
    }>
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'UPCOMING', value: upcomingCount, cls: 'text-[#241D1C]' },
          { label: 'TODAY', value: todayCount, cls: todayCount > 0 ? 'text-[#9A6B1E]' : 'text-[#241D1C]' },
          { label: 'PAST DUE', value: overdueCount, cls: overdueCount > 0 ? 'text-[#C0392B]' : 'text-[#241D1C]' },
          { label: 'TOTAL', value: events.length, cls: 'text-[#241D1C]' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
            <p className="text-[10px] font-medium text-[#8A817B] tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'hearing', 'deadline', 'filing', 'meeting'] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${typeFilter === t ? 'bg-[#6B1E2B] text-white' : 'bg-white border border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'}`}>
              {t === 'all' ? 'All Types' : TYPE_CONFIG[t]?.label ?? t}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPast(!showPast)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showPast ? 'bg-[#F3EDE3] text-[#8A817B]' : 'bg-white border border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'}`}>
          {showPast ? 'Hide past' : 'Show past'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar size={36} className="text-[#C5BBB5] mx-auto mb-3" strokeWidth={1.2} />
          <p className="text-sm text-[#A89F99]">No events found.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([date, dayEvents]) => (
            <div key={date}>
              <div className={`flex items-center gap-3 mb-3 ${isPast(date) && !isToday(date) ? 'opacity-60' : ''}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isToday(date) ? 'bg-[#9A6B1E]' : isPast(date) ? 'bg-[#C5BBB5]' : 'bg-[#6B1E2B]'}`} />
                <p className={`text-sm font-semibold ${isToday(date) ? 'text-[#9A6B1E]' : 'text-[#241D1C]'}`}>
                  {isToday(date) ? 'Today — ' : ''}{fmtDate(date)}
                </p>
              </div>
              <div className="space-y-2 ml-5">
                {dayEvents.map((ev) => {
                  const tc = TYPE_CONFIG[ev.type] ?? { label: ev.type, cls: 'bg-[#F3EDE3] text-[#8A817B]', dot: 'bg-[#A89F99]' };
                  return (
                    <div key={ev.id} className="bg-white border border-[#ECE4D9] rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                      <div className={`w-1 self-stretch rounded-full ${tc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.cls}`}>{tc.label.toUpperCase()}</span>
                          {ev.event_time && <span className="text-xs text-[#A89F99]">{ev.event_time.slice(0, 5)}</span>}
                        </div>
                        <p className="text-sm font-semibold text-[#241D1C] truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.matter && (
                            <button onClick={() => router.push(`/matters/${ev.matter_id}`)}
                              className="text-xs text-[#6B1E2B] font-medium hover:underline">
                              {ev.matter.matter_ref}
                            </button>
                          )}
                          {ev.matter?.client && <span className="text-xs text-[#A89F99]">· {ev.matter.client.full_name}</span>}
                          {ev.location && <span className="text-xs text-[#A89F99]">· 📍 {ev.location}</span>}
                        </div>
                      </div>
                      <button onClick={() => router.push(`/matters/${ev.matter_id}`)}
                        className="text-[#C5BBB5] hover:text-[#6B1E2B] transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Event Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[#241D1C]">Add Event</h3>
              <button onClick={() => setModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6F1EA] transition-colors">
                <X size={16} className="text-[#8A817B]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">MATTER</label>
                <select value={form.matter_id} onChange={(e) => setForm({ ...form, matter_id: e.target.value })}
                  className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]">
                  <option value="">Select matter…</option>
                  {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_ref} — {m.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">TYPE</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]">
                    <option value="hearing">Hearing</option>
                    <option value="deadline">Deadline</option>
                    <option value="filing">Filing</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">DATE</label>
                  <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">TITLE</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Writ petition hearing — Division Bench"
                  className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">TIME (OPTIONAL)</label>
                  <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">LOCATION (OPTIONAL)</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Karachi High Court"
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={addEvent} disabled={saving || !form.matter_id || !form.title || !form.event_date}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {saving ? 'Adding…' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
