'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Download, Clock, DollarSign, BarChart2 } from 'lucide-react';

type ReportTab = 'timesheet' | 'expenses';

interface TimeEntry {
  id: string;
  description: string;
  hours: number;
  entry_date: string;
  billable: boolean;
  matter: { matter_ref: string; title: string };
  lawyer: { full_name: string };
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount_pkr: number;
  expense_date: string;
  billable: boolean;
  receipt_url: string | null;
  matter: { matter_ref: string; title: string };
  logged_by_profile: { full_name: string } | null;
}

interface Lawyer { id: string; full_name: string; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('timesheet');

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);

  const [lawyerFilter, setLawyerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [billableFilter, setBillableFilter] = useState<'all' | 'billable' | 'non-billable'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [lawyersRes, timeRes, expRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'lawyer'),
      supabase.from('time_entries').select('id, description, hours, entry_date, billable, matter:matters!matter_id(matter_ref, title), lawyer:profiles!lawyer_id(full_name)').order('entry_date', { ascending: false }),
      supabase.from('expenses').select('id, category, description, amount_pkr, expense_date, billable, receipt_url, matter:matters!matter_id(matter_ref, title), logged_by_profile:profiles!logged_by(full_name)').order('expense_date', { ascending: false }),
    ]);
    if (lawyersRes.data) setLawyers(lawyersRes.data);
    if (timeRes.data) setTimeEntries(timeRes.data as unknown as TimeEntry[]);
    if (expRes.data) setExpenses(expRes.data as unknown as Expense[]);
    setLoading(false);
  }

  const filteredTime = timeEntries.filter((e) => {
    if (e.entry_date < dateFrom || e.entry_date > dateTo) return false;
    if (lawyerFilter && e.lawyer.full_name !== lawyerFilter) return false;
    if (billableFilter === 'billable' && !e.billable) return false;
    if (billableFilter === 'non-billable' && e.billable) return false;
    return true;
  });

  const filteredExp = expenses.filter((e) => {
    if (e.expense_date < dateFrom || e.expense_date > dateTo) return false;
    if (billableFilter === 'billable' && !e.billable) return false;
    if (billableFilter === 'non-billable' && e.billable) return false;
    return true;
  });

  const totalHours = filteredTime.reduce((s, e) => s + Number(e.hours), 0);
  const totalExpenses = filteredExp.reduce((s, e) => s + e.amount_pkr, 0);

  function exportTimeCSV() {
    const headers = ['Date', 'Lawyer', 'Matter', 'Description', 'Hours', 'Billable'];
    const rows = filteredTime.map((e) => [
      e.entry_date, e.lawyer.full_name,
      `${e.matter.matter_ref} — ${e.matter.title}`,
      e.description, e.hours, e.billable ? 'Yes' : 'No',
    ]);
    downloadCSV([headers, ...rows], `timesheet-${dateFrom}-${dateTo}.csv`);
  }

  function exportExpenseCSV() {
    const headers = ['Date', 'Matter', 'Category', 'Description', 'Amount PKR', 'Billable', 'Logged By'];
    const rows = filteredExp.map((e) => [
      e.expense_date, `${e.matter.matter_ref} — ${e.matter.title}`,
      e.category.replace(/_/g, ' '), e.description,
      (e.amount_pkr / 100).toFixed(2),
      e.billable ? 'Yes' : 'No',
      e.logged_by_profile?.full_name ?? '',
    ]);
    downloadCSV([headers, ...rows], `expenses-${dateFrom}-${dateTo}.csv`);
  }

  function downloadCSV(data: (string | number | boolean)[][], filename: string) {
    const csv = data.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
  }

  // Group time entries by lawyer for summary
  const byLawyer = lawyers.map((l) => {
    const entries = filteredTime.filter((e) => e.lawyer.full_name === l.full_name);
    return { name: l.full_name, hours: entries.reduce((s, e) => s + Number(e.hours), 0), count: entries.length };
  }).filter((l) => l.hours > 0).sort((a, b) => b.hours - a.hours);

  return (
    <PageShell title="Reports" action={
      <button onClick={tab === 'timesheet' ? exportTimeCSV : exportExpenseCSV}
        className="flex items-center gap-2 border border-[#ECE4D9] text-[#6E635F] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#F6F1EA] transition-colors">
        <Download size={15} /> Export CSV
      </button>
    }>
      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(['timesheet', 'expenses'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-[#6B1E2B] text-white' : 'text-[#8A817B] hover:bg-white hover:text-[#241D1C]'}`}>
            {t === 'timesheet' ? <Clock size={14} /> : <DollarSign size={14} />}
            {t === 'timesheet' ? 'Time Sheet' : 'Expenses'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#ECE4D9] rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-medium text-[#8A817B] tracking-wider mb-1.5">FROM</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 border border-[#ECE4D9] rounded-xl px-3 text-sm text-[#241D1C] bg-[#F6F1EA] outline-none focus:border-[#6B1E2B]" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#8A817B] tracking-wider mb-1.5">TO</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-9 border border-[#ECE4D9] rounded-xl px-3 text-sm text-[#241D1C] bg-[#F6F1EA] outline-none focus:border-[#6B1E2B]" />
        </div>
        {tab === 'timesheet' && (
          <div>
            <label className="block text-[10px] font-medium text-[#8A817B] tracking-wider mb-1.5">LAWYER</label>
            <select value={lawyerFilter} onChange={(e) => setLawyerFilter(e.target.value)}
              className="h-9 border border-[#ECE4D9] rounded-xl px-3 text-sm text-[#241D1C] bg-[#F6F1EA] outline-none focus:border-[#6B1E2B]">
              <option value="">All lawyers</option>
              {lawyers.map((l) => <option key={l.id} value={l.full_name}>{l.full_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-medium text-[#8A817B] tracking-wider mb-1.5">BILLABLE</label>
          <select value={billableFilter} onChange={(e) => setBillableFilter(e.target.value as any)}
            className="h-9 border border-[#ECE4D9] rounded-xl px-3 text-sm text-[#241D1C] bg-[#F6F1EA] outline-none focus:border-[#6B1E2B]">
            <option value="all">All</option>
            <option value="billable">Billable only</option>
            <option value="non-billable">Non-billable only</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {tab === 'timesheet' ? (
          <>
            <SummaryCard icon={<Clock size={18} className="text-[#6B1E2B]" />} label="Total Hours" value={totalHours.toFixed(1)} sub={`${filteredTime.length} entries`} />
            <SummaryCard icon={<BarChart2 size={18} className="text-[#9A6B1E]" />} label="Billable Hours" value={filteredTime.filter((e) => e.billable).reduce((s, e) => s + Number(e.hours), 0).toFixed(1)} sub={`${filteredTime.filter((e) => e.billable).length} entries`} />
            <SummaryCard icon={<Clock size={18} className="text-[#3F7A5B]" />} label="Active Lawyers" value={String(byLawyer.length)} sub="with logged time" />
          </>
        ) : (
          <>
            <SummaryCard icon={<DollarSign size={18} className="text-[#6B1E2B]" />} label="Total Expenses" value={`PKR ${(totalExpenses / 100).toLocaleString('en-PK')}`} sub={`${filteredExp.length} entries`} />
            <SummaryCard icon={<DollarSign size={18} className="text-[#9A6B1E]" />} label="Billable" value={`PKR ${(filteredExp.filter((e) => e.billable).reduce((s, e) => s + e.amount_pkr, 0) / 100).toLocaleString('en-PK')}`} sub="recoverable" />
            <SummaryCard icon={<DollarSign size={18} className="text-[#3F7A5B]" />} label="Non-Billable" value={`PKR ${(filteredExp.filter((e) => !e.billable).reduce((s, e) => s + e.amount_pkr, 0) / 100).toLocaleString('en-PK')}`} sub="absorbed by firm" />
          </>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin mx-auto" />
        </div>
      ) : tab === 'timesheet' ? (
        <div className="grid grid-cols-3 gap-6">
          {/* By-lawyer summary */}
          {byLawyer.length > 0 && (
            <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECE4D9]">
                <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-wider">HOURS BY LAWYER</h3>
              </div>
              <div className="divide-y divide-[#F3EDE3]">
                {byLawyer.map((l) => (
                  <div key={l.name} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full bg-[#F0E3E1] flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#6B1E2B]">{l.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                    </div>
                    <span className="text-sm text-[#241D1C] flex-1">{l.name.split(' ')[0]}</span>
                    <span className="text-sm font-semibold text-[#6B1E2B]">{l.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entries table */}
          <div className={`bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden ${byLawyer.length > 0 ? 'col-span-2' : 'col-span-3'}`}>
            <div className="px-5 py-4 border-b border-[#ECE4D9]">
              <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-wider">TIME ENTRIES — {filteredTime.length} ROWS</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#ECE4D9]">
                  {['Date', 'Lawyer', 'Matter', 'Description', 'Hrs', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredTime.map((e) => (
                    <tr key={e.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors">
                      <td className="px-5 py-3 text-xs text-[#A89F99] whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                      <td className="px-5 py-3 text-sm text-[#6E635F]">{e.lawyer.full_name}</td>
                      <td className="px-5 py-3 text-xs font-mono text-[#9A6B1E]">{e.matter.matter_ref}</td>
                      <td className="px-5 py-3 text-sm text-[#241D1C] max-w-xs truncate">{e.description}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-[#6B1E2B]">{Number(e.hours).toFixed(1)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${e.billable ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>
                          {e.billable ? 'Billable' : 'Non-billable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTime.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#A89F99]">No time entries in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ECE4D9]">
            <h3 className="text-[10px] font-semibold text-[#8A817B] tracking-wider">EXPENSES — {filteredExp.length} ENTRIES</h3>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-[#ECE4D9]">
              {['Date', 'Matter', 'Category', 'Description', 'Amount', ''].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filteredExp.map((e) => (
                <tr key={e.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors">
                  <td className="px-5 py-3 text-xs text-[#A89F99] whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                  <td className="px-5 py-3 text-xs font-mono text-[#9A6B1E]">{e.matter.matter_ref}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-[#F6ECD8] text-[#9A6B1E] px-2 py-0.5 rounded-full capitalize">{e.category.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[#241D1C] max-w-xs truncate">{e.description}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-[#241D1C]">PKR {(e.amount_pkr / 100).toLocaleString('en-PK')}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${e.billable ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>
                      {e.billable ? 'Billable' : 'Non-billable'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredExp.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#A89F99]">No expenses in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#FBF1EE] flex items-center justify-center">{icon}</div>
        <span className="text-[10px] font-semibold text-[#8A817B] tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#241D1C] mb-0.5">{value}</p>
      <p className="text-xs text-[#A89F99]">{sub}</p>
    </div>
  );
}
