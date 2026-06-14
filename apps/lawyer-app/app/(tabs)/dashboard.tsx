import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
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

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;

    // Get all matters for this lawyer
    const { data: myMatters } = await supabase
      .from('matters')
      .select('id, matter_ref, title, client_id, client:profiles!client_id(full_name)')
      .eq('lead_lawyer_id', profile.id)
      .eq('status', 'active');

    const matterIds = myMatters?.map((m) => m.id) ?? [];
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
    setLoading(false); setRefreshing(false);
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
          <TouchableOpacity style={styles.logoMark} onPress={() => router.push('/security')}>
            <Text style={styles.logoText}>B</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label="ACTIVE MATTERS" value={stats.activeMatters} />
          <StatCard label="PENDING DOCS" value={stats.pendingDocs} />
          <StatCard label="SLA ALERTS" value={slaQueue.length} alert={slaQueue.length > 0} />
          <StatCard label="TODAY'S EVENTS" value={stats.todayEvents} />
        </ScrollView>

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
});
