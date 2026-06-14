import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, TextInput, Linking, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import Svg, { Path, Circle } from 'react-native-svg';

interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  matter_count: number;
  last_message_at: string | null;
  matter_id: string | null;
}

export default function ClientsScreen() {
  const { profile } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const { data: matters } = await supabase
      .from('matters')
      .select('id, client_id, client:profiles!client_id(id, full_name, email, phone)')
      .eq('lead_lawyer_id', profile.id)
      .neq('status', 'closed');

    if (!matters) { setLoading(false); return; }

    // Deduplicate clients
    const clientMap = new Map<string, Client>();
    for (const m of matters) {
      const c = (m as any).client;
      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, { id: c.id, full_name: c.full_name, email: c.email, phone: c.phone, matter_count: 0, last_message_at: null, matter_id: m.id });
      }
      clientMap.get(c.id)!.matter_count++;
    }

    // Get last message per client matter
    for (const [clientId, client] of clientMap) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('created_at')
        .eq('matter_id', client.matter_id!)
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs?.[0]) client.last_message_at = msgs[0].created_at;
    }

    setClients(Array.from(clientMap.values()));
    setLoading(false); setRefreshing(false);
  }

  const filtered = clients.filter((c) =>
    search === '' || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <View style={styles.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="11" cy="11" r="8" /><Path d="M21 21l-4.35-4.35" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search clients…"
            placeholderTextColor={colors.inkTertiary}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {filtered.map((client) => (
          <TouchableOpacity key={client.id} style={styles.clientCard} onPress={() => client.matter_id && router.push(`/matter/${client.matter_id}`)} activeOpacity={0.85}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</Text>
            </View>
            <View style={styles.clientInfo}>
              <View style={styles.clientTopRow}>
                <Text style={styles.clientName}>{client.full_name}</Text>
                <View style={styles.mattersBadge}>
                  <Text style={styles.mattersBadgeText}>{client.matter_count} matter{client.matter_count !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              <Text style={styles.clientEmail}>{client.email}</Text>
              {client.phone && <Text style={styles.clientPhone}>{client.phone}</Text>}
              {client.last_message_at && (
                <Text style={styles.lastContact}>Last contact {relTime(client.last_message_at)}</Text>
              )}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => client.phone && Linking.openURL(`tel:${client.phone}`)}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.12 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
                </Svg>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => client.matter_id && router.push(`/matter/${client.matter_id}`)}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </Svg>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{search ? 'No clients match your search.' : 'No active clients.'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink, marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  clientCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.burgundy },
  clientInfo: { flex: 1 },
  clientTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  clientName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink, flex: 1 },
  mattersBadge: { backgroundColor: colors.roseTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  mattersBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.burgundy },
  clientEmail: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  clientPhone: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  lastContact: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary, marginTop: 4 },
  actions: { gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkSecondary },
});
