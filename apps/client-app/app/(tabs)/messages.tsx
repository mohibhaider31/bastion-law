import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import Svg, { Path } from 'react-native-svg';

interface Convo {
  key: string;
  kind: 'firm' | 'case';
  matterId?: string;
  title: string;
  subtitle: string;
  preview: string;
  lastAt: string | null;
  unread: number;
}

export default function MessagesScreen() {
  const { profile } = useAuthStore();
  const [firm, setFirm] = useState<Convo | null>(null);
  const [cases, setCases] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data: matters } = await supabase
      .from('matters')
      .select('id, title, matter_ref, lead_lawyer:profiles!lead_lawyer_id(full_name)')
      .eq('client_id', profile.id)
      .order('opened_at', { ascending: false });
    const matterRows = (matters ?? []) as any[];
    const matterIds = matterRows.map((m) => m.id);

    const [caseMsgRes, firmMsgRes] = await Promise.all([
      matterIds.length
        ? supabase.from('messages').select('id, matter_id, body, attachment_name, created_at, sender_id, read_at').in('matter_id', matterIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('messages').select('id, body, attachment_name, created_at, sender_id, read_at').is('matter_id', null).eq('client_id', profile.id).order('created_at', { ascending: false }),
    ]);

    // Firm conversation
    const firmMsgs = (firmMsgRes.data ?? []) as any[];
    const firmLast = firmMsgs[0];
    setFirm({
      key: 'firm', kind: 'firm', title: 'Bastion Law', subtitle: 'Firm · direct line',
      preview: firmLast ? preview(firmLast) : 'Reach out to the firm directly',
      lastAt: firmLast?.created_at ?? null,
      unread: firmMsgs.filter((m) => m.sender_id !== profile.id && !m.read_at).length,
    });

    // Case conversations
    const caseMsgs = (caseMsgRes.data ?? []) as any[];
    const byMatter: Record<string, any[]> = {};
    caseMsgs.forEach((m) => { (byMatter[m.matter_id] ??= []).push(m); });
    const caseConvos: Convo[] = matterRows.map((m) => {
      const msgs = byMatter[m.id] ?? [];
      const last = msgs[0];
      return {
        key: m.id, kind: 'case', matterId: m.id,
        title: m.lead_lawyer?.full_name ?? 'Your lawyer',
        subtitle: m.matter_ref,
        preview: last ? preview(last) : 'No messages yet',
        lastAt: last?.created_at ?? null,
        unread: msgs.filter((x) => x.sender_id !== profile.id && !x.read_at).length,
      };
    });
    // Sort by most recent activity
    caseConvos.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    setCases(caseConvos);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.burgundy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {/* Firm chat — pinned */}
        {firm && (
          <TouchableOpacity style={[styles.row, styles.firmRow]} activeOpacity={0.85} onPress={() => router.push('/firm-chat')}>
            <View style={[styles.avatar, styles.firmAvatar]}>
              <Text style={styles.firmAvatarText}>B</Text>
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{firm.title}</Text>
                {firm.lastAt && <Text style={styles.rowTime}>{relTime(firm.lastAt)}</Text>}
              </View>
              <Text style={styles.firmTag}>FIRM · DIRECT LINE</Text>
              <Text style={styles.rowPreview} numberOfLines={1}>{firm.preview}</Text>
            </View>
            {firm.unread > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{firm.unread}</Text></View>}
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>YOUR CASES</Text>
        {cases.length === 0 && <Text style={styles.muted}>No case conversations yet.</Text>}
        {cases.map((c) => (
          <TouchableOpacity key={c.key} style={styles.row} activeOpacity={0.85} onPress={() => router.push(`/case/${c.matterId}?seg=chat`)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(c.title)}</Text></View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{c.title}</Text>
                {c.lastAt && <Text style={styles.rowTime}>{relTime(c.lastAt)}</Text>}
              </View>
              <Text style={styles.rowSub}>{c.subtitle}</Text>
              <Text style={styles.rowPreview} numberOfLines={1}>{c.preview}</Text>
            </View>
            {c.unread > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{c.unread}</Text></View>}
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function preview(m: any) {
  if (m.body) return m.body;
  if (m.attachment_name) return `📎 ${m.attachment_name}`;
  return 'Attachment';
}
function initials(name?: string | null) { if (!name) return '··'; return name.split(' ').map((n) => n[0]).join('').slice(0, 2); }
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10, marginTop: 18 },
  muted: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  firmRow: { borderColor: colors.brassLight, borderWidth: 1.5, backgroundColor: '#FFFDF8' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.burgundy },
  firmAvatar: { backgroundColor: colors.burgundy },
  firmAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 20, color: colors.cream },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  rowTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  rowSub: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkMuted, letterSpacing: 0.5, marginTop: 1 },
  firmTag: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: colors.brass, letterSpacing: 1, marginTop: 1 },
  rowPreview: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 3 },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: '#fff' },
});
