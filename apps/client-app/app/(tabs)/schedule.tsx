import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Modal, Pressable, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import { dispatchPush } from '../../lib/push';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';

interface Appointment {
  id: string;
  status: string;
  type: string;
  proposed_at: string;
  duration_minutes: number;
  agenda: string | null;
  proposed_by: string | null;
  lawyer: { full_name: string };
  lawyer_id: string;
  video_room_url: string | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  type: string;
  location: string | null;
}

export default function ScheduleScreen() {
  const { profile } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null); // appt id

  // Schedule modal state
  const [meetingType, setMeetingType] = useState<'video' | 'in_person'>('video');
  const [agenda, setAgenda] = useState('');
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const { data: matters } = await supabase.from('matters').select('id').eq('client_id', profile.id).eq('status', 'active');
    if (!matters?.length) { setLoading(false); setRefreshing(false); return; }
    const matterIds = matters.map((m) => m.id);

    const [apptsRes, eventsRes] = await Promise.all([
      supabase.from('appointments')
        .select('id, status, type, proposed_at, duration_minutes, agenda, proposed_by, lawyer_id, video_room_url, lawyer:profiles!lawyer_id(full_name)')
        .eq('client_id', profile.id)
        .in('status', ['pending', 'confirmed', 'counter_proposed'])
        .order('proposed_at'),
      supabase.from('events')
        .select('id, title, event_date, event_time, type, location')
        .in('matter_id', matterIds)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date')
        .limit(10),
    ]);

    if (apptsRes.data) setAppointments(apptsRes.data as unknown as Appointment[]);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false); setRefreshing(false);
  }

  async function respondToAppointment(id: string, status: 'confirmed' | 'rejected') {
    await supabase.from('appointments').update({ status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null }).eq('id', id);
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a).filter((a) => a.status !== 'rejected'));
  }

  async function bookAppointment() {
    if (!profile) return;
    setSubmitting(true);

    let proposedAt: Date;
    if (proposeDate) {
      proposedAt = new Date(`${proposeDate}T${proposeTime || '11:00'}:00`);
    } else {
      proposedAt = new Date();
      proposedAt.setDate(proposedAt.getDate() + 3);
      proposedAt.setHours(11, 0, 0, 0);
    }

    if (proposing) {
      // Counter-propose: update existing appointment to client's preferred time
      const appt = appointments.find((a) => a.id === proposing);
      await supabase.from('appointments').update({
        proposed_at: proposedAt.toISOString(),
        status: 'pending',
        proposed_by: profile.id,
        agenda: agenda || appt?.agenda || null,
      }).eq('id', proposing);
      if (appt) {
        dispatchPush(appt.lawyer_id, profile.full_name, `Proposed a new meeting time: ${fmtDateTime(proposedAt.toISOString())}`, { screen: 'calendar' });
      }
    } else {
      const { data: matters } = await supabase.from('matters').select('id, lead_lawyer_id').eq('client_id', profile.id).eq('status', 'active').single();
      if (matters) {
        await supabase.from('appointments').insert({
          matter_id: matters.id, client_id: profile.id, lawyer_id: matters.lead_lawyer_id,
          type: meetingType, proposed_at: proposedAt.toISOString(), agenda: agenda || null, proposed_by: profile.id,
        });
      }
    }
    setSubmitting(false);
    setScheduleModal(false);
    setAgenda(''); setProposeDate(''); setProposeTime(''); setProposing(null);
    load();
  }

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  const pendingAppts = appointments.filter((a) => a.status === 'pending' && a.proposed_by !== profile?.id);
  const counterAppts = appointments.filter((a) => a.status === 'counter_proposed' || (a.status === 'pending' && a.proposed_by === profile?.id));
  const confirmedAppts = appointments.filter((a) => a.status === 'confirmed');

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}
      >
        {/* Appointments awaiting lawyer (client proposed / counter-proposed) */}
        {counterAppts.map((appt) => (
          <View key={appt.id} style={[styles.pendingCard, { borderColor: colors.border }]}>
            <Text style={[styles.pendingLabel, { color: colors.inkTertiary }]}>AWAITING LAWYER'S RESPONSE</Text>
            <Text style={styles.pendingTitle}>{appt.type === 'video' ? 'Video Call' : 'In-Person Meeting'}</Text>
            <Text style={styles.pendingWith}>{appt.lawyer?.full_name ?? 'Your lawyer'}</Text>
            <Text style={styles.pendingDate}>{fmtDateTime(appt.proposed_at)}</Text>
            {appt.agenda && <Text style={styles.pendingAgenda}>{appt.agenda}</Text>}
          </View>
        ))}

        {/* Pending appointments — lawyer proposed, waiting for client */}
        {pendingAppts.map((appt) => (
          <View key={appt.id} style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>AWAITING YOUR RESPONSE</Text>
            <Text style={styles.pendingTitle}>{appt.type === 'video' ? 'Video Call' : 'In-Person Meeting'}</Text>
            <Text style={styles.pendingWith}>{appt.lawyer?.full_name ?? 'Your lawyer'}</Text>
            <Text style={styles.pendingDate}>{fmtDateTime(appt.proposed_at)}</Text>
            {appt.agenda && <Text style={styles.pendingAgenda}>{appt.agenda}</Text>}
            <View style={styles.apptActions}>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToAppointment(appt.id, 'confirmed')}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.proposeBtn} onPress={() => { setProposing(appt.id); setScheduleModal(true); }}>
                <Text style={styles.proposeBtnText}>Propose new time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => respondToAppointment(appt.id, 'rejected')}>
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Confirmed appointments */}
        {confirmedAppts.map((appt) => (
          <View key={appt.id} style={styles.confirmedCard}>
            <View style={styles.confirmedLeft}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateBlockDay}>{new Date(appt.proposed_at).getDate()}</Text>
                <Text style={styles.dateBlockMonth}>{new Date(appt.proposed_at).toLocaleString('en', { month: 'short' }).toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.confirmedRight}>
              <Text style={styles.confirmedType}>{appt.type === 'video' ? 'Video Call' : 'In-Person Meeting'}</Text>
              <Text style={styles.confirmedWith}>{appt.lawyer?.full_name ?? 'Your lawyer'}</Text>
              <Text style={styles.confirmedTime}>{fmtTime(appt.proposed_at)} · {appt.duration_minutes} min</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedBadgeText}>Confirmed</Text>
              </View>
              {appt.type === 'video' && appt.video_room_url && (
                <TouchableOpacity style={styles.joinVideoBtn} onPress={() => WebBrowser.openBrowserAsync(appt.video_room_url!, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN })}>
                  <Text style={styles.joinVideoBtnText}>Join Video</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Upcoming events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UPCOMING</Text>
            {events.map((ev) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventDate}>
                  <Text style={styles.eventDay}>{new Date(ev.event_date).getDate()}</Text>
                  <Text style={styles.eventDow}>{new Date(ev.event_date).toLocaleString('en', { weekday: 'short' }).toUpperCase()}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  {ev.event_time && <Text style={styles.eventTime}>{ev.event_time.slice(0, 5)} {ev.location ? `· ${ev.location}` : ''}</Text>}
                </View>
                <View style={[styles.typeBadge, { backgroundColor: typeColor(ev.type) }]}>
                  <Text style={styles.typeBadgeText}>{ev.type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Book CTA */}
        <TouchableOpacity style={styles.bookBtn} onPress={() => { setProposing(null); setScheduleModal(true); }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Rect x="3" y="4" width="18" height="18" rx="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" />
          </Svg>
          <Text style={styles.bookBtnText}>Book an appointment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Schedule Meeting Modal */}
      <Modal visible={scheduleModal} transparent animationType="slide" onRequestClose={() => setScheduleModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setScheduleModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Schedule Meeting</Text>

          {!proposing && (
            <>
              <Text style={styles.fieldLabel}>MEETING TYPE</Text>
              <View style={styles.toggleRow}>
                {(['video', 'in_person'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.toggleBtn, meetingType === t && styles.toggleBtnActive]} onPress={() => setMeetingType(t)}>
                    <Text style={[styles.toggleBtnText, meetingType === t && styles.toggleBtnTextActive]}>
                      {t === 'video' ? 'Video Call' : 'In-Person'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>PREFERRED DATE & TIME</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <TextInput style={[styles.agendaInput, { flex: 1, minHeight: 0, marginBottom: 0 }]} value={proposeDate} onChangeText={setProposeDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkTertiary} />
            <TextInput style={[styles.agendaInput, { flex: 1, minHeight: 0, marginBottom: 0 }]} value={proposeTime} onChangeText={setProposeTime} placeholder="HH:MM" placeholderTextColor={colors.inkTertiary} />
          </View>

          <Text style={styles.fieldLabel}>AGENDA</Text>
          <TextInput
            style={styles.agendaInput}
            value={agenda}
            onChangeText={setAgenda}
            placeholder="What would you like to discuss?"
            placeholderTextColor={colors.inkTertiary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={bookAppointment} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{proposing ? 'Send new time proposal' : 'Send appointment request'}</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}

function typeColor(type: string) {
  if (type === 'hearing') return colors.amberBg;
  if (type === 'deadline') return colors.redBg;
  if (type === 'meeting') return colors.roseTint;
  return colors.borderLight;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  pendingCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.brassLight, padding: 16, marginBottom: 14 },
  pendingLabel: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: colors.amber, letterSpacing: 1.5, marginBottom: 8 },
  pendingTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.ink, marginBottom: 2 },
  pendingWith: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginBottom: 2 },
  pendingDate: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.ink, marginBottom: 6 },
  pendingAgenda: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginBottom: 12, lineHeight: 18 },
  apptActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.green },
  acceptBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.green },
  proposeBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.amberBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.amber },
  proposeBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.amber },
  rejectBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.inkSecondary },

  confirmedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, gap: 12 },
  confirmedLeft: {},
  dateBlock: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  dateBlockDay: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: '#fff', lineHeight: 18 },
  dateBlockMonth: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: 'rgba(246,241,234,0.8)', letterSpacing: 0.5 },
  confirmedRight: { flex: 1 },
  confirmedType: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  confirmedWith: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary },
  confirmedTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkTertiary, marginTop: 2 },
  confirmedBadge: { backgroundColor: colors.greenBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  confirmedBadgeText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.green },
  joinVideoBtn: { backgroundColor: colors.burgundy, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  joinVideoBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: '#fff' },

  section: { marginTop: 8 },
  sectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 10 },
  eventRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, gap: 12 },
  eventDate: { width: 36, alignItems: 'center' },
  eventDay: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 18, color: colors.ink },
  eventDow: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 9, color: colors.inkTertiary, letterSpacing: 0.5 },
  eventInfo: { flex: 1 },
  eventTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  eventTime: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  typeBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 11, color: colors.inkSecondary, textTransform: 'capitalize' },

  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.burgundy, borderRadius: 16, height: 56, marginTop: 16 },
  bookBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, marginBottom: 20 },
  fieldLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toggleBtn: { flex: 1, height: 44, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  toggleBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.inkSecondary },
  toggleBtnTextActive: { color: '#fff' },
  agendaInput: { backgroundColor: colors.cream, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, minHeight: 90, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { height: 54, borderRadius: 14, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
});
