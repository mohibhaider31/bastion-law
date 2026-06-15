'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, X, ArrowRight } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  matter_type: string;
  summary: string | null;
  stage: string;
  assigned_to: string | null;
  created_at: string;
  converted_matter_id: string | null;
  assignee?: { full_name: string } | null;
}

const STAGES = [
  { key: 'new',          label: 'New',          color: '#8A817B', bg: '#F3EDE3' },
  { key: 'contacted',    label: 'Contacted',    color: '#9A6B1E', bg: '#F6ECD8' },
  { key: 'consultation', label: 'Consultation', color: '#6B1E2B', bg: '#FBF1EE' },
  { key: 'proposal',     label: 'Proposal',     color: '#3F7A5B', bg: '#EAF1EC' },
  { key: 'won',          label: 'Won',          color: '#3F7A5B', bg: '#D1E8D8' },
  { key: 'lost',         label: 'Lost',         color: '#A89F99', bg: '#F3EDE3' },
];

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct', referral: 'Referral', website: 'Website', walk_in: 'Walk-in', other: 'Other',
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export default function IntakePage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lawyers, setLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'direct', matter_type: 'corporate', summary: '', assigned_to: '' });
  const [saving, setSaving] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [leadsRes, lawyersRes] = await Promise.all([
      supabase.from('intake_leads').select('*, assignee:profiles!assigned_to(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'lawyer'),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (lawyersRes.data) setLawyers(lawyersRes.data);
    setLoading(false);
  }

  async function createLead() {
    if (!form.name) return;
    setSaving(true);
    await supabase.from('intake_leads').insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source,
      matter_type: form.matter_type,
      summary: form.summary || null,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    setModal(false);
    setForm({ name: '', email: '', phone: '', source: 'direct', matter_type: 'corporate', summary: '', assigned_to: '' });
    load();
  }

  async function advanceStage(lead: Lead) {
    const idx = STAGES.findIndex((s) => s.key === lead.stage);
    if (idx < 0 || idx >= STAGES.length - 1 || lead.stage === 'won' || lead.stage === 'lost') return;
    const next = STAGES[idx + 1].key;
    await supabase.from('intake_leads').update({ stage: next, updated_at: new Date().toISOString() }).eq('id', lead.id);
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: next } : l));
    if (detailLead?.id === lead.id) setDetailLead({ ...detailLead, stage: next });
  }

  async function markLost(lead: Lead) {
    await supabase.from('intake_leads').update({ stage: 'lost', updated_at: new Date().toISOString() }).eq('id', lead.id);
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: 'lost' } : l));
    setDetailLead(null);
  }

  async function convertToMatter(lead: Lead) {
    router.push(`/matters?intake=${lead.id}&client_name=${encodeURIComponent(lead.name)}&type=${lead.matter_type}`);
  }

  const stageLeads = (key: string) => leads.filter((l) => l.stage === key);

  return (
    <PageShell title="Intake Pipeline" action={
      <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> New Lead
      </button>
    }>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {STAGES.map((stage) => {
            const stageItems = stageLeads(stage.key);
            return (
              <div key={stage.key} className="flex-shrink-0 w-56">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-semibold tracking-widest" style={{ color: stage.color }}>{stage.label.toUpperCase()}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: stage.color, backgroundColor: stage.bg }}>{stageItems.length}</span>
                </div>
                <div className="space-y-2">
                  {stageItems.map((lead) => (
                    <button key={lead.id} onClick={() => setDetailLead(lead)} className="w-full text-left bg-white border border-[#ECE4D9] rounded-xl p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#FBF1EE] flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-[#6B1E2B]">{initials(lead.name)}</span>
                        </div>
                        <span className="text-[10px] text-[#A89F99] mt-0.5">{fmtDate(lead.created_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#241D1C] mb-1">{lead.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3EDE3] text-[#8A817B] capitalize">{lead.matter_type}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3EDE3] text-[#8A817B]">{SOURCE_LABELS[lead.source]}</span>
                      </div>
                      {lead.assignee && (
                        <p className="text-[10px] text-[#A89F99] mt-1.5">→ {lead.assignee.full_name}</p>
                      )}
                    </button>
                  ))}
                  {stageItems.length === 0 && (
                    <div className="text-center py-6 text-[#C5BBB5] text-xs">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Lead Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">New Intake Lead</h3>
            <div className="space-y-4">
              <Field label="NAME" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ahmed Tariq" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="EMAIL" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="Optional" type="email" />
                <Field label="PHONE" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">SOURCE</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]">
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">MATTER TYPE</label>
                  <select value={form.matter_type} onChange={(e) => setForm({ ...form, matter_type: e.target.value })}
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]">
                    {['corporate', 'civil', 'criminal', 'family', 'property', 'other'].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">ASSIGN TO LAWYER (OPTIONAL)</label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]">
                  <option value="">Unassigned</option>
                  {lawyers.map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">SUMMARY</label>
                <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Brief description of the potential matter…"
                  className="w-full h-20 border border-[#ECE4D9] rounded-xl px-4 pt-3 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createLead} disabled={saving || !form.name} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {saving ? 'Adding…' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer */}
      {detailLead && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.4)] flex items-center justify-end z-50" onClick={() => setDetailLead(null)}>
          <div className="bg-white h-full w-80 shadow-2xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[#241D1C]">Lead Detail</h3>
              <button onClick={() => setDetailLead(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F6F1EA] transition-colors">
                <X size={16} className="text-[#8A817B]" />
              </button>
            </div>

            <div className="w-12 h-12 rounded-full bg-[#FBF1EE] flex items-center justify-center mb-3">
              <span className="text-sm font-bold text-[#6B1E2B]">{initials(detailLead.name)}</span>
            </div>
            <h4 className="text-lg font-bold text-[#241D1C] mb-1">{detailLead.name}</h4>
            {(() => {
              const stage = STAGES.find((s) => s.key === detailLead.stage);
              return <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: stage?.color, backgroundColor: stage?.bg }}>{stage?.label}</span>;
            })()}

            <div className="space-y-3 mt-5">
              {detailLead.email && <Detail label="Email" value={detailLead.email} />}
              {detailLead.phone && <Detail label="Phone" value={detailLead.phone} />}
              <Detail label="Source" value={SOURCE_LABELS[detailLead.source]} />
              <Detail label="Matter Type" value={detailLead.matter_type.charAt(0).toUpperCase() + detailLead.matter_type.slice(1)} />
              {detailLead.assignee && <Detail label="Assigned To" value={detailLead.assignee.full_name} />}
              <Detail label="Added" value={fmtDate(detailLead.created_at)} />
              {detailLead.summary && (
                <div>
                  <p className="text-[10px] font-medium text-[#A89F99] tracking-widest mb-1">SUMMARY</p>
                  <p className="text-sm text-[#6E635F] leading-relaxed">{detailLead.summary}</p>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2">
              {detailLead.stage !== 'won' && detailLead.stage !== 'lost' && (
                <button onClick={() => advanceStage(detailLead)} className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors">
                  <ArrowRight size={15} />
                  Advance Stage
                </button>
              )}
              {detailLead.stage === 'proposal' && (
                <button onClick={() => convertToMatter(detailLead)} className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#3F7A5B] text-white text-sm font-semibold hover:bg-[#2D5A42] transition-colors">
                  Convert to Matter
                </button>
              )}
              {detailLead.stage === 'won' && (
                <button onClick={() => convertToMatter(detailLead)} className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#3F7A5B] text-white text-sm font-semibold hover:bg-[#2D5A42] transition-colors">
                  Open as Matter
                </button>
              )}
              {detailLead.stage !== 'lost' && detailLead.stage !== 'won' && (
                <button onClick={() => markLost(detailLead)} className="w-full h-11 rounded-xl border border-[#ECE4D9] text-[#A89F99] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">
                  Mark as Lost
                </button>
              )}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#A89F99] tracking-widest mb-0.5">{label.toUpperCase()}</p>
      <p className="text-sm text-[#241D1C]">{value}</p>
    </div>
  );
}
