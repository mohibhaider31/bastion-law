import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors, STAGE_ORDER, STAGE_LABELS } from '../../lib/colors';
import Svg, { Path } from 'react-native-svg';

interface MatterRow {
  id: string;
  matter_ref: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  cause_no: string | null;
  court: string | null;
  lead_lawyer: { full_name: string } | null;
  open_actions: number;
}

export default function CasesScreen() {
  const { profile } = useAuthStore();
  const [matters, setMatters] = useState<MatterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('matters')
      .select('id, matter_ref, title, type, stage, status, cause_no, court, lead_lawyer:profiles!lead_lawyer_id(full_name)')
      .eq('client_id', profile.id)
      .order('opened_at', { ascending: false });

    const rows = (data ?? []) as unknown as MatterRow[];

    // Pull open action counts per matter in one query
    const ids = rows.map((m) => m.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('matter_id')
        .eq('client_id', profile.id)
        .eq('assigned_to', 'client')
        .eq('status', 'pending')
        .in('matter_id', ids);
      (tasks ?? []).forEach((t: any) => {
        if (t.matter_id) counts[t.matter_id] = (counts[t.matter_id] ?? 0) + 1;
      });
    }
    rows.forEach((m) => { m.open_actions = counts[m.id] ?? 0; });

    setMatters(rows);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  // Refresh counts/stages when returning from a case detail
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.burgundy} />
      </SafeAreaView>
    );
  }

  const active = matters.filter((m) => m.status !== 'closed');
  const past = matters.filter((m) => m.status === 'closed');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Cases</Text>
        <Text style={styles.subtitle}>{active.length} active · {past.length} closed</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {matters.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No cases yet. Your lawyer will add your matter shortly.</Text>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ACTIVE</Text>
            {active.map((m) => <CaseCard key={m.id} matter={m} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>CLOSED</Text>
            {past.map((m) => <CaseCard key={m.id} matter={m} closed />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CaseCard({ matter, closed }: { matter: MatterRow; closed?: boolean }) {
  const stageIndex = STAGE_ORDER.indexOf(matter.stage);
  const progress = stageIndex >= 0 ? (stageIndex + 1) / STAGE_ORDER.length : 0;
  return (
    <TouchableOpacity
      style={[styles.card, closed && styles.cardClosed]}
      activeOpacity={0.9}
      onPress={() => router.push(`/case/${matter.id}`)}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardRef}>{matter.matter_ref}</Text>
        <View style={[styles.stagePill, closed && styles.stagePillClosed]}>
          <Text style={[styles.stagePillText, closed && styles.stagePillTextClosed]}>
            {closed ? 'CLOSED' : (STAGE_LABELS[matter.stage] ?? matter.stage).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{matter.title}</Text>
      {matter.cause_no && <Text style={styles.cardCause}>Cause No. {matter.cause_no}</Text>}

      {/* Lawyer */}
      <View style={styles.lawyerRow}>
        <View style={[styles.lawyerAvatar, !matter.lead_lawyer && styles.lawyerAvatarTba]}>
          <Text style={styles.lawyerAvatarText}>{matter.lead_lawyer ? initials(matter.lead_lawyer.full_name) : '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.lawyerLabel}>LEAD LAWYER</Text>
          <Text style={[styles.lawyerName, !matter.lead_lawyer && styles.lawyerNameTba]}>
            {matter.lead_lawyer?.full_name ?? 'Lawyer TBA'}
          </Text>
        </View>
        {matter.open_actions > 0 && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{matter.open_actions} to do</Text>
          </View>
        )}
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 18l6-6-6-6" />
        </Svg>
      </View>

      {!closed && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function initials(name?: string | null) {
  if (!name) return '··';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  subtitle: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkSecondary, textAlign: 'center', lineHeight: 22 },

  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  cardClosed: { backgroundColor: colors.cream, borderColor: colors.borderLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardRef: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5 },
  stagePill: { backgroundColor: colors.roseTint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stagePillClosed: { backgroundColor: colors.borderLight },
  stagePillText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: colors.burgundy, letterSpacing: 1 },
  stagePillTextClosed: { color: colors.inkTertiary },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 17, color: colors.ink, lineHeight: 23, marginBottom: 4 },
  cardCause: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginBottom: 12 },

  lawyerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  lawyerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  lawyerAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.burgundy },
  lawyerLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 8, color: colors.inkMuted, letterSpacing: 1.2 },
  lawyerName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  lawyerAvatarTba: { backgroundColor: '#F6ECD8' },
  lawyerNameTba: { color: '#9A6B1E' },
  actionBadge: { backgroundColor: colors.amberBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  actionBadgeText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.amber },

  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.borderLight, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brass },
});
