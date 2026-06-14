'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageShell } from '../../components/PageShell';
import { Plus, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';

interface Invoice {
  id: string; invoice_ref: string; status: string; amount_paisas: number;
  due_date: string; paid_at: string | null; created_at: string;
  client: { full_name: string };
  matter: { matter_ref: string } | null;
}

interface Expense {
  id: string; category: string; description: string; amount_pkr: number;
  expense_date: string; billable: boolean;
  matter: { matter_ref: string; title: string } | null;
  logger: { full_name: string } | null;
}

const STATUS_STYLE: Record<string, { cls: string; icon: any }> = {
  draft:       { cls: 'bg-[#F3EDE3] text-[#A89F99]', icon: Clock },
  sent:        { cls: 'bg-[#F6ECD8] text-[#9A6B1E]', icon: Clock },
  outstanding: { cls: 'bg-[#FDF0EE] text-[#C0392B]', icon: AlertCircle },
  overdue:     { cls: 'bg-[#FDF0EE] text-[#C0392B]', icon: AlertCircle },
  paid:        { cls: 'bg-[#EAF1EC] text-[#3F7A5B]', icon: CheckCircle },
  cancelled:   { cls: 'bg-[#F3EDE3] text-[#A89F99]', icon: Clock },
};

function formatPKR(paisas: number) {
  const rupees = paisas / 100;
  return `PKR ${rupees.toLocaleString('en-PK')}`;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [matters, setMatters] = useState<{ id: string; matter_ref: string; title: string }[]>([]);
  const [profile, setProfile] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ client_id: '', matter_id: '', due_date: '', notes: '' });
  const [lineItems, setLineItems] = useState([{ description: '', quantity: '1', unit_pkr: '' }]);
  const [saving, setSaving] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setProfile({ id: user.id });
    const [invRes, clRes, matRes, expRes] = await Promise.all([
      supabase.from('invoices').select('id, invoice_ref, status, amount_paisas, due_date, paid_at, created_at, client:profiles!client_id(full_name), matter:matters(matter_ref)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'client'),
      supabase.from('matters').select('id, matter_ref, title').eq('status', 'active'),
      supabase.from('expenses').select('id, category, description, amount_pkr, expense_date, billable, matter:matters(matter_ref, title), logger:profiles!logged_by(full_name)').order('expense_date', { ascending: false }).limit(50),
    ]);
    if (invRes.data) setInvoices(invRes.data as unknown as Invoice[]);
    if (expRes.data) setExpenses(expRes.data as unknown as Expense[]);
    if (clRes.data) setClients(clRes.data);
    if (matRes.data) setMatters(matRes.data);
    setLoading(false);
  }

  async function createInvoice() {
    if (!form.client_id || !form.due_date || !profile) return;
    setSaving(true);
    const totalPaisas = lineItems.reduce((s, li) => s + (parseFloat(li.unit_pkr || '0') * parseFloat(li.quantity || '1') * 100), 0);
    const count = invoices.length + 1;
    const ref = `INV-${new Date().getFullYear()}-${String(count).padStart(3, '0')}`;

    const { data: inv } = await supabase.from('invoices').insert({
      invoice_ref: ref, client_id: form.client_id,
      matter_id: form.matter_id || null, status: 'sent',
      amount_paisas: Math.round(totalPaisas), due_date: form.due_date,
      notes: form.notes || null, created_by: profile.id,
    }).select('id').single();

    if (inv) {
      await supabase.from('invoice_items').insert(
        lineItems.filter((li) => li.description && li.unit_pkr).map((li) => ({
          invoice_id: inv.id, description: li.description,
          quantity: parseFloat(li.quantity), unit_paisas: Math.round(parseFloat(li.unit_pkr) * 100),
        }))
      );

      // Push a payment action item to the client + notify them
      const amountPkr = (Math.round(totalPaisas) / 100).toLocaleString('en-PK');
      await supabase.from('tasks').insert({
        matter_id: form.matter_id || null, client_id: form.client_id, created_by: profile.id,
        assigned_to: 'client', type: 'payment', priority: 'high',
        title: `Pay invoice ${ref}`,
        description: `PKR ${amountPkr} due by ${form.due_date}.`,
        due_date: form.due_date, related_invoice_id: inv.id,
      });
      await supabase.from('notifications').insert({
        user_id: form.client_id, type: 'invoice_sent',
        title: `New invoice ${ref}`,
        body: `PKR ${amountPkr} is now due by ${form.due_date}.`,
        matter_id: form.matter_id || null,
      });
      // Best-effort push dispatch via Edge Function
      await supabase.functions.invoke('send-push', {
        body: { user_id: form.client_id, title: `New invoice ${ref}`, body: `PKR ${amountPkr} due by ${form.due_date}` },
      }).catch(() => {});
    }

    setSaving(false); setModal(false);
    setForm({ client_id: '', matter_id: '', due_date: '', notes: '' });
    setLineItems([{ description: '', quantity: '1', unit_pkr: '' }]);
    load();
  }

  async function markPaid(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    // Clear the client's matching payment action
    await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('related_invoice_id', id).eq('type', 'payment');
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
  }

  async function downloadPDF(inv: Invoice) {
    const { default: jsPDF } = await import('jspdf');
    const { data: items } = await supabase.from('invoice_items').select('description, quantity, unit_paisas').eq('invoice_id', inv.id);
    const doc = new jsPDF();
    const pkr = (p: number) => `PKR ${(p / 100).toLocaleString('en-PK')}`;
    const textColor = [36, 29, 28] as [number, number, number];
    const mutedColor = [138, 129, 123] as [number, number, number];

    doc.setFillColor(107, 30, 43);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(246, 241, 234);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('BASTION LAW', 20, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Karachi · Pakistan · www.bastionlaw.pk', 20, 27);
    doc.text(`INVOICE  ${inv.invoice_ref}`, 140, 18);
    doc.text(`Issued: ${new Date(inv.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, 26);
    doc.text(`Due: ${new Date(inv.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}`, 140, 34);

    doc.setTextColor(...textColor);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('BILLED TO', 20, 52);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text(inv.client.full_name, 20, 60);
    if (inv.matter?.matter_ref) doc.text(`Matter: ${inv.matter.matter_ref}`, 20, 68);

    const tableTop = 82;
    doc.setFillColor(246, 241, 234);
    doc.rect(15, tableTop - 6, 180, 10, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedColor);
    doc.text('DESCRIPTION', 20, tableTop); doc.text('QTY', 135, tableTop); doc.text('UNIT', 150, tableTop); doc.text('AMOUNT', 175, tableTop);

    let y = tableTop + 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...textColor);
    (items ?? []).forEach((item) => {
      const amount = item.quantity * item.unit_paisas;
      doc.text(item.description, 20, y, { maxWidth: 110 });
      doc.text(String(item.quantity), 135, y);
      doc.text(pkr(item.unit_paisas), 148, y);
      doc.text(pkr(amount), 172, y);
      y += 10;
    });

    doc.setDrawColor(236, 228, 217);
    doc.line(15, y + 2, 195, y + 2);
    y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('TOTAL DUE', 135, y);
    doc.setTextColor(107, 30, 43);
    doc.text(pkr(inv.amount_paisas), 172, y);

    if (inv.status === 'paid') {
      doc.setTextColor(63, 122, 91); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('PAID', 155, y + 20);
    }

    doc.setTextColor(...mutedColor); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Payment via bank transfer. This is a computer-generated invoice.', 20, 265);

    doc.save(`${inv.invoice_ref}.pdf`);
  }

  const totalOutstanding = invoices.filter((i) => i.status === 'outstanding' || i.status === 'sent').reduce((s, i) => s + i.amount_paisas, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_paisas, 0);

  return (
    <PageShell title="Billing & Invoices" action={
      <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
        <Plus size={16} /> New Invoice
      </button>
    }>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#6B1E2B] rounded-2xl p-5">
          <p className="text-[10px] font-medium text-[rgba(246,241,234,0.6)] tracking-widest mb-2">TOTAL OUTSTANDING</p>
          <p className="text-2xl font-bold text-[#F6F1EA]">{formatPKR(totalOutstanding)}</p>
        </div>
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <p className="text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">TOTAL PAID (ALL TIME)</p>
          <p className="text-2xl font-bold text-[#3F7A5B]">{formatPKR(totalPaid)}</p>
        </div>
        <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
          <p className="text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">TOTAL INVOICES</p>
          <p className="text-2xl font-bold text-[#241D1C]">{invoices.length}</p>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        {loading ? <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin mx-auto" /></div> : (
          <table className="w-full">
            <thead><tr className="border-b border-[#ECE4D9]">
              {['Invoice', 'Client', 'Matter', 'Amount', 'Due Date', 'Status', ''].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {invoices.map((inv) => {
                const { cls, icon: Icon } = STATUS_STYLE[inv.status] ?? { cls: 'bg-[#F3EDE3] text-[#8A817B]', icon: Clock };
                return (
                  <tr key={inv.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF1EE] transition-colors">
                    <td className="px-5 py-4 text-xs font-mono text-[#8A817B]">{inv.invoice_ref}</td>
                    <td className="px-5 py-4 text-sm font-medium text-[#241D1C]">{inv.client.full_name}</td>
                    <td className="px-5 py-4 text-xs text-[#A89F99]">{inv.matter?.matter_ref ?? '—'}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#241D1C]">{formatPKR(inv.amount_paisas)}</td>
                    <td className="px-5 py-4 text-sm text-[#6E635F]">{new Date(inv.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${cls}`}>
                        <Icon size={11} /> {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {(inv.status === 'outstanding' || inv.status === 'sent') && (
                          <button onClick={() => markPaid(inv.id)} className="text-xs font-semibold text-[#3F7A5B] hover:underline">Mark paid</button>
                        )}
                        <button onClick={() => downloadPDF(inv)} className="flex items-center gap-1 text-xs text-[#A89F99] hover:text-[#6B1E2B] transition-colors">
                          <Download size={12} /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[#A89F99]">No invoices yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Expenses table */}
      <div className="mt-6 bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#ECE4D9] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#241D1C]">Disbursements & Expenses</h2>
          <span className="text-xs text-[#8A817B]">
            Total billable: {formatPKR(expenses.filter((e) => e.billable).reduce((s, e) => s + e.amount_pkr, 0))}
          </span>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-[#ECE4D9]">
            {['Date', 'Matter', 'Category', 'Description', 'Amount', 'Billable'].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
            ))}
          </tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-[#F3EDE3] hover:bg-[#FBF8F5] transition-colors">
                <td className="px-5 py-3 text-xs text-[#6E635F]">{new Date(e.expense_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</td>
                <td className="px-5 py-3 text-xs text-[#A89F99]">{e.matter?.matter_ref ?? '—'}</td>
                <td className="px-5 py-3"><span className="text-[10px] bg-[#F0EBE3] text-[#6E635F] px-2 py-0.5 rounded-full capitalize">{e.category.replace(/_/g, ' ')}</span></td>
                <td className="px-5 py-3 text-sm text-[#241D1C]">{e.description}</td>
                <td className="px-5 py-3 text-sm font-semibold text-[#B68A4E]">{formatPKR(e.amount_pkr)}</td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.billable ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>
                    {e.billable ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[#A89F99]">No expenses logged yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      {modal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">New Invoice</h3>
            <div className="space-y-4 mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">CLIENT</label>
                  <select className="w-full h-11 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                    <option value="">Select client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">MATTER</label>
                  <select className="w-full h-11 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" value={form.matter_id} onChange={(e) => setForm({ ...form, matter_id: e.target.value })}>
                    <option value="">None</option>
                    {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_ref} — {m.title}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#8A817B] tracking-widest mb-2">DUE DATE</label>
                <input type="date" className="w-full h-11 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            {/* Line items */}
            <p className="text-[10px] font-semibold text-[#8A817B] tracking-widest mb-3">LINE ITEMS</p>
            {lineItems.map((li, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input className="col-span-6 h-10 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" placeholder="Description" value={li.description} onChange={(e) => setLineItems((prev) => prev.map((l, j) => j === i ? { ...l, description: e.target.value } : l))} />
                <input className="col-span-2 h-10 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" placeholder="Qty" type="number" value={li.quantity} onChange={(e) => setLineItems((prev) => prev.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))} />
                <input className="col-span-3 h-10 border border-[#ECE4D9] rounded-xl px-3 bg-[#F6F1EA] text-[#241D1C] text-sm outline-none focus:border-[#6B1E2B]" placeholder="PKR" type="number" value={li.unit_pkr} onChange={(e) => setLineItems((prev) => prev.map((l, j) => j === i ? { ...l, unit_pkr: e.target.value } : l))} />
                <button className="col-span-1 text-[#C0392B] text-lg font-bold" onClick={() => setLineItems((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button className="text-xs font-semibold text-[#6B1E2B] mb-4 hover:underline" onClick={() => setLineItems((prev) => [...prev, { description: '', quantity: '1', unit_pkr: '' }])}>+ Add line item</button>

            <div className="text-right text-sm font-semibold text-[#241D1C] mb-5">
              Total: {formatPKR(lineItems.reduce((s, li) => s + (parseFloat(li.unit_pkr || '0') * parseFloat(li.quantity || '1') * 100), 0))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createInvoice} disabled={saving || !form.client_id || !form.due_date}
                className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] transition-colors disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
