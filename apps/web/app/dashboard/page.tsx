'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Briefcase, FileText, Clock, Users } from 'lucide-react';

interface Stats { matters: number; pendingDocs: number; openAppts: number; lawyers: number; clients: number; }
interface SLAItem { id: string; matter_ref: string; client_name: string; elapsed_minutes: number; }
interface UpcomingEvent { id: string; title: string; event_date: string; event_time: string | null; type: string; }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ matters: 0, pendingDocs: 0, openAppts: 0, lawyers: 0, clients: 0 });
  const [slaItems, setSlaItems] = useState<SLAItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const [mattersRes, docsRes, apptsRes, lawyersRes, clientsRes, eventsRes, msgsRes] = await Promise.all([
      supabase.from('matters').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'lawyer'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('events').select('id, title, event_date, event_time, type').gte('event_date', today).order('event_date').limit(5),
      supabase.from('messages').select('matter_id, sender_id, created_at, body, sender:profiles!sender_id(role)').order('created_at', { ascending: false }).limit(100),
    ]);

    setStats({
      matters: mattersRes.count ?? 0,
      pendingDocs: docsRes.count ?? 0,
      openAppts: apptsRes.count ?? 0,
      lawyers: lawyersRes.count ?? 0,
      clients: clientsRes.count ?? 0,
    });

    // Build SLA from messages
    if (msgsRes.data) {
      const byMatter = new Map<string, any[]>();
      for (const m of (msgsRes.data as any[])) {
        if (!byMatter.has(m.matter_id)) byMatter.set(m.matter_id, []);
        byMatter.get(m.matter_id)!.push(m);
      }
      const sla: SLAItem[] = [];
      const { data: matters } = await supabase.from('matters').select('id, matter_ref, client:profiles!client_id(full_name)').eq('status', 'active');
      for (const [mId, msgs] of byMatter) {
        const last = msgs[0];
        if ((last.sender as any)?.role === 'lawyer') continue;
        const elapsed = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 60000);
        if (elapsed > 60) {
          const matter = matters?.find((m) => m.id === mId);
          if (matter) sla.push({ id: mId, matter_ref: matter.matter_ref, client_name: (matter as any).client.full_name, elapsed_minutes: elapsed });
        }
      }
      setSlaItems(sla.slice(0, 5));
    }

    if (eventsRes.data) setUpcoming(eventsRes.data as UpcomingEvent[]);
    setLoading(false);
  }

  if (loading) return <PageShell title="Dashboard"><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div></PageShell>;

  return (
    <PageShell title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard icon={Briefcase} label="Active Matters" value={stats.matters} />
        <StatCard icon={FileText} label="Pending Docs" value={stats.pendingDocs} alert={stats.pendingDocs > 0} />
        <StatCard icon={Clock} label="Pending Appointments" value={stats.openAppts} alert={stats.openAppts > 0} />
        <StatCard icon={Users} label="Lawyers" value={stats.lawyers} />
        <StatCard icon={Users} label="Clients" value={stats.clients} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* SLA Queue */}
        <div className="col-span-2 bg-[#FDF0EE] border border-[#ECCDC8] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#C0392B] animate-pulse" />
            <h3 className="text-[10px] font-semibold text-[#C0392B] tracking-widest">SLA QUEUE — {slaItems.length} FLAGGED</h3>
          </div>
          {slaItems.length === 0 && <p className="text-sm text-[#6E635F]">No SLA breaches. All messages answered.</p>}
          {slaItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3 border-t border-[#ECCDC8]">
              <div>
                <p className="text-sm font-semibold text-[#241D1C]">{item.client_name}</p>
                <p className="text-xs text-[#A89F99]">{item.matter_ref}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${item.elapsed_minutes >= 120 ? 'bg-[#C0392B] text-white' : 'bg-[#F6ECD8] text-[#9A6B1E]'}`}>
                {item.elapsed_minutes >= 60 ? `${Math.floor(item.elapsed_minutes / 60)}h ${item.elapsed_minutes % 60}m` : `${item.elapsed_minutes}m`}
              </span>
            </div>
          ))}
        </div>

        {/* Upcoming events */}
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-4">UPCOMING</h3>
          {upcoming.map((ev) => (
            <div key={ev.id} className="flex gap-3 mb-4">
              <div className={`w-1 rounded-full flex-shrink-0 ${evColor(ev.type)}`} />
              <div>
                <p className="text-sm font-semibold text-[#241D1C] leading-snug">{ev.title}</p>
                <p className="text-xs text-[#A89F99] mt-0.5">{fmtDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''}</p>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-sm text-[#6E635F]">No upcoming events.</p>}
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value, alert }: { icon: any; label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${alert ? 'bg-[#FDF0EE] border-[#C0392B]/30' : 'bg-white border-[#ECE4D9]'}`}>
      <Icon size={20} className={`mb-3 ${alert ? 'text-[#C0392B]' : 'text-[#A89F99]'}`} strokeWidth={1.7} />
      <p className={`text-3xl font-bold mb-1 ${alert ? 'text-[#C0392B]' : 'text-[#241D1C]'}`}>{value}</p>
      <p className={`text-[10px] font-medium tracking-wider ${alert ? 'text-[#C0392B]' : 'text-[#8A817B]'}`}>{label.toUpperCase()}</p>
    </div>
  );
}

function evColor(t: string) { return t === 'hearing' ? 'bg-[#9A6B1E]' : t === 'deadline' ? 'bg-[#C0392B]' : 'bg-[#6B1E2B]'; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }); }

export function PageShell({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#241D1C]">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}
