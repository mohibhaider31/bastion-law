import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';

export default function WrongRole() {
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Wrong App</Text>
      <Text style={styles.body}>
        This app is for lawyers only.{'\n'}Clients use the client app, owners use the web portal.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={signOut}>
        <Text style={styles.btnText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 22, color: colors.ink, marginBottom: 12 },
  body: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: { backgroundColor: colors.burgundy, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  btnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
});
