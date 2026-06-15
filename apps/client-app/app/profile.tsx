import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { colors } from '../lib/colors';
import Svg, { Path, Circle } from 'react-native-svg';

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const { profile, loadProfile } = useAuthStore();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(useCallback(() => {
    setName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]));

  async function save() {
    if (!profile || !name.trim()) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', profile.id);
    await loadProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function initials(n: string) { return n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile?.full_name ?? '??')}</Text>
          </View>
          <Text style={styles.avatarName}>{profile?.full_name}</Text>
          <Text style={styles.avatarEmail}>{profile?.email}</Text>
        </View>

        {/* Edit details */}
        <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.inkTertiary}
            />
          </View>
          <View style={[styles.fieldRow, styles.border]}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.fieldInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+92 300 1234567"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="phone-pad"
            />
          </View>
          <View style={[styles.fieldRow, styles.border]}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={[styles.fieldInput, { color: colors.inkSecondary }]} numberOfLines={1}>{profile?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (saving || saved) && styles.saveBtnSaved]}
          onPress={save}
          disabled={saving || saved}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save Changes'}</Text>}
        </TouchableOpacity>

        {/* Security */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SECURITY</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={async () => {
            if (!profile?.email) return;
            await supabase.auth.resetPasswordForEmail(profile.email);
            Alert.alert('Password reset', 'A reset link has been sent to your email.');
          }}>
            <View style={styles.menuIcon}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Change Password</Text>
              <Text style={styles.menuSub}>Send reset link to your email</Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Help */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>HELP</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/support')}>
            <View style={[styles.menuIcon, { backgroundColor: colors.greenBg }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="10" />
                <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Support & FAQ</Text>
              <Text style={styles.menuSub}>Get help or contact the firm</Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} disabled={signingOut}>
          {signingOut ? (
            <ActivityIndicator color={colors.red} size="small" />
          ) : (
            <>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </Svg>
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 20, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 28, color: colors.burgundy },
  avatarName: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 20, color: colors.ink, marginBottom: 4 },
  avatarEmail: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary },

  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },

  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.inkSecondary, width: 80, flexShrink: 0 },
  fieldInput: { flex: 1, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink },

  saveBtn: { backgroundColor: colors.burgundy, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveBtnSaved: { backgroundColor: colors.green },
  saveBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },

  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.roseBg, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  menuSub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 1 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, backgroundColor: colors.redBg, borderWidth: 1, borderColor: '#ECCDC8', borderRadius: 12, height: 48 },
  signOutText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.red },
});
