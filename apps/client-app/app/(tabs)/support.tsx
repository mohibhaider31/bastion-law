import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../lib/colors';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

const FAQS = [
  {
    q: 'How do I share documents with my lawyer?',
    a: 'Go to your case, open the Documents tab, and tap "Upload Document". Your lawyer will be notified automatically.',
  },
  {
    q: 'What do I do if I need to reschedule a meeting?',
    a: 'Go to Schedule, find your confirmed appointment, and tap "Propose new time". Your lawyer will review and confirm.',
  },
  {
    q: 'How are invoices handled?',
    a: 'Invoices are settled directly with the firm offline. You can view all invoices under any case\'s Invoices tab.',
  },
  {
    q: 'How long does it take to get a response?',
    a: 'Our team responds to messages within 24 hours on business days. Urgent matters are flagged and prioritised.',
  },
  {
    q: 'Can I add another person to my case?',
    a: 'Please send a message to your lawyer through the Messages tab requesting to add a co-applicant or witness.',
  },
];

export default function SupportScreen() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.subtitle}>We're here to help</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick contact cards */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactCard} onPress={() => router.push('/(tabs)/messages')}>
            <View style={[styles.contactIcon, { backgroundColor: colors.roseTint }]}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.burgundy} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </Svg>
            </View>
            <Text style={styles.contactLabel}>Message Us</Text>
            <Text style={styles.contactSub}>Usually replies in 24 hrs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('mailto:support@bastionlaw.pk')}>
            <View style={[styles.contactIcon, { backgroundColor: colors.amberBg }]}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.amber} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <Path d="M22 6l-10 7L2 6" />
              </Svg>
            </View>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactSub}>support@bastionlaw.pk</Text>
          </TouchableOpacity>
        </View>

        {/* Office info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="10" />
                <Line x1="12" y1="6" x2="12" y2="12" />
                <Line x1="12" y1="16" x2="12.01" y2="16" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>OFFICE HOURS</Text>
              <Text style={styles.infoValue}>Mon – Fri, 9:00 AM – 6:00 PM PKT</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <View style={styles.infoIcon}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <Circle cx="12" cy="10" r="3" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>ADDRESS</Text>
              <Text style={styles.infoValue}>Bastion Law Chambers, Blue Area, Islamabad</Text>
            </View>
          </View>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.faqCard, expanded === i && styles.faqCardOpen]}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.75}
          >
            <View style={styles.faqRow}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.inkTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d={expanded === i ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
              </Svg>
            </View>
            {expanded === i && <Text style={styles.faqA}>{faq.a}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  subtitle: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  contactRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  contactCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'flex-start', gap: 8 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  contactSub: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 11, color: colors.inkSecondary },

  infoCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.inkTertiary, letterSpacing: 1.2, marginBottom: 3 },
  infoValue: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.ink, lineHeight: 18 },

  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 12 },
  faqCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 8 },
  faqCardOpen: { borderColor: colors.brassLight },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, lineHeight: 20 },
  faqA: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 20, marginTop: 12 },
});
