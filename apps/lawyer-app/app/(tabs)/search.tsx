import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';

interface SearchResult {
  result_type: string;
  id: string;
  matter_id: string;
  matter_ref: string;
  title: string;
  snippet: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  message: colors.burgundy,
  document: colors.brass,
  task: colors.amber,
};

const TYPE_LABELS: Record<string, string> = {
  message: 'Message',
  document: 'Document',
  task: 'Action',
};

export default function SearchScreen() {
  const { profile } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doSearch(q: string) {
    if (!q.trim() || !profile) return;
    setLoading(true);
    setSearched(true);
    const { data } = await supabase.rpc('search_matter_content', {
      p_query: q.trim(),
      p_user_id: profile.id,
      p_role: 'lawyer',
    });
    setResults((data as SearchResult[]) ?? []);
    setLoading(false);
  }

  function handleNav(r: SearchResult) {
    if (!r.matter_id) return;
    router.push(`/matter/${r.matter_id}`);
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Search</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages, documents, actions…"
            placeholderTextColor={colors.inkTertiary}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.burgundy} style={{ marginTop: 40 }} />}

      {!loading && searched && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(r) => r.result_type + r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: r }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleNav(r)} activeOpacity={0.75}>
            <View style={styles.cardTop}>
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[r.result_type] ?? colors.inkTertiary }]}>
                <Text style={styles.typeBadgeText}>{TYPE_LABELS[r.result_type] ?? r.result_type}</Text>
              </View>
              <Text style={styles.matterRef}>{r.matter_ref}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
            {r.snippet ? <Text style={styles.snippet} numberOfLines={2}>{r.snippet}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  heading: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 24, color: colors.ink, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.ink },
  clearBtn: { fontSize: 16, color: colors.inkTertiary, paddingLeft: 8 },
  list: { padding: 20, paddingTop: 8 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: '#fff', letterSpacing: 0.8 },
  matterRef: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkTertiary },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, marginBottom: 4 },
  snippet: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, lineHeight: 18 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkTertiary },
});
