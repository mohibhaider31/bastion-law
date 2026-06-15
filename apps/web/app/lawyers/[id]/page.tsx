'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { PageShell } from '../../../components/PageShell';
import { ArrowLeft, Clock, Briefcase, DollarSign, Activity } from 'lucide-react';

interface LawyerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  hourly_rate_pkr: number | null;
  created_at: string;
}

interface MatterRow {
  id: string;
  matter_ref: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  opened_at: string;
  total_invoiced: number;
  total_paid: number;
  hours: number;
}

interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  billed: boolean;
  date: string;
  matter_ref: string;
  matter_title: string;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  matter_ref: string | null;
  matter_id: string | null;
}

type Tab = 'overview' | 'matters' | 'time' | 'activity';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPKR(paisas: number) {
  const r = paisas / 100;
  if (r >= 1000000) return `PKR ${(r / 1000000).toFixed(1)}M`;
  if (r >= 1000) return `PKR ${(r / 1000).toFixed(0)}K`;
  return `PKR ${r.toLocaleString('en-PK')}`;
}
function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function LawyerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [lawyer, setLawyer] = useState<LawyerProfile | null>(null);
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    const [profileRes, mattersRes, timeRes, auditRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, hourly_rate_pkr, created_at').eq('id', id).single(),
      supabase.from('matters').select('id, matter_ref, title, type, stage, status, opened_at').eq('lead_lawyer_id', id).order('opened_at', { ascending: false }),
      supabase.from('time_entries').select('id, description, hours, billed, date, matter:matters!matter_id(id, matter_ref, title)').eq('lawyer_id', id).order('date', { ascending: false }).limit(100),
      supabase.from('audit_logs').select('id, action, created_at, matter_id, matter:matters!matter_id(matter_ref)').eq('actor_id', id).order('created_at', { ascending: false }).limit(100),
    ]);

    if (profileRes.data) setLawyer(profileRes.data as LawyerProfile);

    const matterIds = (mattersRes.data ?? []).map((m: any) => m.id);
    let invoiceMap = new Map<string, { invoiced: number; paid: number }>();
    if (matterIds.length > 0) {
      const { data: invData } = await supabase.from('invoices').select('matter_id, amount_paisas, status').in('matter_id', matterIds);
      for (const inv of (invData ?? []) as any[]) {
        const cur = invoiceMap.get(inv.matter_id) ?? { invoiced: 0, paid: 0 };
        cur.invoiced += inv.amount_paisas;
        if (inv.status === 'paid') cur.paid += inv.amount_paisas;
        invoiceMap.set(inv.matter_id, cur);
      }
    }

    const hoursMap = new Map<string, number>();
    for (const te of (timeRes.data ?? []) as any[]) {
      const mid = te.matter?.id ?? '';
      hoursMap.set(mid, (hoursMap.get(mid) ?? 0) + te.hours);
    }

    const enrichedMatters: MatterRow[] = ((mattersRes.data ?? []) as any[]).map((m: any) => ({
      id: m.id,
      matter_ref: m.matter_ref,
      title: m.title,
      type: m.type,
      stage: m.stage,
      status: m.status,
      opened_at: m.opened_at,
      total_invoiced: invoiceMap.get(m.id)?.invoiced ?? 0,
      total_paid: invoiceMap.get(m.id)?.paid ?? 0,
      hours: hoursMap.get(m.id) ?? 0,
    }));
    setMatters(enrichedMatters);

    setTimeEntries(((timeRes.data ?? []) as any[]).map((te: any) => ({
      id: te.id,
      description: te.description,
      hours: te.hours,
      billed: te.billed,
      date: te.date,
      matter_ref: te.matter?.matter_ref ?? '',
      matter_title: te.matter?.title ?? '',
    })));

    setAuditLogs(((auditRes.data ?? []) as any[]).map((a: any) => ({
      id: a.id,
      action: a.action,
      created_at: a.created_at,
      matter_id: a.matter_id,
      matter_ref: a.matter?.matter_ref ?? null,
    })));

    setLoading(false);
  }

  if (loading) return (
    <PageShell title="Lawyer">
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
      </div>
    </PageShell>
  );
  if (!lawyer) return <PageShell title="Not found"><p className="text-[#A89F99]">Lawyer not found.</p></PageShell>;

  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const totalInvoiced = matters.reduce((s, m) => s + m.total_invoiced, 0);
  const totalCollected = matters.reduce((s, m) => s + m.total_paid, 0);
  const activeMatters = matters.filter((m) => m.status === 'active').length;
  const billedHours = timeEntries.filter((t) => t.billed).reduce((s, t) => s + t.hours, 0);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'matters', label: `Matters (${matters.length})`, icon: Briefcase },
    { key: 'time', label: 'Time Entries', icon: Clock },
    { key: 'activity', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#ECE4D9] px-6 py-4">
        <button onClick={() => router.push('/lawyers')} className="flex items-center gap-1.5 text-sm text-[#8A817B] hover:text-[#241D1C] mb-4 transition-colors">
          <ArrowLeft size={15} /> Back to Lawyers
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#EAF1EC] flex items-center justify-center flex-shrink-0">
            <span className="text-[#3F7A5B] font-bold text-xl">{initials(lawyer.full_name)}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#241D1C]">{lawyer.full_name}</h1>
            <p className="text-sm text-[#8A817B] mt-0.5">{lawyer.email}{lawyer.phone ? ` · ${lawyer.phone}` : ''}</p>
            <p className="text-xs text-[#A89F99] mt-0.5">
              Member since {fmtDate(lawyer.created_at)}
              {lawyer.hourly_rate_pkr ? ` · PKR ${lawyer.hourly_rate_pkr.toLocaleString('en-PK')}/hr` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#ECE4D9] px-6">
        <div className="flex gap-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === key ? 'border-[#6B1E2B] text-[#6B1E2B]' : 'border-transparent text-[#8A817B] hover:text-[#241D1C]'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-4">
              <KpiCard label="ACTIVE MATTERS" value={String(activeMatters)} icon={Briefcase} />
              <KpiCard label="TOTAL HOURS" value={`${totalHours.toFixed(1)}h`} icon={Clock} />
              <KpiCard label="REVENUE BILLED" value={fmtPKR(totalInvoiced)} icon={DollarSign} />
              <KpiCard label="REVENUE COLLECTED" value={fmtPKR(totalCollected)} icon={DollarSign} positive />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Revenue breakdown */}
              <div className="bg-[#6B1E2B] rounded-2xl p-6 text-white">
                <h3 className="text-[10px] font-medium text-[rgba(246,241,234,0.6)] tracking-widest mb-5">REVENUE CONTRIBUTION</h3>
                <div className="space-y-4">
                  <Stat label="TOTAL BILLED" value={fmtPKR(totalInvoiced)} />
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-4">
                    <Stat label="COLLECTED" value={fmtPKR(totalCollected)} highlight />
                  </div>
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-4">
                    <Stat label="OUTSTANDING" value={fmtPKR(totalInvoiced - totalCollected)} />
                  </div>
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-4">
                    <Stat label="COLLECTION RATE" value={totalInvoiced > 0 ? `${Math.round((totalCollected / totalInvoiced) * 100)}%` : '—'} />
                  </div>
                </div>
              </div>

              {/* Time breakdown */}
              <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6">
                <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-widest mb-5">TIME BREAKDOWN</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#6E635F]">Total hours logged</span>
                      <span className="text-sm font-bold text-[#241D1C]">{totalHours.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#6E635F]">Billed hours</span>
                      <span className="text-sm font-bold text-[#3F7A5B]">{billedHours.toFixed(1)}h</span>
                    </div>
                    <div className="h-2 bg-[#F0EBE3] rounded-full overflow-hidden">
                      <div className="h-full bg-[#3F7A5B] rounded-full" style={{ width: `${totalHours > 0 ? (billedHours / totalHours) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#6E635F]">Unbilled hours</span>
                      <span className="text-sm font-bold text-[#9A6B1E]">{(totalHours - billedHours).toFixed(1)}h</span>
                    </div>
                  </div>
                  {lawyer.hourly_rate_pkr && (
                    <div className="border-t border-[#ECE4D9] pt-4">
                      <div className="flex justify-between">
                        <span className="text-xs text-[#6E635F]">Implied value (at rate)</span>
                        <span className="text-sm font-bold text-[#241D1C]">PKR {(totalHours * lawyer.hourly_rate_pkr).toLocaleString('en-PK')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent activity preview */}
            <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-4">RECENT ACTIVITY</h3>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-[#A89F99]">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#6B1E2B] mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#241D1C]">{a.action}</p>
                        {a.matter_ref && (
                          <button onClick={() => router.push(`/matters/${a.matter_id}`)} className="text-xs text-[#6B1E2B] hover:underline">{a.matter_ref}</button>
                        )}
                      </div>
                      <span className="text-xs text-[#A89F99] flex-shrink-0">{relTime(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MATTERS ── */}
        {tab === 'matters' && (
          <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
            {matters.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#A89F99]">No matters assigned.</p>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-[#ECE4D9]">
                  {['Matter', 'Type', 'Stage', 'Hours', 'Billed', 'Collected', 'Opened'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {matters.map((m) => (
                    <tr key={m.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] cursor-pointer transition-colors" onClick={() => router.push(`/matters/${m.id}`)}>
                      <td className="px-5 py-4">
                        <p className="text-xs font-mono text-[#A89F99]">{m.matter_ref}</p>
                        <p className="text-sm font-semibold text-[#241D1C]">{m.title}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#6E635F] capitalize">{m.type}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F3EDE3] text-[#8A817B] capitalize">{m.stage}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#241D1C]">{m.hours.toFixed(1)}h</td>
                      <td className="px-5 py-4 text-sm text-[#241D1C]">{fmtPKR(m.total_invoiced)}</td>
                      <td className="px-5 py-4 text-sm text-[#3F7A5B] font-medium">{fmtPKR(m.total_paid)}</td>
                      <td className="px-5 py-4 text-sm text-[#A89F99]">{fmtDate(m.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TIME ENTRIES ── */}
        {tab === 'time' && (
          <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
            {timeEntries.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#A89F99]">No time entries logged.</p>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-[#ECE4D9]">
                  {['Date', 'Matter', 'Description', 'Hours', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {timeEntries.map((te) => (
                    <tr key={te.id} className="border-b border-[#F3EDE3]">
                      <td className="px-5 py-3.5 text-sm text-[#A89F99] whitespace-nowrap">{te.date}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-mono text-[#A89F99]">{te.matter_ref}</p>
                        <p className="text-sm text-[#6E635F]">{te.matter_title}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#241D1C] max-w-xs">
                        <p className="truncate">{te.description}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[#241D1C]">{te.hours}h</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${te.billed ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F6ECD8] text-[#9A6B1E]'}`}>
                          {te.billed ? 'Billed' : 'Unbilled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'activity' && (
          <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-[#A89F99] text-center py-8">No activity recorded.</p>
            ) : (
              <div className="space-y-0">
                {auditLogs.map((a, i) => (
                  <div key={a.id} className={`flex items-start gap-4 py-3.5 ${i < auditLogs.length - 1 ? 'border-b border-[#F3EDE3]' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-[#FBF1EE] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#6B1E2B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#241D1C]">{a.action}</p>
                      {a.matter_ref && (
                        <button onClick={() => router.push(`/matters/${a.matter_id}`)} className="text-xs text-[#6B1E2B] hover:underline mt-0.5">
                          {a.matter_ref}
                        </button>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#A89F99]">{relTime(a.created_at)}</p>
                      <p className="text-[10px] text-[#C5BBB5]">{new Date(a.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, positive }: { label: string; value: string; icon: any; positive?: boolean }) {
  return (
    <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
      <Icon size={20} className={`mb-3 ${positive ? 'text-[#3F7A5B]' : 'text-[#A89F99]'}`} strokeWidth={1.7} />
      <p className="text-2xl font-bold text-[#241D1C] mb-1">{value}</p>
      <p className="text-[10px] font-medium tracking-wider text-[#8A817B]">{label}</p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[rgba(246,241,234,0.6)] tracking-widest">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${highlight ? 'text-[#EAF1EC]' : 'text-[#F6F1EA]'}`}>{value}</p>
    </div>
  );
}
