import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../lib/colors';
import Svg, { Path, Circle, Line } from 'react-native-svg';

const FAQS = [
  { q: 'How do I upload a document?' },
  { q: 'What is a Vakalatnama?' },
  { q: 'How do retainer fees work?' },
  { q: 'My lawyer is not responding' },
];

export default function SupportScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title}>Support</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Chat with support */}
        <TouchableOpacity style={styles.card}>
          <View style={styles.cardIcon}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </Svg>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Chat with support team</Text>
            <Text style={styles.cardSub}>Usually responds within 4 hours</Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </TouchableOpacity>

        {/* Call */}
        <TouchableOpacity style={styles.card} onPress={() => Linking.openURL('tel:+922111122233')}>
          <View style={[styles.cardIcon, { backgroundColor: colors.greenBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.12 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
            </Svg>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>+92-21-111-222-333</Text>
            <Text style={styles.cardSub}>Mon–Sat, 9:00 AM – 6:00 PM</Text>
          </View>
          <View style={styles.callPill}>
            <Text style={styles.callPillText}>Call</Text>
          </View>
        </TouchableOpacity>

        {/* FAQs */}
        <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, idx) => (
            <TouchableOpacity key={idx} style={[styles.faqRow, idx > 0 && styles.faqRowBorder]}>
              <Text style={styles.faqText}>{faq.q}</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18l6-6-6-6" />
              </Svg>
            </TouchableOpacity>
          ))}
        </View>
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
  scrollContent: { padding: 20, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  cardSub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  callPill: { backgroundColor: colors.greenBg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.green },
  callPillText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.green },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  faqCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  faqRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  faqText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, flex: 1 },
});
