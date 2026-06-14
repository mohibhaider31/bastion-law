import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/colors';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: colors.burgundy,
      tabBarInactiveTintColor: colors.inkTertiary,
      tabBarLabelStyle: styles.tabLabel,
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused, color }) => <Icon focused={focused}><DashIcon color={color as string} /></Icon> }} />
      <Tabs.Screen name="board" options={{ title: 'Board', tabBarIcon: ({ focused, color }) => <Icon focused={focused}><BoardIcon color={color as string} /></Icon> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ focused, color }) => <Icon focused={focused}><ClientsIcon color={color as string} /></Icon> }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ focused, color }) => <Icon focused={focused}><CalIcon color={color as string} /></Icon> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ focused, color }) => <Icon focused={focused}><SearchIcon color={color as string} /></Icon> }} />
    </Tabs>
  );
}

function Icon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <View style={[styles.icon, focused && styles.iconActive]}>{children}</View>;
}
function DashIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="3" width="7" height="7" rx="1" /><Rect x="14" y="3" width="7" height="7" rx="1" /><Rect x="3" y="14" width="7" height="7" rx="1" /><Rect x="14" y="14" width="7" height="7" rx="1" /></Svg>;
}
function BoardIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="3" width="18" height="18" rx="2" /><Line x1="9" y1="3" x2="9" y2="21" /><Line x1="15" y1="3" x2="15" y2="21" /></Svg>;
}
function ClientsIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><Circle cx="9" cy="7" r="4" /><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Svg>;
}
function CalIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Rect x="3" y="4" width="18" height="18" rx="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" /></Svg>;
}
function SearchIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Circle cx="11" cy="11" r="8" /><Line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, height: 84, paddingBottom: 20, paddingTop: 8 },
  tabLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconActive: { backgroundColor: colors.roseTint },
});
