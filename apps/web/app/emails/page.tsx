'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { Mail, Send, Clock, LayoutTemplate, ChevronDown, X, Check, AlertCircle } from 'lucide-react';

interface Client {
  id: string;
  full_name: string;
  email: string;
  matters: { id: string; ref: string; title: string; stage: string }[];
  last_email: string | null;
}

interface Template {
  id: string;
  slug: string;
  name: string;
  is_auto: boolean;
  variables: string[];
}

interface EmailLog {
  id: string;
  to_name: string | null;
  to_email: string;
  subject: string;
  status: string;
  sent_at: string;
  template: { name: string } | null;
}

interface SendModal {
  client: Client;
  template: Template | null;
}

const MANUAL_VARS: Record<string, { label: string; placeholder: string; required: boolean }> = {
  custom_message:   { label: 'Message',          placeholder: 'Add a personal note (optional)', required: false },
  temp_password:    { label: 'Temporary Password', placeholder: 'e.g. TempP@ss123',             required: true  },
  new_stage:        { label: 'New Stage',         placeholder: 'e.g. Filing',                   required: true  },
  invoice_ref:      { label: 'Invoice Reference', placeholder: 'e.g. INV-2026-042',             required: true  },
  amount_pkr:       { label: 'Amount (PKR)',       placeholder: 'e.g. PKR 150,000',              required: true  },
  due_date:         { label: 'Due Date',           placeholder: 'e.g. 30 June 2026',            required: true  },
  appointment_date: { label: 'Appointment Date',  placeholder: 'e.g. 25 June 2026, 3:00 PM',   required: true  },
  meeting_type:     { label: 'Meeting Type',      placeholder: 'e.g. Video Call',               required: true  },
  lawyer_name:      { label: 'Lawyer Name',       placeholder: 'e.g. Zara Hussain',             required: false },
  task_title:       { label: 'Task Title',        placeholder: 'e.g. Submit signed affidavit',  required: true  },
  matter_ref:       { label: 'Matter Reference',  placeholder: 'Auto-filled from matter',       required: false },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EmailsPage() {
  const [clients, setClients]       = useState<Client[]>([]);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [logs, setLogs]             = useState<EmailLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<SendModal | null>(null);
  const [formVars, setFormVars]     = useState<Record<string, string>>({});
  const [sending, setSending]       = useState(false);
  const [toast, setToast]           = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [clientsRes, tplRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'client').order('full_name'),
      supabase.from('email_templates').select('id, slug, name, is_auto, variables').order('name'),
      supabase.from('email_logs').select('id, to_name, to_email, subject, status, sent_at, template:email_templates(name)').order('sent_at', { ascending: false }).limit(50),
    ]);

    const profileList = clientsRes.data ?? [];

    // Fetch matters per client
    const mattersRes = await supabase
      .from('matters')
      .select('id, ref, title, stage, client_id')
      .in('client_id', profileList.map(p => p.id));

    const mattersByClient: Record<string, Client['matters']> = {};
    for (const m of mattersRes.data ?? []) {
      if (!mattersByClient[m.client_id]) mattersByClient[m.client_id] = [];
      mattersByClient[m.client_id].push({ id: m.id, ref: m.ref, title: m.title, stage: m.stage });
    }

    // Last email per client
    const lastEmailRes = await supabase
      .from('email_logs')
      .select('client_id, sent_at')
      .order('sent_at', { ascending: false });

    const lastEmail: Record<string, string> = {};
    for (const l of lastEmailRes.data ?? []) {
      if (l.client_id && !lastEmail[l.client_id]) lastEmail[l.client_id] = l.sent_at;
    }

    setClients(profileList.map(p => ({
      ...p,
      matters:    mattersByClient[p.id] ?? [],
      last_email: lastEmail[p.id] ?? null,
    })));
    setTemplates(tplRes.data ?? []);
    setLogs((logsRes.data ?? []) as unknown as EmailLog[]);
    setLoading(false);
  }

  function openSend(client: Client, template: Template) {
    setModal({ client, template });
    setFormVars({});
    setOpenDropdown(null);
  }

  async function send() {
    if (!modal?.template || !modal?.client) return;
    setSending(true);
    const client = modal.client;
    const tpl    = modal.template;
    const matter = client.matters[0];

    const vars: Record<string, string> = {
      client_name: client.full_name,
      client_email: client.email,
      matter_ref:   matter?.ref ?? '',
      matter_type:  matter?.title ?? '',
      lawyer_name:  '',
      ...formVars,
    };

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_slug: tpl.slug,
        to_email:      client.email,
        to_name:       client.full_name,
        vars,
        client_id:     client.id,
        matter_id:     matter?.id,
      }),
    });

    setSending(false);
    if (res.ok) {
      setToast({ type: 'ok', msg: `Email sent to ${client.full_name}` });
      setModal(null);
      load();
    } else {
      const err = await res.json();
      setToast({ type: 'err', msg: err.error ?? 'Failed to send' });
    }
    setTimeout(() => setToast(null), 4000);
  }

  // Which vars the selected template needs that aren't auto-filled
  const manualVarsNeeded = modal?.template
    ? (modal.template.variables ?? []).filter(v =>
        !['firm_name', 'from_email', 'primary_color', 'accent_color', 'client_name', 'client_email', 'matter_ref', 'matter_type'].includes(v)
        && MANUAL_VARS[v]
      )
    : [];

  const filtered = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  const manualTemplates = templates.filter(t => !t.is_auto);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#241D1C]">Emails</h1>
          <p className="text-sm text-[#8A817B] mt-1">Send and manage client communications</p>
        </div>
        <Link href="/emails/templates"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#ECE4D9] text-sm font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
          <LayoutTemplate size={16} />
          Manage Templates
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Client list — 2/3 */}
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-[#ECE4D9] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#ECE4D9] flex items-center gap-3">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="flex-1 text-sm bg-[#F6F1EA] border border-[#ECE4D9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6B1E2B]"
              />
              <span className="text-xs text-[#8A817B]">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-[#8A817B] text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-[#8A817B] text-sm">No clients found</div>
            ) : (
              <div className="divide-y divide-[#F3EDE3]">
                {filtered.map(client => (
                  <div key={client.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-[#F0E3E1] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#6B1E2B] font-semibold text-sm">{client.full_name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#241D1C] truncate">{client.full_name}</p>
                      <p className="text-xs text-[#8A817B] truncate">{client.email}</p>
                      {client.matters.length > 0 && (
                        <p className="text-xs text-[#A89F99] mt-0.5">
                          {client.matters.length} matter{client.matters.length !== 1 ? 's' : ''} · {client.matters[0].ref}
                        </p>
                      )}
                    </div>
                    {client.last_email && (
                      <div className="flex items-center gap-1 text-xs text-[#A89F99] flex-shrink-0">
                        <Clock size={11} />
                        {fmtDate(client.last_email)}
                      </div>
                    )}
                    {/* Send dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6B1E2B] text-white text-xs font-medium hover:bg-[#4A141E] transition-colors">
                        <Send size={13} />
                        Send
                        <ChevronDown size={12} />
                      </button>
                      {openDropdown === client.id && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#ECE4D9] rounded-xl shadow-lg z-20 py-1">
                          {manualTemplates.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-[#8A817B]">No manual templates</p>
                          ) : manualTemplates.map(tpl => (
                            <button key={tpl.slug} onClick={() => openSend(client, tpl)}
                              className="w-full text-left px-4 py-2.5 text-sm text-[#241D1C] hover:bg-[#F6F1EA] transition-colors">
                              {tpl.name}
                            </button>
                          ))}
                          <div className="border-t border-[#F3EDE3] mt-1 pt-1">
                            {templates.filter(t => t.is_auto).map(tpl => (
                              <button key={tpl.slug} onClick={() => openSend(client, tpl)}
                                className="w-full text-left px-4 py-2.5 text-sm text-[#241D1C] hover:bg-[#F6F1EA] transition-colors flex items-center justify-between">
                                <span>{tpl.name}</span>
                                <span className="text-[10px] text-[#B68A4E] font-medium border border-[#B68A4E]/30 rounded px-1.5 py-0.5">AUTO</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent log — 1/3 */}
        <div>
          <h2 className="text-sm font-semibold text-[#241D1C] mb-3">Recent Sends</h2>
          <div className="bg-white rounded-2xl border border-[#ECE4D9] overflow-hidden">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#8A817B]">No emails sent yet</div>
            ) : (
              <div className="divide-y divide-[#F3EDE3]">
                {logs.slice(0, 20).map(log => (
                  <div key={log.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#241D1C] truncate">{log.to_name ?? log.to_email}</p>
                        <p className="text-xs text-[#8A817B] truncate mt-0.5">{log.subject}</p>
                        <p className="text-[11px] text-[#A89F99] mt-1">{fmtDate(log.sent_at)}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        log.status === 'sent' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#FDF0EE] text-[#C0392B]'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#ECE4D9]">
              <div>
                <h3 className="font-semibold text-[#241D1C]">Send Email</h3>
                <p className="text-xs text-[#8A817B] mt-0.5">{modal.template?.name} → {modal.client.full_name}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-[#8A817B] hover:text-[#241D1C]">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#F6F1EA] rounded-xl px-4 py-3 text-sm">
                <p className="text-xs text-[#8A817B] mb-1">Sending to</p>
                <p className="font-medium text-[#241D1C]">{modal.client.full_name}</p>
                <p className="text-[#6E635F]">{modal.client.email}</p>
              </div>

              {manualVarsNeeded.map(varKey => (
                <div key={varKey}>
                  <label className="block text-xs font-medium text-[#8A817B] uppercase tracking-wider mb-1.5">
                    {MANUAL_VARS[varKey]?.label ?? varKey}
                    {MANUAL_VARS[varKey]?.required && <span className="text-[#C0392B] ml-1">*</span>}
                  </label>
                  <input
                    value={formVars[varKey] ?? ''}
                    onChange={e => setFormVars(p => ({ ...p, [varKey]: e.target.value }))}
                    placeholder={MANUAL_VARS[varKey]?.placeholder ?? ''}
                    className="w-full border border-[#ECE4D9] rounded-xl px-3 py-2.5 text-sm bg-[#F6F1EA] focus:outline-none focus:border-[#6B1E2B]"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-[#ECE4D9] flex gap-3">
              <button onClick={() => setModal(null)}
                className="flex-1 h-10 rounded-xl border border-[#ECE4D9] text-sm font-medium text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">
                Cancel
              </button>
              <button onClick={send} disabled={sending}
                className="flex-1 h-10 rounded-xl bg-[#6B1E2B] text-white text-sm font-medium hover:bg-[#4A141E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {sending ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <><Mail size={14} /> Send Email</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {openDropdown && <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          toast.type === 'ok' ? 'bg-[#3F7A5B] text-white' : 'bg-[#C0392B] text-white'
        }`}>
          {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
