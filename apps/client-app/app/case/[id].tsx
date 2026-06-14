import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal, Pressable, Image, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors, STAGE_ORDER, STAGE_LABELS } from '../../lib/colors';
import { uploadToBucket } from '../../lib/upload';
import { dispatchPush } from '../../lib/push';
import Svg, { Path } from 'react-native-svg';

type Seg = 'overview' | 'actions' | 'documents' | 'invoices' | 'chat';

interface Matter {
  id: string; matter_ref: string; title: string; type: string; stage: string;
  status: string; court: string | null; cause_no: string | null; description: string | null;
  lead_lawyer_id: string | null;
  lead_lawyer: { full_name: string } | null;
}
interface TeamMember { id: string; full_name: string; role: string; }
interface Task {
  id: string; type: string; title: string; description: string | null; status: string;
  priority: string; due_date: string | null; assigned_to: string;
}
interface Doc {
  id: string; name: string; category: string; status: string;
  due_date: string | null; requires_esign: boolean; file_url: string | null;
  signed_at: string | null; signed_name: string | null;
}
interface Message {
  id: string; body: string; created_at: string; sender_id: string;
  attachment_url: string | null; attachment_name: string | null; attachment_type: string | null;
  sender: { full_name: string } | null;
}

export default function CaseDetailScreen() {
  const { id, seg: segParam } = useLocalSearchParams<{ id: string; seg?: string }>();
  const { profile } = useAuthStore();
  const [seg, setSeg] = useState<Seg>((segParam as Seg) ?? 'overview');
  const [loading, setLoading] = useState(true);

  const [matter, setMatter] = useState<Matter | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [docSheet, setDocSheet] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [signSheet, setSignSheet] = useState<Doc | null>(null);
  const [signName, setSignName] = useState('');
  const [signing, setSigning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadAll = useCallback(async () => {
    if (!id || !profile) return;
    const [matterRes, teamRes, taskRes, docRes, msgRes, invRes] = await Promise.all([
      supabase.from('matters').select('id, matter_ref, title, type, stage, status, court, cause_no, description, lead_lawyer_id, lead_lawyer:profiles!lead_lawyer_id(full_name)').eq('id', id).single(),
      supabase.from('matter_lawyers').select('role, lawyer:profiles!lawyer_id(id, full_name)').eq('matter_id', id),
      supabase.from('tasks').select('id, type, title, description, status, priority, due_date, assigned_to').eq('matter_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('id, name, category, status, due_date, requires_esign, file_url, signed_at, signed_name').eq('matter_id', id).order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('messages').select('id, body, created_at, sender_id, attachment_url, attachment_name, attachment_type, sender:profiles!sender_id(full_name)').eq('matter_id', id).order('created_at'),
      supabase.from('invoices').select('id, invoice_ref, status, amount_paisas, due_date, paid_at, created_at').eq('matter_id', id).order('created_at', { ascending: false }),
    ]);
    if (matterRes.data) setMatter(matterRes.data as unknown as Matter);
    if (teamRes.data) setTeam(teamRes.data.filter((r: any) => r.lawyer).map((r: any) => ({ id: r.lawyer.id, full_name: r.lawyer.full_name, role: r.role })));
    if (taskRes.data) setTasks(taskRes.data as Task[]);
    if (docRes.data) setDocs(docRes.data as Doc[]);
    if (msgRes.data) setMessages(msgRes.data as unknown as Message[]);
    if (invRes.data) setInvoices(invRes.data);
    setLoading(false);
  }, [id, profile]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime chat
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`case-msgs-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `matter_id=eq.${id}` },
        (payload) => {
          supabase
            .from('messages')
            .select('id, body, created_at, sender_id, attachment_url, attachment_name, attachment_type, sender:profiles!sender_id(full_name)')
            .eq('id', (payload.new as any).id)
            .single()
            .then(({ data }) => {
              if (!data) return;
              setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as unknown as Message]);
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
            });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Mark this case's incoming messages as read when the chat is opened
  useEffect(() => {
    if (seg !== 'chat' || !id || !profile) return;
    supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('matter_id', id).neq('sender_id', profile.id).is('read_at', null)
      .then(() => {});
  }, [seg, id, profile, messages.length]);

  async function completeTask(taskId: string) {
    await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', taskId);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'done' } : t));
  }

  async function signDocument() {
    if (!signSheet || !signName.trim() || !profile || signing) return;
    setSigning(true);
    const now = new Date().toISOString();
    await supabase.from('documents').update({
      status: 'signed', signed_at: now, signed_by: profile.id, signed_name: signName.trim(),
    }).eq('id', signSheet.id);
    await supabase.from('audit_logs').insert({
      matter_id: id, actor_id: profile.id, actor_type: 'client',
      action: `Document signed: ${signSheet.name}`, metadata: { signed_name: signName.trim() },
    }).then(() => {});
    setDocs((prev) => prev.map((d) => d.id === signSheet.id ? { ...d, status: 'signed', signed_at: now, signed_name: signName.trim() } : d));
    setSigning(false);
    setSignSheet(null);
    setSignName('');
  }

  async function sendText() {
    if (!text.trim() || !id || !profile || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    await supabase.from('messages').insert({ matter_id: id, sender_id: profile.id, body });
    if (matter?.lead_lawyer_id) {
      dispatchPush(matter.lead_lawyer_id, profile.full_name, body, { matter_id: id, screen: 'chat' });
    }
    setSending(false);
  }

  async function attachToChat() {
    if (!id || !profile || attaching) return;
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAttaching(true);
    const path = `chat/${id}/${Date.now()}_${asset.name}`;
    const up = await uploadToBucket({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' }, path);
    if (up) {
      await supabase.from('messages').insert({
        matter_id: id, sender_id: profile.id, body: '',
        attachment_url: up.url, attachment_name: asset.name, attachment_type: asset.mimeType ?? 'application/octet-stream',
        attachment_size_kb: up.sizeKb,
      });
    }
    setAttaching(false);
  }

  async function uploadDoc(docId: string, source: 'camera' | 'files') {
    setDocSheet(null);
    setUploadingDoc(docId);
    try {
      let uri: string | null = null, fileName = 'document', mimeType = 'application/octet-stream';
      if (source === 'camera') {
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!r.canceled) { uri = r.assets[0].uri; fileName = `photo_${Date.now()}.jpg`; mimeType = r.assets[0].mimeType ?? 'image/jpeg'; }
      } else {
        const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (!r.canceled) { uri = r.assets[0].uri; fileName = r.assets[0].name; mimeType = r.assets[0].mimeType ?? 'application/octet-stream'; }
      }
      if (!uri) { setUploadingDoc(null); return; }
      await supabase.from('documents').update({ status: 'uploading', file_name: fileName }).eq('id', docId);
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'uploading' } : d));
      const up = await uploadToBucket({ uri, name: fileName, mimeType }, `documents/${docId}/${fileName}`);
      if (up) {
        await supabase.from('documents').update({ status: 'under_review', file_url: up.url, storage_path: `documents/${docId}/${fileName}`, file_size_kb: up.sizeKb }).eq('id', docId);
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'under_review', file_url: up.url } : d));
      } else {
        await supabase.from('documents').update({ status: 'requested' }).eq('id', docId);
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'requested' } : d));
      }
    } finally {
      setUploadingDoc(null);
    }
  }

  if (loading || !matter) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.burgundy} />
      </SafeAreaView>
    );
  }

  const openActions = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerRef}>{matter.matter_ref}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{matter.title}</Text>
          </View>
        </View>

        {/* Segmented control */}
        <View style={styles.segBar}>
          {(['overview', 'actions', 'documents', 'invoices', 'chat'] as Seg[]).map((s) => {
            const pendingInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'outstanding').length;
            let label = s.charAt(0).toUpperCase() + s.slice(1);
            if (s === 'actions' && openActions.length > 0) label = `Actions (${openActions.length})`;
            if (s === 'invoices' && pendingInvoices > 0) label = `Invoices (${pendingInvoices})`;
            return (
              <TouchableOpacity key={s} style={styles.segItem} onPress={() => setSeg(s)}>
                <Text style={[styles.segLabel, seg === s && styles.segLabelActive]}>{label}</Text>
                {seg === s && <View style={styles.segIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── OVERVIEW ── */}
        {seg === 'overview' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <View style={styles.factGrid}>
              <Fact label="TYPE" value={cap(matter.type)} />
              <Fact label="STAGE" value={STAGE_LABELS[matter.stage] ?? matter.stage} />
              {matter.court && <Fact label="COURT" value={matter.court} />}
              {matter.cause_no && <Fact label="CAUSE NO." value={matter.cause_no} />}
            </View>

            {matter.description && (
              <View style={styles.descCard}>
                <Text style={styles.descText}>{matter.description}</Text>
              </View>
            )}

            {/* Stage stepper */}
            <Text style={styles.blockLabel}>PROGRESS</Text>
            <View style={styles.stepCard}>
              {STAGE_ORDER.map((stage, i) => {
                const idx = STAGE_ORDER.indexOf(matter.stage);
                const done = i < idx, active = i === idx, isLast = i === STAGE_ORDER.length - 1;
                return (
                  <View key={stage} style={styles.stepRow}>
                    <View style={styles.stepLeft}>
                      <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                        {done && <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5" /></Svg>}
                      </View>
                      {!isLast && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
                    </View>
                    <Text style={[styles.stepName, active && styles.stepNameActive, done && styles.stepNameDone]}>{STAGE_LABELS[stage] ?? stage}</Text>
                  </View>
                );
              })}
            </View>

            {/* Team */}
            <Text style={styles.blockLabel}>YOUR LEGAL TEAM</Text>
            <View style={styles.teamCard}>
              {team.length === 0 && <Text style={styles.mutedText}>No lawyers assigned yet.</Text>}
              {team.map((m) => (
                <View key={m.id} style={styles.teamRow}>
                  <View style={styles.teamAvatar}><Text style={styles.teamAvatarText}>{initials(m.full_name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{m.full_name}</Text>
                    <Text style={styles.teamRole}>{cap(m.role)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* ── ACTIONS ── */}
        {seg === 'actions' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {tasks.length === 0 && <View style={styles.emptyBlock}><Text style={styles.mutedText}>No actions yet. Your lawyer will assign tasks here.</Text></View>}
            {openActions.length > 0 && <Text style={styles.blockLabel}>TO DO</Text>}
            {openActions.map((t) => (
              <View key={t.id} style={styles.taskCard}>
                <View style={[styles.taskIcon, { backgroundColor: taskBg(t.type) }]}>
                  <Text style={[styles.taskIconText, { color: taskColor(t.type) }]}>{taskEmoji(t.type)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{t.title}</Text>
                  {t.description && <Text style={styles.taskDesc} numberOfLines={2}>{t.description}</Text>}
                  {t.due_date && <Text style={styles.taskDue}>Due {fmtDate(t.due_date)}</Text>}
                </View>
                {t.assigned_to === 'client' && (
                  <TouchableOpacity style={styles.taskDoneBtn} onPress={() => completeTask(t.id)}>
                    <Text style={styles.taskDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {tasks.some((t) => t.status === 'done') && <Text style={[styles.blockLabel, { marginTop: 18 }]}>COMPLETED</Text>}
            {tasks.filter((t) => t.status === 'done').map((t) => (
              <View key={t.id} style={[styles.taskCard, styles.taskCardDone]}>
                <View style={[styles.taskIcon, { backgroundColor: colors.greenBg }]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 6L9 17l-5-5" /></Svg>
                </View>
                <Text style={[styles.taskTitle, styles.taskTitleDone]}>{t.title}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── DOCUMENTS ── */}
        {seg === 'documents' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {docs.length === 0 && <View style={styles.emptyBlock}><Text style={styles.mutedText}>No documents for this case yet.</Text></View>}
            {docs.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <View style={[styles.docIcon, d.status === 'verified' && styles.docIconGreen, (d.status === 'under_review' || d.status === 'uploading') && styles.docIconAmber]}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={d.status === 'verified' ? colors.green : (d.status === 'requested' ? colors.burgundy : colors.amber)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                  <Text style={[styles.docStatus, { color: statusColor(d.status) }]}>{statusLabel(d.status, d.due_date)}</Text>
                </View>
                {d.status === 'requested' && (
                  uploadingDoc === d.id
                    ? <ActivityIndicator color={colors.burgundy} size="small" />
                    : d.requires_esign
                      ? <TouchableOpacity style={[styles.docUploadBtn, { backgroundColor: colors.burgundy }]} onPress={() => { setSignSheet(d); setSignName(profile?.full_name ?? ''); }}>
                          <Text style={[styles.docUploadText, { color: '#fff' }]}>Sign</Text>
                        </TouchableOpacity>
                      : <TouchableOpacity style={styles.docUploadBtn} onPress={() => setDocSheet(d.id)}>
                          <Text style={styles.docUploadText}>Upload</Text>
                        </TouchableOpacity>
                )}
                {d.status === 'signed' && (
                  <View style={styles.docSignedBadge}>
                    <Text style={styles.docSignedText}>Signed</Text>
                  </View>
                )}
                {d.status === 'verified' && d.file_url && (
                  <TouchableOpacity style={styles.docViewBtn} onPress={() => Linking.openURL(d.file_url!)}>
                    <Text style={styles.docViewText}>View</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── INVOICES ── */}
        {seg === 'invoices' && (
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {invoices.length === 0 && (
              <View style={styles.emptyState}><Text style={styles.emptyStateText}>No invoices for this matter yet.</Text></View>
            )}
            {invoices.map((inv: any) => {
              const isPending = inv.status === 'sent' || inv.status === 'outstanding';
              const isPaid = inv.status === 'paid';
              return (
                <View key={inv.id} style={[styles.invCard, isPending && styles.invCardPending]}>
                  <View style={styles.invRow}>
                    <Text style={styles.invRef}>{inv.invoice_ref}</Text>
                    <View style={[styles.invBadge, isPaid && styles.invBadgePaid, isPending && styles.invBadgePending]}>
                      <Text style={[styles.invBadgeText, isPaid && styles.invBadgeTextPaid, isPending && styles.invBadgeTextPending]}>{inv.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.invAmount}>PKR {(inv.amount_paisas / 100).toLocaleString('en-PK')}</Text>
                  <Text style={styles.invDate}>Due: {new Date(inv.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  {isPaid && inv.paid_at && <Text style={styles.invPaidOn}>Paid on {new Date(inv.paid_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── CHAT ── */}
        {seg === 'chat' && (
          <View style={styles.body}>
            <ScrollView ref={scrollRef} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              <View style={styles.chatNotice}>
                <Text style={styles.chatNoticeText}>Messages here go to {matter.lead_lawyer?.full_name ?? 'your lawyer'} for this case.</Text>
              </View>
              {messages.map((msg) => {
                const isMe = msg.sender_id === profile?.id;
                return (
                  <View key={msg.id} style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
                    {!isMe && <View style={styles.bubbleAvatar}><Text style={styles.bubbleAvatarText}>{initials(msg.sender?.full_name)}</Text></View>}
                    <View style={[styles.bubble, isMe && styles.bubbleMe]}>
                      {!isMe && <Text style={styles.bubbleSender}>{msg.sender?.full_name ?? 'Bastion Law'}</Text>}
                      {msg.attachment_url && (
                        msg.attachment_type?.startsWith('image/')
                          ? <TouchableOpacity onPress={() => Linking.openURL(msg.attachment_url!)}><Image source={{ uri: msg.attachment_url }} style={styles.attachImage} /></TouchableOpacity>
                          : <TouchableOpacity style={styles.attachChip} onPress={() => Linking.openURL(msg.attachment_url!)}>
                              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={isMe ? colors.cream : colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" /></Svg>
                              <Text style={[styles.attachName, isMe && { color: colors.cream }]} numberOfLines={1}>{msg.attachment_name}</Text>
                            </TouchableOpacity>
                      )}
                      {!!msg.body && <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>}
                      <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{fmtTime(msg.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.attachBtn} onPress={attachToChat} disabled={attaching}>
                {attaching ? <ActivityIndicator color={colors.inkSecondary} size="small" /> : (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></Svg>
                )}
              </TouchableOpacity>
              <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Message your lawyer…" placeholderTextColor={colors.inkTertiary} multiline maxLength={2000} />
              <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={sendText} disabled={!text.trim() || sending}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* E-Sign modal */}
        <Modal visible={!!signSheet} transparent animationType="slide" onRequestClose={() => setSignSheet(null)}>
          <Pressable style={styles.backdrop} onPress={() => setSignSheet(null)} />
          <View style={[styles.sheet, { paddingBottom: 40 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Sign Document</Text>
            <View style={styles.signDocBox}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" /></Svg>
              <Text style={styles.signDocName} numberOfLines={2}>{signSheet?.name}</Text>
            </View>
            <Text style={styles.signLegal}>
              By typing your full legal name below, you agree that your electronic signature is the legal equivalent of your handwritten signature on this document.
            </Text>
            <Text style={styles.signLabel}>YOUR FULL LEGAL NAME</Text>
            <TextInput
              style={styles.signInput}
              value={signName}
              onChangeText={setSignName}
              placeholder="Type your full name to sign"
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="words"
            />
            <Text style={styles.signMeta}>
              Signed: {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              style={[styles.sheetBtnPrimary, styles.sheetBtn, { marginTop: 20 }, (!signName.trim() || signing) && { opacity: 0.5 }]}
              onPress={signDocument}
              disabled={!signName.trim() || signing}
            >
              {signing ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnTextPrimary}>Confirm Signature</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setSignSheet(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Doc upload sheet */}
        <Modal visible={!!docSheet} transparent animationType="slide" onRequestClose={() => setDocSheet(null)}>
          <Pressable style={styles.backdrop} onPress={() => setDocSheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Upload Document</Text>
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimary]} onPress={() => docSheet && uploadDoc(docSheet, 'camera')}>
              <Text style={styles.sheetBtnTextPrimary}>Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => docSheet && uploadDoc(docSheet, 'files')}>
              <Text style={styles.sheetBtnText}>Browse files</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setDocSheet(null)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function initials(name?: string | null) { if (!name) return '··'; return name.split(' ').map((n) => n[0]).join('').slice(0, 2); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }); }
function taskEmoji(t: string) { return ({ document: '📄', payment: '💳', signature: '✍️', review: '👁', meeting: '📅' } as Record<string, string>)[t] ?? '•'; }
function taskColor(t: string) { return t === 'payment' ? colors.amber : colors.burgundy; }
function taskBg(t: string) { return t === 'payment' ? colors.amberBg : colors.roseTint; }
function statusColor(s: string) { if (s === 'verified' || s === 'signed') return colors.green; if (s === 'requested') return colors.burgundy; return colors.amber; }
function statusLabel(s: string, due: string | null) {
  if (s === 'verified') return 'Verified';
  if (s === 'signed') return 'Signed — awaiting verification';
  if (s === 'under_review') return 'Under review';
  if (s === 'uploading') return 'Uploading…';
  return due ? `Requested · due ${fmtDate(due)}` : 'Requested';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerRef: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.inkMuted, letterSpacing: 1.5 },
  headerTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 17, color: colors.ink },

  segBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  segLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.inkSecondary },
  segLabelActive: { color: colors.burgundy, fontFamily: 'HankenGrotesk_600SemiBold' },
  segIndicator: { position: 'absolute', bottom: -1, left: 12, right: 12, height: 2.5, backgroundColor: colors.burgundy, borderRadius: 999 },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },
  blockLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  mutedText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, lineHeight: 20 },
  emptyBlock: { paddingTop: 40, alignItems: 'center' },

  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  fact: { flexGrow: 1, minWidth: '44%', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 },
  factLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.inkMuted, letterSpacing: 1.2, marginBottom: 3 },
  factValue: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  descCard: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12 },
  descText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, lineHeight: 21 },

  stepCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepLeft: { alignItems: 'center', width: 22 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  stepDotActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  stepLine: { flex: 1, width: 2, minHeight: 16, backgroundColor: colors.border, marginVertical: 2 },
  stepLineDone: { backgroundColor: colors.green },
  stepName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSecondary, paddingTop: 1, paddingBottom: 14 },
  stepNameActive: { color: colors.ink, fontFamily: 'HankenGrotesk_600SemiBold' },
  stepNameDone: { color: colors.green },

  teamCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  teamAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.burgundy },
  teamName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  teamRole: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },

  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  taskCardDone: { backgroundColor: colors.cream, borderColor: colors.borderLight },
  taskIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  taskIconText: { fontSize: 16 },
  taskTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  taskTitleDone: { color: colors.inkSecondary, textDecorationLine: 'line-through', flex: 1 },
  taskDesc: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2, lineHeight: 18 },
  taskDue: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.amber, marginTop: 4 },
  taskDoneBtn: { backgroundColor: colors.burgundy, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  taskDoneText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: '#fff' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  docIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  docIconGreen: { backgroundColor: colors.greenBg },
  docIconAmber: { backgroundColor: colors.amberBg },
  docName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  docStatus: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, marginTop: 2 },
  docUploadBtn: { backgroundColor: colors.burgundy, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  docUploadText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: '#fff' },
  docViewBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  docViewText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.burgundy },

  chatContent: { padding: 16, paddingBottom: 8 },
  chatNotice: { backgroundColor: colors.roseBg, borderRadius: 10, padding: 10, marginBottom: 12 },
  chatNoticeText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  bubbleRowMe: { flexDirection: 'row-reverse' },
  bubbleAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, color: colors.burgundy },
  bubble: { maxWidth: '78%', backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border, padding: 12 },
  bubbleMe: { backgroundColor: colors.burgundy, borderColor: colors.burgundy, borderBottomRightRadius: 5, borderBottomLeftRadius: 16 },
  bubbleSender: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.burgundy, marginBottom: 4 },
  bubbleText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 10, color: colors.inkTertiary, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(246,241,234,0.6)' },
  attachImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4, maxWidth: 200 },
  attachName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.burgundy, flex: 1 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  attachBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 17, color: colors.ink, marginBottom: 20 },
  sheetBtn: { height: 54, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  sheetBtnPrimary: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  sheetBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  sheetBtnTextPrimary: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
  sheetCancel: { height: 54, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 15, color: colors.inkSecondary },

  emptyState: { paddingTop: 40, alignItems: 'center' },
  emptyStateText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkTertiary, textAlign: 'center' },

  // E-sign
  signDocBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.roseTint, borderRadius: 12, padding: 12, marginBottom: 16 },
  signDocName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink, flex: 1 },
  signLegal: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, lineHeight: 18, marginBottom: 20 },
  signLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 8 },
  signInput: { height: 54, borderRadius: 14, borderWidth: 2, borderColor: colors.burgundy, backgroundColor: colors.cream, paddingHorizontal: 16, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, letterSpacing: 0.5 },
  signMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 8 },
  docSignedBadge: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.green, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  docSignedText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.green },

  // Invoices tab
  invCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  invCardPending: { borderColor: colors.brassLight, borderWidth: 1.5 },
  invRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  invRef: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkTertiary, letterSpacing: 1 },
  invBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.borderLight },
  invBadgePaid: { backgroundColor: colors.greenBg },
  invBadgePending: { backgroundColor: colors.amberBg },
  invBadgeText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: colors.inkTertiary, letterSpacing: 0.5 },
  invBadgeTextPaid: { color: colors.green },
  invBadgeTextPending: { color: colors.amber },
  invAmount: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 20, color: colors.ink, marginBottom: 4 },
  invDate: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  invPaidOn: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.green, marginTop: 4 },
});
