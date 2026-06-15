import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { colors } from '../lib/colors';
import Svg, { Path } from 'react-native-svg';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  matter_id: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  case_update:  colors.burgundy,
  invoice_sent: colors.amber,
  document:     colors.brass,
  appointment:  colors.green,
};

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}

export default function NotificationsScreen() {
  const { profile } = useAuthStore();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read_at, created_at, matter_id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifs(data as Notif[]);
    setLoading(false);
    setRefreshing(false);
    // Mark all as read
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', profile.id).is('read_at', null);
  }, [profile]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unread = notifs.filter((n) => !n.read_at);
  const read = notifs.filter((n) => n.read_at);

  function handlePress(n: Notif) {
    if (n.matter_id) router.push(`/matter/${n.matter_id}`);
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.burgundy} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
        >
          {notifs.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          )}

          {unread.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>NEW</Text>
              {unread.map((n) => <NotifCard key={n.id} notif={n} onPress={() => handlePress(n)} />)}
            </>
          )}

          {read.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, unread.length > 0 && { marginTop: 20 }]}>EARLIER</Text>
              {read.map((n) => <NotifCard key={n.id} notif={n} onPress={() => handlePress(n)} dimmed />)}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotifCard({ notif, onPress, dimmed }: { notif: Notif; onPress: () => void; dimmed?: boolean }) {
  const dotColor = TYPE_COLORS[notif.type] ?? colors.inkTertiary;
  return (
    <TouchableOpacity
      style={[styles.card, dimmed && styles.cardDimmed]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, dimmed && styles.cardTitleDimmed]}>{notif.title}</Text>
        <Text style={styles.cardBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.cardTime}>{relTime(notif.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 20, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  cardDimmed: { opacity: 0.6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  cardContent: { flex: 1 },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, marginBottom: 2 },
  cardTitleDimmed: { fontFamily: 'HankenGrotesk_500Medium' },
  cardBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 18 },
  cardTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 6 },
  empty: { paddingTop: 80, alignItems: 'center' },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkMuted },
});
