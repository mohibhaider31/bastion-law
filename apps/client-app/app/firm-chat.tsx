import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { colors } from '../lib/colors';
import { uploadToBucket } from '../lib/upload';
import Svg, { Path } from 'react-native-svg';

interface Message {
  id: string; body: string; created_at: string; sender_id: string;
  attachment_url: string | null; attachment_name: string | null; attachment_type: string | null;
  sender: { full_name: string } | null;
}

export default function FirmChatScreen() {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('messages')
      .select('id, body, created_at, sender_id, attachment_url, attachment_name, attachment_type, sender:profiles!sender_id(full_name)')
      .is('matter_id', null)
      .eq('client_id', profile.id)
      .order('created_at');
    if (data) setMessages(data as unknown as Message[]);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
    // Mark incoming as read
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .is('matter_id', null).eq('client_id', profile.id).neq('sender_id', profile.id).is('read_at', null);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`firm-chat-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${profile.id}` },
        (payload) => {
          if ((payload.new as any).matter_id) return; // ignore case messages
          supabase
            .from('messages')
            .select('id, body, created_at, sender_id, attachment_url, attachment_name, attachment_type, sender:profiles!sender_id(full_name)')
            .eq('id', (payload.new as any).id)
            .single()
            .then(({ data }) => {
              if (!data) return;
              setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data as unknown as Message]);
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
            });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function send() {
    if (!text.trim() || !profile || sending) return;
    setSending(true);
    const body = text.trim();
    setText('');
    await supabase.from('messages').insert({ matter_id: null, client_id: profile.id, sender_id: profile.id, body });
    setSending(false);
  }

  async function attach() {
    if (!profile || attaching) return;
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAttaching(true);
    const path = `chat/firm/${profile.id}/${Date.now()}_${asset.name}`;
    const up = await uploadToBucket({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' }, path);
    if (up) {
      await supabase.from('messages').insert({
        matter_id: null, client_id: profile.id, sender_id: profile.id, body: '',
        attachment_url: up.url, attachment_name: asset.name, attachment_type: asset.mimeType ?? 'application/octet-stream', attachment_size_kb: up.sizeKb,
      });
    }
    setAttaching(false);
  }

  if (loading) {
    return <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={colors.burgundy} /></SafeAreaView>;
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M19 12H5M12 5l-7 7 7 7" /></Svg>
          </TouchableOpacity>
          <View style={styles.firmAvatar}><Text style={styles.firmAvatarText}>B</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>Bastion Law</Text>
            <Text style={styles.headerSub}>Firm · direct line</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === profile?.id;
            return (
              <View key={msg.id} style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
                {!isMe && <View style={styles.bubbleAvatar}><Text style={styles.bubbleAvatarText}>{initials(msg.sender?.full_name)}</Text></View>}
                <View style={[styles.bubble, isMe && styles.bubbleMe]}>
                  {!isMe && <Text style={styles.bubbleSender}>{msg.sender?.full_name ?? 'Bastion Law'}</Text>}
                  {msg.attachment_url && (
                    msg.attachment_type?.startsWith('image/')
                      ? <TouchableOpacity onPress={() => Linking.openURL(msg.attachment_url!)}><Image source={{ uri: msg.attachment_url }} style={styles.attachImage} /></TouchableOpacity>
                      : <TouchableOpacity style={styles.attachChip} onPress={() => Linking.openURL(msg.attachment_url!)}>
                          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={isMe ? colors.cream : colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Path d="M14 2v6h6" /></Svg>
                          <Text style={[styles.attachName, isMe && { color: colors.cream }]} numberOfLines={1}>{msg.attachment_name}</Text>
                        </TouchableOpacity>
                  )}
                  {!!msg.body && <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>}
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{fmtTime(msg.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn} onPress={attach} disabled={attaching}>
            {attaching ? <ActivityIndicator color={colors.inkSecondary} size="small" /> : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></Svg>
            )}
          </TouchableOpacity>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Message the firm…" placeholderTextColor={colors.inkTertiary} multiline maxLength={2000} />
          <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={send} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function initials(name?: string | null) { if (!name) return '··'; return name.split(' ').map((n) => n[0]).join('').slice(0, 2); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  firmAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  firmAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.cream },
  headerName: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.ink },
  headerSub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  bubbleRowMe: { flexDirection: 'row-reverse' },
  bubbleAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, color: colors.burgundy },
  bubble: { maxWidth: '78%', backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border, padding: 12 },
  bubbleMe: { backgroundColor: colors.burgundy, borderColor: colors.burgundy, borderBottomRightRadius: 5, borderBottomLeftRadius: 16 },
  bubbleSender: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12, color: colors.burgundy, marginBottom: 4 },
  bubbleText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 10, color: colors.inkTertiary, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMe: { color: 'rgba(246,241,234,0.6)' },
  attachImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
  attachChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4, maxWidth: 200 },
  attachName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.burgundy, flex: 1 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  attachBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
