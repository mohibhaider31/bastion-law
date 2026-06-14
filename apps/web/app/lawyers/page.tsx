'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, Search } from 'lucide-react';

interface Lawyer { id: string; full_name: string; email: string; phone: string | null; active_matters: number; created_at: string; }

export default function LawyersPage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: 'Bastion123!' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles').select('id, full_name, email, phone, created_at').eq('role', 'lawyer').order('full_name');
    if (!data) { setLoading(false); return; }
    const enriched = await Promise.all(data.map(async (l) => {
      const { count } = await supabase.from('matters').select('id', { count: 'exact', head: true }).eq('lead_lawyer_id', l.id).eq('status', 'active');
      return { ...l, active_matters: count ?? 0 };
    }));
    setLawyers(enriched);
    setLoading(false);
  }

  async function createLawyer() {
    if (!form.full_name || !form.email) return;
    setSaving(true); setSaveError('');
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role: 'lawyer' }),
    });
    const json = await res.json();
    if (!res.ok) { setSaveError(json.error ?? 'Failed to create lawyer'); setSaving(false); return; }
    setSaving(false); setModal(false);
    setForm({ full_name: '', email: '', phone: '', password: 'Bastion123!' });
    load();
  }

  const filtered = lawyers.filter((l) => !search || l.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell title="Lawyers" action={
      <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> Add Lawyer
      </button>
    }>
      <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#ECE4D9]">
          <div className="flex items-center gap-2 bg-[#F6F1EA] rounded-xl px-3 py-2 w-72">
            <Search size={15} className="text-[#A89F99]" />
            <input className="bg-transparent text-sm text-[#241D1C] placeholder-[#A89F99] outline-none flex-1" placeholder="Search lawyers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin mx-auto" /></div> : (
          <table className="w-full">
            <thead><tr className="border-b border-[#ECE4D9]">
              {['Lawyer', 'Email', 'Phone', 'Active Matters', 'Joined'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#EAF1EC] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#3F7A5B] font-bold text-sm">{l.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                      </div>
                      <span className="font-semibold text-sm text-[#241D1C]">{l.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">{l.email}</td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">{l.phone ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#EAF1EC] text-[#3F7A5B]">{l.active_matters} matters</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#A89F99]">{new Date(l.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[#A89F99]">No lawyers found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Add New Lawyer</h3>
            <div className="space-y-4">
              <Field label="FULL NAME" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="Zara Khan" />
              <Field label="EMAIL" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="lawyer@bastionlaw.pk" type="email" />
              <Field label="PHONE" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+92-300-000-0000" />
              <Field label="INITIAL PASSWORD" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Bastion123!" type="password" />
            </div>
            {saveError && <p className="text-[#C0392B] text-xs mt-3 bg-[#FDF0EE] rounded-lg p-3">{saveError}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(false); setSaveError(''); }} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createLawyer} disabled={saving || !form.full_name || !form.email} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Lawyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]" />
    </div>
  );
}
