'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Briefcase, FileText, Clock, Users, ArrowRight } from 'lucide-react';

interface Stats { matters: number; pendingDocs: number; openAppts: number; lawyers: number; clients: number; revenueThisMonth: number; }
interface SLAItem { id: string; matter_ref: string; client_name: string; elapsed_minutes: number; }
interface UpcomingEvent { id: string; title: string; event_date: string; event_time: string | null; type: string; }
interface ActivityItem { id: string; action: string; actor_type: string; matter_ref: string | null; matter_id: string | null; created_at: string; }

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ matters: 0, pendingDocs: 0, openAppts: 0, lawyers: 0, clients: 0, revenueThisMonth: 0 });
  const [slaItems, setSlaItems] = useState<SLAItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [mattersRes, docsRes, apptsRes, lawyersRes, clientsRes, eventsRes, msgsRes, revenueRes, auditRes] = await Promise.all([
      supabase.from('matters').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'lawyer'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('events').select('id, title, event_date, event_time, type').gte('event_date', today).order('event_date').limit(5),
      supabase.from('messages').select('matter_id, sender_id, created_at, body, sender:profiles!sender_id(role)').order('created_at', { ascending: false }).limit(100),
      supabase.from('invoices').select('amount_paisas').eq('status', 'paid').gte('paid_at', monthStart.toISOString()),
      supabase.from('audit_logs').select('id, action, actor_type, matter_id, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const revenueThisMonth = ((revenueRes.data ?? []) as any[]).reduce((s: number, inv: any) => s + (inv.amount_paisas ?? 0), 0);

    setStats({
      matters: mattersRes.count ?? 0,
      pendingDocs: docsRes.count ?? 0,
      openAppts: apptsRes.count ?? 0,
      lawyers: lawyersRes.count ?? 0,
      clients: clientsRes.count ?? 0,
      revenueThisMonth,
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

    // Enrich audit logs with matter refs
    if (auditRes.data) {
      const matterIds = [...new Set((auditRes.data as any[]).filter((a) => a.matter_id).map((a: any) => a.matter_id))];
      let matterRefMap: Record<string, string> = {};
      if (matterIds.length) {
        const { data: mRefs } = await supabase.from('matters').select('id, matter_ref').in('id', matterIds);
        for (const m of (mRefs ?? []) as any[]) matterRefMap[m.id] = m.matter_ref;
      }
      setActivity((auditRes.data as any[]).map((a: any) => ({
        id: a.id,
        action: a.action,
        actor_type: a.actor_type,
        matter_ref: a.matter_id ? (matterRefMap[a.matter_id] ?? null) : null,
        matter_id: a.matter_id ?? null,
        created_at: a.created_at,
      })));
    }

    setLoading(false);
  }

  if (loading) return <PageShell title="Dashboard"><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div></PageShell>;

  return (
    <PageShell title="Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <StatCard icon={Briefcase} label="Active Matters" value={stats.matters} onClick={() => router.push('/matters')} />
        <StatCard icon={FileText} label="Pending Docs" value={stats.pendingDocs} alert={stats.pendingDocs > 0} />
        <StatCard icon={Clock} label="Pending Appointments" value={stats.openAppts} alert={stats.openAppts > 0} onClick={() => router.push('/appointments')} />
        <StatCard icon={Users} label="Lawyers" value={stats.lawyers} onClick={() => router.push('/lawyers')} />
        <StatCard icon={Users} label="Clients" value={stats.clients} onClick={() => router.push('/clients')} />
        <div className="rounded-2xl border border-[#ECE4D9] bg-white p-5">
          <p className="text-[10px] font-medium tracking-wider text-[#8A817B] mb-1">REVENUE THIS MONTH</p>
          <p className="text-xl font-bold text-[#3F7A5B]">{fmtPkr(stats.revenueThisMonth)}</p>
          <p className="text-[10px] text-[#A89F99] mt-1">collected</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* SLA Queue */}
        <div className="col-span-1 bg-[#FDF0EE] border border-[#ECCDC8] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#C0392B] animate-pulse" />
            <h3 className="text-[10px] font-semibold text-[#C0392B] tracking-widest">SLA QUEUE — {slaItems.length} FLAGGED</h3>
          </div>
          {slaItems.length === 0 && <p className="text-sm text-[#6E635F]">No SLA breaches. All messages answered.</p>}
          {slaItems.map((item) => (
            <button key={item.id} onClick={() => router.push(`/matters/${item.id}`)}
              className="w-full flex items-center justify-between py-3 border-t border-[#ECCDC8] hover:bg-[#F9E5E2] rounded-lg px-2 -mx-2 transition-colors text-left">
              <div>
                <p className="text-sm font-semibold text-[#241D1C]">{item.client_name}</p>
                <p className="text-xs text-[#A89F99]">{item.matter_ref}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${item.elapsed_minutes >= 120 ? 'bg-[#C0392B] text-white' : 'bg-[#F6ECD8] text-[#9A6B1E]'}`}>
                  {item.elapsed_minutes >= 60 ? `${Math.floor(item.elapsed_minutes / 60)}h ${item.elapsed_minutes % 60}m` : `${item.elapsed_minutes}m`}
                </span>
                <ArrowRight size={12} className="text-[#C0392B]" />
              </div>
            </button>
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

        {/* Recent Activity */}
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5 overflow-hidden">
          <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-4">RECENT ACTIVITY</h3>
          <div className="space-y-0 max-h-72 overflow-y-auto">
            {activity.map((a, idx) => (
              <div key={a.id} className={`flex gap-3 py-2.5 ${idx > 0 ? 'border-t border-[#F3EDE3]' : ''}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${actorDot(a.actor_type)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#241D1C] leading-snug line-clamp-2">{a.action}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.matter_ref && a.matter_id && (
                      <button onClick={() => router.push(`/matters/${a.matter_id}`)}
                        className="text-[10px] text-[#6B1E2B] font-medium hover:underline">
                        {a.matter_ref}
                      </button>
                    )}
                    <span className="text-[10px] text-[#A89F99]">{fmtRelative(a.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-[#6E635F]">No recent activity.</p>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ icon: Icon, label, value, alert, onClick }: { icon: any; label: string; value: number; alert?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-5 ${alert ? 'bg-[#FDF0EE] border-[#C0392B]/30' : 'bg-white border-[#ECE4D9]'} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
      <Icon size={20} className={`mb-3 ${alert ? 'text-[#C0392B]' : 'text-[#A89F99]'}`} strokeWidth={1.7} />
      <p className={`text-3xl font-bold mb-1 ${alert ? 'text-[#C0392B]' : 'text-[#241D1C]'}`}>{value}</p>
      <p className={`text-[10px] font-medium tracking-wider ${alert ? 'text-[#C0392B]' : 'text-[#8A817B]'}`}>{label.toUpperCase()}</p>
    </div>
  );
}

function evColor(t: string) { return t === 'hearing' ? 'bg-[#9A6B1E]' : t === 'deadline' ? 'bg-[#C0392B]' : 'bg-[#6B1E2B]'; }
function actorDot(type: string) {
  if (type === 'lawyer') return 'bg-[#6B1E2B]';
  if (type === 'client') return 'bg-[#3F7A5B]';
  if (type === 'owner') return 'bg-[#9A6B1E]';
  return 'bg-[#A89F99]';
}
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }); }
function fmtPkr(paisas: number) {
  const r = paisas / 100;
  if (r >= 1000000) return `PKR ${(r / 1000000).toFixed(1)}M`;
  if (r >= 1000) return `PKR ${(r / 1000).toFixed(0)}K`;
  return `PKR ${r.toLocaleString()}`;
}
function fmtRelative(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
