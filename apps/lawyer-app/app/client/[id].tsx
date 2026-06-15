import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, STAGE_LABELS } from '../../lib/colors';
import Svg, { Path, Circle } from 'react-native-svg';

interface ClientProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cnic: string | null;
  address: string | null;
  created_at: string;
}

interface Matter {
  id: string;
  matter_ref: string;
  title: string;
  type: string;
  stage: string;
  status: string;
  created_at: string;
  court: string | null;
}

interface Doc {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  intake:        { bg: colors.borderLight, text: colors.inkMuted },
  documentation: { bg: colors.amberBg,    text: colors.amber },
  filing:        { bg: colors.amberBg,    text: colors.amber },
  hearing:       { bg: colors.roseTint,   text: colors.burgundy },
  judgment:      { bg: colors.greenBg,    text: colors.green },
  closed:        { bg: colors.borderLight, text: colors.inkTertiary },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [profileRes, mattersRes, docsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone, cnic, address, created_at').eq('id', id).single(),
      supabase.from('matters').select('id, matter_ref, title, type, stage, status, created_at, court').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('id, name, status, created_at').eq('client_id', id).order('created_at', { ascending: false }).limit(5),
    ]);
    if (profileRes.data) setClient(profileRes.data as ClientProfile);
    if (mattersRes.data) setMatters(mattersRes.data as Matter[]);
    if (docsRes.data) setDocs(docsRes.data as Doc[]);
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.burgundy} />
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.inkSecondary, fontFamily: 'HankenGrotesk_400Regular' }}>Client not found</Text>
      </SafeAreaView>
    );
  }

  const activeMatters = matters.filter((m) => m.status !== 'closed');
  const closedMatters = matters.filter((m) => m.status === 'closed');

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(client.full_name)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{client.full_name}</Text>
            <Text style={styles.meta}>Client since {fmtDate(client.created_at)}</Text>
          </View>
          <View style={styles.statsBadge}>
            <Text style={styles.statsBadgeNum}>{matters.length}</Text>
            <Text style={styles.statsBadgeLabel}>matter{matters.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {client.email && (
            <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(`mailto:${client.email}`)}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <Path d="M22 6l-10 7L2 6" />
              </Svg>
              <Text style={styles.actionChipText}>Email</Text>
            </TouchableOpacity>
          )}
          {client.phone && (
            <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(`tel:${client.phone}`)}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.72A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </Svg>
              <Text style={styles.actionChipText}>Call</Text>
            </TouchableOpacity>
          )}
          {client.phone && (
            <TouchableOpacity style={styles.actionChip} onPress={() => Linking.openURL(`https://wa.me/${client.phone?.replace(/\D/g, '')}`)}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </Svg>
              <Text style={styles.actionChipText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTACT DETAILS</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Email" value={client.email} />
            {client.phone && <InfoRow label="Phone" value={client.phone} divider />}
            {client.cnic && <InfoRow label="CNIC" value={client.cnic} divider />}
            {client.address && <InfoRow label="Address" value={client.address} divider />}
          </View>
        </View>

        {/* Active matters */}
        {activeMatters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE MATTERS</Text>
            {activeMatters.map((m) => (
              <MatterCard key={m.id} matter={m} onPress={() => router.push(`/matter/${m.id}`)} />
            ))}
          </View>
        )}

        {/* Closed matters */}
        {closedMatters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CLOSED MATTERS</Text>
            {closedMatters.map((m) => (
              <MatterCard key={m.id} matter={m} onPress={() => router.push(`/matter/${m.id}`)} />
            ))}
          </View>
        )}

        {matters.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MATTERS</Text>
            <View style={[styles.infoCard, { alignItems: 'center', paddingVertical: 24 }]}>
              <Text style={styles.emptyText}>No matters yet</Text>
            </View>
          </View>
        )}

        {/* Recent documents */}
        {docs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT DOCUMENTS</Text>
            <View style={styles.infoCard}>
              {docs.map((d, i) => (
                <View key={d.id} style={[styles.docRow, i > 0 && styles.docRowBorder]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.amber} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <Path d="M14 2v6h6" />
                  </Svg>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.docMeta}>{fmtDate(d.created_at)}</Text>
                  </View>
                  <View style={[styles.docStatus, d.status === 'approved' ? styles.docStatusGreen : d.status === 'rejected' ? styles.docStatusRed : styles.docStatusAmber]}>
                    <Text style={[styles.docStatusText, d.status === 'approved' ? { color: colors.green } : d.status === 'rejected' ? { color: colors.red } : { color: colors.amber }]}>
                      {d.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.infoRow, divider && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function MatterCard({ matter, onPress }: { matter: Matter; onPress: () => void }) {
  const stageColor = STAGE_COLORS[matter.stage] ?? { bg: colors.borderLight, text: colors.inkMuted };
  return (
    <TouchableOpacity style={styles.matterCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.matterCardLeft}>
        <Text style={styles.matterRef}>{matter.matter_ref}</Text>
        <Text style={styles.matterTitle} numberOfLines={2}>{matter.title}</Text>
        {matter.court && <Text style={styles.matterCourt}>{matter.court}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={[styles.stagePill, { backgroundColor: stageColor.bg }]}>
          <Text style={[styles.stagePillText, { color: stageColor.text }]}>{STAGE_LABELS[matter.stage] ?? matter.stage}</Text>
        </View>
        <Text style={styles.matterDate}>{fmtDate(matter.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 20, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 20, color: colors.burgundy },
  profileInfo: { flex: 1 },
  name: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.ink, marginBottom: 2 },
  meta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  statsBadge: { alignItems: 'center', backgroundColor: colors.roseBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  statsBadgeNum: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.burgundy },
  statsBadgeLabel: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 10, color: colors.inkSecondary },

  quickActions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.roseBg, borderRadius: 10, borderWidth: 1, borderColor: colors.roseTint, paddingVertical: 10 },
  actionChipText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.burgundy },

  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },

  infoCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  infoLabel: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, flexShrink: 0, marginRight: 8 },
  infoValue: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink, textAlign: 'right', flex: 1 },

  matterCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8 },
  matterCardLeft: { flex: 1 },
  matterRef: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.burgundy, letterSpacing: 0.5, marginBottom: 4 },
  matterTitle: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, lineHeight: 20, marginBottom: 4 },
  matterCourt: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  matterDate: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  stagePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stagePillText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, letterSpacing: 0.3 },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  docRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  docName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink },
  docMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 2 },
  docStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  docStatusGreen: { backgroundColor: colors.greenBg },
  docStatusRed: { backgroundColor: colors.redBg },
  docStatusAmber: { backgroundColor: colors.amberBg },
  docStatusText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, letterSpacing: 0.3, textTransform: 'capitalize' },

  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary },
});
