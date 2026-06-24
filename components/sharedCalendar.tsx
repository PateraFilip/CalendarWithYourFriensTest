// sharedCalendar.tsx

import { fetchColors } from '@/services/users/get_colors'
import { fetchEventsException } from '@/services/events/get_event_exceptions'
import { fetchEvents } from '@/services/events/get_events'
import { fetchUsers } from '@/services/users/get_users'
import { CellModal } from '@/components/CellModal'
import DayCalendar from '@/components/CustomDay/CustomDay'
import MonthCalendar from '@/components/CustomMonth/CustomMonth'
import WeekCalendar from '@/components/CustomWeek/CustomWeek'
import { FilterModal } from '@/components/FilterModal'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useNewEvent } from '@/contexts/NewEventContext'
import { useAuth } from '@/hooks/useAuth'
import { useThemeColor } from '@/hooks/use-theme-color'
import { requestUserPermission } from '@/hooks/useNotificationHandler'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { registerAndSavePushToken } from '@/lib/push-notifications'
import { loadStorage, saveStorage } from '@/lib/storage'
import { createClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SegmentedButtons } from 'react-native-paper'

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface WeeklyEvent { id: number; title: string; cas_od: Date; cas_do: Date; user_id: number; den: string; }
interface Event { id: number; title: string; start: Date; end: Date; user_id: number; pocet_lidi: number; pravidelnost: boolean; is_group: boolean; original_start?: Date; original_end?: Date; }
interface EventException { id: number; start: Date; end: Date; event_id: number; typ: string; puvodni_start: Date; puvodni_end: Date; }
interface Color { id: number; name: string; background_color: string; text_color: string; user_id: string | null; }
interface User { id: number; username: string; jmeno: string; prijmeni: string; email: string; datum_narozeni: string }

dayjs.locale('cs')

const weeklyEvents: WeeklyEvent[] = []

export default function SharedCalendar() {
    const SCREEN_HEIGHT = Dimensions.get('window').height
    const router = useRouter()

    const [users, setUsers] = useState<User[]>([])
    const [colors, setColors] = useState<Color[]>([])
    const { user } = useAuth()
    const { openNewEvent } = useNewEvent()

    const { calendar, day } = useLocalSearchParams();
    const [selectedDate, setSelectedDate] = useState<Date | null>(day ? new Date(day as string) : new Date());
    const [visibleDate, setVisibleDate] = useState<Date>(day ? new Date(day as string) : new Date());
    const [selectedIndex, setSelectedIndex] = useState(calendar ? Number(calendar) : 1);

    const { events, eventException, isLoading: isEventsLoading } = useCalendarEvents(user, visibleDate);

    // 🌟 POUZE TENTO JEDEN JEDINÝ STAV: Obsahuje pole IDček odškrtnutých uživatelů
    const [uncheckedUserIds, setUncheckedUserIds] = useState<number[]>([]);

    const textColor = useThemeColor({}, 'text');

    useEffect(() => {
        (async () => {
            try {
                const stored = await loadStorage('uncheckedUsersArray');
                if (stored) {
                    setUncheckedUserIds(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Chyba při načítání filtru:', e);
            }
        })();
    }, []);

    const handleToggleUser = (userId: number) => {
        setUncheckedUserIds(prev => {
            let nextState;
            if (prev.includes(userId)) {
                nextState = prev.filter(id => id !== userId);
            } else {
                nextState = [...prev, userId];
            }
            saveStorage('uncheckedUsersArray', JSON.stringify(nextState)).catch(e => console.error(e));
            return nextState;
        });
    };

    // Filtrování událostí
    const filteredEvents = useMemo(() => {
        if (uncheckedUserIds.length === 0) return events;
        return events.filter(e => e.is_group === true || !uncheckedUserIds.includes(e.user_id));
    }, [events, uncheckedUserIds]);

    const filteredWeeklyEvents = useMemo(() => {
        if (uncheckedUserIds.length === 0) return weeklyEvents;
        return weeklyEvents.filter(e => !uncheckedUserIds.includes(e.user_id));
    }, [uncheckedUserIds]);


    useEffect(() => {
        requestUserPermission()
        const initNotifications = async () => { if (user?.auth_user_id) await registerAndSavePushToken(user.auth_user_id); };
        initNotifications();
    }, [user]);

    const loadColors = async () => { try { const data = await fetchColors(); setColors(data) } catch (err) { console.error(err) } }

    useEffect(() => {
        let mounted = true;
        const loadUsers = async () => { try { const data = await fetchUsers(); if (mounted) setUsers(data); } catch (err) { console.error(err) } }

        loadColors(); loadUsers();

        const channelColors = supabase.channel('realtime:public:colors').on('postgres_changes', { event: '*', schema: 'public', table: 'colors' }, () => { if (mounted) loadColors(); }).subscribe();
        const channelUsers = supabase.channel('realtime:public:users').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => { if (mounted) loadUsers(); }).subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channelColors); supabase.removeChannel(channelUsers);
        };
    }, []);

    const [cellModalVisible, setCellModalVisible] = useState(false)
    const [pendingCreateDate, setPendingCreateDate] = useState<Date | null>(null)
    const [filterModalVisible, setFilterModalVisible] = useState(false)

    useEffect(() => {
        if (calendar) setSelectedIndex(Number(calendar));
        if (day) setSelectedDate(new Date(day as string));
    }, [calendar, day]);

    const selectCalendar = () => {
        // Kalendář se vždy vykreslí, loader jen překryjeme nebo ukážeme vedle
        return (
            <>
                {isEventsLoading && (
                    <ThemedView style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 10, alignItems: 'center' }}>
                        <ThemedView style={{ backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                            <Text style={{ color: 'white' }}>Načítání událostí...</Text>
                        </ThemedView>
                    </ThemedView>
                )}
                {selectedIndex === 1 ? (
                    <WeekCalendar events={filteredEvents} weeklyEvents={filteredWeeklyEvents} eventsException={eventException} defaultDate={visibleDate} onPressCell={(date) => { setSelectedDate(date); setCellModalVisible(true) }} onPressDay={(date) => { setSelectedDate(date); setSelectedIndex(0) }} onPressEvent={(event) => { setSelectedDate(event.start); setCellModalVisible(true); }} hourHeight={(SCREEN_HEIGHT - 170) / 7} colors={colors} onVisibleDateChange={setVisibleDate} />
                ) : selectedIndex === 0 ? (
                    <DayCalendar events={filteredEvents} weeklyEvents={filteredWeeklyEvents} eventsException={eventException} defaultDate={visibleDate} onPressCell={(date) => { setSelectedDate(date); setCellModalVisible(true) }} hourHeight={100} colors={colors} onVisibleDateChange={setVisibleDate} />
                ) : (
                    <MonthCalendar events={filteredEvents} weeklyEvents={filteredWeeklyEvents} eventsException={eventException} defaultDate={visibleDate} onPressDay={(date) => { setSelectedDate(date); setSelectedIndex(0) }} onPressEvent={(event) => { setSelectedDate(event.start); setCellModalVisible(true); }} colors={colors} onVisibleDateChange={setVisibleDate} />
                )}
            </>
        );
    }

    useEffect(() => {
        if (!cellModalVisible && pendingCreateDate) { openNewEvent(pendingCreateDate); setPendingCreateDate(null); }
    }, [cellModalVisible, pendingCreateDate, openNewEvent])

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginVertical: 4 }}>
                <SegmentedButtons
                    value={String(selectedIndex)}
                    onValueChange={(value) => setSelectedIndex(Number(value))}
                    buttons={[{ value: '0', label: 'Den', }, { value: '1', label: 'Týden' }, { value: '2', label: 'Měsíc' }]}
                    style={{ flex: 1, marginRight: 8 }}
                />

                {/* 🌟 NATIVNÍ TLAČÍTKO MÍSTO PAPER KNIHOVNY: Zabrání zpožděnému vykreslování */}
                <TouchableOpacity
                    onPress={() => setFilterModalVisible(true)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: useThemeColor({ light: '#e6e0f8', dark: '#444' }, 'background'), // dynamická barva pozadí
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 20
                    }}
                >
                    <IconSymbol color={textColor} name="filter.fill" />
                    <ThemedText style={{ fontWeight: 'bold', marginLeft: 4 }}>
                        ({uncheckedUserIds.length})
                    </ThemedText>
                </TouchableOpacity>
            </ThemedView>

            {selectCalendar()}

            <CellModal visible={cellModalVisible} date={selectedDate} events={events} weeklyEvents={weeklyEvents} colors={colors} users={users} eventsException={eventException}
                onCreateEvent={() => { setPendingCreateDate(selectedDate ?? new Date()); setCellModalVisible(false); }}
                onPressEvent={(event: Event) => { setCellModalVisible(false); router.push({ pathname: `/events/${event.id}`, params: { event: JSON.stringify(event) } }) }}
                onDismiss={() => setCellModalVisible(false)}
            />

            <FilterModal
                visible={filterModalVisible}
                uncheckedUserIds={uncheckedUserIds}
                users={users}
                onToggleUser={handleToggleUser}
                onDismiss={() => setFilterModalVisible(false)}
                colors={colors}
            />
        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({ container: { flex: 1 } })
