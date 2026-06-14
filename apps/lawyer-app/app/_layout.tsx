import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableNative: true,
  tracesSampleRate: 0.2,
});

function RootLayout() {
  const [fontsLoaded] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold });
  const setSession = useAuthStore((s) => s.setSession);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) router.replace('/(auth)/login');
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'lawyer') { router.replace('/(auth)/wrong-role'); return; }
    router.replace('/(tabs)/dashboard');
  }, [profile]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="matter/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="security" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default Sentry.wrap(RootLayout);
