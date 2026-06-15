import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface SLAItem {
  id: string;
  matter_id: string;
  matter_title: string;
  matter_ref: string;
  client_name: string;
  last_message: string;
  elapsed_minutes: number;
  escalated: boolean;
}

interface PendingDoc {
  id: string;
  name: string;
  client_name: string;
  due_date: string | null;
  matter_ref: string;
}

interface TodayEvent {
  id: string;
  title: string;
  event_time: string | null;
  type: string;
  location: string | null;
}

interface Stats {
  activeMatters: number;
  pendingDocs: number;
  unreadMessages: number;
  todayEvents: number;
}

export default function DashboardScreen() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ activeMatters: 0, pendingDocs: 0, unreadMessages: 0, todayEvents: 0 });
  const [slaQueue, setSlaQueue] = useState<SLAItem[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [escalated, setEscalated] = useState<Set<string>>(new Set());
  const [myMatters, setMyMatters] = useState<{ id: string; matter_ref: string; title: string }[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // Quick Log Time modal
  const [logModal, setLogModal] = useState(false);
  const [logMatterId, setLogMatterId] = useState('');
  const [logHours, setLogHours] = useState('');
  const [logDesc, setLogDesc] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingLog, setSavingLog] = useState(false);

  // Quick Add Note modal
  const [noteModal, setNoteModal] = useState(false);
  const [noteMatterId, setNoteMatterId] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;

    // Get all matters for this lawyer
    const { data: myMatters } = await supabase
      .from('matters')
      .select('id, matter_ref, title, client_id, client:profiles!client_id(full_name)')
      .eq('lead_lawyer_id', profile.id)
      .eq('status', 'active');

    const matterIds = myMatters?.map((m: any) => m.id) ?? [];
    setMyMatters((myMatters ?? []).map((m: any) => ({ id: m.id, matter_ref: m.matter_ref, title: m.title })));
    const today = new Date().toISOString().split('T')[0];

    const [docsRes, eventsRes, msgsRes] = await Promise.all([
      matterIds.length ? supabase.from('documents').select('id, name, due_date, matter_id').in('matter_id', matterIds).eq('status', 'requested').order('due_date') : { data: [] },
      matterIds.length ? supabase.from('events').select('id, title, event_time, type, location').in('matter_id', matterIds).eq('event_date', today).order('event_time') : { data: [] },
      matterIds.length ? supabase.from('messages').select('id, matter_id, sender_id, created_at, body').in('matter_id', matterIds).order('created_at', { ascending: false }) : { data: [] },
    ]);

    // Build SLA queue: last messages from clients with no lawyer reply > 60 mins
    const slaItems: SLAItem[] = [];
    if (myMatters && msgsRes.data) {
      for (const matter of myMatters) {
        const matterMsgs = (msgsRes.data as any[]).filter((m) => m.matter_id === matter.id);
        if (!matterMsgs.length) continue;
        const lastMsg = matterMsgs[0];
        if (lastMsg.sender_id === profile.id) continue; // last msg is from lawyer, no breach
        const elapsed = Math.floor((Date.now() - new Date(lastMsg.created_at).getTime()) / 60000);
        if (elapsed > 30) {
          slaItems.push({
            id: matter.id,
            matter_id: matter.id,
            matter_title: matter.title,
            matter_ref: matter.matter_ref,
            client_name: (matter as any).client.full_name,
            last_message: lastMsg.body,
            elapsed_minutes: elapsed,
            escalated: false,
          });
        }
      }
    }

    // Build pending docs with client names
    const docsWithClient: PendingDoc[] = [];
    if (docsRes.data && myMatters) {
      for (const doc of (docsRes.data as any[])) {
        const matter = myMatters.find((m) => m.id === doc.matter_id);
        if (matter) {
          docsWithClient.push({
            id: doc.id,
            name: doc.name,
            client_name: (matter as any).client.full_name,
            due_date: doc.due_date,
            matter_ref: matter.matter_ref,
          });
        }
      }
    }

    setSlaQueue(slaItems);
    setPendingDocs(docsWithClient.slice(0, 4));
    setTodayEvents((eventsRes.data ?? []) as TodayEvent[]);
    setStats({
      activeMatters: myMatters?.length ?? 0,
      pendingDocs: docsWithClient.length,
      unreadMessages: slaItems.length,
      todayEvents: (eventsRes.data?.length ?? 0),
    });

    if (profile) {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).is('read_at', null);
      setUnreadNotifs(count ?? 0);
    }

    setLoading(false); setRefreshing(false);
  }

  async function saveTimeLog() {
    if (!profile || !logMatterId || !logHours) return;
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) return;
    setSavingLog(true);
    await supabase.from('time_entries').insert({
      matter_id: logMatterId, lawyer_id: profile.id,
      hours, description: logDesc.trim() || 'Billable time',
      entry_date: logDate, billable: true,
    });
    await supabase.from('audit_logs').insert({
      matter_id: logMatterId, actor_id: profile.id, actor_type: 'lawyer',
      action: `Time logged: ${hours}h — ${logDesc.trim() || 'Billable time'}`,
    });
    setSavingLog(false);
    setLogModal(false);
    setLogMatterId(''); setLogHours(''); setLogDesc('');
    setLogDate(new Date().toISOString().split('T')[0]);
  }

  async function saveNote() {
    if (!profile || !noteMatterId || !noteText.trim()) return;
    setSavingNote(true);
    await supabase.from('matter_notes').insert({
      matter_id: noteMatterId, author_id: profile.id,
      content: noteText.trim(), visible_to_client: false,
    });
    await supabase.from('audit_logs').insert({
      matter_id: noteMatterId, actor_id: profile.id, actor_type: 'lawyer',
      action: 'Note added via mobile app',
    });
    setSavingNote(false);
    setNoteModal(false);
    setNoteMatterId(''); setNoteText('');
  }

  function handleEscalate(id: string) {
    setEscalated((prev) => new Set([...prev, id]));
  }

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {tod()}, {profile?.full_name.split(' ')[0]}.</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/notifications')}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </Svg>
              {unreadNotifs > 0 && <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoMark} onPress={() => router.push('/profile')}>
              <Text style={styles.logoText}>{profile?.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) ?? 'B'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label="ACTIVE MATTERS" value={stats.activeMatters} />
          <StatCard label="PENDING DOCS" value={stats.pendingDocs} />
          <StatCard label="SLA ALERTS" value={slaQueue.length} alert={slaQueue.length > 0} />
          <StatCard label="TODAY'S EVENTS" value={stats.todayEvents} />
        </ScrollView>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => { setLogDate(new Date().toISOString().split('T')[0]); setLogModal(true); }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="10" /><Line x1="12" y1="8" x2="12" y2="12" /><Line x1="12" y1="16" x2="12.01" y2="16" />
            </Svg>
            <Text style={styles.quickBtnText}>Log Time</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setNoteModal(true)}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6M12 18v-6M9 15h6" />
            </Svg>
            <Text style={styles.quickBtnText}>Add Note</Text>
          </TouchableOpacity>
        </View>

        {/* SLA Escalation Queue */}
        {slaQueue.length > 0 && (
          <View style={styles.slaCard}>
            <View style={styles.slaHeader}>
              <View style={styles.slaDot} />
              <Text style={styles.slaTitle}>SLA QUEUE — {slaQueue.length} FLAGGED</Text>
            </View>
            {slaQueue.map((item, idx) => (
              <View key={item.id} style={[styles.slaRow, idx > 0 && styles.slaRowBorder]}>
                <View style={styles.slaAvatar}>
                  <Text style={styles.slaAvatarText}>{item.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</Text>
                </View>
                <View style={styles.slaInfo}>
                  <Text style={styles.slaClient}>{item.client_name}</Text>
                  <Text style={styles.slaMatter}>{item.matter_ref}</Text>
                  <Text style={styles.slaMsg} numberOfLines={1}>{item.last_message}</Text>
                  <Text style={[styles.slaElapsed, item.elapsed_minutes >= 120 && styles.slaElapsedBreach]}>
                    {item.elapsed_minutes >= 60 ? `${Math.floor(item.elapsed_minutes / 60)}h ${item.elapsed_minutes % 60}m` : `${item.elapsed_minutes}m`} unanswered
                  </Text>
                </View>
                <View style={styles.slaActions}>
                  <TouchableOpacity style={styles.replyBtn} onPress={() => router.push(`/matter/${item.matter_id}`)}>
                    <Text style={styles.replyBtnText}>Reply</Text>
                  </TouchableOpacity>
                  {!escalated.has(item.id) ? (
                    <TouchableOpacity style={styles.escalateBtn} onPress={() => handleEscalate(item.id)}>
                      <Text style={styles.escalateBtnText}>Escalate</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.escalatedBadge}>
                      <Text style={styles.escalatedText}>Escalated</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending requirements */}
        {pendingDocs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pending Documents</Text>
            {pendingDocs.map((doc, idx) => (
              <View key={doc.id} style={[styles.docRow, idx > 0 && styles.docRowBorder]}>
                <View style={styles.docAvatar}>
                  <Text style={styles.docAvatarText}>{doc.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.docClient}>{doc.client_name} · {doc.matter_ref}</Text>
                </View>
                {doc.due_date && (
                  <View style={[styles.dueBadge, isUrgent(doc.due_date) && styles.dueBadgeUrgent]}>
                    <Text style={[styles.dueBadgeText, isUrgent(doc.due_date) && styles.dueBadgeTextUrgent]}>
                      {fmtDate(doc.due_date)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Today's schedule */}
        {todayEvents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today</Text>
            {todayEvents.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={[styles.eventBar, { backgroundColor: eventColor(ev.type) }]} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTime}>{ev.event_time?.slice(0, 5) ?? 'All day'}</Text>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  {ev.location && <Text style={styles.eventLoc}>{ev.location}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Log Time Modal */}
      <Modal visible={logModal} transparent animationType="slide" onRequestClose={() => setLogModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLogModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Log Time</Text>

          <Text style={styles.fieldLabel}>MATTER</Text>
          {myMatters.length === 0 ? (
            <Text style={styles.mutedSmall}>No active matters.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {myMatters.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => setLogMatterId(m.id)}
                  style={[styles.matterChip, logMatterId === m.id && styles.matterChipActive]}>
                  <Text style={[styles.matterChipText, logMatterId === m.id && styles.matterChipTextActive]} numberOfLines={1}>{m.matter_ref}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>HOURS</Text>
          <TextInput style={styles.input} value={logHours} onChangeText={setLogHours} placeholder="e.g. 1.5" keyboardType="decimal-pad" placeholderTextColor={colors.inkTertiary} />

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput style={styles.input} value={logDesc} onChangeText={setLogDesc} placeholder="e.g. Client call, research, drafting…" placeholderTextColor={colors.inkTertiary} />

          <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={logDate} onChangeText={setLogDate} placeholder={new Date().toISOString().split('T')[0]} placeholderTextColor={colors.inkTertiary} />

          <TouchableOpacity style={[styles.saveBtn, (!logMatterId || !logHours || savingLog) && { opacity: 0.5 }]} onPress={saveTimeLog} disabled={!logMatterId || !logHours || savingLog}>
            {savingLog ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
      {/* Add Note Modal */}
      <Modal visible={noteModal} transparent animationType="slide" onRequestClose={() => setNoteModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNoteModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Add Note</Text>

          <Text style={styles.fieldLabel}>MATTER</Text>
          {myMatters.length === 0 ? (
            <Text style={styles.mutedSmall}>No active matters.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {myMatters.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => setNoteMatterId(m.id)}
                  style={[styles.matterChip, noteMatterId === m.id && styles.matterChipActive]}>
                  <Text style={[styles.matterChipText, noteMatterId === m.id && styles.matterChipTextActive]} numberOfLines={1}>{m.matter_ref}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>NOTE (INTERNAL — NOT VISIBLE TO CLIENT)</Text>
          <TextInput
            style={[styles.input, { height: 110, textAlignVertical: 'top', paddingTop: 12 }]}
            value={noteText} onChangeText={setNoteText}
            placeholder="Key observations, next steps, strategy notes…"
            placeholderTextColor={colors.inkTertiary}
            multiline
          />

          <TouchableOpacity
            style={[styles.saveBtn, (!noteMatterId || !noteText.trim() || savingNote) && { opacity: 0.5 }]}
            onPress={saveNote} disabled={!noteMatterId || !noteText.trim() || savingNote}>
            {savingNote ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Note</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <View style={[styles.statCard, alert && styles.statCardAlert]}>
      <Text style={[styles.statValue, alert && styles.statValueAlert]}>{value}</Text>
      <Text style={[styles.statLabel, alert && styles.statLabelAlert]}>{label}</Text>
    </View>
  );
}

function tod() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}
function isUrgent(iso: string) {
  return (new Date(iso).getTime() - Date.now()) < 3 * 86400000;
}
function eventColor(type: string) {
  if (type === 'hearing') return colors.amber;
  if (type === 'meeting') return colors.burgundy;
  if (type === 'deadline') return colors.red;
  return colors.inkTertiary;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  greeting: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 22, color: colors.ink },
  date: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2 },
  logoMark: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.cream },
  headerBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: colors.burgundy, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifBadgeText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 9, color: colors.cream },

  statsRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 16 },
  statCard: { width: 120, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 14 },
  statCardAlert: { backgroundColor: colors.redBg, borderColor: colors.red },
  statValue: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 28, color: colors.ink },
  statValueAlert: { color: colors.red },
  statLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.inkMuted, letterSpacing: 1, marginTop: 4 },
  statLabelAlert: { color: colors.red },

  slaCard: { marginHorizontal: 20, backgroundColor: colors.redBg, borderRadius: 16, borderWidth: 1.5, borderColor: '#ECCDC8', padding: 16, marginBottom: 14 },
  slaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  slaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  slaTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, color: colors.red, letterSpacing: 1.5 },
  slaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  slaRowBorder: { borderTopWidth: 1, borderTopColor: '#ECCDC8' },
  slaAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  slaAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, color: colors.burgundy },
  slaInfo: { flex: 1 },
  slaClient: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink },
  slaMatter: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  slaMsg: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  slaElapsed: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.amber, marginTop: 3 },
  slaElapsedBreach: { color: colors.red },
  slaActions: { gap: 6 },
  replyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.burgundy },
  replyBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: '#fff' },
  escalateBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.red },
  escalateBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.red },
  escalatedBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.amberBg },
  escalatedText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.amber },

  card: { marginHorizontal: 20, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, marginBottom: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  docRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  docAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  docAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: colors.burgundy },
  docInfo: { flex: 1 },
  docName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink },
  docClient: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 1 },
  dueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.amberBg },
  dueBadgeUrgent: { backgroundColor: colors.redBg },
  dueBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.amber },
  dueBadgeTextUrgent: { color: colors.red },

  eventRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  eventBar: { width: 3, borderRadius: 999, minHeight: 44 },
  eventInfo: { flex: 1 },
  eventTime: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkMuted },
  eventTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  eventLoc: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },

  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.roseTint, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.roseBg },
  quickBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.burgundy },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, marginBottom: 20 },
  fieldLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cream, paddingHorizontal: 14, fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, marginBottom: 16 },
  matterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  matterChipActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  matterChipText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.inkSecondary },
  matterChipTextActive: { color: '#fff' },
  saveBtn: { height: 54, borderRadius: 14, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
  mutedSmall: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginBottom: 16 },
});
