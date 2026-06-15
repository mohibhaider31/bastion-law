'use client';
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';

interface Thread {
  matter_id: string;
  matter_ref: string;
  matter_title: string;
  client_name: string;
  last_body: string;
  last_at: string;
  unread: number;
}

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 1) return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen() {
  const { profile } = useAuthStore();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    // Get all matters this lawyer is on
    const { data: matters } = await supabase
      .from('matters')
      .select('id, matter_ref, title, client_id, client:profiles!client_id(full_name)')
      .eq('lead_lawyer_id', profile.id)
      .neq('status', 'archived');

    if (!matters?.length) { setLoading(false); setRefreshing(false); return; }

    const matterIds = matters.map((m) => m.id);

    // Get latest message + unread count per matter
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, matter_id, body, created_at, sender_id, read_at')
      .in('matter_id', matterIds)
      .order('created_at', { ascending: false });

    if (!msgs) { setLoading(false); setRefreshing(false); return; }

    const byMatter = new Map<string, typeof msgs>();
    for (const m of msgs) {
      if (!byMatter.has(m.matter_id)) byMatter.set(m.matter_id, []);
      byMatter.get(m.matter_id)!.push(m);
    }

    const threadList: Thread[] = matters
      .filter((m) => byMatter.has(m.id))
      .map((m) => {
        const mmsgs = byMatter.get(m.id)!;
        const last = mmsgs[0];
        const unread = mmsgs.filter((msg) => msg.sender_id !== profile.id && !msg.read_at).length;
        return {
          matter_id: m.id,
          matter_ref: m.matter_ref,
          matter_title: m.title,
          client_name: (m.client as any)?.full_name ?? 'Client',
          last_body: last.body ?? '(attachment)',
          last_at: last.created_at,
          unread,
        };
      })
      .sort((a, b) => b.last_at.localeCompare(a.last_at));

    setThreads(threadList);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages{totalUnread > 0 ? ` (${totalUnread})` : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.burgundy} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, threads.length === 0 && styles.emptyContent]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
        >
          {threads.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>Client conversations on your matters will appear here.</Text>
            </View>
          ) : (
            threads.map((t) => (
              <TouchableOpacity
                key={t.matter_id}
                style={[styles.row, t.unread > 0 && styles.rowUnread]}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/matter/[id]', params: { id: t.matter_id, tab: 'chat' } })}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {t.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.clientName, t.unread > 0 && styles.clientNameBold]} numberOfLines={1}>{t.client_name}</Text>
                    <Text style={styles.time}>{relTime(t.last_at)}</Text>
                  </View>
                  <Text style={styles.matterRef}>{t.matter_ref} · {t.matter_title}</Text>
                  <Text style={[styles.preview, t.unread > 0 && styles.previewBold]} numberOfLines={1}>{t.last_body}</Text>
                </View>
                {t.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t.unread > 9 ? '9+' : t.unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },
  emptyContent: { flex: 1 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.ink, marginBottom: 6 },
  emptyBody: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkTertiary, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, gap: 12 },
  rowUnread: { borderColor: colors.brassLight, backgroundColor: '#FFFDF9' },

  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.burgundy },

  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  clientName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, flex: 1 },
  clientNameBold: { fontFamily: 'HankenGrotesk_700Bold' },
  time: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginLeft: 8 },
  matterRef: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkMuted, marginBottom: 3 },
  preview: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary },
  previewBold: { fontFamily: 'HankenGrotesk_500Medium', color: colors.ink },

  badge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, color: '#fff' },
});
