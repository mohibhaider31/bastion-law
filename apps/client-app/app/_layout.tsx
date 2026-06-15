import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableNative: true,
  tracesSampleRate: 0.2,
});
import {
  useFonts,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

function RootLayout() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  const setSession = useAuthStore((s) => s.setSession);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.replace('/(auth)/login');
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'client') {
      router.replace('/(auth)/wrong-role');
      return;
    }
    router.replace('/(tabs)/home');
  }, [profile]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="case/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="firm-chat" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default Sentry.wrap(RootLayout);
