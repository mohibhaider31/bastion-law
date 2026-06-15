'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../dashboard/page';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Clock, AlertTriangle, Download } from 'lucide-react';

interface MonthRevenue { month: string; collected: number; billed: number; }
interface LawyerUtil { id: string; full_name: string; hours: number; matters: number; }
interface MatterFunnel { status: string; count: number; }
interface OverdueInvoice { id: string; invoice_ref: string; client_name: string; amount_paisas: number; due_date: string; days_overdue: number; }

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<MonthRevenue[]>([]);
  const [lawyers, setLawyers] = useState<LawyerUtil[]>([]);
  const [funnel, setFunnel] = useState<MatterFunnel[]>([]);
  const [overdue, setOverdue] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

    const [invoicesRes, lawyersRes, mattersRes, overdueRes, timeRes] = await Promise.all([
      supabase.from('invoices').select('amount_paisas, paid_at, due_date, status, issued_at').gte('issued_at', sixMonthsAgo),
      supabase.from('profiles').select('id, full_name').eq('role', 'lawyer'),
      supabase.from('matters').select('id, status'),
      supabase.from('invoices').select('id, invoice_ref, amount_paisas, due_date, client:profiles!client_id(full_name)').eq('status', 'overdue').order('due_date'),
      supabase.from('time_entries').select('lawyer_id, hours, matter_id'),
    ]);

    // Monthly revenue (last 6 months)
    const monthMap = new Map<string, { billed: number; collected: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      monthMap.set(d.toISOString().slice(0, 7), { billed: 0, collected: 0 });
    }
    for (const inv of (invoicesRes.data ?? []) as any[]) {
      const mo = (inv.issued_at as string).slice(0, 7);
      if (monthMap.has(mo)) {
        monthMap.get(mo)!.billed += inv.amount_paisas;
        if (inv.status === 'paid') monthMap.get(mo)!.collected += inv.amount_paisas;
      }
    }
    const revenueData: MonthRevenue[] = Array.from(monthMap.entries()).map(([month, v]) => ({
      month, billed: v.billed, collected: v.collected,
    }));
    setRevenue(revenueData);

    // Matter funnel by status
    const statusCount = new Map<string, number>();
    for (const m of (mattersRes.data ?? []) as any[]) {
      statusCount.set(m.status, (statusCount.get(m.status) ?? 0) + 1);
    }
    const ORDER = ['inquiry', 'active', 'pending_review', 'closed', 'archived'];
    setFunnel(ORDER.filter((s) => statusCount.has(s)).map((s) => ({ status: s, count: statusCount.get(s)! })));

    // Lawyer utilization: hours + active matter count
    const lawyerHours = new Map<string, number>();
    const lawyerMatters = new Map<string, Set<string>>();
    for (const te of (timeRes.data ?? []) as any[]) {
      lawyerHours.set(te.lawyer_id, (lawyerHours.get(te.lawyer_id) ?? 0) + te.hours);
      if (!lawyerMatters.has(te.lawyer_id)) lawyerMatters.set(te.lawyer_id, new Set());
      lawyerMatters.get(te.lawyer_id)!.add(te.matter_id);
    }
    const lawyerData: LawyerUtil[] = ((lawyersRes.data ?? []) as any[]).map((l: any) => ({
      id: l.id, full_name: l.full_name,
      hours: Math.round((lawyerHours.get(l.id) ?? 0) * 10) / 10,
      matters: lawyerMatters.get(l.id)?.size ?? 0,
    })).sort((a, b) => b.hours - a.hours);
    setLawyers(lawyerData);

    // Overdue invoices
    const overdueData: OverdueInvoice[] = ((overdueRes.data ?? []) as any[]).map((inv: any) => ({
      id: inv.id,
      invoice_ref: inv.invoice_ref,
      client_name: inv.client?.full_name ?? 'Unknown',
      amount_paisas: inv.amount_paisas,
      due_date: inv.due_date,
      days_overdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
    }));
    setOverdue(overdueData);

    setLoading(false);
  }

  if (loading) return (
    <PageShell title="Analytics">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
      </div>
    </PageShell>
  );

  const totalBilled = revenue.reduce((s, r) => s + r.billed, 0);
  const totalCollected = revenue.reduce((s, r) => s + r.collected, 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const maxBilled = Math.max(...revenue.map((r) => r.billed), 1);
  const maxFunnel = Math.max(...funnel.map((f) => f.count), 1);
  const maxHours = Math.max(...lawyers.map((l) => l.hours), 1);
  const overdueTotal = overdue.reduce((s, o) => s + o.amount_paisas, 0);

  function exportCSV() {
    const rows: string[][] = [
      ['Report Type', 'Month / Name', 'Billed (PKR)', 'Collected (PKR)', 'Collection Rate'],
      ...revenue.map((r) => [
        'Monthly Revenue', r.month,
        String(r.billed / 100),
        String(r.collected / 100),
        r.billed > 0 ? `${Math.round((r.collected / r.billed) * 100)}%` : '0%',
      ]),
      [],
      ['Report Type', 'Lawyer', 'Total Hours', 'Matters'],
      ...lawyers.map((l) => ['Lawyer Utilization', l.full_name, String(l.hours), String(l.matters)]),
      [],
      ['Report Type', 'Invoice Ref', 'Client', 'Amount (PKR)', 'Due Date', 'Days Overdue'],
      ...overdue.map((inv) => ['Overdue Invoice', inv.invoice_ref, inv.client_name, String(inv.amount_paisas / 100), inv.due_date, String(inv.days_overdue)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bastion-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <PageShell title="Analytics" action={
      <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#ECE4D9] text-sm font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
        <Download size={15} /> Export CSV
      </button>
    }>
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="6-MONTH BILLED" value={fmtPkr(totalBilled)} icon={DollarSign} />
        <KpiCard label="6-MONTH COLLECTED" value={fmtPkr(totalCollected)} icon={TrendingUp} positive />
        <KpiCard label="COLLECTION RATE" value={`${collectionRate}%`} icon={collectionRate >= 80 ? TrendingUp : TrendingDown} positive={collectionRate >= 80} />
        <KpiCard label="OVERDUE BALANCE" value={fmtPkr(overdueTotal)} icon={AlertTriangle} alert={overdueTotal > 0} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Revenue bar chart */}
        <div className="col-span-2 bg-white border border-[#ECE4D9] rounded-2xl p-6">
          <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-widest mb-5">MONTHLY REVENUE (PKR)</h3>
          <div className="flex items-end gap-3 h-40">
            {revenue.map((r) => (
              <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: 128 }}>
                  <div
                    className="flex-1 bg-[#6B1E2B]/20 rounded-t-md transition-all"
                    style={{ height: `${Math.max(4, (r.billed / maxBilled) * 100)}%` }}
                    title={`Billed: ${fmtPkr(r.billed)}`}
                  />
                  <div
                    className="flex-1 bg-[#6B1E2B] rounded-t-md transition-all"
                    style={{ height: `${Math.max(2, (r.collected / maxBilled) * 100)}%` }}
                    title={`Collected: ${fmtPkr(r.collected)}`}
                  />
                </div>
                <span className="text-[9px] text-[#A89F99] font-medium">{fmtMonth(r.month)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#6B1E2B]/20" /><span className="text-xs text-[#8A817B]">Billed</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#6B1E2B]" /><span className="text-xs text-[#8A817B]">Collected</span></div>
          </div>
        </div>

        {/* Matter funnel */}
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6">
          <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-widest mb-5">MATTER PIPELINE</h3>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.status}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-[#241D1C] capitalize">{f.status.replace('_', ' ')}</span>
                  <span className="text-xs font-bold text-[#6B1E2B]">{f.count}</span>
                </div>
                <div className="h-2 bg-[#F0EBE3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6B1E2B] rounded-full transition-all"
                    style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {funnel.length === 0 && <p className="text-sm text-[#A89F99]">No matters yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Lawyer utilization */}
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-6">
          <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-widest mb-5">LAWYER UTILIZATION</h3>
          <div className="space-y-4">
            {lawyers.map((l) => (
              <div key={l.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-[#241D1C]">{l.full_name}</span>
                  <span className="text-xs text-[#8A817B]">{l.hours}h · {l.matters} matter{l.matters !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 bg-[#F0EBE3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B68A4E] rounded-full transition-all"
                    style={{ width: `${Math.max(4, (l.hours / maxHours) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {lawyers.length === 0 && <p className="text-sm text-[#A89F99]">No lawyers found.</p>}
          </div>
        </div>

        {/* Overdue invoices */}
        <div className="bg-[#FDF0EE] border border-[#ECCDC8] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-[#C0392B] animate-pulse" />
            <h3 className="text-[10px] font-semibold text-[#C0392B] tracking-widest">OVERDUE INVOICES</h3>
          </div>
          {overdue.length === 0 && <p className="text-sm text-[#6E635F]">No overdue invoices.</p>}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {overdue.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-[#ECCDC8] last:border-0">
                <div>
                  <p className="text-sm font-semibold text-[#241D1C]">{inv.client_name}</p>
                  <p className="text-xs text-[#A89F99]">{inv.invoice_ref} · due {fmtDate(inv.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#C0392B]">{fmtPkr(inv.amount_paisas)}</p>
                  <p className="text-xs text-[#C0392B]">{inv.days_overdue}d overdue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function KpiCard({ label, value, icon: Icon, positive, alert }: { label: string; value: string; icon: any; positive?: boolean; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${alert ? 'bg-[#FDF0EE] border-[#C0392B]/30' : 'bg-white border-[#ECE4D9]'}`}>
      <Icon size={20} className={`mb-3 ${alert ? 'text-[#C0392B]' : positive ? 'text-[#27AE60]' : 'text-[#A89F99]'}`} strokeWidth={1.7} />
      <p className={`text-2xl font-bold mb-1 ${alert ? 'text-[#C0392B]' : 'text-[#241D1C]'}`}>{value}</p>
      <p className={`text-[10px] font-medium tracking-wider ${alert ? 'text-[#C0392B]' : 'text-[#8A817B]'}`}>{label}</p>
    </div>
  );
}

function fmtPkr(paisas: number) {
  const rupees = paisas / 100;
  if (rupees >= 1000000) return `PKR ${(rupees / 1000000).toFixed(1)}M`;
  if (rupees >= 1000) return `PKR ${(rupees / 1000).toFixed(0)}K`;
  return `PKR ${rupees.toLocaleString()}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-PK', { month: 'short' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}
