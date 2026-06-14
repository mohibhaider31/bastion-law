import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';

interface Matter {
  id: string;
  matter_ref: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  client: { full_name: string };
  events: { event_date: string }[];
}

const COLUMNS = [
  { key: 'intake',         label: 'Intake',        color: colors.inkTertiary },
  { key: 'documentation', label: 'Documentation',  color: colors.inkTertiary },
  { key: 'filing',        label: 'Filing',         color: colors.inkTertiary },
  { key: 'hearing',       label: 'In Progress',    color: colors.burgundy    },
  { key: 'judgment',      label: 'Judgment',       color: colors.green       },
];

export default function BoardScreen() {
  const { profile } = useAuthStore();
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('matters')
      .select('id, matter_ref, title, type, stage, status, client:profiles!client_id(full_name), events(event_date)')
      .eq('lead_lawyer_id', profile.id)
      .neq('status', 'closed')
      .order('opened_at', { ascending: false });
    if (data) setMatters(data as unknown as Matter[]);
    setLoading(false); setRefreshing(false);
  }

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Work Board</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {COLUMNS.map((col) => {
          const colMatters = matters.filter((m) => m.stage === col.key);
          return (
            <View key={col.key} style={styles.column}>
              <View style={styles.colHeader}>
                <Text style={[styles.colLabel, { color: col.color }]}>{col.label.toUpperCase()}</Text>
                <View style={[styles.colBadge, { backgroundColor: col.color === colors.burgundy ? colors.roseTint : col.color === colors.green ? colors.greenBg : colors.borderLight }]}>
                  <Text style={[styles.colBadgeText, { color: col.color }]}>{colMatters.length}</Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {colMatters.map((m) => <MatterCard key={m.id} matter={m} />)}
                {colMatters.length === 0 && <View style={styles.emptyCol}><Text style={styles.emptyColText}>—</Text></View>}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function MatterCard({ matter }: { matter: Matter }) {
  const nextEvent = matter.events.sort((a, b) => a.event_date.localeCompare(b.event_date)).find((e) => e.event_date >= new Date().toISOString().split('T')[0]);
  const daysUntil = nextEvent ? Math.ceil((new Date(nextEvent.event_date).getTime() - Date.now()) / 86400000) : null;
  const priority = daysUntil !== null && daysUntil <= 3 ? 'high' : daysUntil !== null && daysUntil <= 14 ? 'medium' : 'normal';
  const borderColor = priority === 'high' ? colors.red : priority === 'medium' ? colors.amber : colors.border;

  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: borderColor }]} onPress={() => router.push(`/matter/${matter.id}`)} activeOpacity={0.85}>
      <Text style={styles.cardRef}>{matter.matter_ref}</Text>
      <Text style={styles.cardTitle} numberOfLines={2}>{matter.title}</Text>
      <View style={styles.cardMeta}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>{matter.client.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</Text>
        </View>
        <Text style={styles.clientName} numberOfLines={1}>{matter.client.full_name}</Text>
      </View>
      {nextEvent && (
        <View style={[styles.dueBadge, priority === 'high' && styles.dueBadgeHigh, priority === 'medium' && styles.dueBadgeMed]}>
          <Text style={[styles.dueBadgeText, priority === 'high' && styles.dueBadgeTextHigh, priority === 'medium' && styles.dueBadgeTextMed]}>
            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E7E5E1' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  board: { paddingHorizontal: 16, paddingBottom: 40, gap: 10, alignItems: 'flex-start' },
  column: { width: 230, backgroundColor: colors.card, borderRadius: 16, padding: 12, maxHeight: 620 },
  colHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  colLabel: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, letterSpacing: 1.2 },
  colBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  colBadgeText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11 },
  emptyCol: { paddingVertical: 20, alignItems: 'center' },
  emptyColText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 20, color: colors.borderLight },
  card: { backgroundColor: colors.card, borderRadius: 13, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, padding: 12, marginBottom: 8 },
  cardRef: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkTertiary, letterSpacing: 1, marginBottom: 4 },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink, lineHeight: 18, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  clientAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  clientAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 8, color: colors.burgundy },
  clientName: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, flex: 1 },
  dueBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.borderLight, alignSelf: 'flex-start' },
  dueBadgeHigh: { backgroundColor: colors.redBg },
  dueBadgeMed: { backgroundColor: colors.amberBg },
  dueBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkSecondary },
  dueBadgeTextHigh: { color: colors.red },
  dueBadgeTextMed: { color: colors.amber },
});
