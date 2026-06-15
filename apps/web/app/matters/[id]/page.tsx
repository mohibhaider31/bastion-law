'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { PageShell } from '../../../components/PageShell';
import {
  ArrowLeft, Pencil, Check, X, Plus, UserPlus, ShieldAlert,
  FileText, Clock, DollarSign, Users, StickyNote, Activity, MessageSquare, CheckSquare,
} from 'lucide-react';

const STAGES = ['intake', 'documentation', 'filing', 'hearing', 'judgment', 'closed'] as const;
const STAGE_COLORS: Record<string, string> = {
  intake: 'bg-[#F3EDE3] text-[#8A817B]', documentation: 'bg-[#F6ECD8] text-[#9A6B1E]',
  filing: 'bg-[#F6ECD8] text-[#9A6B1E]', hearing: 'bg-[#FBF1EE] text-[#6B1E2B]',
  judgment: 'bg-[#EAF1EC] text-[#3F7A5B]', closed: 'bg-[#F3EDE3] text-[#A89F99]',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#EAF1EC] text-[#3F7A5B]', on_hold: 'bg-[#F6ECD8] text-[#9A6B1E]', closed: 'bg-[#F3EDE3] text-[#A89F99]',
};

type Tab = 'overview' | 'actions' | 'docs' | 'billing' | 'contacts' | 'notes' | 'audit' | 'chat';

function initials(name?: string) {
  return (name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPKR(paisas: number) {
  return `PKR ${(paisas / 100).toLocaleString('en-PK')}`;
}
function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

export default function MatterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [matter, setMatter] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [allLawyers, setAllLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  // Inline edit state
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', stage: '', status: '', court: '', cause_no: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Add lawyer to team
  const [teamModal, setTeamModal] = useState(false);
  const [addLawyerId, setAddLawyerId] = useState('');
  const [addLawyerRole, setAddLawyerRole] = useState<'lead' | 'associate' | 'paralegal'>('associate');
  const [addingLawyer, setAddingLawyer] = useState(false);

  // Task modal
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', type: 'document', priority: 'normal', due_date: '', assigned_to: 'client' });
  const [savingTask, setSavingTask] = useState(false);

  // Contact modal
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', role: 'opposing_counsel', firm: '', email: '', phone: '', notes: '' });
  const [savingContact, setSavingContact] = useState(false);

  // Event modal
  const [eventModal, setEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ type: 'hearing', title: '', event_date: '', event_time: '', location: '' });
  const [savingEvent, setSavingEvent] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState<{ id: string; field_name: string; field_value: string }[]>([]);
  const [fieldDefs, setFieldDefs] = useState<{ name: string; hint: string | null }[]>([]);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [savingField, setSavingField] = useState(false);

  // Note
  const [newNote, setNewNote] = useState('');
  const [postingNote, setPostingNote] = useState(false);

  // Chat
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setCurrentUser({ id: user.id }); });
  }, []);

  useEffect(() => { if (id) load(); }, [id]);

  // Realtime chat
  useEffect(() => {
    if (!id) return;
    const sub = supabase.channel(`owner-matter-chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `matter_id=eq.${id}` }, async () => {
        const { data } = await supabase.from('messages').select('*, sender:profiles!sender_id(full_name, role)').eq('matter_id', id).order('created_at').limit(100);
        if (data) { setMessages(data); setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [id]);

  useEffect(() => {
    if (tab === 'chat') setTimeout(() => msgEndRef.current?.scrollIntoView(), 100);
  }, [tab]);

  async function load() {
    const [mRes, teamRes, evRes, docsRes, timeRes, notesRes, auditRes, msgsRes, tasksRes, contactsRes, expRes, invRes, lawyersRes] = await Promise.all([
      supabase.from('matters').select('*, client:profiles!client_id(id, full_name, email, phone), lead_lawyer:profiles!lead_lawyer_id(id, full_name, email, hourly_rate_pkr)').eq('id', id).single(),
      supabase.from('matter_lawyers').select('role, lawyer:profiles!lawyer_id(id, full_name, hourly_rate_pkr)').eq('matter_id', id),
      supabase.from('events').select('*').eq('matter_id', id).order('event_date'),
      supabase.from('documents').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('time_entries').select('*, lawyer:profiles!lawyer_id(full_name)').eq('matter_id', id).order('entry_date', { ascending: false }),
      supabase.from('private_notes').select('*, author:profiles!author_id(full_name)').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*, actor:profiles!actor_id(full_name)').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('messages').select('*, sender:profiles!sender_id(full_name, role)').eq('matter_id', id).order('created_at').limit(100),
      supabase.from('tasks').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, logger:profiles!logged_by(full_name)').eq('matter_id', id).order('expense_date', { ascending: false }),
      supabase.from('invoices').select('id, invoice_ref, status, amount_paisas, due_date, paid_at').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name').eq('role', 'lawyer').order('full_name'),
    ]);

    if (mRes.data) { setMatter(mRes.data); setEditForm({ title: mRes.data.title, stage: mRes.data.stage, status: mRes.data.status, court: mRes.data.court ?? '', cause_no: mRes.data.cause_no ?? '', description: mRes.data.description ?? '' }); }
    if (teamRes.data) setTeam(teamRes.data);
    if (evRes.data) setEvents(evRes.data);
    if (docsRes.data) setDocs(docsRes.data);
    if (timeRes.data) setTimeEntries(timeRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (auditRes.data) setAuditLogs(auditRes.data);
    if (msgsRes.data) setMessages(msgsRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (expRes.data) setExpenses(expRes.data);
    if (invRes.data) setInvoices(invRes.data);
    if (lawyersRes.data) setAllLawyers(lawyersRes.data);

    const [cfRes, defsRes] = await Promise.all([
      supabase.from('matter_custom_fields').select('id, field_name, field_value').eq('matter_id', id).order('created_at'),
      supabase.from('custom_field_definitions').select('name, hint').order('name'),
    ]);
    if (cfRes.data) setCustomFields(cfRes.data);
    if (defsRes.data) setFieldDefs(defsRes.data);

    setLoading(false);
  }

  async function saveEdit() {
    setSaving(true);
    const update: Record<string, any> = {
      title: editForm.title, stage: editForm.stage, status: editForm.status,
      court: editForm.court || null, cause_no: editForm.cause_no || null,
      description: editForm.description || null,
      updated_at: new Date().toISOString(),
    };
    if (editForm.status === 'closed' && matter.status !== 'closed') update.closed_at = new Date().toISOString();
    if (editForm.status !== 'closed' && matter.status === 'closed') update.closed_at = null;
    await supabase.from('matters').update(update).eq('id', id);
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Matter updated: stage=${editForm.stage}, status=${editForm.status}` });

    // Notify client when stage or status changes
    const stageChanged = editForm.stage !== matter.stage;
    const statusChanged = editForm.status !== matter.status;
    if ((stageChanged || statusChanged) && matter.client_id) {
      const stageLabels: Record<string, string> = { intake: 'Intake', documentation: 'Documentation', filing: 'Filing', hearing: 'In Progress', judgment: 'Judgment', closed: 'Closed' };
      const notifBody = stageChanged
        ? `Your matter "${matter.title}" has progressed to the ${stageLabels[editForm.stage] ?? editForm.stage} stage.`
        : `Your matter "${matter.title}" status has been updated to ${editForm.status.replace('_', ' ')}.`;
      await supabase.from('notifications').insert({ user_id: matter.client_id, type: 'case_update', title: `Matter update: ${matter.matter_ref}`, body: notifBody, matter_id: id });
      const { data: clientP } = await supabase.from('profiles').select('email, full_name').eq('id', matter.client_id).single();
      if (clientP?.email) {
        await fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_slug: 'matter_update', to_email: clientP.email, to_name: clientP.full_name, client_id: matter.client_id, matter_id: id, vars: { client_name: clientP.full_name, matter_ref: matter.matter_ref, matter_title: matter.title, update_body: notifBody } }),
        }).catch(() => {});
      }
    }

    setSaving(false);
    setEditModal(false);
    load();
  }

  async function addToTeam() {
    if (!addLawyerId) return;
    setAddingLawyer(true);
    await supabase.from('matter_lawyers').upsert({ matter_id: id, lawyer_id: addLawyerId, role: addLawyerRole }, { onConflict: 'matter_id,lawyer_id' });
    if (currentUser) {
      const lawyer = allLawyers.find((l) => l.id === addLawyerId);
      await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Lawyer added to team: ${lawyer?.full_name} (${addLawyerRole})` });
    }
    setAddingLawyer(false);
    setTeamModal(false);
    setAddLawyerId('');
    load();
  }

  async function removeFromTeam(lawyerId: string, lawyerName: string) {
    await supabase.from('matter_lawyers').delete().eq('matter_id', id).eq('lawyer_id', lawyerId);
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Lawyer removed from team: ${lawyerName}` });
    load();
  }

  async function toggleTask(task: any) {
    const next = task.status === 'done' ? 'pending' : 'done';
    await supabase.from('tasks').update({ status: next, completed_at: next === 'done' ? new Date().toISOString() : null }).eq('id', task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  async function createTask() {
    if (!taskForm.title || !matter) return;
    setSavingTask(true);
    await supabase.from('tasks').insert({
      matter_id: id, client_id: matter.client_id, created_by: currentUser?.id,
      assigned_to: taskForm.assigned_to, type: taskForm.type,
      title: taskForm.title, description: taskForm.description || null,
      priority: taskForm.priority, due_date: taskForm.due_date || null,
    });
    if (taskForm.assigned_to === 'client') {
      await supabase.from('notifications').insert({ user_id: matter.client_id, type: 'case_update', title: `New action: ${taskForm.title}`, body: taskForm.description || 'Your lawyer has assigned you a new action.', matter_id: id });
    }
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Action assigned: ${taskForm.title} → ${taskForm.assigned_to}` });
    setSavingTask(false);
    setTaskModal(false);
    setTaskForm({ title: '', description: '', type: 'document', priority: 'normal', due_date: '', assigned_to: 'client' });
    load();
  }

  async function saveContact() {
    if (!contactForm.name) return;
    setSavingContact(true);
    await supabase.from('contacts').insert({ matter_id: id, name: contactForm.name, role: contactForm.role, firm: contactForm.firm || null, email: contactForm.email || null, phone: contactForm.phone || null, notes: contactForm.notes || null, added_by: currentUser?.id });
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Contact added: ${contactForm.name} (${contactForm.role.replace(/_/g, ' ')})` });
    setSavingContact(false);
    setContactModal(false);
    setContactForm({ name: '', role: 'opposing_counsel', firm: '', email: '', phone: '', notes: '' });
    load();
  }

  async function createEvent() {
    if (!eventForm.title || !eventForm.event_date) return;
    setSavingEvent(true);
    await supabase.from('events').insert({
      matter_id: id,
      type: eventForm.type,
      title: eventForm.title,
      event_date: eventForm.event_date,
      event_time: eventForm.event_time || null,
      location: eventForm.location || null,
    });
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: `Event scheduled: ${eventForm.title} (${eventForm.type}) on ${eventForm.event_date}` });
    setSavingEvent(false);
    setEventModal(false);
    setEventForm({ type: 'hearing', title: '', event_date: '', event_time: '', location: '' });
    load();
  }

  async function postNote() {
    if (!newNote.trim() || !currentUser) return;
    setPostingNote(true);
    await supabase.from('private_notes').insert({ matter_id: id, author_id: currentUser.id, body: newNote.trim() });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: 'Private note added' });
    setNewNote('');
    setPostingNote(false);
    load();
  }

  async function sendMsg() {
    if (!chatInput.trim() || !currentUser || !matter) return;
    setSendingMsg(true);
    const text = chatInput.trim();
    setChatInput('');
    await supabase.from('messages').insert({ matter_id: id, client_id: matter.client_id, sender_id: currentUser.id, body: text });
    setSendingMsg(false);
  }

  async function verifyDoc(docId: string) {
    await supabase.from('documents').update({ status: 'verified' }).eq('id', docId);
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: 'Document verified' });
    const doc = docs.find((d) => d.id === docId);
    if (matter?.client_id && doc) {
      await supabase.from('notifications').insert({ user_id: matter.client_id, type: 'document', title: 'Document verified', body: `"${doc.name}" has been reviewed and verified.`, matter_id: id });
    }
    load();
  }

  async function rejectDoc(docId: string) {
    await supabase.from('documents').update({ status: 'rejected' }).eq('id', docId);
    if (currentUser) await supabase.from('audit_logs').insert({ matter_id: id, actor_id: currentUser.id, actor_type: 'owner', action: 'Document rejected' });
    const doc = docs.find((d) => d.id === docId);
    if (matter?.client_id && doc) {
      await supabase.from('notifications').insert({ user_id: matter.client_id, type: 'document', title: 'Document needs resubmission', body: `"${doc.name}" requires correction. Please re-upload an updated version.`, matter_id: id });
    }
    load();
  }

  async function saveCustomField() {
    if (!newFieldName.trim() || !newFieldValue.trim() || !currentUser) return;
    setSavingField(true);
    await supabase.from('matter_custom_fields').upsert({
      matter_id: id, field_name: newFieldName.trim(), field_value: newFieldValue.trim(), created_by: currentUser.id,
    }, { onConflict: 'matter_id,field_name' });
    setSavingField(false);
    setAddingField(false);
    setNewFieldName(''); setNewFieldValue('');
    const { data } = await supabase.from('matter_custom_fields').select('id, field_name, field_value').eq('matter_id', id).order('created_at');
    if (data) setCustomFields(data);
  }

  async function deleteCustomField(cfId: string) {
    await supabase.from('matter_custom_fields').delete().eq('id', cfId);
    setCustomFields((prev) => prev.filter((f) => f.id !== cfId));
  }

  if (loading) return (
    <PageShell title="Matter">
      <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#6B1E2B]/30 border-t-[#6B1E2B] rounded-full animate-spin" /></div>
    </PageShell>
  );
  if (!matter) return <PageShell title="Not found"><p className="text-[#A89F99]">Matter not found.</p></PageShell>;

  const stageIdx = STAGES.indexOf(matter.stage);
  const totalHours = timeEntries.reduce((s, e) => s + e.hours, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount_pkr, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount_paisas, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_paisas, 0);
  const openTasks = tasks.filter((t) => t.status !== 'done').length;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'actions', label: openTasks > 0 ? `Actions (${openTasks})` : 'Actions', icon: CheckSquare },
    { key: 'docs', label: 'Documents', icon: FileText },
    { key: 'billing', label: 'Billing', icon: DollarSign },
    { key: 'contacts', label: contacts.length > 0 ? `Contacts (${contacts.length})` : 'Contacts', icon: Users },
    { key: 'notes', label: 'Notes', icon: StickyNote },
    { key: 'audit', label: 'Audit', icon: Clock },
    { key: 'chat', label: messages.length > 0 ? `Chat (${messages.length})` : 'Chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <div className="bg-white border-b border-[#ECE4D9] px-6 py-4">
        <button onClick={() => router.push('/matters')} className="flex items-center gap-1.5 text-sm text-[#8A817B] hover:text-[#241D1C] mb-4 transition-colors">
          <ArrowLeft size={15} /> Back to Matters
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-mono text-[#A89F99]">{matter.matter_ref}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#F3EDE3] text-[#8A817B] capitalize">{matter.type}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STAGE_COLORS[matter.stage]}`}>{matter.stage}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[matter.status]}`}>{matter.status.replace('_', ' ')}</span>
              {matter.confidentiality !== 'standard' && <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#FBF1EE] text-[#6B1E2B] capitalize"><ShieldAlert size={10} />{matter.confidentiality}</span>}
            </div>
            <h1 className="text-xl font-bold text-[#241D1C] leading-tight">{matter.title}</h1>
            {(matter.court || matter.cause_no) && (
              <p className="text-sm text-[#A89F99] mt-1">{[matter.court, matter.cause_no && `Cause No. ${matter.cause_no}`].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button onClick={() => setEditModal(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#ECE4D9] text-sm text-[#6E635F] hover:bg-[#F6F1EA] transition-colors flex-shrink-0">
            <Pencil size={14} /> Edit
          </button>
        </div>

        {/* Parties */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-2 bg-[#F6F1EA] rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-[#F6ECD8] flex items-center justify-center text-[9px] font-bold text-[#9A6B1E]">{initials(matter.client?.full_name)}</div>
            <span className="text-sm text-[#241D1C] font-medium">{matter.client?.full_name}</span>
            <span className="text-[10px] text-[#A89F99]">client</span>
          </div>
          {matter.lead_lawyer ? (
            <div className="flex items-center gap-2 bg-[#F6F1EA] rounded-full px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-[#FBF1EE] flex items-center justify-center text-[9px] font-bold text-[#6B1E2B]">{initials(matter.lead_lawyer?.full_name)}</div>
              <span className="text-sm text-[#241D1C] font-medium">{matter.lead_lawyer?.full_name}</span>
              <span className="text-[10px] text-[#A89F99]">lead</span>
            </div>
          ) : (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#F6ECD8] text-[#9A6B1E]">Lawyer TBA</span>
          )}
          {team.filter((t) => t.lawyer.id !== matter.lead_lawyer_id).map((t) => (
            <div key={t.lawyer.id} className="flex items-center gap-2 bg-[#F6F1EA] rounded-full px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-[#EAF1EC] flex items-center justify-center text-[9px] font-bold text-[#3F7A5B]">{initials(t.lawyer.full_name)}</div>
              <span className="text-sm text-[#241D1C] font-medium">{t.lawyer.full_name}</span>
              <span className="text-[10px] text-[#A89F99] capitalize">{t.role}</span>
              <button onClick={() => removeFromTeam(t.lawyer.id, t.lawyer.full_name)} className="text-[#A89F99] hover:text-[#C0392B] transition-colors"><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setTeamModal(true)} className="flex items-center gap-1.5 text-xs text-[#6B1E2B] font-medium hover:underline">
            <UserPlus size={13} /> Add to team
          </button>
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

      {/* Tab content */}
      <div className="p-6 max-w-6xl">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: stage + events */}
            <div className="col-span-2 space-y-6">
              {/* Stage stepper */}
              <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-4">PROGRESS</h3>
                <div className="flex items-center gap-0">
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx, active = i === stageIdx;
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${done ? 'bg-[#3F7A5B] border-[#3F7A5B] text-white' : active ? 'bg-[#6B1E2B] border-[#6B1E2B] text-white' : 'bg-white border-[#ECE4D9] text-[#A89F99]'}`}>
                            {done ? <Check size={14} /> : i + 1}
                          </div>
                          <span className={`text-[10px] mt-1.5 font-medium capitalize ${active ? 'text-[#6B1E2B]' : done ? 'text-[#3F7A5B]' : 'text-[#A89F99]'}`}>{s}</span>
                        </div>
                        {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < stageIdx ? 'bg-[#3F7A5B]' : 'bg-[#ECE4D9]'}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming events */}
              <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest">UPCOMING EVENTS</h3>
                  <button onClick={() => setEventModal(true)} className="flex items-center gap-1.5 text-xs text-[#6B1E2B] font-medium hover:underline">
                    <Plus size={13} /> Add Event
                  </button>
                </div>
                {events.filter((e) => e.event_date >= new Date().toISOString().split('T')[0]).length === 0 ? (
                  <p className="text-sm text-[#A89F99]">No upcoming events. <button onClick={() => setEventModal(true)} className="text-[#6B1E2B] underline">Schedule one</button></p>
                ) : (
                  <div className="space-y-3">
                    {events.filter((e) => e.event_date >= new Date().toISOString().split('T')[0]).slice(0, 5).map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3">
                        <div className={`w-1 self-stretch rounded-full ${ev.type === 'hearing' ? 'bg-[#9A6B1E]' : ev.type === 'deadline' ? 'bg-[#C0392B]' : 'bg-[#6B1E2B]'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#241D1C]">{ev.title}</p>
                          <p className="text-xs text-[#A89F99]">{fmtDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''}{ev.location ? ` · ${ev.location}` : ''}</p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F3EDE3] text-[#8A817B] capitalize">{ev.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              {matter.description && (
                <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-3">DESCRIPTION</h3>
                  <p className="text-sm text-[#6E635F] leading-relaxed">{matter.description}</p>
                </div>
              )}
            </div>

            {/* Right: key facts + financials */}
            <div className="space-y-4">
              <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest mb-1">KEY FACTS</h3>
                <Fact label="Client" value={matter.client?.full_name} />
                <Fact label="Lead Lawyer" value={matter.lead_lawyer?.full_name ?? 'TBA'} />
                {matter.court && <Fact label="Court" value={matter.court} />}
                {matter.cause_no && <Fact label="Cause No." value={matter.cause_no} />}
                <Fact label="Opened" value={fmtDate(matter.opened_at)} />
                {matter.closed_at && <Fact label="Closed" value={fmtDate(matter.closed_at)} />}
                <Fact label="Confidentiality" value={matter.confidentiality} />
              </div>

              {/* Custom fields */}
              <div className="bg-white border border-[#ECE4D9] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[#8A817B] tracking-widest">CUSTOM FIELDS</h3>
                  <button onClick={() => setAddingField(true)} className="text-xs text-[#6B1E2B] font-medium hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {customFields.map((cf) => (
                    <div key={cf.id} className="flex items-start gap-2 group">
                      <div className="flex-1">
                        <p className="text-[10px] font-medium text-[#A89F99] tracking-widest">{cf.field_name.toUpperCase()}</p>
                        <p className="text-sm text-[#241D1C]">{cf.field_value}</p>
                      </div>
                      <button onClick={() => deleteCustomField(cf.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#A89F99] hover:text-[#C0392B]">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {customFields.length === 0 && !addingField && (
                    <p className="text-xs text-[#A89F99]">No custom fields yet.</p>
                  )}
                  {addingField && (
                    <div className="pt-2 space-y-2">
                      <div>
                        <label className="field-label">FIELD NAME</label>
                        <input
                          list="field-defs"
                          className="field-input"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          placeholder="e.g. Filing Fee (PKR)"
                        />
                        <datalist id="field-defs">
                          {fieldDefs.map((d) => <option key={d.name} value={d.name} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="field-label">VALUE</label>
                        <input className="field-input" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} placeholder="Enter value" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setAddingField(false); setNewFieldName(''); setNewFieldValue(''); }} className="flex-1 h-9 rounded-xl border border-[#ECE4D9] text-xs text-[#6E635F] hover:bg-[#F6F1EA] transition-colors">Cancel</button>
                        <button onClick={saveCustomField} disabled={savingField || !newFieldName || !newFieldValue} className="flex-1 h-9 rounded-xl bg-[#6B1E2B] text-white text-xs font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                          {savingField ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#6B1E2B] rounded-2xl p-5 text-white">
                <h3 className="text-[10px] font-medium text-[rgba(246,241,234,0.6)] tracking-widest mb-4">FINANCIALS</h3>
                <div className="space-y-3">
                  <div><p className="text-[10px] text-[rgba(246,241,234,0.6)] tracking-widest">HOURS LOGGED</p><p className="text-xl font-bold text-[#F6F1EA]">{totalHours.toFixed(1)}h</p></div>
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-3"><p className="text-[10px] text-[rgba(246,241,234,0.6)] tracking-widest">TOTAL INVOICED</p><p className="text-xl font-bold text-[#F6F1EA]">{fmtPKR(totalInvoiced)}</p></div>
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-3"><p className="text-[10px] text-[rgba(246,241,234,0.6)] tracking-widest">COLLECTED</p><p className="text-xl font-bold text-[#EAF1EC]">{fmtPKR(totalPaid)}</p></div>
                  <div className="border-t border-[rgba(246,241,234,0.15)] pt-3"><p className="text-[10px] text-[rgba(246,241,234,0.6)] tracking-widest">DISBURSEMENTS</p><p className="text-xl font-bold text-[#F6F1EA]">{fmtPKR(totalExpenses)}</p></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIONS ── */}
        {tab === 'actions' && (
          <div className="max-w-2xl">
            <div className="flex justify-between items-center mb-5">
              <div />
              <button onClick={() => setTaskModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
                <Plus size={15} /> New Action
              </button>
            </div>
            {tasks.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No action items yet.</p>}
            <div className="space-y-2">
              {tasks.filter((t) => t.status !== 'done').map((t) => (
                <div key={t.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4 flex items-start gap-3">
                  <button onClick={() => toggleTask(t)} className="w-5 h-5 rounded-md border-2 border-[#ECE4D9] flex-shrink-0 mt-0.5 hover:border-[#6B1E2B] transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#241D1C]">{t.title}</p>
                    {t.description && <p className="text-xs text-[#8A817B] mt-0.5 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] bg-[#F3EDE3] text-[#8A817B] px-1.5 py-0.5 rounded capitalize">{t.type}</span>
                      <span className="text-[10px] bg-[#F3EDE3] text-[#8A817B] px-1.5 py-0.5 rounded capitalize">→ {t.assigned_to}</span>
                      {t.priority === 'high' && <span className="text-[10px] bg-[#FBF1EE] text-[#6B1E2B] px-1.5 py-0.5 rounded font-semibold">HIGH</span>}
                      {t.due_date && <span className="text-[10px] text-[#A89F99]">Due {fmtDate(t.due_date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {tasks.some((t) => t.status === 'done') && (
              <>
                <p className="text-xs font-semibold text-[#A89F99] tracking-widest mt-6 mb-3">COMPLETED</p>
                <div className="space-y-2">
                  {tasks.filter((t) => t.status === 'done').map((t) => (
                    <div key={t.id} className="bg-[#F6F1EA] border border-[#ECE4D9] rounded-xl p-4 flex items-center gap-3 opacity-60">
                      <div className="w-5 h-5 rounded-md bg-[#3F7A5B] border-2 border-[#3F7A5B] flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                      <p className="text-sm text-[#8A817B] line-through">{t.title}</p>
                      <button onClick={() => toggleTask(t)} className="ml-auto text-xs text-[#A89F99] hover:underline">Reopen</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === 'docs' && (
          <div className="max-w-2xl">
            {docs.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No documents yet.</p>}
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${doc.status === 'verified' ? 'bg-[#3F7A5B]' : doc.status === 'signed' ? 'bg-[#6B1E2B]' : doc.status === 'under_review' ? 'bg-[#9A6B1E]' : 'bg-[#C0392B]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#241D1C]">{doc.name}</p>
                    <p className="text-xs text-[#A89F99] capitalize mt-0.5">{doc.status.replace(/_/g, ' ')} · {doc.category}{doc.requires_esign ? ' · Requires signature' : ''}{doc.due_date ? ` · Due ${fmtDate(doc.due_date)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.file_url && <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#6B1E2B] hover:underline">View</a>}
                    {(doc.status === 'under_review' || doc.status === 'signed') && (
                      <>
                        <button onClick={() => verifyDoc(doc.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#EAF1EC] text-[#3F7A5B] hover:bg-[#D1E8D8] transition-colors">Verify</button>
                        <button onClick={() => rejectDoc(doc.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FDF0EE] text-[#C0392B] hover:bg-[#F5D8D5] transition-colors">Reject</button>
                      </>
                    )}
                    {doc.status === 'rejected' && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#FDF0EE] text-[#C0392B]">Rejected</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BILLING ── */}
        {tab === 'billing' && (
          <div className="space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Hours Logged', value: `${totalHours.toFixed(1)}h` },
                { label: 'Total Invoiced', value: fmtPKR(totalInvoiced) },
                { label: 'Collected', value: fmtPKR(totalPaid) },
                { label: 'Disbursements', value: fmtPKR(totalExpenses) },
              ].map((c) => (
                <div key={c.label} className="bg-white border border-[#ECE4D9] rounded-2xl p-4">
                  <p className="text-[10px] font-medium text-[#8A817B] tracking-widest mb-1">{c.label}</p>
                  <p className="text-xl font-bold text-[#241D1C]">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Time entries */}
            <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECE4D9]">
                <h3 className="text-sm font-semibold text-[#241D1C]">Time Entries</h3>
              </div>
              {timeEntries.length === 0 ? <p className="px-5 py-6 text-sm text-[#A89F99]">No time logged yet.</p> : (
                <table className="w-full">
                  <thead><tr className="border-b border-[#ECE4D9]">
                    {['Date', 'Lawyer', 'Description', 'Hours'].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {timeEntries.map((e) => (
                      <tr key={e.id} className="border-b border-[#F3EDE3]">
                        <td className="px-5 py-3 text-xs text-[#A89F99]">{fmtDate(e.entry_date)}</td>
                        <td className="px-5 py-3 text-sm text-[#6E635F]">{e.lawyer?.full_name}</td>
                        <td className="px-5 py-3 text-sm text-[#241D1C]">{e.description}</td>
                        <td className="px-5 py-3 text-sm font-bold text-[#6B1E2B]">{e.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Invoices */}
            <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECE4D9]">
                <h3 className="text-sm font-semibold text-[#241D1C]">Invoices</h3>
              </div>
              {invoices.length === 0 ? <p className="px-5 py-6 text-sm text-[#A89F99]">No invoices for this matter.</p> : (
                <table className="w-full">
                  <thead><tr className="border-b border-[#ECE4D9]">
                    {['Ref', 'Amount', 'Due', 'Status'].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-[#F3EDE3]">
                        <td className="px-5 py-3 text-xs font-mono text-[#A89F99]">{inv.invoice_ref}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-[#241D1C]">{fmtPKR(inv.amount_paisas)}</td>
                        <td className="px-5 py-3 text-sm text-[#6E635F]">{fmtDate(inv.due_date)}</td>
                        <td className="px-5 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${inv.status === 'paid' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#FBF1EE] text-[#C0392B]'}`}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Expenses */}
            <div className="bg-white border border-[#ECE4D9] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECE4D9]">
                <h3 className="text-sm font-semibold text-[#241D1C]">Disbursements & Expenses</h3>
              </div>
              {expenses.length === 0 ? <p className="px-5 py-6 text-sm text-[#A89F99]">No expenses logged.</p> : (
                <table className="w-full">
                  <thead><tr className="border-b border-[#ECE4D9]">
                    {['Date', 'Category', 'Description', 'Logged By', 'Amount', 'Billable'].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold text-[#8A817B] tracking-wider">{h.toUpperCase()}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-[#F3EDE3]">
                        <td className="px-5 py-3 text-xs text-[#A89F99]">{fmtDate(e.expense_date)}</td>
                        <td className="px-5 py-3"><span className="text-[10px] bg-[#F3EDE3] text-[#8A817B] px-2 py-0.5 rounded capitalize">{e.category.replace(/_/g, ' ')}</span></td>
                        <td className="px-5 py-3 text-sm text-[#241D1C]">{e.description}</td>
                        <td className="px-5 py-3 text-sm text-[#6E635F]">{e.logger?.full_name ?? '—'}</td>
                        <td className="px-5 py-3 text-sm font-bold text-[#9A6B1E]">{fmtPKR(e.amount_pkr)}</td>
                        <td className="px-5 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.billable ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#A89F99]'}`}>{e.billable ? 'Yes' : 'No'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── CONTACTS ── */}
        {tab === 'contacts' && (
          <div className="max-w-2xl">
            <div className="flex justify-end mb-5">
              <button onClick={() => setContactModal(true)} className="flex items-center gap-2 bg-[#6B1E2B] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#4A141E] transition-colors">
                <Plus size={15} /> Add Contact
              </button>
            </div>
            {contacts.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No external contacts yet. Add opposing counsel, witnesses, or experts.</p>}
            <div className="space-y-3">
              {contacts.map((c) => (
                <div key={c.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded text-white uppercase tracking-wider ${c.role === 'opposing_counsel' ? 'bg-[#C0392B]' : c.role === 'judge' ? 'bg-[#6B1E2B]' : c.role === 'witness' ? 'bg-[#9A6B1E]' : 'bg-[#6E635F]'}`}>{c.role.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#241D1C]">{c.name}</p>
                  {c.firm && <p className="text-xs text-[#8A817B] mt-0.5">{c.firm}</p>}
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    {c.email && <span className="text-xs text-[#6E635F]">{c.email}</span>}
                    {c.phone && <span className="text-xs text-[#6E635F]">{c.phone}</span>}
                  </div>
                  {c.notes && <p className="text-xs text-[#A89F99] italic mt-2">{c.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NOTES ── */}
        {tab === 'notes' && (
          <div className="max-w-2xl">
            <div className="bg-[#FBF1EE] border border-[#F0C9C0] rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2">
              <ShieldAlert size={14} className="text-[#6B1E2B]" />
              <span className="text-xs font-semibold text-[#6B1E2B] tracking-widest">NOT VISIBLE TO CLIENT</span>
            </div>
            <div className="bg-white border border-[#ECE4D9] rounded-2xl p-4 mb-4">
              <textarea
                className="w-full text-sm text-[#241D1C] placeholder-[#A89F99] resize-none outline-none min-h-[80px]"
                placeholder="Add a private internal note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <button onClick={postNote} disabled={postingNote || !newNote.trim()} className="px-4 py-2 text-sm font-semibold bg-[#6B1E2B] text-white rounded-lg hover:bg-[#4A141E] disabled:opacity-50 transition-colors">
                  {postingNote ? 'Posting…' : 'Post Note'}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {notes.length === 0 && <p className="text-sm text-[#A89F99] text-center py-6">No notes yet.</p>}
              {notes.map((note) => (
                <div key={note.id} className="bg-white border border-[#ECE4D9] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-[#FBF1EE] flex items-center justify-center text-[9px] font-bold text-[#6B1E2B]">{initials(note.author?.full_name)}</div>
                    <span className="text-sm font-semibold text-[#241D1C]">{note.author?.full_name}</span>
                    <span className="text-xs text-[#A89F99] ml-auto">{relTime(note.created_at)}</span>
                  </div>
                  <p className="text-sm text-[#6E635F] leading-relaxed">{note.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AUDIT ── */}
        {tab === 'audit' && (
          <div className="max-w-2xl">
            {auditLogs.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No audit entries yet.</p>}
            <div className="space-y-0">
              {auditLogs.map((log, i) => (
                <div key={log.id} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${log.actor_type === 'lawyer' ? 'bg-[#6B1E2B]' : log.actor_type === 'client' ? 'bg-[#9A6B1E]' : log.actor_type === 'owner' ? 'bg-[#3F7A5B]' : 'bg-[#A89F99]'}`} />
                    {i < auditLogs.length - 1 && <div className="w-0.5 flex-1 bg-[#ECE4D9] mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm text-[#241D1C]">{log.action}</p>
                    <p className="text-xs text-[#A89F99] mt-0.5">
                      {log.actor?.full_name ?? log.actor_type}
                      <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${log.actor_type === 'lawyer' ? 'bg-[#FBF1EE] text-[#6B1E2B]' : log.actor_type === 'client' ? 'bg-[#F6ECD8] text-[#9A6B1E]' : log.actor_type === 'owner' ? 'bg-[#EAF1EC] text-[#3F7A5B]' : 'bg-[#F3EDE3] text-[#8A817B]'}`}>{log.actor_type}</span>
                      <span className="ml-2">{relTime(log.created_at)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {tab === 'chat' && (
          <div className="max-w-2xl flex flex-col h-[calc(100vh-280px)]">
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {messages.length === 0 && <p className="text-sm text-[#A89F99] text-center py-10">No messages yet.</p>}
              {messages.map((msg) => {
                const mine = msg.sender_id === currentUser?.id;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && <div className="w-7 h-7 rounded-full bg-[#F3EDE3] flex items-center justify-center text-[9px] font-bold text-[#8A817B] flex-shrink-0">{initials(msg.sender?.full_name)}</div>}
                    <div className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-[#6B1E2B] text-white rounded-br-sm' : 'bg-white border border-[#ECE4D9] text-[#241D1C] rounded-bl-sm'}`}>
                      {!mine && <p className="text-[10px] font-semibold text-[#6B1E2B] mb-1 capitalize">{msg.sender?.full_name} · {msg.sender?.role}</p>}
                      <p className="text-sm leading-relaxed">{msg.body}</p>
                      <p className={`text-[10px] mt-1 text-right ${mine ? 'text-[rgba(255,255,255,0.5)]' : 'text-[#A89F99]'}`}>{relTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
            <div className="bg-white border border-[#ECE4D9] rounded-2xl p-3 flex items-end gap-3 mt-auto">
              <textarea
                className="flex-1 text-sm text-[#241D1C] placeholder-[#A89F99] resize-none outline-none min-h-[40px] max-h-[120px]"
                placeholder={`Message ${matter.client?.full_name}…`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              />
              <button onClick={sendMsg} disabled={sendingMsg || !chatInput.trim()} className="w-9 h-9 rounded-xl bg-[#6B1E2B] flex items-center justify-center hover:bg-[#4A141E] disabled:opacity-40 transition-colors flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EDIT MATTER MODAL ── */}
      {editModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Edit Matter</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">TITLE</label>
                <input className="field-input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">STAGE</label>
                  <select className="field-input" value={editForm.stage} onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}>
                    {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">STATUS</label>
                  <select className="field-input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">COURT</label>
                  <input className="field-input" value={editForm.court} onChange={(e) => setEditForm({ ...editForm, court: e.target.value })} placeholder="Karachi High Court" />
                </div>
                <div>
                  <label className="field-label">CAUSE NO.</label>
                  <input className="field-input" value={editForm.cause_no} onChange={(e) => setEditForm({ ...editForm, cause_no: e.target.value })} placeholder="1247/2026" />
                </div>
              </div>
              <div>
                <label className="field-label">DESCRIPTION</label>
                <textarea className="field-input h-24 resize-none pt-3" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Brief description of the matter…" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={saving || !editForm.title} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TO TEAM MODAL ── */}
      {teamModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Add Lawyer to Team</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">LAWYER</label>
                <select className="field-input" value={addLawyerId} onChange={(e) => setAddLawyerId(e.target.value)}>
                  <option value="">Select lawyer…</option>
                  {allLawyers.filter((l) => !team.some((t) => t.lawyer.id === l.id)).map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">ROLE</label>
                <select className="field-input" value={addLawyerRole} onChange={(e) => setAddLawyerRole(e.target.value as any)}>
                  <option value="associate">Associate</option>
                  <option value="paralegal">Paralegal</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setTeamModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={addToTeam} disabled={addingLawyer || !addLawyerId} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {addingLawyer ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW ACTION MODAL ── */}
      {taskModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">New Action Item</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">ASSIGN TO</label>
                <div className="flex gap-2">
                  {['client', 'lawyer'].map((a) => (
                    <button key={a} onClick={() => setTaskForm({ ...taskForm, assigned_to: a })}
                      className={`flex-1 h-10 rounded-xl border text-sm font-medium capitalize transition-colors ${taskForm.assigned_to === a ? 'bg-[#6B1E2B] border-[#6B1E2B] text-white' : 'border-[#ECE4D9] text-[#6E635F] hover:bg-[#F6F1EA]'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">TYPE</label>
                <select className="field-input" value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}>
                  {['document', 'payment', 'signature', 'review', 'meeting', 'general'].map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">TITLE</label>
                <input className="field-input" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Sign the Vakalatnama" />
              </div>
              <div>
                <label className="field-label">DESCRIPTION (OPTIONAL)</label>
                <textarea className="field-input h-20 resize-none pt-3" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="What needs to be done?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">DUE DATE</label>
                  <input type="date" className="field-input" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">PRIORITY</label>
                  <select className="field-input" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setTaskModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createTask} disabled={savingTask || !taskForm.title} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {savingTask ? 'Creating…' : 'Create Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CONTACT MODAL ── */}
      {contactModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Add External Contact</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">NAME</label>
                <input className="field-input" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <label className="field-label">ROLE</label>
                <select className="field-input" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}>
                  {['opposing_counsel', 'judge', 'witness', 'expert', 'other'].map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">FIRM / ORGANISATION</label>
                <input className="field-input" value={contactForm.firm} onChange={(e) => setContactForm({ ...contactForm, firm: e.target.value })} placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">EMAIL</label>
                  <input type="email" className="field-input" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <label className="field-label">PHONE</label>
                  <input className="field-input" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="field-label">NOTES</label>
                <textarea className="field-input h-20 resize-none pt-3" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Any additional notes" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setContactModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={saveContact} disabled={savingContact || !contactForm.name} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {savingContact ? 'Saving…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventModal && (
        <div className="fixed inset-0 bg-[rgba(28,21,18,0.5)] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-[#241D1C] mb-5">Schedule Event</h3>
            <div className="space-y-4">
              <div>
                <label className="field-label">EVENT TYPE</label>
                <select className="field-input" value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}>
                  {['hearing', 'deadline', 'filing', 'meeting', 'other'].map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">TITLE</label>
                <input className="field-input" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="e.g. Hearing before Justice Ahmed" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">DATE</label>
                  <input type="date" className="field-input" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">TIME (OPTIONAL)</label>
                  <input type="time" className="field-input" value={eventForm.event_time} onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label">LOCATION (OPTIONAL)</label>
                <input className="field-input" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Court room, office, etc." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEventModal(false)} className="flex-1 h-11 rounded-xl border border-[#ECE4D9] text-[#6E635F] text-sm font-medium hover:bg-[#F6F1EA] transition-colors">Cancel</button>
              <button onClick={createEvent} disabled={savingEvent || !eventForm.title || !eventForm.event_date} className="flex-1 h-11 rounded-xl bg-[#6B1E2B] text-white text-sm font-semibold hover:bg-[#4A141E] disabled:opacity-60 transition-colors">
                {savingEvent ? 'Saving…' : 'Schedule Event'}
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
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-[10px] font-medium text-[#A89F99] tracking-widest flex-shrink-0">{label.toUpperCase()}</span>
      <span className="text-sm text-[#241D1C] text-right capitalize">{value}</span>
    </div>
  );
}
