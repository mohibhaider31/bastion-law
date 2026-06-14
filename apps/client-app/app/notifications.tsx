import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { colors } from '../lib/colors';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default function NotificationsScreen() {
  const { profile } = useAuthStore();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, read_at, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setNotifs(data);
    // Mark all as read
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', profile.id).is('read_at', null);
    setLoading(false); setRefreshing(false);
  }

  const newNotifs = notifs.filter((n) => !n.read_at || new Date(n.created_at) > new Date(Date.now() - 3600000));
  const earlier = notifs.filter((n) => !newNotifs.includes(n));

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {newNotifs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>NEW</Text>
            {newNotifs.map((n) => <NotifRow key={n.id} notif={n} isNew />)}
          </>
        )}
        {earlier.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EARLIER</Text>
            {earlier.map((n) => <NotifRow key={n.id} notif={n} />)}
          </>
        )}
        {notifs.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotifRow({ notif, isNew }: { notif: Notification; isNew?: boolean }) {
  const { bg } = notifStyle(notif.type);
  return (
    <View style={[styles.notifRow, isNew && styles.notifRowNew]}>
      <View style={[styles.notifIcon, { backgroundColor: bg }]}>
        <NotifIcon type={notif.type} />
      </View>
      <View style={styles.notifContent}>
        <Text style={styles.notifTitle}>{notif.title}</Text>
        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.notifTime}>{relTime(notif.created_at)}</Text>
      </View>
    </View>
  );
}

function NotifIcon({ type }: { type: string }) {
  const stroke = notifStyle(type).stroke;
  if (type === 'document_requested' || type === 'invoice_sent') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" />
      </Svg>
    );
  }
  if (type === 'hearing_reminder' || type === 'appointment_confirmed' || type === 'appointment_cancelled') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Rect x="3" y="4" width="18" height="18" rx="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" />
      </Svg>
    );
  }
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" /><Line x1="12" y1="8" x2="12" y2="12" /><Line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

function notifStyle(type: string) {
  if (type === 'document_requested') return { bg: colors.amberBg, stroke: colors.amber };
  if (type === 'hearing_reminder') return { bg: colors.amberBg, stroke: colors.amber };
  if (type === 'appointment_confirmed') return { bg: colors.greenBg, stroke: colors.green };
  if (type === 'appointment_cancelled') return { bg: colors.redBg, stroke: colors.red };
  if (type === 'sla_breach') return { bg: colors.redBg, stroke: colors.red };
  return { bg: colors.roseTint, stroke: colors.burgundy };
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 20, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },
  notifRow: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  notifRowNew: { backgroundColor: colors.roseBg, borderColor: colors.roseTint },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, marginBottom: 3 },
  notifBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkSecondary },
});
