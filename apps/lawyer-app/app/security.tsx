import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/colors';
import Svg, { Path, Circle } from 'react-native-svg';

interface Factor { id: string; friendly_name: string | null; status: string; }

export default function SecurityScreen() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }

  async function startEnroll() {
    setLoading(true); setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Bastion Law' });
    if (error || !data) { setMsg({ ok: false, text: error?.message ?? 'Failed' }); setLoading(false); return; }
    setQrCode(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
    setEnrollFactorId(data.id);
    setLoading(false);
  }

  async function verifyEnroll() {
    if (!enrollFactorId || verifyCode.length !== 6) return;
    setVerifying(true);
    const chRes = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
    if (chRes.error) { setMsg({ ok: false, text: chRes.error.message }); setVerifying(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrollFactorId, challengeId: chRes.data.id, code: verifyCode });
    if (error) { setMsg({ ok: false, text: error.message }); setVerifying(false); return; }
    setMsg({ ok: true, text: '2FA enabled. You\'ll be prompted for a code on next sign-in.' });
    setQrCode(null); setTotpSecret(null); setEnrollFactorId(null); setVerifyCode('');
    setVerifying(false);
    loadFactors();
  }

  async function unenroll(factorId: string) {
    Alert.alert('Remove 2FA', 'You will no longer need a code to sign in. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.auth.mfa.unenroll({ factorId });
        loadFactors();
      }},
    ]);
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Security</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>TWO-FACTOR AUTHENTICATION</Text>
        <Text style={styles.sub}>Add an extra layer of security to your account. After enabling, you'll need to enter a code from your authenticator app when signing in.</Text>

        {msg && (
          <View style={[styles.msgBox, { backgroundColor: msg.ok ? '#EAF1EC' : '#FDF0EE' }]}>
            <Text style={[styles.msgText, { color: msg.ok ? colors.green : colors.red }]}>{msg.text}</Text>
          </View>
        )}

        {/* Enrolled factors */}
        {factors.map((f) => (
          <View key={f.id} style={styles.factorCard}>
            <View style={styles.factorLeft}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <Path d="M9 12l2 2 4-4" />
              </Svg>
              <Text style={styles.factorName}>{f.friendly_name ?? 'Authenticator App'}</Text>
              <View style={[styles.factorStatus, { backgroundColor: f.status === 'verified' ? colors.greenBg : colors.amberBg }]}>
                <Text style={[styles.factorStatusText, { color: f.status === 'verified' ? colors.green : colors.amber }]}>{f.status}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => unenroll(f.id)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* QR Code enrollment flow */}
        {qrCode ? (
          <View style={styles.enrollBox}>
            <Text style={styles.enrollStep}>1. Open your authenticator app and scan this QR code.</Text>
            {/* React Native can't render SVG QR directly; show URI for manual entry */}
            <View style={styles.qrPlaceholder}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="3" width="5" height="5" rx="1" />
                <Rect x="16" y="3" width="5" height="5" rx="1" />
                <Rect x="3" y="16" width="5" height="5" rx="1" />
                <Path d="M21 16h-3a2 2 0 00-2 2v3M21 21v.01M14 14h.01M14 21h3M17 14h1" />
              </Svg>
              <Text style={styles.qrSecretLabel}>Manual entry key:</Text>
              <Text style={styles.qrSecret}>{totpSecret}</Text>
            </View>
            <Text style={styles.enrollStep}>2. Enter the 6-digit code from your app.</Text>
            <TextInput
              style={styles.codeInput}
              value={verifyCode}
              onChangeText={(t) => setVerifyCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="numeric"
              placeholder="000000"
              placeholderTextColor={colors.inkTertiary}
              maxLength={6}
              textAlign="center"
            />
            <TouchableOpacity style={[styles.btn, { opacity: verifyCode.length === 6 && !verifying ? 1 : 0.5 }]}
              onPress={verifyEnroll} disabled={verifyCode.length !== 6 || verifying}>
              {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm & Enable 2FA</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setQrCode(null); setEnrollFactorId(null); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={startEnroll} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{factors.length > 0 ? 'Add another authenticator' : 'Enable 2FA'}</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { Rect } from 'react-native-svg';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink },
  content: { padding: 20, paddingBottom: 60 },
  section: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.inkTertiary, letterSpacing: 1.5, marginBottom: 8 },
  sub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, lineHeight: 21, marginBottom: 20 },
  msgBox: { borderRadius: 12, padding: 12, marginBottom: 16 },
  msgText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13 },
  factorCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  factorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  factorName: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink },
  factorStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  factorStatusText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 10, textTransform: 'capitalize' },
  removeBtn: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.red },
  enrollBox: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 20, marginTop: 8 },
  enrollStep: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, marginBottom: 12 },
  qrPlaceholder: { backgroundColor: colors.roseTint, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, gap: 8 },
  qrSecretLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkSecondary, letterSpacing: 1 },
  qrSecret: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.ink, letterSpacing: 3, textAlign: 'center' },
  codeInput: { height: 56, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontFamily: 'HankenGrotesk_700Bold', fontSize: 28, color: colors.ink, letterSpacing: 8, marginBottom: 16 },
  btn: { backgroundColor: colors.burgundy, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
  cancelBtn: { marginTop: 12, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSecondary },
});
