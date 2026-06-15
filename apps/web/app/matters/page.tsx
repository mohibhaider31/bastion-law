'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, Search, UserCheck, Download } from 'lucide-react';

interface Matter { id: string; matter_ref: string; title: string; type: string; stage: string; status: string; client: { full_name: string }; lead_lawyer: { full_name: string } | null; opened_at: string; }

const STAGE_COLORS: Record<string, string> = {
  intake: 'bg-[#F3EDE3] text-[#8A817B]',
  documentation: 'bg-[#F6ECD8] text-[#9A6B1E]',
  filing: 'bg-[#F6ECD8] text-[#9A6B1E]',
  hearing: 'bg-[#FBF1EE] text-[#6B1E2B]',
  judgment: 'bg-[#EAF1EC] text-[#3F7A5B]',
  closed: 'bg-[#F3EDE3] text-[#A89F99]',
};

export default function MattersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intakePreloaded = useRef(false);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [lawyers, setLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ title: '', type: 'corporate', client_id: '', lead_lawyer_id: '', cause_no: '', court: '' });
  const [saving, setSaving] = useState(false);
  const [assignModal, setAssignModal] = useState<{ matterId: string; matterRef: string } | null>(null);
  const [assignLawyerId, setAssignLawyerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'archived'>('all');

  // Conflict of interest check
  const [coiConflicts, setCoiConflicts] = useState<{ matter_ref: string; matter_id: string; role: string }[]>([]);
  const [coiChecking, setCoiChecking] = useState(false);
  const [existingMatters, setExistingMatters] = useState<{ id: string; matter_ref: string; title: string }[]>([]);

  useEffect(() => { load(); }, []);

  // Auto-open create modal when coming from Intake pipeline
  useEffect(() => {
    if (intakePreloaded.current || loading) return;
    const intakeId = searchParams.get('intake');
    const clientName = searchParams.get('client_name');
    const type = searchParams.get('type');
    if (!intakeId) return;
    intakePreloaded.current = true;
    const matchedClient = clients.find((c) => c.full_name.toLowerCase() === (clientName ?? '').toLowerCase());
    setForm((f) => ({ ...f, type: type ?? 'corporate', client_id: matchedClient?.id ?? '' }));
    setModal(true);
  }, [loading, clients, searchParams]);

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
    if (!form.title || !form.client_id) return;
    setSaving(true);
    const { count: existing } = await supabase.from('matters').select('id', { count: 'exact', head: true });
    const ref = `BST-${new Date().getFullYear()}-${String((existing ?? 0) + 1).padStart(3, '0')}`;
    const { data: m } = await supabase.from('matters').insert({
      matter_ref: ref, title: form.title, type: form.type,
      client_id: form.client_id,
      lead_lawyer_id: form.lead_lawyer_id || null,
      cause_no: form.cause_no || null, court: form.court || null,
    }).select('id').single();

    if (m) {
      const lawyer = lawyers.find((l) => l.id === form.lead_lawyer_id);
      const client = clients.find((c) => c.id === form.client_id);

      if (form.lead_lawyer_id) {
        await supabase.from('matter_lawyers').insert({ matter_id: m.id, lawyer_id: form.lead_lawyer_id, role: 'lead' });
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
      } else {
        await supabase.from('notifications').insert({
          user_id: form.client_id, type: 'case_update',
          title: `Matter opened: ${ref}`,
          body: `${form.title} has been opened. A lawyer will be assigned shortly.`,
          matter_id: m.id,
        });
      }

      const { data: cp } = await supabase.from('profiles').select('email').eq('id', form.client_id).single();
      if (cp?.email) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_slug: 'matter_opened',
            to_email: cp.email,
            to_name: client?.full_name ?? '',
            client_id: form.client_id,
            matter_id: m.id,
            vars: {
              client_name: client?.full_name ?? '',
              matter_ref:  ref,
              matter_type: form.type,
              lawyer_name: lawyer?.full_name ?? 'Lawyer TBA',
            },
          }),
        }).catch(() => {});
      }
    }
    // Mark intake lead as won if this matter was converted from one
    const intakeId = searchParams.get('intake');
    if (intakeId && m) {
      await supabase.from('intake_leads').update({ stage: 'won', converted_matter_id: m.id, updated_at: new Date().toISOString() }).eq('id', intakeId);
    }
    setSaving(false);
    setModal(false);
    setForm({ title: '', type: 'corporate', client_id: '', lead_lawyer_id: '', cause_no: '', court: '' });
    load();
  }

  async function assignLawyer() {
    if (!assignModal || !assignLawyerId) return;
    setAssigning(true);
    await fetch('/api/assign-lawyer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matter_id: assignModal.matterId, lawyer_id: assignLawyerId }),
    });
    setAssigning(false);
    setAssignModal(null);
    setAssignLawyerId('');
    load();
  }

  async function checkConflicts(clientId: string) {
    if (!clientId) { setCoiConflicts([]); setExistingMatters([]); return; }
    setCoiChecking(true);
    const client = clients.find((c) => c.id === clientId);
    const clientName = client?.full_name ?? '';
    const [existRes, contactsRes] = await Promise.all([
      supabase.from('matters').select('id, matter_ref, title').eq('client_id', clientId).neq('status', 'archived'),
      clientName
        ? supabase.from('contacts').select('role, matter:matters!matter_id(id, matter_ref)').ilike('name', `%${clientName}%`).in('role', ['opposing_counsel', 'opposing_party', 'witness', 'other'])
        : Promise.resolve({ data: [] }),
    ]);
    setExistingMatters((existRes.data ?? []) as any[]);
    const conflicts = ((contactsRes.data ?? []) as any[])
      .filter((c: any) => c.matter?.id)
      .map((c: any) => ({ matter_ref: c.matter.matter_ref, matter_id: c.matter.id, role: c.role }));
    setCoiConflicts(conflicts);
    setCoiChecking(false);
  }

  const filtered = matters.filter((m) => {
    const matchesSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.matter_ref.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function exportCSV() {
    const headers = ['Ref', 'Title', 'Type', 'Client', 'Lead Lawyer', 'Stage', 'Status', 'Opened'];
    const rows = filtered.map((m) => [
      m.matter_ref, m.title, m.type,
      m.client.full_name,
      m.lead_lawyer?.full_name ?? 'TBA',
      m.stage, m.status,
      new Date(m.opened_at).toLocaleDateString('en-PK'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `matters-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <PageShell title="Matters" action={
      <div className="flex items-center gap-2">
        <button onClick={exportCSV} className="flex items-center gap-2 border border-[#ECE4D9] text-[#6E635F] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#F6F1EA] transition-colors">
          <Download size={15} /> Export CSV
        </button>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
          <Plus size={16} /> New Matter
        </button>
      </div>
    }>
      <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#ECE4D9] flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-[#F6F1EA] rounded-xl px-3 py-2 w-72">
            <Search size={15} className="text-[#A89F99]" />
            <input className="bg-transparent text-sm text-[#241D1C] placeholder-[#A89F99] outline-none flex-1" placeholder="Search matters…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'closed', 'archived'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-[#6B1E2B] text-white' : 'text-[#8A817B] hover:bg-[#F6F1EA]'}`}>
                {s === 'all' ? `All (${matters.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${matters.filter((m) => m.status === s).length})`}
              </button>
            ))}
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
                <tr key={m.id} onClick={() => router.push(`/matters/${m.id}`)} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors cursor-pointer">
                  <td className="px-5 py-4 text-xs font-mono text-[#A89F99]">{m.matter_ref}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-[#241D1C] max-w-xs">
                    <p className="truncate">{m.title}</p>
                    <p className="text-xs text-[#A89F99] font-normal capitalize">{m.type}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">{m.client.full_name}</td>
                  <td className="px-5 py-4 text-sm text-[#6E635F]">
                    {m.lead_lawyer ? (
                      m.lead_lawyer.full_name
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F6ECD8] text-[#9A6B1E]">Lawyer TBA</span>
                        <button
                          onClick={() => { setAssignModal({ matterId: m.id, matterRef: m.matter_ref }); setAssignLawyerId(''); }}
                          className="flex items-center gap-1 text-xs text-[#6B1E2B] font-medium hover:underline"
                        >
                          <UserCheck size={12} /> Assign
                        </button>
                      </div>
                    )}
                  </td>
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
                <select className="field-input" value={form.client_id} onChange={(e) => { setForm({ ...form, client_id: e.target.value }); checkConflicts(e.target.value); }}>
                  <option value="">Select client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
                {coiChecking && <p className="text-xs text-[#A89F99] mt-1">Checking for conflicts…</p>}
                {!coiChecking && form.client_id && coiConflicts.length > 0 && (
                  <div className="mt-2 bg-[#FDF0EE] border border-[#ECCDC8] rounded-xl p-3">
                    <p className="text-xs font-semibold text-[#C0392B] mb-1.5">⚠ Potential Conflict of Interest</p>
                    <p className="text-xs text-[#6E635F] mb-2">This client's name appears as an opposing party in existing matters:</p>
                    {coiConflicts.map((c, i) => (
                      <button key={i} onClick={() => router.push(`/matters/${c.matter_id}`)} className="block text-xs text-[#C0392B] underline hover:no-underline">
                        {c.matter_ref} (as {c.role.replace(/_/g, ' ')})
                      </button>
                    ))}
                  </div>
                )}
                {!coiChecking && form.client_id && existingMatters.length > 0 && (
                  <div className="mt-2 bg-[#F6F1EA] border border-[#ECE4D9] rounded-xl p-3">
                    <p className="text-xs font-semibold text-[#8A817B] mb-1.5">Client's existing matters</p>
                    {existingMatters.map((m) => (
                      <p key={m.id} className="text-xs text-[#6E635F]">{m.matter_ref} — {m.title}</p>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="field-label">LEAD LAWYER <span className="text-[#A89F99] font-normal normal-case tracking-normal">(optional — can assign later)</span></label>
                <select className="field-input" value={form.lead_lawyer_id} onChange={(e) => setForm({ ...form, lead_lawyer_id: e.target.value })}>
                  <option value="">Assign later (Lawyer TBA)</option>
                  {lawyers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModal(false); setCoiConflicts([]); setExistingMatters([]); }} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createMatter} disabled={saving || !form.title || !form.client_id}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Matter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-1">Assign Lawyer</h3>
            <p className="text-sm text-[#A89F99] mb-5">{assignModal.matterRef}</p>
            <div>
              <label className="field-label">SELECT LAWYER</label>
              <select className="field-input" value={assignLawyerId} onChange={(e) => setAssignLawyerId(e.target.value)}>
                <option value="">Choose a lawyer…</option>
                {lawyers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setAssignModal(null)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={assignLawyer} disabled={assigning || !assignLawyerId}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {assigning ? 'Assigning…' : 'Assign'}
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
