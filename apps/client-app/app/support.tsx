import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Linking, LayoutAnimation } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../lib/colors';
import Svg, { Path } from 'react-native-svg';

const FAQS = [
  {
    q: 'How do I upload a document?',
    a: 'Go to your case, tap the "Documents" tab, then tap the upload icon. You can take a photo, choose from your gallery, or pick a file. Supported formats include PDF, JPG, PNG, and DOCX.',
  },
  {
    q: 'What is a Vakalatnama?',
    a: 'A Vakalatnama is a legal document authorising your lawyer to represent you in court. It must be signed by both you and your lawyer. Your lawyer will send you one through the Documents tab when needed.',
  },
  {
    q: 'How do retainer fees work?',
    a: 'A retainer is an advance payment that your firm holds on your behalf. It is applied against future invoices as work is completed. You can see your current retainer balance and all invoices in the Invoices tab of your case.',
  },
  {
    q: 'My lawyer is not responding',
    a: 'First, try sending a message in the case chat (Messages tab). If your lawyer has not replied within 24 hours, you can contact the firm directly by tapping "Chat with support" or calling the office number below.',
  },
  {
    q: 'How do I view my invoices?',
    a: 'Open your case from the Cases tab, then tap "Invoices". You will see a list of all invoices, their amounts, due dates, and payment status. Invoices are settled by bank transfer — once confirmed, our office will mark them as paid.',
  },
  {
    q: 'What happens at each matter stage?',
    a: 'Intake → your matter is being set up. Documentation → gathering and preparing documents. Filing → submissions being made to the court. In Progress → hearings and proceedings underway. Judgment → awaiting the court\'s decision. Closed → matter is concluded.',
  },
  {
    q: 'Can I change my appointment time?',
    a: 'Yes. Go to the Schedule tab and tap your upcoming appointment. You can request a new time and your lawyer will confirm. Alternatively, use the case chat to coordinate directly.',
  },
  {
    q: 'How do I change my password?',
    a: 'Tap the profile icon on the Home screen, then "Security". You can update your password there. If you have forgotten your password, log out and use "Forgot Password" on the login screen.',
  },
];

export default function SupportScreen() {
  const [expanded, setExpanded] = useState<number | null>(null);

  function toggle(idx: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === idx ? null : idx));
  }

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
        <TouchableOpacity style={styles.card} onPress={() => router.push('/firm-chat')}>
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

        {/* Email */}
        <TouchableOpacity style={styles.card} onPress={() => Linking.openURL('mailto:support@bastionlaw.pk')}>
          <View style={[styles.cardIcon, { backgroundColor: colors.amberBg }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.amber} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <Path d="M22 6l-10 7L2 6" />
            </Svg>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>support@bastionlaw.pk</Text>
            <Text style={styles.cardSub}>Response within 1 business day</Text>
          </View>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </TouchableOpacity>

        {/* FAQs */}
        <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, idx) => (
            <View key={idx} style={idx > 0 ? styles.faqItemBorder : undefined}>
              <TouchableOpacity style={styles.faqRow} onPress={() => toggle(idx)} activeOpacity={0.7}>
                <Text style={styles.faqText}>{faq.q}</Text>
                <Svg
                  width={18} height={18} viewBox="0 0 24 24" fill="none"
                  stroke={expanded === idx ? colors.burgundy : colors.inkTertiary}
                  strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: [{ rotate: expanded === idx ? '90deg' : '0deg' }] }}
                >
                  <Path d="M9 18l6-6-6-6" />
                </Svg>
              </TouchableOpacity>
              {expanded === idx && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.a}</Text>
                </View>
              )}
            </View>
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
  faqItemBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  faqText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.ink, flex: 1, paddingRight: 10 },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
  faqAnswerText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 20 },
});
