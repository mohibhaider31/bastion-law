import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/colors';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useMessagesStore } from '../../store/messages';

function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      {children}
    </View>
  );
}

// Inline SVG-style icons as text for now — swap for SVG components if desired
export default function TabsLayout() {
  const profile = useAuthStore((s) => s.profile);
  const { unreadCount, setUnreadCount } = useMessagesStore();

  useEffect(() => {
    if (!profile) return;

    async function fetchUnread() {
      const { data: matters } = await supabase.from('matters').select('id').eq('client_id', profile!.id);
      const matterIds = (matters ?? []).map((m: any) => m.id);
      let count = 0;
      if (matterIds.length) {
        const { count: c } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('matter_id', matterIds).neq('sender_id', profile!.id).is('read_at', null);
        count += c ?? 0;
      }
      const { count: firmCount } = await supabase.from('messages').select('id', { count: 'exact', head: true }).is('matter_id', null).eq('client_id', profile!.id).neq('sender_id', profile!.id).is('read_at', null);
      count += firmCount ?? 0;
      setUnreadCount(count);
    }

    fetchUnread();
    const channel = supabase.channel('tabs-msg-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchUnread)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.burgundy,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <HomeIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="case"
        options={{
          title: 'Cases',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <CaseIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Docs',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <DocsIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.burgundy, fontSize: 10 },
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <MsgIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <CalIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <SearchIcon color={focused ? colors.burgundy : colors.inkTertiary} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <Path d="M9 21V12h6v9" />
    </Svg>
  );
}

function CaseIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="7" width="20" height="14" rx="2" />
      <Path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <Line x1="12" y1="12" x2="12" y2="16" />
      <Line x1="10" y1="14" x2="14" y2="14" />
    </Svg>
  );
}

function DocsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  );
}

function MsgIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

function CalIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 84,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: 11,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconActive: {
    backgroundColor: colors.roseTint,
  },
});
