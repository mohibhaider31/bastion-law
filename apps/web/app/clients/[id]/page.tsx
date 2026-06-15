'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import {
  ArrowLeft, Pencil, Check, Mail, Phone, Briefcase,
  FileText, DollarSign, Calendar, Activity, ToggleLeft, ToggleRight,
} from 'lucide-react';

type Tab = 'matters' | 'invoices' | 'documents' | 'appointments' | 'activity';

const STAGE_COLORS: Record<string, string> = {
  intake: 'bg-[#F3EDE3] text-[#8A817B]', documentation: 'bg-[#F6ECD8] text-[#9A6B1E]',
  filing: 'bg-[#F6ECD8] text-[#9A6B1E]', hearing: 'bg-[#FBF1EE] text-[#6B1E2B]',
  judgment: 'bg-[#EAF1EC] text-[#3F7A5B]', closed: 'bg-[#F3EDE3] text-[#A89F99]',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPKR(paisas: number) {
  return `PKR ${(paisas / 100).toLocaleString('en-PK')}`;
}
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<any>(null);
  const [matters, setMatters] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('matters');

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', cnic: '' });
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    const [clientRes, mattersRes, invoicesRes, apptsRes, notifsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('matters').select('id, matter_ref, title, type, stage, status, opened_at, lead_lawyer:profiles!lead_lawyer_id(full_name)').eq('client_id', id).order('opened_at', { ascending: false }),
      supabase.from('invoices').select('id, invoice_ref, status, amount_paisas, due_date, paid_at, matter:matters(matter_ref)').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('id, status, type, proposed_at, duration_minutes, lawyer:profiles!lawyer_id(full_name), matter:matters(matter_ref)').eq('client_id', id).order('proposed_at', { ascending: false }).limit(20),
      supabase.from('notifications').select('id, title, body, type, read_at, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    ]);

    if (clientRes.data) { setClient(clientRes.data); setEditForm({ full_name: clientRes.data.full_name, phone: clientRes.data.phone ?? '', cnic: clientRes.data.cnic ?? '' }); }
    if (mattersRes.data) {
      setMatters(mattersRes.data as any[]);
      // Load documents across all matters
      const matterIds = mattersRes.data.map((m: any) => m.id);
      if (matterIds.length) {
        const { data: docs } = await supabase.from('documents').select('id, name, category, status, due_date, requires_esign, matter:matters(matter_ref)').in('matter_id', matterIds).order('created_at', { ascending: false });
        if (docs) setDocuments(docs);
      }
    }
    if (invoicesRes.data) setInvoices(invoicesRes.data as any[]);
    if (apptsRes.data) setAppointments(apptsRes.data as any[]);
    if (notifsRes.data) setNotifications(notifsRes.data);
    setLoading(false);
  }

  async function saveEdit() {
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      cnic: editForm.cnic || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    setEditModal(false);
    load();
  }

  async function toggleActive() {
    if (!client) return;
    setTogglingActive(true);
    await supabase.from('profiles').update({ is_active: !client.is_active, updated_at: new Date().toISOString() }).eq('id', id);
    setTogglingActive(false);
    load();
  }

  async function markInvoicePaid(invId: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invId);
    setInvoices((prev) => prev.map((i) => i.id === invId ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
  }

  if (loading) return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" />
    </div>
  );
  if (!client) return <div className="p-8 text-[#A89F99]">Client not found.</div>;

  const activeMatterCount = matters.filter((m) => m.status === 'active').length;
  const totalBilled = invoices.reduce((s, i) => s + i.amount_paisas, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_paisas, 0);
  const outstanding = totalBilled - totalPaid;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'matters', label: `Matters (${matters.length})`, icon: Briefcase },
    { key: 'invoices', label: `Invoices (${invoices.length})`, icon: DollarSign },
    { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { key: 'appointments', label: 'Appointments', icon: Calendar },
    { key: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#ECE4D9] px-6 py-4">
        <button onClick={() => router.push('/clients')} className="flex items-center gap-1.5 text-sm text-[#8A817B] hover:text-[#241D1C] mb-4 transition-colors">
          <ArrowLeft size={15} /> Back to Clients
        </button>

        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#F0E3E1] flex items-center justify-center flex-shrink-0">
            <span className="text-[#6B1E2B] font-bold text-xl">{initials(client.full_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-[#241D1C]">{client.full_name}</h1>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${client.is_active ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#FDF0EE] text-[#C0392B]'}`}>
                {client.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-[#6E635F]"><Mail size={13} className="text-[#A89F99]" />{client.email}</span>
              {client.phone && <span className="flex items-center gap-1.5 text-sm text-[#6E635F]"><Phone size={13} className="text-[#A89F99]" />{client.phone}</span>}
              {client.cnic && <span className="text-sm text-[#A89F99]">CNIC: {client.cnic}</span>}
              <span className="text-sm text-[#A89F99]">Joined {fmtDate(client.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={toggleActive} disabled={togglingActive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ECE4D9] text-sm text-[#6E635F] hover:bg-[#F6F1EA] transition-colors disabled:opacity-50">
              {client.is_active ? <ToggleRight size={15} className="text-[#3F7A5B]" /> : <ToggleLeft size={15} />}
              {client.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => setEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ECE4D9] text-sm text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
              <Pencil size={14} /> Edit
            </button>
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Active Matters', value: activeMatterCount.toString(), highlight: activeMatterCount > 0 },
            { label: 'Total Billed', value: fmtPKR(totalBilled) },
            { label: 'Total Paid', value: fmtPKR(totalPaid) },
            { label: 'Outstanding', value: fmtPKR(outstanding), alert: outstanding > 0 },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 border ${s.alert ? 'bg-[#FBF1EE] border-[#F0C9C0]' : 'bg-[#F6F1EA] border-[#ECE4D9]'}`}>
              <p className="text-[10px] font-medium text-[#A89F99] tracking-widest mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.alert ? 'text-[#C0392B]' : s.highlight ? 'text-[#6B1E2B]' : 'text-[#241D1C]'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-[#ECE4D9] px-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === key ? 'border-[#6B1E2B] text-[#6B1E2B]' : 'border-transparent text-[#8A817B] hover:text-[#241D1C]'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-5xl">

        {/* MATTERS */}
        {tab === 'matters' && (
          <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
            {matters.length === 0 ? <p className="px-5 py-8 text-sm text-[#A89F99]">No matters yet.</p> : (
              <table className="w-full">
                <thead><tr className="border-b border-[#ECE4D9]">
                  {['Ref', 'Title', 'Lead Lawyer', 'Stage', 'Status', 'Opened'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {matters.map((m) => (
                    <tr key={m.id} onClick={() => router.push(`/matters/${m.id}`)}
                      className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors cursor-pointer">
                      <td className="px-5 py-4 text-xs font-mono text-[#A89F99]">{m.matter_ref}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#241D1C]">
                        <p className="truncate max-w-[220px]">{m.title}</p>
                        <p className="text-xs text-[#A89F99] font-normal capitalize">{m.type}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#6E635F]">{(m.lead_lawyer as any)?.full_name ?? <span className="text-[10px] bg-[#F6ECD8] text-[#9A6B1E] px-2 py-0.5 rounded-full">TBA</span>}</td>
                      <td className="px-5 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STAGE_COLORS[m.stage]}`}>{m.stage}</span></td>
                      <td className="px-5 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${m.status === 'active' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>{m.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 text-sm text-[#A89F99]">{fmtDate(m.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* INVOICES */}
        {tab === 'invoices' && (
          <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
            {invoices.length === 0 ? <p className="px-5 py-8 text-sm text-[#A89F99]">No invoices yet.</p> : (
              <table className="w-full">
                <thead><tr className="border-b border-[#ECE4D9]">
                  {['Invoice', 'Matter', 'Amount', 'Due Date', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#F3EDE3]">
                      <td className="px-5 py-4 text-xs font-mono text-[#A89F99]">{inv.invoice_ref}</td>
                      <td className="px-5 py-4 text-xs text-[#A89F99]">{(inv.matter as any)?.matter_ref ?? '—'}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#241D1C]">{fmtPKR(inv.amount_paisas)}</td>
                      <td className="px-5 py-4 text-sm text-[#6E635F]">{fmtDate(inv.due_date)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${inv.status === 'paid' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : inv.status === 'overdue' ? 'bg-[#FDF0EE] text-[#C0392B]' : 'bg-[#F6ECD8] text-[#9A6B1E]'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {(inv.status === 'sent' || inv.status === 'outstanding' || inv.status === 'overdue') && (
                          <button onClick={() => markInvoicePaid(inv.id)} className="text-xs font-semibold text-[#3F7A5B] hover:underline">Mark paid</button>
                        )}
                        {inv.status === 'paid' && inv.paid_at && <span className="text-xs text-[#A89F99]">Paid {fmtDate(inv.paid_at)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* DOCUMENTS */}
        {tab === 'documents' && (
          <div className="space-y-2">
            {documents.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No documents across this client's matters.</p>}
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4 flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${doc.status === 'verified' ? 'bg-[#3F7A5B]' : doc.status === 'signed' ? 'bg-[#6B1E2B]' : doc.status === 'under_review' ? 'bg-[#9A6B1E]' : 'bg-[#C0392B]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#241D1C]">{doc.name}</p>
                  <p className="text-xs text-[#A89F99] mt-0.5 capitalize">
                    {doc.status.replace(/_/g, ' ')} · {(doc.matter as any)?.matter_ref ?? '—'} · {doc.category}
                    {doc.requires_esign ? ' · Requires signature' : ''}
                    {doc.due_date ? ` · Due ${fmtDate(doc.due_date)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* APPOINTMENTS */}
        {tab === 'appointments' && (
          <div className="space-y-3">
            {appointments.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No appointments yet.</p>}
            {appointments.map((appt) => (
              <div key={appt.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${appt.status === 'confirmed' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : appt.status === 'pending' ? 'bg-[#F6ECD8] text-[#9A6B1E]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-[#A89F99]">{appt.type === 'video' ? 'Video' : 'In-Person'} · {appt.duration_minutes} min</span>
                  </div>
                  <p className="text-sm font-semibold text-[#241D1C]">With {(appt.lawyer as any)?.full_name}</p>
                  <p className="text-xs text-[#A89F99] mt-0.5">
                    {new Date(appt.proposed_at).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {(appt.matter as any)?.matter_ref ? ` · ${(appt.matter as any).matter_ref}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ACTIVITY */}
        {tab === 'activity' && (
          <div className="max-w-2xl space-y-0">
            {notifications.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No activity yet.</p>}
            {notifications.map((n, i) => (
              <div key={n.id} className="flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${n.read_at ? 'bg-[#ECE4D9]' : 'bg-[#6B1E2B]'}`} />
                  {i < notifications.length - 1 && <div className="w-0.5 flex-1 bg-[#ECE4D9] mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-semibold text-[#241D1C]">{n.title}</p>
                  <p className="text-xs text-[#8A817B] mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-[#A89F99] mt-1">{new Date(n.created_at).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!n.read_at && <div className="w-2 h-2 rounded-full bg-[#6B1E2B] flex-shrink-0 mt-2" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Edit Client</h3>
            <div className="space-y-4">
              {[
                { label: 'FULL NAME', key: 'full_name', placeholder: 'Full name' },
                { label: 'PHONE', key: 'phone', placeholder: '+92-300-000-0000' },
                { label: 'CNIC', key: 'cnic', placeholder: '42101-1234567-1' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">{label}</label>
                  <input
                    className="w-full h-11 border border-[#ECE4D9] rounded-xl px-4 bg-[#F6F1EA] text-[#241D1C] text-sm focus:outline-none focus:border-[#6B1E2B]"
                    value={(editForm as any)[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving || !editForm.full_name}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
