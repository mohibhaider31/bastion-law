import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Modal, Pressable, TextInput, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { colors } from '../../lib/colors';
import { dispatchPush } from '../../lib/push';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';

interface CalEvent { id: string; title: string; event_date: string; event_time: string | null; type: string; location: string | null; matter_id: string; }
interface Appointment { id: string; status: string; type: string; proposed_at: string; duration_minutes: number; agenda: string | null; client: { full_name: string }; client_id: string; matter_id: string | null; video_room_url: string | null; }

export default function CalendarScreen() {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [apptStatuses, setApptStatuses] = useState<Record<string, string>>({});
  const [proposeModal, setProposeModal] = useState(false);
  const [proposingAppt, setProposingAppt] = useState<Appointment | null>(null);
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('');
  const [proposing, setProposing] = useState(false);

  // Add event form
  const [evType, setEvType] = useState<'hearing' | 'deadline' | 'filing' | 'meeting'>('hearing');
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evTime, setEvTime] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evMatterId, setEvMatterId] = useState('');
  const [myMatters, setMyMatters] = useState<{ id: string; matter_ref: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(); end.setDate(end.getDate() + 30);

    const { data: mattersData } = await supabase.from('matters').select('id, matter_ref').eq('lead_lawyer_id', profile.id).eq('status', 'active');
    if (mattersData) setMyMatters(mattersData);
    const matterIds = mattersData?.map((m) => m.id) ?? [];

    const [evRes, apptRes] = await Promise.all([
      matterIds.length ? supabase.from('events').select('id, title, event_date, event_time, type, location, matter_id').in('matter_id', matterIds).gte('event_date', today).lte('event_date', end.toISOString().split('T')[0]).order('event_date').order('event_time') : { data: [] },
      supabase.from('appointments').select('id, status, type, proposed_at, duration_minutes, agenda, client_id, video_room_url, client:profiles!client_id(full_name), matter_id').eq('lawyer_id', profile.id).in('status', ['pending', 'confirmed', 'counter_proposed']).order('proposed_at'),
    ]);

    if (evRes.data) setEvents(evRes.data as CalEvent[]);
    if (apptRes.data) {
      const appts = apptRes.data as unknown as Appointment[];
      setAppointments(appts);
      const statusMap: Record<string, string> = {};
      appts.forEach((a) => { statusMap[a.id] = a.status; });
      setApptStatuses(statusMap);
    }
    setLoading(false); setRefreshing(false);
  }

  async function respondAppt(id: string, status: 'confirmed' | 'rejected') {
    const appt = appointments.find((a) => a.id === id);
    const videoRoomUrl = (status === 'confirmed' && appt?.type === 'video')
      ? `https://meet.jit.si/bastion-${id.replace(/-/g, '').slice(0, 16)}`
      : null;
    const update: Record<string, unknown> = { status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null };
    if (videoRoomUrl) update.video_room_url = videoRoomUrl;
    await supabase.from('appointments').update(update).eq('id', id);
    setApptStatuses((prev) => ({ ...prev, [id]: status }));
    if (appt && status === 'confirmed') {
      await supabase.from('notifications').insert({ user_id: appt.client_id, type: 'appointment_confirmed', title: 'Appointment confirmed', body: `${fmtDT(appt.proposed_at)} has been confirmed by your lawyer.`, matter_id: appt.matter_id });
      dispatchPush(appt.client_id, 'Appointment confirmed', `${fmtDT(appt.proposed_at)} — confirmed by your lawyer.`, { screen: 'schedule' });
    } else if (appt && status === 'rejected') {
      await supabase.from('notifications').insert({ user_id: appt.client_id, type: 'appointment_cancelled', title: 'Appointment declined', body: 'Your appointment request has been declined. Please propose a new time.', matter_id: appt.matter_id });
      dispatchPush(appt.client_id, 'Appointment declined', 'Your lawyer declined. Please propose a new time.', { screen: 'schedule' });
    }
  }

  async function proposeNewTime() {
    if (!proposingAppt || !proposeDate || !profile) return;
    setProposing(true);
    const proposed = new Date(`${proposeDate}T${proposeTime || '11:00'}:00`);
    await supabase.from('appointments').update({
      proposed_at: proposed.toISOString(),
      status: 'counter_proposed',
      proposed_by: profile.id,
    }).eq('id', proposingAppt.id);
    setApptStatuses((prev) => ({ ...prev, [proposingAppt.id]: 'counter_proposed' }));
    dispatchPush(proposingAppt.client_id, 'New time proposed', `Your lawyer proposed ${fmtDT(proposed.toISOString())}. Tap to respond.`, { screen: 'schedule' });
    setProposing(false);
    setProposeModal(false);
    setProposeDate(''); setProposeTime(''); setProposingAppt(null);
    load();
  }

  async function addEvent() {
    if (!evTitle || !evDate || !evMatterId || !profile) return;
    setSubmitting(true);
    await supabase.from('events').insert({ matter_id: evMatterId, created_by: profile.id, type: evType, title: evTitle, event_date: evDate, event_time: evTime || null, location: evLocation || null });
    setSubmitting(false);
    setAddModal(false);
    setEvTitle(''); setEvDate(''); setEvTime(''); setEvLocation('');
    load();
  }

  // Build month strip for the current month
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthDays = Array.from({ length: monthEnd.getDate() }, (_, i) => {
    const d = new Date(monthStart); d.setDate(i + 1); return d;
  });

  // Events grouped by date
  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    if (!acc[ev.event_date]) acc[ev.event_date] = [];
    acc[ev.event_date].push(ev);
    return acc;
  }, {});

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  if (loading) return (
    <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={colors.burgundy} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.monthLabel}>{today.toLocaleString('en', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Month strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthStrip}>
        {monthDays.map((day) => {
          const ds = day.toISOString().split('T')[0];
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          const hasDot = !!(eventsByDate[ds]?.length);
          return (
            <TouchableOpacity key={ds} style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]} onPress={() => setSelectedDate(ds)} activeOpacity={0.7}>
              <Text style={[styles.dayLetter, isSelected && styles.dayLetterSelected, isToday && !isSelected && styles.dayLetterToday]}>
                {day.toLocaleString('en', { weekday: 'narrow' })}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected, isToday && !isSelected && styles.dayNumToday]}>
                {day.getDate()}
              </Text>
              {hasDot && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.burgundy} />}>

        {/* Counter-proposed appointments (lawyer proposed, waiting for client) */}
        {appointments.filter((a) => apptStatuses[a.id] === 'counter_proposed').map((appt) => (
          <View key={appt.id} style={[styles.pendingCard, { borderColor: colors.border }]}>
            <Text style={[styles.pendingLabel, { color: colors.inkTertiary }]}>AWAITING CLIENT'S RESPONSE</Text>
            <Text style={styles.pendingTitle}>{appt.type === 'video' ? 'Video Call' : 'In-Person'} · {appt.client.full_name}</Text>
            <Text style={styles.pendingDate}>{fmtDT(appt.proposed_at)}</Text>
          </View>
        ))}

        {/* Pending appointments (client proposed, lawyer must respond) */}
        {appointments.filter((a) => apptStatuses[a.id] === 'pending').map((appt) => (
          <View key={appt.id} style={styles.pendingCard}>
            <Text style={styles.pendingLabel}>CLIENT REQUEST</Text>
            <Text style={styles.pendingTitle}>{appt.type === 'video' ? 'Video Call' : 'In-Person'} · {appt.client.full_name}</Text>
            <Text style={styles.pendingDate}>{fmtDT(appt.proposed_at)}</Text>
            {appt.agenda && <Text style={styles.pendingAgenda} numberOfLines={2}>{appt.agenda}</Text>}
            <View style={styles.apptBtns}>
              <TouchableOpacity style={[styles.apptBtn, styles.acceptBtn]} onPress={() => respondAppt(appt.id, 'confirmed')}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.apptBtn, { backgroundColor: colors.amberBg, borderWidth: 1, borderColor: colors.amber }]} onPress={() => { setProposingAppt(appt); setProposeModal(true); }}>
                <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 11, color: colors.amber }}>New time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.apptBtn, styles.rejectBtn]} onPress={() => respondAppt(appt.id, 'rejected')}>
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Confirmed appointments with video link */}
        {appointments.filter((a) => apptStatuses[a.id] === 'confirmed' && a.type === 'video' && a.video_room_url).map((appt) => (
          <View key={appt.id} style={[styles.pendingCard, { borderColor: colors.green, backgroundColor: '#F0FAF4' }]}>
            <Text style={[styles.pendingLabel, { color: colors.green }]}>CONFIRMED VIDEO CALL</Text>
            <Text style={styles.pendingTitle}>{appt.client.full_name}</Text>
            <Text style={styles.pendingDate}>{fmtDT(appt.proposed_at)} · {appt.duration_minutes} min</Text>
            <TouchableOpacity
              style={[styles.apptBtn, { backgroundColor: colors.burgundy, marginTop: 8, alignSelf: 'flex-start' }]}
              onPress={() => WebBrowser.openBrowserAsync(appt.video_room_url!, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN })}>
              <Text style={[styles.acceptText, { color: '#fff' }]}>Join Video Call</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Day event list */}
        <View style={styles.daySection}>
          <Text style={styles.daySectionLabel}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </Text>
          {selectedEvents.length > 0 ? selectedEvents.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={[styles.evBar, { backgroundColor: evColor(ev.type) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evTitle}>{ev.title}</Text>
                <Text style={styles.evMeta}>
                  {ev.event_time ? ev.event_time.slice(0, 5) : 'All day'}{ev.location ? ` · ${ev.location}` : ''}
                </Text>
              </View>
              <View style={[styles.evTypeBadge, { backgroundColor: evBg(ev.type) }]}>
                <Text style={[styles.evTypeBadgeText, { color: evColor(ev.type) }]}>{ev.type}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>No events</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Propose New Time Modal */}
      <Modal visible={proposeModal} transparent animationType="slide" onRequestClose={() => setProposeModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setProposeModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Propose New Time</Text>
          <Text style={styles.fieldLabel}>DATE</Text>
          <TextInput style={styles.input} value={proposeDate} onChangeText={setProposeDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkTertiary} />
          <Text style={styles.fieldLabel}>TIME</Text>
          <TextInput style={[styles.input, { marginBottom: 24 }]} value={proposeTime} onChangeText={setProposeTime} placeholder="HH:MM (e.g. 14:30)" placeholderTextColor={colors.inkTertiary} />
          <TouchableOpacity style={[styles.submitBtn, (!proposeDate || proposing) && { opacity: 0.5 }]} onPress={proposeNewTime} disabled={!proposeDate || proposing}>
            {proposing ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Send proposal to client</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Add Event</Text>
          <Text style={styles.fieldLabel}>TYPE</Text>
          <View style={styles.typeRow}>
            {(['hearing', 'deadline', 'filing', 'meeting'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.typePill, evType === t && styles.typePillActive]} onPress={() => setEvType(t)}>
                <Text style={[styles.typePillText, evType === t && styles.typePillTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>MATTER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {myMatters.map((m) => (
              <TouchableOpacity key={m.id} style={[styles.matterPill, evMatterId === m.id && styles.matterPillActive]} onPress={() => setEvMatterId(m.id)}>
                <Text style={[styles.matterPillText, evMatterId === m.id && styles.matterPillTextActive]}>{m.matter_ref}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput style={styles.input} value={evTitle} onChangeText={setEvTitle} placeholder="Hearing title or description" placeholderTextColor={colors.inkTertiary} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DATE</Text>
              <TextInput style={styles.input} value={evDate} onChangeText={setEvDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TIME</Text>
              <TextInput style={styles.input} value={evTime} onChangeText={setEvTime} placeholder="HH:MM" placeholderTextColor={colors.inkTertiary} />
            </View>
          </View>
          <Text style={styles.fieldLabel}>LOCATION</Text>
          <TextInput style={[styles.input, { marginBottom: 20 }]} value={evLocation} onChangeText={setEvLocation} placeholder="Court room, address, or Video Call" placeholderTextColor={colors.inkTertiary} />
          <TouchableOpacity style={styles.submitBtn} onPress={addEvent} disabled={submitting || !evTitle || !evDate || !evMatterId}>
            <Text style={styles.submitBtnText}>Add event to calendar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function evColor(type: string) { if (type === 'hearing') return colors.amber; if (type === 'deadline') return colors.red; if (type === 'meeting') return colors.burgundy; return colors.inkSecondary; }
function evBg(type: string) { if (type === 'hearing') return colors.amberBg; if (type === 'deadline') return colors.redBg; if (type === 'meeting') return colors.roseTint; return colors.borderLight; }
function fmtDT(iso: string) { return new Date(iso).toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink },
  monthLabel: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  monthStrip: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  dayCell: { width: 44, paddingVertical: 8, borderRadius: 12, alignItems: 'center', gap: 2, backgroundColor: 'transparent' },
  dayCellSelected: { backgroundColor: colors.burgundy },
  dayCellToday: { backgroundColor: colors.roseTint },
  dayLetter: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkTertiary, letterSpacing: 0.3 },
  dayLetterSelected: { color: 'rgba(246,241,234,0.8)' },
  dayLetterToday: { color: colors.burgundy },
  dayNum: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink },
  dayNumSelected: { color: '#fff' },
  dayNumToday: { color: colors.burgundy },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.burgundy, marginTop: 1 },
  dotSelected: { backgroundColor: 'rgba(246,241,234,0.7)' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  pendingCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brassLight, padding: 14, marginBottom: 14 },
  pendingLabel: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 9, color: colors.amber, letterSpacing: 1.5, marginBottom: 4 },
  pendingTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
  pendingDate: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, marginTop: 2, marginBottom: 4 },
  pendingAgenda: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 13, color: colors.inkSecondary, lineHeight: 18, marginBottom: 10 },
  apptBtns: { flexDirection: 'row', gap: 8 },
  apptBtn: { flex: 1, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.green },
  rejectBtn: { backgroundColor: colors.borderLight },
  acceptText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.green },
  rejectText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.inkSecondary },

  daySection: { gap: 8 },
  daySectionLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  evBar: { width: 3, borderRadius: 999, alignSelf: 'stretch', minHeight: 40 },
  evTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  evMeta: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 12, color: colors.inkSecondary, marginTop: 2 },
  evTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  evTypeBadgeText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, textTransform: 'capitalize' },
  emptyDay: { paddingVertical: 32, alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  emptyDayText: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.inkSecondary },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,21,18,0.55)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 18, color: colors.ink, marginBottom: 20 },
  fieldLabel: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 10, color: colors.inkMuted, letterSpacing: 1.5, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border },
  typePillActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  typePillText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.inkSecondary },
  typePillTextActive: { color: '#fff' },
  matterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, marginRight: 6 },
  matterPillActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  matterPillText: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 12, color: colors.inkSecondary },
  matterPillTextActive: { color: '#fff' },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cream, paddingHorizontal: 14, fontFamily: 'HankenGrotesk_400Regular', fontSize: 14, color: colors.ink, marginBottom: 12 },
  twoCol: { flexDirection: 'row', gap: 10 },
  submitBtn: { height: 54, borderRadius: 14, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: '#fff' },
});
