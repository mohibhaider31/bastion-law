import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { colors } from '../../lib/colors';
import { useAuthStore } from '../../store/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const { signIn, loading } = useAuthStore();

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    const err = await signIn(email.trim().toLowerCase(), password);
    if (err) setError(err);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Top hero */}
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>B</Text>
          </View>
          <Text style={styles.headline}>Bastion Law</Text>
          <Text style={styles.subtitle}>Karachi's premier legal counsel,{'\n'}now in your pocket.</Text>
        </View>

        {/* Auth card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to your account</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.inkTertiary}
                secureTextEntry={!showPw}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
                <Text style={styles.eyeText}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.signInBtnLoading]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.signInBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.authNote}>
            Credentials are provided by Bastion Law. No self-registration.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.burgundy,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(246,241,234,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(246,241,234,0.24)',
  },
  logoLetter: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.cream,
  },
  headline: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 26,
    color: colors.cream,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: 15,
    color: 'rgba(246,241,234,0.72)',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  cardTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.ink,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  eyeBtn: {
    height: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.cream,
    justifyContent: 'center',
  },
  eyeText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 13,
    color: colors.burgundy,
  },
  errorText: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: 13,
    color: colors.red,
    marginBottom: 12,
  },
  signInBtn: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  signInBtnLoading: {
    opacity: 0.8,
  },
  signInBtnText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  authNote: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: 12,
    color: colors.inkTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
