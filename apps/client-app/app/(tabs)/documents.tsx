import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Modal, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import Svg, { Path, Circle } from 'react-native-svg';

type FilterKey = 'all' | 'corporate' | 'contracts' | 'court' | 'identity';

interface Doc {
  id: string;
  name: string;
  category: string;
  status: 'requested' | 'uploading' | 'under_review' | 'verified' | 'rejected' | 'uploaded' | 'signed';
  due_date: string | null;
  requires_esign: boolean;
  matter_id: string;
  file_url: string | null;
  file_name: string | null;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'court', label: 'Court Filings' },
  { key: 'identity', label: 'Identity' },
];

export default function DocumentsScreen() {
  const { profile } = useAuthStore();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameraModal, setCameraModal] = useState<string | null>(null); // doc id
  const [uploading, setUploading] = useState<Record<string, number>>({});

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const { data: matters } = await supabase.from('matters').select('id').eq('client_id', profile.id).eq('status', 'active');
    if (!matters?.length) { setLoading(false); setRefreshing(false); return; }
    const matterIds = matters.map((m) => m.id);
    const { data } = await supabase.from('documents').select('id, name, category, status, due_date, requires_esign, matter_id, file_url, file_name').in('matter_id', matterIds).order('due_date', { ascending: true, nullsFirst: false });
    if (data) setDocs(data as Doc[]);
    setLoading(false); setRefreshing(false);
  }

  const filtered = filter === 'all' ? docs : docs.filter((d) => d.category === filter);
  const needsAction = filtered.filter((d) => d.status === 'requested');
  const rejected = filtered.filter((d) => d.status === 'rejected');
  const inReview = filtered.filter((d) => d.status === 'under_review' || d.status === 'uploading');
  const verified = filtered.filter((d) => d.status === 'verified' || d.status === 'uploaded' || d.status === 'signed');

  async function handleUpload(docId: string, source: 'camera' | 'library' | 'files') {
    setCameraModal(null);
    setUploading((prev) => ({ ...prev, [docId]: 0 }));
    try {
      let uri: string | null = null;
      let fileName = 'document.jpg';
      let mimeType = 'application/octet-stream';
      if (source === 'camera') {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (!result.canceled) { uri = result.assets[0].uri; fileName = `photo_${Date.now()}.jpg`; mimeType = result.assets[0].mimeType ?? 'image/jpeg'; }
      } else if (source === 'library') {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
        if (!result.canceled) { uri = result.assets[0].uri; fileName = `image_${Date.now()}.jpg`; mimeType = result.assets[0].mimeType ?? 'image/jpeg'; }
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
        if (!result.canceled) { uri = result.assets[0].uri; fileName = result.assets[0].name; mimeType = result.assets[0].mimeType ?? 'application/octet-stream'; }
      }
      if (!uri) { setUploading((prev) => { const n = { ...prev }; delete n[docId]; return n; }); return; }

      // Mark uploading
      await supabase.from('documents').update({ status: 'uploading', file_name: fileName }).eq('id', docId);
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'uploading' } : d));

      // Read the picked file into an ArrayBuffer. React Native's fetch().blob()
      // uploads 0-byte files to Supabase Storage, so use expo-file-system's File API.
      const bytes = await new File(uri).arrayBuffer();
      const path = `documents/${docId}/${fileName}`;
      const { error } = await supabase.storage.from('documents').upload(path, bytes, { upsert: true, contentType: mimeType });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
        await supabase.from('documents').update({ status: 'under_review', file_url: publicUrl, storage_path: path }).eq('id', docId);
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'under_review' } : d));
      } else {
        // Upload failed — revert so the document doesn't stay stuck on "uploading".
        await supabase.from('documents').update({ status: 'requested' }).eq('id', docId);
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'requested' } : d));
      }
    } catch (e) {
      await supabase.from('documents').update({ status: 'requested' }).eq('id', docId);
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'requested' } : d));
    } finally {
      setUploading((prev) => { const n = { ...prev }; delete n[docId]; return n; });
    }
  }

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {/* Needs action */}
        {needsAction.length > 0 && (
          <Section label="NEEDS YOUR ACTION" labelColor={colors.red}>
            {needsAction.map((doc) => (
              <DocRow key={doc.id} doc={doc} uploading={uploading[doc.id]} onUpload={() => setCameraModal(doc.id)} />
            ))}
          </Section>
        )}

        {/* Rejected — needs re-upload */}
        {rejected.length > 0 && (
          <Section label="NEEDS RESUBMISSION" labelColor={colors.red}>
            {rejected.map((doc) => (
              <DocRow key={doc.id} doc={doc} uploading={uploading[doc.id]} onUpload={() => setCameraModal(doc.id)} />
            ))}
          </Section>
        )}

        {/* Under review */}
        {inReview.length > 0 && (
          <Section label="UNDER REVIEW" labelColor={colors.amber}>
            {inReview.map((doc) => (
              <DocRow key={doc.id} doc={doc} uploading={uploading[doc.id]} />
            ))}
          </Section>
        )}

        {/* Verified */}
        {verified.length > 0 && (
          <Section label="VERIFIED" labelColor={colors.green}>
            {verified.map((doc) => (
              <DocRow key={doc.id} doc={doc} />
            ))}
          </Section>
        )}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No documents in this category.</Text>
          </View>
        )}

        {/* AI hint */}
        <View style={styles.aiHint}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.brass} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </Svg>
          <Text style={styles.aiHintText}>Not sure what's needed? Ask Bastion Assistant</Text>
        </View>
      </ScrollView>

      {/* Camera upload sheet */}
      <Modal visible={!!cameraModal} transparent animationType="slide" onRequestClose={() => setCameraModal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setCameraModal(null)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Upload Document</Text>
          {([
            { label: 'Take a photo', source: 'camera' as const, variant: 'primary' },
            { label: 'Choose from library', source: 'library' as const, variant: 'outline' },
            { label: 'Browse files', source: 'files' as const, variant: 'outline' },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.source}
              style={[styles.sheetBtn, opt.variant === 'primary' && styles.sheetBtnPrimary]}
              onPress={() => cameraModal && handleUpload(cameraModal, opt.source)}
            >
              <Text style={[styles.sheetBtnText, opt.variant === 'primary' && styles.sheetBtnTextPrimary]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setCameraModal(null)}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ label, labelColor, children }: { label: string; labelColor: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: labelColor }]}>{label}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

async function openDoc(url: string) {
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
}

function DocRow({ doc, uploading, onUpload }: { doc: Doc; uploading?: number; onUpload?: () => void }) {
  const isVerified = doc.status === 'verified' || doc.status === 'uploaded' || doc.status === 'signed';
  const isReview = doc.status === 'under_review' || doc.status === 'uploading';
  const isRejected = doc.status === 'rejected';
  return (
    <View style={styles.docRow}>
      <View style={[styles.docIcon, isVerified && styles.docIconGreen, isReview && styles.docIconAmber, isRejected && styles.docIconRed]}>
        {isVerified ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6L9 17l-5-5" />
          </Svg>
        ) : isRejected ? (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.red} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        ) : (
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={isReview ? colors.amber : colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" />
          </Svg>
        )}
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
        {doc.status === 'uploading' && uploading !== undefined && (
          <Text style={styles.docStatus}>Uploading…</Text>
        )}
        {doc.due_date && doc.status === 'requested' && (
          <Text style={styles.docDue}>Due {fmtDate(doc.due_date)}</Text>
        )}
        {isReview && doc.status !== 'uploading' && (
          <Text style={[styles.docStatus, { color: colors.amber }]}>Under review</Text>
        )}
        {isRejected && (
          <Text style={[styles.docStatus, { color: colors.red }]}>Needs correction — please re-upload</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {doc.file_url && (
          <TouchableOpacity style={styles.viewBtn} onPress={() => openDoc(doc.file_url!)}>
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>
        )}
        {(doc.status === 'requested' || isRejected) && onUpload && (
          <TouchableOpacity style={[styles.uploadBtn, isRejected && { backgroundColor: colors.redBg, borderColor: colors.red }]} onPress={onUpload}>
            <Text style={[styles.uploadBtnText, isRejected && { color: colors.red }]}>{doc.requires_esign ? 'Sign' : 'Upload'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  filtersRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  chipText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.inkSecondary },
  chipTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, letterSpacing: 1.5, marginBottom: 8 },
  sectionCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  docRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  docIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  docIconGreen: { backgroundColor: colors.greenBg },
  docIconAmber: { backgroundColor: colors.amberBg },
  docIconRed: { backgroundColor: colors.redBg },
  docInfo: { flex: 1 },
  docName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  docDue: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.amber, marginTop: 2 },
  docStatus: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkTertiary, marginTop: 2 },
  viewBtn: { backgroundColor: colors.borderLight, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  viewBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.inkSecondary },
  uploadBtn: { backgroundColor: colors.burgundy, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  uploadBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary },
  aiHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  aiHintText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 17, color: colors.ink, marginBottom: 20 },
  sheetBtn: { height: 54, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  sheetBtnPrimary: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  sheetBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  sheetBtnTextPrimary: { color: '#fff' },
  sheetCancel: { height: 54, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 15, color: colors.inkSecondary },
});
