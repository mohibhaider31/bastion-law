import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export async function registerPushToken(userId: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token', ignoreDuplicates: true }
    );

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bastion Law',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B1E2B',
      });
    }
  } catch {
    // non-fatal: push is best-effort
  }
}

export async function dispatchPush(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    await supabase.functions.invoke('send-push', { body: { user_id: userId, title, body, data } });
  } catch {
    // best-effort
  }
}
