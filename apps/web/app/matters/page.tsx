'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, Search } from 'lucide-react';

interface Matter { id: string; matter_ref: string; title: string; type: string; stage: string; status: string; client: { full_name: string }; lead_lawyer: { full_name: string }; opened_at: string; }

const STAGE_COLORS: Record<string, string> = {
  intake: 'bg-[#F3EDE3] text-[#8A817B]',
  documentation: 'bg-[#F6ECD8] text-[#9A6B1E]',
  filing: 'bg-[#F6ECD8] text-[#9A6B1E]',
  hearing: 'bg-[#FBF1EE] text-[#6B1E2B]',
  judgment: 'bg-[#EAF1EC] text-[#3F7A5B]',
  closed: 'bg-[#F3EDE3] text-[#A89F99]',
};

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [lawyers, setLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ title: '', type: 'corporate', client_id: '', lead_lawyer_id: '', cause_no: '', court: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('matters').select('id, matter_ref, title, type, stage, status, client:profiles!client_id(full_name), lead_lawyer:profiles!lead_lawyer_id(full_name), opened_at').order('opened_at', { ascending: false });
    if (data) setMatters(data as unknown as Matter[]);
    const [cl, la] = await Promise.all([
      supabase.from('profiles').select('id, full_name').eq('role', 'client'),
      supabase.from('profiles').select('id, full_name').eq('role', 'lawyer'),
    ]);
    if (cl.data) setClients(cl.data);
    if (la.data) setLawyers(la.data);
    setLoading(false);
  }

  async function createMatter() {
    if (!form.title || !form.client_id || !form.lead_lawyer_id) return;
    setSaving(true);
    const { count: existing } = await supabase.from('matters').select('id', { count: 'exact', head: true });
    const ref = `BST-${new Date().getFullYear()}-${String((existing ?? 0) + 1).padStart(3, '0')}`;
    const { data: m } = await supabase.from('matters').insert({
      matter_ref: ref, title: form.title, type: form.type,
      client_id: form.client_id, lead_lawyer_id: form.lead_lawyer_id,
      cause_no: form.cause_no || null, court: form.court || null,
    }).select('id').single();

    if (m) {
      await supabase.from('matter_lawyers').insert({ matter_id: m.id, lawyer_id: form.lead_lawyer_id, role: 'lead' });
      // Welcome message in firm chat + notification to client
      const lawyer = lawyers.find((l) => l.id === form.lead_lawyer_id);
      await supabase.from('messages').insert({
        matter_id: null, client_id: form.client_id, sender_id: form.lead_lawyer_id,
        body: `Welcome to Bastion Law. Your matter "${form.title}" (${ref}) has been opened and ${lawyer?.full_name ?? 'your lawyer'} has been assigned. Please review the Documents tab for any required submissions.`,
      });
      await supabase.from('notifications').insert({
        user_id: form.client_id, type: 'case_update',
        title: `Matter opened: ${ref}`,
        body: `${form.title} has been opened. ${lawyer?.full_name ?? 'Your lawyer'} has been assigned.`,
        matter_id: m.id,
      });
    }
    setSaving(false);
    setModal(false);
    setForm({ title: '', type: 'corporate', client_id: '', lead_lawyer_id: '', cause_no: '', court: '' });
    load();
  }

  const filtered = matters.filter((m) => !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.matter_ref.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell title="Matters" action={
      <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> New Matter
      </button>
    }>
      <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#ECE4D9]">
          <div className="flex items-center gap-2 bg-[#F6F1EA] rounded-xl px-3 py-2 w-80">
            <Search size={15} className="text-[#A89F99]" />
            <input className="bg-transparent text-sm text-[#241D1C] placeholder-[#A89F99] outline-none flex-1" placeholder="Search matters…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin mx-auto" /></div> : (
          <table className="w-full">
            <thead><tr className="border-b border-[#ECE4D9]">
              {['Ref', 'Title', 'Client', 'Lead Lawyer', 'Stage', 'Opened'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-[#A89F99]">{m.matter_ref}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[#241D1C] max-w-xs">
                    <p className="truncate">{m.title}</p>
                    <p className="text-xs text-[#A89F99] font-normal capitalize">{m.type}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">{m.client.full_name}</td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">{m.lead_lawyer.full_name}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STAGE_COLORS[m.stage] ?? 'bg-[#F3EDE3] text-[#8A817B]'}`}>{m.stage}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#A89F99]">{new Date(m.opened_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#A89F99]">No matters found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">New Matter</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">TITLE</label>
                <input className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Corporate Merger — Tariq Enterprises" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">TYPE</label>
                  <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {['corporate', 'civil', 'criminal', 'family', 'property', 'other'].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">CAUSE NO.</label>
                  <input className="field-input" value={form.cause_no} onChange={(e) => setForm({ ...form, cause_no: e.target.value })} placeholder="1247/2026" />
                </div>
              </div>
              <div>
                <label className="field-label">COURT</label>
                <input className="field-input" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} placeholder="Karachi High Court" />
              </div>
              <div>
                <label className="field-label">CLIENT</label>
                <select className="field-input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">LEAD LAWYER</label>
                <select className="field-input" value={form.lead_lawyer_id} onChange={(e) => setForm({ ...form, lead_lawyer_id: e.target.value })}>
                  <option value="">Select lawyer…</option>
                  {lawyers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createMatter} disabled={saving || !form.title || !form.client_id || !form.lead_lawyer_id}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Matter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .field-label { display: block; font-size: 10px; font-weight: 500; color: #8A817B; letter-spacing: 0.1em; margin-bottom: 6px; }
        .field-input { width: 100%; height: 44px; border: 1px solid #ECE4D9; border-radius: 12px; padding: 0 14px; background: #F6F1EA; color: #241D1C; font-size: 14px; outline: none; }
        .field-input:focus { border-color: #6B1E2B; box-shadow: 0 0 0 1px #6B1E2B; }
      `}</style>
    </PageShell>
  );
}
