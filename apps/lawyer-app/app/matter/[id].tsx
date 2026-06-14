import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors, STAGE_ORDER } from '../../lib/colors';
import { dispatchPush } from '../../lib/push';
import Svg, { Path, Rect, Line } from 'react-native-svg';

type Tab = 'overview' | 'actions' | 'docs' | 'billing' | 'expenses' | 'contacts' | 'notes' | 'audit' | 'chat';

const TASK_TYPES = ['document', 'payment', 'signature', 'review', 'meeting', 'general'] as const;
type TaskType = typeof TASK_TYPES[number];

export default function MatterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>('overview');
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
  const [expenseModal, setExpenseModal] = useState(false);
  const [expAmt, setExpAmt] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState<'filing_fee' | 'courier' | 'travel' | 'printing' | 'expert_fee' | 'court_fee' | 'miscellaneous'>('filing_fee');
  const [expDate, setExpDate] = useState('');
  const [expBillable, setExpBillable] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactModal, setContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState<'opposing_counsel' | 'judge' | 'witness' | 'expert' | 'other'>('opposing_counsel');
  const [contactFirm, setContactFirm] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNotes, setContactNotes] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStage, setEditStage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const msgScrollRef = useRef<ScrollView>(null);

  // New-action modal state
  const [actionModal, setActionModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('document');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [savingTask, setSavingTask] = useState(false);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerModal, setTimerModal] = useState(false);
  const [timerDesc, setTimerDesc] = useState('');
  const [savingTimer, setSavingTimer] = useState(false);
  const timerStartRef = useRef<Date | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    timerStartRef.current = new Date();
    setTimerSecs(0);
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSecs(Math.floor((Date.now() - timerStartRef.current!.getTime()) / 1000));
    }, 1000);
  }

  function stopTimer() {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerRunning(false);
    setTimerModal(true);
  }

  async function saveTimerEntry() {
    if (!profile || !timerStartRef.current) return;
    setSavingTimer(true);
    const hours = Math.max(0.1, Math.round((timerSecs / 3600) * 10) / 10);
    await supabase.from('time_entries').insert({
      matter_id: id, lawyer_id: profile.id, hours,
      description: timerDesc.trim() || 'Billable time',
      entry_date: timerStartRef.current.toISOString().split('T')[0],
      billable: true,
    });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile.id, actor_type: 'lawyer', action: `Time logged: ${hours}h — ${timerDesc.trim() || 'Billable time'}` });
    setSavingTimer(false);
    setTimerModal(false);
    setTimerDesc('');
    timerStartRef.current = null;
    setTimerSecs(0);
    load();
  }

  // Clean up interval on unmount
  useEffect(() => () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }, []);

  useEffect(() => { if (id && profile) load(); }, [id, profile]);

  // Realtime chat subscription — refetch with joins on INSERT
  useFocusEffect(useCallback(() => {
    if (!id) return;
    const sub = supabase.channel(`matter-chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `matter_id=eq.${id}` }, async () => {
        const { data } = await supabase.from('messages').select('*, sender:profiles!sender_id(full_name)').eq('matter_id', id).order('created_at').limit(50);
        if (data) {
          setMessages(data);
          countUnread(data);
          setTimeout(() => msgScrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [id]));

  function countUnread(msgs: any[]) {
    if (!profile) return;
    const n = msgs.filter((m) => m.sender_id !== profile.id && !m.read_at).length;
    setUnreadCount(n);
  }

  async function markChatRead() {
    if (!profile || !id) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('matter_id', id)
      .neq('sender_id', profile.id)
      .is('read_at', null);
    setUnreadCount(0);
  }

  async function sendMsg() {
    if (!chatInput.trim() || !profile || !id || !matter) return;
    setSendingMsg(true);
    const text = chatInput.trim();
    setChatInput('');
    await supabase.from('messages').insert({ matter_id: id, sender_id: profile.id, body: text });
    dispatchPush(matter.client_id, `${profile.full_name}`, text, { matter_id: id, screen: 'chat' });
    setSendingMsg(false);
  }

  async function load() {
    const [matterRes, teamRes, eventsRes, docsRes, timeRes, notesRes, auditRes, msgsRes, tasksRes, contactsRes, expensesRes] = await Promise.all([
      supabase.from('matters').select('*, client:profiles!client_id(*), lead_lawyer:profiles!lead_lawyer_id(*)').eq('id', id).single(),
      supabase.from('matter_lawyers').select('role, lawyer:profiles!lawyer_id(id, full_name)').eq('matter_id', id),
      supabase.from('events').select('*').eq('matter_id', id).order('event_date'),
      supabase.from('documents').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('time_entries').select('*, lawyer:profiles!lawyer_id(full_name)').eq('matter_id', id).order('entry_date', { ascending: false }),
      supabase.from('private_notes').select('*, author:profiles!author_id(full_name)').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*, actor:profiles!actor_id(full_name)').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('messages').select('*, sender:profiles!sender_id(full_name)').eq('matter_id', id).order('created_at').limit(50),
      supabase.from('tasks').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('*, logger:profiles!logged_by(full_name)').eq('matter_id', id).order('expense_date', { ascending: false }),
    ]);

    if (matterRes.data) { setMatter(matterRes.data); setEditTitle(matterRes.data.title); setEditStage(matterRes.data.stage); }
    if (teamRes.data) setTeam(teamRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (docsRes.data) setDocs(docsRes.data);
    if (timeRes.data) setTimeEntries(timeRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (auditRes.data) setAuditLogs(auditRes.data);
    if (msgsRes.data) { setMessages(msgsRes.data); countUnread(msgsRes.data); }
    if (tasksRes.data) setTasks(tasksRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    setLoading(false);
  }

  async function saveExpense() {
    const amt = Math.round(parseFloat(expAmt) * 100);
    if (!amt || amt <= 0 || !expDesc.trim() || !profile) return;
    setSavingExpense(true);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(expDate) ? expDate : new Date().toISOString().split('T')[0];
    await supabase.from('expenses').insert({
      matter_id: id, logged_by: profile.id, category: expCat,
      description: expDesc.trim(), amount_pkr: amt,
      expense_date: date, billable: expBillable,
    });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile.id, actor_type: 'lawyer', action: `Expense logged: ${expDesc.trim()} — PKR ${(amt / 100).toFixed(2)}` });
    setSavingExpense(false);
    setExpenseModal(false);
    setExpAmt(''); setExpDesc(''); setExpCat('filing_fee'); setExpDate(''); setExpBillable(true);
    load();
  }

  async function saveContact() {
    if (!contactName.trim() || !profile) return;
    setSavingContact(true);
    await supabase.from('contacts').insert({
      matter_id: id, name: contactName.trim(), role: contactRole,
      firm: contactFirm.trim() || null, email: contactEmail.trim() || null,
      phone: contactPhone.trim() || null, notes: contactNotes.trim() || null,
      added_by: profile.id,
    });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile.id, actor_type: 'lawyer', action: `Contact added: ${contactName.trim()} (${contactRole.replace('_', ' ')})` });
    setSavingContact(false);
    setContactModal(false);
    setContactName(''); setContactRole('opposing_counsel'); setContactFirm('');
    setContactEmail(''); setContactPhone(''); setContactNotes('');
    load();
  }

  async function createTask() {
    if (!taskTitle.trim() || !profile || !matter) return;
    setSavingTask(true);
    await supabase.from('tasks').insert({
      matter_id: id, client_id: matter.client_id, created_by: profile.id,
      assigned_to: 'client', type: taskType, title: taskTitle.trim(),
      description: taskDesc.trim() || null, priority: taskPriority,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(taskDue) ? taskDue : null,
    });
    // Notify the client + log it
    const notifBody = taskDesc.trim() || 'Your lawyer has assigned you a new action item.';
    await supabase.from('notifications').insert({
      user_id: matter.client_id, type: 'case_update',
      title: `New action: ${taskTitle.trim()}`,
      body: notifBody,
      matter_id: id,
    });
    dispatchPush(matter.client_id, `New action: ${taskTitle.trim()}`, notifBody, { matter_id: id, screen: 'actions' });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile.id, actor_type: 'lawyer', action: `Action assigned: ${taskTitle.trim()}` });
    setSavingTask(false);
    setActionModal(false);
    setTaskTitle(''); setTaskDesc(''); setTaskDue(''); setTaskType('document'); setTaskPriority('normal');
    load();
  }

  async function toggleTask(task: any) {
    const next = task.status === 'done' ? 'pending' : 'done';
    await supabase.from('tasks').update({ status: next, completed_at: next === 'done' ? new Date().toISOString() : null }).eq('id', task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  async function postNote() {
    if (!newNote.trim() || !profile) return;
    setPostingNote(true);
    await supabase.from('private_notes').insert({ matter_id: id, author_id: profile.id, body: newNote.trim() });
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile.id, actor_type: 'lawyer', action: 'Private note added' });
    setNewNote('');
    setPostingNote(false);
    load();
  }

  async function saveEdit() {
    await supabase.from('matters').update({ title: editTitle, stage: editStage }).eq('id', id);
    setEditModal(false);
    load();
  }

  async function verifyDoc(docId: string) {
    await supabase.from('documents').update({ status: 'verified' }).eq('id', docId);
    await supabase.from('audit_logs').insert({ matter_id: id, actor_id: profile?.id, actor_type: 'lawyer', action: 'Document verified', metadata: { document_id: docId } });
    load();
  }

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  if (!matter) return null;

  const stageIdx = STAGE_ORDER.indexOf(matter.stage);
  const totalHours = timeEntries.reduce((s, e) => s + e.hours, 0);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </TouchableOpacity>
          <View style={styles.headerBadges}>
            <View style={styles.badge}><Text style={styles.badgeText}>{matter.matter_ref}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{matter.type}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{matter.stage}</Text></View>
            <View style={[styles.badge, styles.badgeConf]}><Text style={styles.badgeText}>{matter.confidentiality}</Text></View>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditModal(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </Svg>
          </TouchableOpacity>
        </View>

        <Text style={styles.matterTitle}>{matter.title}</Text>
        {matter.cause_no && <Text style={styles.causeNo}>{matter.court} · Cause No. {matter.cause_no}</Text>}

        {/* Parties */}
        <View style={styles.partiesRow}>
          <View style={styles.partyChip}>
            <View style={styles.partyAvatar}><Text style={styles.partyAvatarText}>{matter.client.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text></View>
            <Text style={styles.partyName} numberOfLines={1}>{matter.client.full_name}</Text>
          </View>
          {team.map((tm: any) => (
            <View key={tm.lawyer.id} style={styles.partyChip}>
              <View style={[styles.partyAvatar, { backgroundColor: colors.greenBg }]}><Text style={[styles.partyAvatarText, { color: colors.green }]}>{tm.lawyer.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text></View>
              <Text style={styles.partyName} numberOfLines={1}>{tm.lawyer.full_name}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {(['overview', 'actions', 'docs', 'billing', 'expenses', 'contacts', 'notes', 'audit', 'chat'] as Tab[]).map((t) => {
            const openCount = tasks.filter((x) => x.status === 'pending' || x.status === 'in_progress').length;
            let label = t === 'overview' ? 'Overview' : t === 'actions' ? (openCount > 0 ? `Actions (${openCount})` : 'Actions') : t === 'docs' ? 'Documents' : t === 'billing' ? 'Time & Billing' : t === 'expenses' ? 'Expenses' : t === 'contacts' ? `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ''}` : t === 'notes' ? 'Notes' : t === 'audit' ? 'Audit Trail' : (unreadCount > 0 ? `Chat (${unreadCount})` : 'Chat');
            return (
              <TouchableOpacity key={t} style={styles.tabItem} onPress={() => { setTab(t); if (t === 'chat') { markChatRead(); setTimeout(() => msgScrollRef.current?.scrollToEnd({ animated: false }), 150); } }}>
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{label}</Text>
                {tab === t && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TAB: Overview */}
        {tab === 'overview' && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Progress</Text>
            {STAGE_ORDER.map((stage, i) => (
              <View key={stage} style={styles.stepRow}>
                <View style={[styles.stepDot, i < stageIdx && styles.stepDotDone, i === stageIdx && styles.stepDotActive]} />
                <Text style={[styles.stepLabel, i === stageIdx && styles.stepLabelActive, i < stageIdx && styles.stepLabelDone]}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                </Text>
              </View>
            ))}
            {events.slice(0, 3).map((ev: any) => (
              <View key={ev.id} style={styles.eventCard}>
                <View style={[styles.evBar, { backgroundColor: evColor(ev.type) }]} />
                <View>
                  <Text style={styles.evTitle}>{ev.title}</Text>
                  <Text style={styles.evDate}>{fmtDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time.slice(0, 5)}` : ''}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* TAB: Actions */}
        {tab === 'actions' && (
          <View style={{ flex: 1 }}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {tasks.length === 0 && <Text style={styles.emptyActions}>No action items yet. Push the first one to your client below.</Text>}
              {tasks.filter((t) => t.status !== 'done').map((t) => (
                <View key={t.id} style={styles.taskRow}>
                  <TouchableOpacity style={styles.taskCheck} onPress={() => toggleTask(t)} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{t.title}</Text>
                    {t.description ? <Text style={styles.taskDesc} numberOfLines={2}>{t.description}</Text> : null}
                    <Text style={styles.taskMeta}>{t.type}{t.due_date ? ` · due ${fmtDate(t.due_date)}` : ''}{t.priority === 'high' ? ' · HIGH' : ''}</Text>
                  </View>
                </View>
              ))}
              {tasks.some((t) => t.status === 'done') && <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Completed</Text>}
              {tasks.filter((t) => t.status === 'done').map((t) => (
                <View key={t.id} style={[styles.taskRow, styles.taskRowDone]}>
                  <TouchableOpacity style={[styles.taskCheck, styles.taskCheckDone]} onPress={() => toggleTask(t)}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5" /></Svg>
                  </TouchableOpacity>
                  <Text style={[styles.taskTitle, styles.taskTitleDone]}>{t.title}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.actionFooter}>
              <TouchableOpacity style={styles.newActionBtn} onPress={() => setActionModal(true)}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 5v14M5 12h14" /></Svg>
                <Text style={styles.newActionText}>Push new action to client</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB: Documents */}
        {tab === 'docs' && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {docs.map((doc: any) => (
              <View key={doc.id} style={styles.docRow}>
                <View style={[styles.docStatusDot, { backgroundColor: docColor(doc.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docStatus}>{doc.status.replace('_', ' ')} {doc.due_date ? `· Due ${fmtDate(doc.due_date)}` : ''}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {doc.file_url && (
                    <TouchableOpacity style={styles.viewDocBtn} onPress={() => WebBrowser.openBrowserAsync(doc.file_url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN })}>
                      <Text style={styles.viewDocBtnText}>View</Text>
                    </TouchableOpacity>
                  )}
                  {(doc.status === 'under_review' || doc.status === 'signed') && (
                    <TouchableOpacity style={[styles.verifyBtn, doc.status === 'signed' && { backgroundColor: colors.roseTint, borderColor: colors.burgundy }]} onPress={() => verifyDoc(doc.id)}>
                      <Text style={[styles.verifyBtnText, doc.status === 'signed' && { color: colors.burgundy }]}>{doc.status === 'signed' ? 'Accept sign' : 'Verify'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* TAB: Time & Billing */}
        {tab === 'billing' && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.billingSummary}>
                <Text style={styles.billingSummaryLabel}>TOTAL HOURS</Text>
                <Text style={styles.billingSummaryValue}>{totalHours.toFixed(1)}h</Text>
              </View>
              {/* Timer widget */}
              <View style={styles.timerCard}>
                <View style={styles.timerLeft}>
                  <Text style={styles.timerLabel}>TIMER</Text>
                  <Text style={styles.timerDisplay}>
                    {String(Math.floor(timerSecs / 3600)).padStart(2, '0')}:{String(Math.floor((timerSecs % 3600) / 60)).padStart(2, '0')}:{String(timerSecs % 60).padStart(2, '0')}
                  </Text>
                </View>
                {timerRunning ? (
                  <TouchableOpacity style={styles.timerStopBtn} onPress={stopTimer}>
                    <Text style={styles.timerBtnText}>Stop & Log</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.timerStartBtn} onPress={startTimer}>
                    <Text style={styles.timerBtnText}>Start Timer</Text>
                  </TouchableOpacity>
                )}
              </View>
              {timeEntries.map((entry: any) => (
                <View key={entry.id} style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeDesc}>{entry.description}</Text>
                    <Text style={styles.timeMeta}>{entry.lawyer.full_name} · {fmtDate(entry.entry_date)}</Text>
                  </View>
                  <Text style={styles.timeHours}>{entry.hours}h</Text>
                </View>
              ))}
            </ScrollView>
            {/* Timer description modal */}
            <Modal visible={timerModal} transparent animationType="fade">
              <View style={styles.overlay}>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>Log Time Entry</Text>
                  <Text style={styles.modalSub}>Duration: {(timerSecs / 3600).toFixed(2)}h</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 12 }]}
                    value={timerDesc}
                    onChangeText={setTimerDesc}
                    placeholder="Description (e.g. Client call, drafting)"
                    placeholderTextColor="rgba(30,20,10,0.4)"
                    maxLength={200}
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => { setTimerModal(false); setTimerDesc(''); }}>
                      <Text style={styles.modalCancelText}>Discard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirm} onPress={saveTimerEntry} disabled={savingTimer}>
                      {savingTimer ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmText}>Save Entry</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}

        {/* TAB: Expenses */}
        {tab === 'expenses' && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Summary bar */}
              <View style={styles.expSummary}>
                <View>
                  <Text style={styles.expSummaryLabel}>TOTAL DISBURSEMENTS</Text>
                  <Text style={styles.expSummaryValue}>PKR {(expenses.reduce((s: number, e: any) => s + e.amount_pkr, 0) / 100).toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expSummaryLabel}>BILLABLE</Text>
                  <Text style={styles.expSummaryValue}>PKR {(expenses.filter((e: any) => e.billable).reduce((s: number, e: any) => s + e.amount_pkr, 0) / 100).toLocaleString()}</Text>
                </View>
              </View>
              {expenses.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyStateText}>No expenses logged yet.</Text></View>}
              {expenses.map((e: any) => (
                <View key={e.id} style={styles.expRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expDesc}>{e.description}</Text>
                    <Text style={styles.expMeta}>{e.category.replace(/_/g, ' ')} · {e.logger?.full_name ?? 'Unknown'} · {fmtDate(e.expense_date)}</Text>
                    {!e.billable && <Text style={[styles.expMeta, { color: colors.inkTertiary }]}>Non-billable</Text>}
                  </View>
                  <Text style={styles.expAmt}>PKR {(e.amount_pkr / 100).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.contactAddBar}>
              <TouchableOpacity style={styles.contactAddBtn} onPress={() => setExpenseModal(true)}>
                <Text style={styles.contactAddBtnText}>+ Log Expense</Text>
              </TouchableOpacity>
            </View>
            {/* Add Expense Modal */}
            <Modal visible={expenseModal} transparent animationType="slide">
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Pressable style={styles.overlay} onPress={() => setExpenseModal(false)}>
                  <Pressable style={[styles.modalBox, { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.modalTitle}>Log Expense</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Text style={styles.fieldLabel}>AMOUNT (PKR) *</Text>
                      <TextInput style={styles.input} value={expAmt} onChangeText={setExpAmt} placeholder="e.g. 1500.00" placeholderTextColor="rgba(30,20,10,0.4)" keyboardType="decimal-pad" />
                      <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
                      <TextInput style={styles.input} value={expDesc} onChangeText={setExpDesc} placeholder="Brief description" placeholderTextColor="rgba(30,20,10,0.4)" />
                      <Text style={styles.fieldLabel}>CATEGORY</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {(['filing_fee', 'courier', 'travel', 'printing', 'expert_fee', 'court_fee', 'miscellaneous'] as const).map((c) => (
                          <TouchableOpacity key={c} onPress={() => setExpCat(c)}
                            style={[styles.roleChip, expCat === c && styles.roleChipActive]}>
                            <Text style={[styles.roleChipText, expCat === c && styles.roleChipTextActive]}>{c.replace(/_/g, ' ')}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD)</Text>
                      <TextInput style={styles.input} value={expDate} onChangeText={setExpDate} placeholder={new Date().toISOString().split('T')[0]} placeholderTextColor="rgba(30,20,10,0.4)" />
                      <TouchableOpacity style={styles.billableToggle} onPress={() => setExpBillable(!expBillable)}>
                        <View style={[styles.checkbox, expBillable && styles.checkboxActive]} />
                        <Text style={styles.billableLabel}>Billable to client</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setExpenseModal(false)}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalConfirm} onPress={saveExpense} disabled={savingExpense || !expAmt || !expDesc.trim()}>
                        {savingExpense ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmText}>Save</Text>}
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Pressable>
              </KeyboardAvoidingView>
            </Modal>
          </>
        )}

        {/* TAB: Contacts */}
        {tab === 'contacts' && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {contacts.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No contacts yet. Add opposing counsel, judge, witnesses, or experts.</Text>
                </View>
              )}
              {contacts.map((c: any) => (
                <View key={c.id} style={styles.contactCard}>
                  <View style={[styles.contactRoleBadge, { backgroundColor: roleColor(c.role) }]}>
                    <Text style={styles.contactRoleText}>{c.role.replace(/_/g, ' ').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {c.firm ? <Text style={styles.contactDetail}>{c.firm}</Text> : null}
                  {c.email ? <Text style={styles.contactDetail}>{c.email}</Text> : null}
                  {c.phone ? <Text style={styles.contactDetail}>{c.phone}</Text> : null}
                  {c.notes ? <Text style={[styles.contactDetail, { fontStyle: 'italic', marginTop: 4 }]}>{c.notes}</Text> : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.contactAddBar}>
              <TouchableOpacity style={styles.contactAddBtn} onPress={() => setContactModal(true)}>
                <Text style={styles.contactAddBtnText}>+ Add Contact</Text>
              </TouchableOpacity>
            </View>
            {/* Add Contact Modal */}
            <Modal visible={contactModal} transparent animationType="slide">
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Pressable style={styles.overlay} onPress={() => setContactModal(false)}>
                  <Pressable style={[styles.modalBox, { maxHeight: '85%' }]} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.modalTitle}>Add Contact</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Text style={styles.fieldLabel}>NAME *</Text>
                      <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Full name" placeholderTextColor="rgba(30,20,10,0.4)" />
                      <Text style={styles.fieldLabel}>ROLE</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {(['opposing_counsel', 'judge', 'witness', 'expert', 'other'] as const).map((r) => (
                          <TouchableOpacity key={r} onPress={() => setContactRole(r)}
                            style={[styles.roleChip, contactRole === r && styles.roleChipActive]}>
                            <Text style={[styles.roleChipText, contactRole === r && styles.roleChipTextActive]}>{r.replace(/_/g, ' ')}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={styles.fieldLabel}>FIRM / ORGANISATION</Text>
                      <TextInput style={styles.input} value={contactFirm} onChangeText={setContactFirm} placeholder="Optional" placeholderTextColor="rgba(30,20,10,0.4)" />
                      <Text style={styles.fieldLabel}>EMAIL</Text>
                      <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="Optional" placeholderTextColor="rgba(30,20,10,0.4)" keyboardType="email-address" autoCapitalize="none" />
                      <Text style={styles.fieldLabel}>PHONE</Text>
                      <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="Optional" placeholderTextColor="rgba(30,20,10,0.4)" keyboardType="phone-pad" />
                      <Text style={styles.fieldLabel}>NOTES</Text>
                      <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={contactNotes} onChangeText={setContactNotes} placeholder="Any additional notes" placeholderTextColor="rgba(30,20,10,0.4)" multiline />
                    </ScrollView>
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setContactModal(false)}>
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modalConfirm} onPress={saveContact} disabled={savingContact || !contactName.trim()}>
                        {savingContact ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmText}>Save</Text>}
                      </TouchableOpacity>
                    </View>
                  </Pressable>
                </Pressable>
              </KeyboardAvoidingView>
            </Modal>
          </>
        )}

        {/* TAB: Private Notes */}
        {tab === 'notes' && (
          <>
            <View style={styles.notBanner}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </Svg>
              <Text style={styles.notBannerText}>NOT VISIBLE TO CLIENT</Text>
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {notes.map((note: any) => (
                <View key={note.id} style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <View style={styles.noteAvatar}><Text style={styles.noteAvatarText}>{note.author.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text></View>
                    <Text style={styles.noteAuthor}>{note.author.full_name}</Text>
                    <Text style={styles.noteDate}>{fmtDate(note.created_at)}</Text>
                  </View>
                  <Text style={styles.noteBody}>{note.body}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.noteInputBar}>
              <TextInput style={styles.noteInput} value={newNote} onChangeText={setNewNote} placeholder="Add a private note…" placeholderTextColor={colors.inkTertiary} multiline maxLength={2000} />
              <TouchableOpacity style={styles.notePostBtn} onPress={postNote} disabled={postingNote || !newNote.trim()}>
                {postingNote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.notePostBtnText}>Post</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* TAB: Audit Trail */}
        {tab === 'audit' && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {auditLogs.map((log: any) => (
              <View key={log.id} style={styles.auditRow}>
                <View style={[styles.auditDot, { backgroundColor: actorColor(log.actor_type) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.auditAction}>{log.action}</Text>
                  <Text style={styles.auditMeta}>{log.actor?.full_name ?? log.actor_type} · {fmtRelTime(log.created_at)}</Text>
                </View>
                <View style={[styles.auditBadge, { backgroundColor: actorBg(log.actor_type) }]}>
                  <Text style={[styles.auditBadgeText, { color: actorColor(log.actor_type) }]}>{log.actor_type}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* TAB: Chat */}
        {tab === 'chat' && (
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={msgScrollRef}
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => msgScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {messages.length === 0 && (
                <View style={styles.chatEmpty}>
                  <Text style={styles.chatEmptyText}>No messages yet. Send the first one to {matter.client?.full_name ?? 'the client'}.</Text>
                </View>
              )}
              {messages.map((msg: any) => {
                const isMine = msg.sender_id === profile?.id;
                return (
                  <View key={msg.id} style={[styles.msgWrapper, isMine && styles.msgWrapperMine]}>
                    {!isMine && (
                      <View style={styles.msgAvatar}>
                        <Text style={styles.msgAvatarText}>{(msg.sender?.full_name ?? 'C').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text>
                      </View>
                    )}
                    <View style={[styles.msgBubble, isMine && styles.msgBubbleMine]}>
                      {!isMine && <Text style={styles.msgSenderName}>{msg.sender?.full_name ?? 'Client'}</Text>}
                      <Text style={[styles.msgBody, isMine && styles.msgBodyMine]}>{msg.body}</Text>
                      <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{fmtRelTime(msg.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
              <View style={styles.chatInputBar}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={`Message ${matter.client?.full_name ?? 'client'}…`}
                  placeholderTextColor={colors.inkTertiary}
                  multiline
                  maxLength={2000}
                  returnKeyType="send"
                  onSubmitEditing={sendMsg}
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={[styles.chatSendBtn, (!chatInput.trim() || sendingMsg) && styles.chatSendBtnDisabled]} onPress={sendMsg} disabled={!chatInput.trim() || sendingMsg}>
                  {sendingMsg
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
                  }
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}

        {/* New Action Modal */}
        <Modal visible={actionModal} transparent animationType="slide" onRequestClose={() => setActionModal(false)}>
          <Pressable style={styles.backdrop} onPress={() => setActionModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Push Action to Client</Text>

            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.stageRow}>
              {TASK_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.stagePill, taskType === t && styles.stagePillActive]} onPress={() => setTaskType(t)}>
                  <Text style={[styles.stagePillText, taskType === t && styles.stagePillTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput style={styles.editInput} value={taskTitle} onChangeText={setTaskTitle} placeholder="e.g. Sign the Vakalatnama" placeholderTextColor={colors.inkTertiary} />

            <Text style={styles.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput style={[styles.editInput, { height: 70, paddingTop: 12, borderColor: colors.border }]} value={taskDesc} onChangeText={setTaskDesc} placeholder="What does the client need to do?" placeholderTextColor={colors.inkTertiary} multiline />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>DUE DATE</Text>
                <TextInput style={[styles.editInput, { borderColor: colors.border }]} value={taskDue} onChangeText={setTaskDue} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>PRIORITY</Text>
                <View style={styles.priorityRow}>
                  {(['normal', 'high'] as const).map((p) => (
                    <TouchableOpacity key={p} style={[styles.priorityPill, taskPriority === p && styles.priorityPillActive]} onPress={() => setTaskPriority(p)}>
                      <Text style={[styles.priorityText, taskPriority === p && styles.priorityTextActive]}>{p === 'high' ? 'High' : 'Normal'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity style={[styles.saveBtn, (!taskTitle.trim() || savingTask) && { opacity: 0.5 }]} onPress={createTask} disabled={!taskTitle.trim() || savingTask}>
              {savingTask ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Send to client</Text>}
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Edit Case Modal */}
        <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
          <Pressable style={styles.backdrop} onPress={() => setEditModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Edit Matter</Text>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput style={styles.editInput} value={editTitle} onChangeText={setEditTitle} />
            <Text style={styles.fieldLabel}>STAGE</Text>
            <View style={styles.stageRow}>
              {STAGE_ORDER.filter((s) => s !== 'closed').map((s) => (
                <TouchableOpacity key={s} style={[styles.stagePill, editStage === s && styles.stagePillActive]} onPress={() => setEditStage(s)}>
                  <Text style={[styles.stagePillText, editStage === s && styles.stagePillTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
              <Text style={styles.saveBtnText}>Save changes</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function roleColor(r: string) { return r === 'opposing_counsel' ? '#C0392B' : r === 'judge' ? '#6B1E2B' : r === 'witness' ? '#9A6B1E' : r === 'expert' ? '#1A5276' : '#6E635F'; }
function evColor(t: string) { return t === 'hearing' ? colors.amber : t === 'deadline' ? colors.red : colors.burgundy; }
function docColor(s: string) { return s === 'verified' ? colors.green : s === 'signed' ? colors.burgundy : s === 'under_review' ? colors.amber : s === 'requested' ? colors.red : colors.inkTertiary; }
function actorColor(t: string) { return t === 'lawyer' ? colors.burgundy : t === 'client' ? colors.brass : t === 'system' ? colors.inkTertiary : colors.green; }
function actorBg(t: string) { return t === 'lawyer' ? colors.roseTint : t === 'client' ? colors.amberBg : colors.borderLight; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtRelTime(iso: string) { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d < 1 ? 'today' : `${d}d ago`; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBadges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { backgroundColor: colors.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeConf: { backgroundColor: colors.amberBg },
  badgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkSecondary, textTransform: 'capitalize' },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.roseTint, backgroundColor: colors.roseBg },
  matterTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, paddingHorizontal: 20, marginBottom: 4, lineHeight: 24 },
  causeNo: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, paddingHorizontal: 20, marginBottom: 12 },
  partiesRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  partyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 999, paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  partyAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  partyAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 9, color: colors.burgundy },
  partyName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.ink, maxWidth: 100 },
  tabBar: { paddingHorizontal: 20, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  tabItem: { paddingVertical: 10, paddingHorizontal: 4 },
  tabLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.inkSecondary },
  tabLabelActive: { color: colors.burgundy, fontFamily: 'HankenGrotesk_600SemiBold' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, backgroundColor: colors.burgundy, borderRadius: 999 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  stepDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  stepDotActive: { backgroundColor: colors.burgundy, borderColor: colors.roseTint },
  stepLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSecondary },
  stepLabelActive: { color: colors.ink, fontFamily: 'HankenGrotesk_600SemiBold' },
  stepLabelDone: { color: colors.green },
  eventCard: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, marginTop: 4 },
  evBar: { width: 3, borderRadius: 999 },
  evTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink },
  evDate: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  docStatusDot: { width: 10, height: 10, borderRadius: 5 },
  docName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink },
  docStatus: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2, textTransform: 'capitalize' },
  viewDocBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.borderLight, borderWidth: 1, borderColor: colors.border },
  viewDocBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.inkSecondary },
  verifyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.green },
  verifyBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.green },
  expSummary: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.brass, borderRadius: 14, padding: 16, marginBottom: 16 },
  expSummaryLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: 'rgba(246,241,234,0.7)', letterSpacing: 1.5, marginBottom: 4 },
  expSummaryValue: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 20, color: colors.cream },
  expRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  expDesc: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink },
  expMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkSecondary, marginTop: 2, textTransform: 'capitalize' },
  expAmt: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.brass },
  billableToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  billableLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  contactCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  contactRoleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  contactRoleText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: '#fff', letterSpacing: 1 },
  contactName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink, marginBottom: 2 },
  contactDetail: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  contactAddBar: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  contactAddBtn: { backgroundColor: colors.burgundy, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  contactAddBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: '#fff' },
  roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: 8, backgroundColor: colors.card },
  roleChipActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  roleChipText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.inkSecondary, textTransform: 'capitalize' },
  roleChipTextActive: { color: '#fff' },
  timerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  timerLeft: { flex: 1 },
  timerLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkTertiary, letterSpacing: 1.5, marginBottom: 4 },
  timerDisplay: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 28, color: colors.ink, letterSpacing: 2 },
  timerStartBtn: { backgroundColor: colors.burgundy, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  timerStopBtn: { backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  timerBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: '#fff' },
  billingSummary: { backgroundColor: colors.burgundy, borderRadius: 14, padding: 16, marginBottom: 16 },
  billingSummaryLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: 'rgba(246,241,234,0.7)', letterSpacing: 1.5 },
  billingSummaryValue: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 32, color: colors.cream, marginTop: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  timeDesc: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink, flex: 1 },
  timeMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 3 },
  timeHours: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.burgundy },
  notBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.redBg, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ECCDC8' },
  notBannerText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, color: colors.red, letterSpacing: 1.5 },
  noteCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noteAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  noteAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, color: colors.burgundy },
  noteAuthor: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink, flex: 1 },
  noteDate: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  noteBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 19 },
  noteInputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  noteInput: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.ink },
  notePostBtn: { height: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  notePostBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: '#fff' },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  auditDot: { width: 8, height: 8, borderRadius: 4 },
  auditAction: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink },
  auditMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 2 },
  auditBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  auditBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, textTransform: 'capitalize' },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, marginBottom: 20 },
  fieldLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 8 },
  editInput: { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.burgundy, backgroundColor: colors.cream, paddingHorizontal: 14, fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, marginBottom: 16 },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  stagePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border },
  stagePillActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  stagePillText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.inkSecondary },
  stagePillTextActive: { color: '#fff' },
  saveBtn: { height: 54, borderRadius: 14, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },

  // Actions tab
  emptyActions: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, textAlign: 'center', paddingTop: 30, lineHeight: 20 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  taskRowDone: { backgroundColor: colors.cream, borderColor: colors.borderLight },
  taskCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.border, marginTop: 1 },
  taskCheckDone: { backgroundColor: colors.green, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  taskTitleDone: { color: colors.inkSecondary, textDecorationLine: 'line-through', flex: 1 },
  taskDesc: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2, lineHeight: 18 },
  taskMeta: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkTertiary, marginTop: 4, textTransform: 'capitalize' },
  actionFooter: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  newActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: colors.burgundy },
  newActionText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  priorityPill: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  priorityPillActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  priorityText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.inkSecondary },
  priorityTextActive: { color: '#fff' },

  // Chat tab
  chatEmpty: { paddingTop: 40, alignItems: 'center' },
  chatEmptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkTertiary, textAlign: 'center', lineHeight: 20 },
  msgWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  msgWrapperMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  msgAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, color: colors.inkSecondary },
  msgBubble: { maxWidth: '75%', backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border, padding: 10 },
  msgBubbleMine: { backgroundColor: colors.burgundy, borderColor: colors.burgundy, borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  msgSenderName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.burgundy, marginBottom: 3 },
  msgBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, lineHeight: 20 },
  msgBodyMine: { color: '#fff' },
  msgTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 10, color: colors.inkTertiary, marginTop: 4, textAlign: 'right' },
  msgTimeMine: { color: 'rgba(255,255,255,0.6)' },
  chatInputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  chatInput: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.ink },
  chatSendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  chatSendBtnDisabled: { opacity: 0.4 },
  // Shared modal / form styles (used by timer, contacts, expenses modals)
  overlay: { flex: 1, backgroundColor: 'rgba(28,21,18,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.ink, marginBottom: 4 },
  modalSub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginBottom: 16 },
  input: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  modalCancelText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSecondary },
  modalConfirm: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.burgundy },
  modalConfirmText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkTertiary, textAlign: 'center' },
});
