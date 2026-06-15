import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors, STAGE_ORDER } from '../../lib/colors';
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg';

interface Matter {
  id: string;
  matter_ref: string;
  title: string;
  stage: string;
  status: string;
  cause_no: string | null;
  lead_lawyer: { full_name: string } | null;
}

interface Document {
  id: string;
  name: string;
  due_date: string | null;
  requires_esign: boolean;
}

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender: { full_name: string };
}

interface Notification {
  id: string;
  read_at: string | null;
}

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [pendingDocs, setPendingDocs] = useState<Document[]>([]);
  const [latestMessage, setLatestMessage] = useState<(Message & { matter_title: string }) | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    if (!profile) return;
    const [mattersRes, docsRes, msgsRes, notifsRes] = await Promise.all([
      supabase.from('matters').select('id, matter_ref, title, stage, status, cause_no, lead_lawyer:profiles!lead_lawyer_id(full_name)').eq('client_id', profile.id).eq('status', 'active').order('opened_at', { ascending: false }),
      supabase.from('documents').select('id, name, due_date, requires_esign, matter_id').in('status', ['requested']).order('due_date', { ascending: true }).limit(5),
      supabase.from('messages').select('id, body, created_at, sender:profiles!sender_id(full_name), matter_id').order('created_at', { ascending: false }).limit(1),
      supabase.from('notifications').select('id, read_at').eq('user_id', profile.id).is('read_at', null),
    ]);

    if (mattersRes.data) setMatters(mattersRes.data);
    if (docsRes.data) setPendingDocs(docsRes.data as Document[]);
    if (msgsRes.data?.[0]) {
      const msg = msgsRes.data[0] as any;
      if (msg.sender) {
        const matter = mattersRes.data?.find((m) => m.id === msg.matter_id);
        setLatestMessage({ ...msg, matter_title: matter?.title ?? '' });
      }
    }
    if (notifsRes.data) setUnreadCount(notifsRes.data.length);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchData(); }, [profile]);

  const primaryMatter = matters[0];
  const stageIndex = primaryMatter ? STAGE_ORDER.indexOf(primaryMatter.stage) : -1;
  const stageProgress = stageIndex >= 0 ? (stageIndex + 1) / STAGE_ORDER.length : 0;

  function formatRelativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.burgundy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.burgundy} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoLetter}>B</Text>
            </View>
            <Text style={styles.logoWord}>BASTION</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
              <View style={styles.bellWrap}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </Svg>
                {unreadCount > 0 && <View style={styles.bellBadge} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/profile')}>
              <Text style={styles.avatarBtnText}>{profile?.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2) ?? '?'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>
          Good {getTimeOfDay()},{'\n'}{profile?.full_name.split(' ')[0]}.
        </Text>

        {/* Hero case card */}
        {primaryMatter ? (
          <TouchableOpacity
            style={styles.heroCard}
            onPress={() => router.push(`/case/${primaryMatter.id}`)}
            activeOpacity={0.92}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroRef}>{primaryMatter.matter_ref}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{primaryMatter.stage.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{primaryMatter.title}</Text>
            {primaryMatter.cause_no && (
              <Text style={styles.heroCause}>Cause No. {primaryMatter.cause_no}</Text>
            )}
            <View style={styles.heroLawyerRow}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(246,241,234,0.5)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
              </Svg>
              <Text style={[styles.heroLawyerText, !primaryMatter.lead_lawyer && styles.heroLawyerTba]}>
                {primaryMatter.lead_lawyer ? primaryMatter.lead_lawyer.full_name : 'Lawyer being assigned…'}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressRow}>
              {STAGE_ORDER.slice(0, -1).map((stage, i) => {
                const filled = i < stageIndex;
                const active = i === stageIndex;
                return (
                  <View
                    key={stage}
                    style={[
                      styles.progressSeg,
                      i > 0 && { marginLeft: 3 },
                      filled && styles.progressFilled,
                      active && styles.progressActive,
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.stageRow}>
              <Text style={styles.stageCurrent}>
                {STAGE_ORDER[stageIndex]?.toUpperCase() ?? ''}
              </Text>
              <Text style={styles.stageNext}>
                {STAGE_ORDER[stageIndex + 1]?.toUpperCase() ?? 'COMPLETE'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.noMatterCard}>
            <Text style={styles.noMatterText}>No active matters. Your lawyer will add your case shortly.</Text>
          </View>
        )}

        {/* Action needed */}
        {pendingDocs.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{pendingDocs.length}</Text>
              </View>
              <Text style={styles.cardTitle}>Action needed</Text>
            </View>
            {pendingDocs.map((doc, idx) => (
              <View key={doc.id} style={[styles.docRow, idx > 0 && styles.docRowBorder]}>
                <View style={styles.docIcon}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <Path d="M14 2v6h6" />
                  </Svg>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  {doc.due_date && (
                    <Text style={styles.docDue}>Due {formatDate(doc.due_date)}</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => router.push('/(tabs)/documents')}>
                  <Text style={styles.uploadBtnText}>{doc.requires_esign ? 'Sign' : 'Upload'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Latest update */}
        {latestMessage && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>LATEST UPDATE</Text>
            <View style={styles.updateRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>
                  {latestMessage.sender.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View style={styles.updateMeta}>
                <Text style={styles.updateName}>{latestMessage.sender.full_name}</Text>
                <Text style={styles.updateTime}>{formatRelativeTime(latestMessage.created_at)}</Text>
              </View>
            </View>
            <Text style={styles.updateBody} numberOfLines={3}>{latestMessage.body}</Text>
            {primaryMatter && (
              <TouchableOpacity onPress={() => router.push(`/case/${primaryMatter.id}`)}>
                <Text style={styles.updateLink}>Open case →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.cream },
  logoWord: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink, letterSpacing: 2 },
  headerIcons: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  bellWrap: { position: 'relative' },
  bellBadge: { position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brassLight, borderWidth: 1.5, borderColor: colors.cream },
  greeting: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink, paddingHorizontal: 20, marginTop: 8, marginBottom: 20, lineHeight: 32 },

  // Hero card
  heroCard: { marginHorizontal: 20, borderRadius: 22, backgroundColor: colors.burgundy, padding: 20, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroRef: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: 'rgba(246,241,234,0.7)', letterSpacing: 1.5 },
  statusPill: { backgroundColor: 'rgba(246,241,234,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(246,241,234,0.22)' },
  statusPillText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.cream, letterSpacing: 1.2 },
  heroTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.cream, lineHeight: 24, marginBottom: 6 },
  heroCause: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: 'rgba(246,241,234,0.6)', marginBottom: 8 },
  heroLawyerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  heroLawyerText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: 'rgba(246,241,234,0.7)' },
  heroLawyerTba: { color: 'rgba(246,241,234,0.4)', fontStyle: 'italic' },
  progressRow: { flexDirection: 'row', marginBottom: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(246,241,234,0.18)' },
  progressFilled: { backgroundColor: colors.brassLight },
  progressActive: { backgroundColor: colors.brass },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stageCurrent: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.brassLight, letterSpacing: 1 },
  stageNext: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 10, color: 'rgba(246,241,234,0.5)', letterSpacing: 1 },
  noMatterCard: { marginHorizontal: 20, borderRadius: 16, backgroundColor: colors.card, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  noMatterText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, lineHeight: 20 },

  // Cards
  card: { marginHorizontal: 20, borderRadius: 16, backgroundColor: colors.card, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  actionBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  actionBadgeText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, color: '#fff' },

  // Doc rows
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  docRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  docIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1 },
  docName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  docDue: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.amber, marginTop: 2 },
  uploadBtn: { backgroundColor: colors.burgundy, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  uploadBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: '#fff' },

  // Latest update
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 12 },
  updateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.burgundy },
  updateMeta: { flex: 1 },
  updateName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  updateTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkTertiary, marginTop: 1 },
  updateBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, lineHeight: 20, marginBottom: 10 },
  updateLink: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.burgundy },
  avatarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  avatarBtnText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.burgundy },
});
