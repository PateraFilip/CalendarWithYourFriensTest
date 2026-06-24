import { fetchUsers } from '@/api/users/get_users';
import { fetchUserEvents } from '@/api/events/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { dedupeCalendarEvents, eventInstanceKey, eventsOverlappingDay, mergeDuplicateEvents } from '@/lib/calendarEvents';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';



interface Event {
    id: number;
    title: string;
    start: Date;
    end: Date;
    user_id: number;
    pocet_lidi: number;
    pravidelnost: boolean;
    is_group: boolean;
    original_start?: Date;
    original_end?: Date;
}

interface WeeklyEvent {
    id: number;
    title: string;
    cas_od: Date;
    cas_do: Date;
    user_id: number;
    den: string;
}

interface EventException {
    id: number;
    start: Date;
    end: Date;
    event_id: number;
    typ: string;
    puvodni_start: Date;
    puvodni_end: Date;
}

interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number;
}

interface MonthCalendarProps {
    events: Event[];
    weeklyEvents: WeeklyEvent[];
    eventsException: EventException[];
    onPressDay?: (date: Date) => void;
    onPressEvent?: (event: Event) => void;
    defaultDate?: Date;
    colors: Color[];
    onVisibleDateChange?: (date: Date | ((prev: Date) => Date)) => void;
}

interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

interface UserEvent {
    event_id: number;
    user_id: number;
    instance_date?: string;
}

const SUPABASE_URL = 'https://sdzyhihtqrgsntbxlugp.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkenloaWh0cXJnc250YnhsdWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDk2MTEsImV4cCI6MjA5NjEyNTYxMX0.4L2K8gmIvWn6FwkECofkvJ-cpFr8hXCZbjxOqpECN38'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function MonthCalendar({ events, weeklyEvents, eventsException, onPressDay, onPressEvent, defaultDate, colors, onVisibleDateChange }: MonthCalendarProps) {
    const currentMonth = defaultDate || new Date();
    const SCREEN_HEIGHT = Dimensions.get('window').height;
    const [users, setUsers] = useState<User[]>([]);
    const [userEvents, setUserEvents] = useState<UserEvent[]>([])
    const insets = useSafeAreaInsets();

    const firstDayOfMonth = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
    const borderColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

    const days = useMemo(() => {
        const startDay = (firstDayOfMonth.getDay() + 6) % 7; // pondělí = 0
        const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const daysArray: (Date | null)[] = [];

        for (let i = 0; i < startDay; i++) daysArray.push(null);
        for (let i = 1; i <= totalDays; i++) daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
        while (daysArray.length % 7 !== 0) daysArray.push(null);

        return daysArray;
    }, [currentMonth, firstDayOfMonth]);

    const loadUsers = async () => {
        try {
            const data = await fetchUsers()
            setUsers(data)
        } catch (err) {
            console.error(err)
        }
    }

    const loadUserEvent = async () => {
        try {
            const data = await fetchUserEvents()
            setUserEvents(data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        let mounted = true;

        loadUsers(); // načtení na start

        const channel = supabase.channel('realtime:public:users');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'users'
        }, (payload) => {
            console.log('Change in users:', payload);
            if (mounted) {
                loadUsers(); // načti nové eventy
            }
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        loadUserEvent()

        const channel = supabase.channel('realtime:public:user_events');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'event_users'
        }, (payload) => {
            console.log('Change in events:', payload);
            if (mounted) loadUserEvent(); // načti nové eventy
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const handlePrevMonth = () => {
        console.log('--- PREV MONTH CLICKED ---');
        onVisibleDateChange?.((prev) => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
            console.log(`[CustomMonth] prev=${prev.toISOString()} -> new=${newDate.toISOString()}`);
            return newDate;
        });
    };
    const handleNextMonth = () => {
        console.log('--- NEXT MONTH CLICKED ---');
        onVisibleDateChange?.((prev) => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            console.log(`[CustomMonth] prev=${prev.toISOString()} -> new=${newDate.toISOString()}`);
            return newDate;
        });
    };

    const eventsByDay = useMemo(() => {
        const map = new Map<string, Event[]>();
        
        events.forEach(e => {
            let startD = new Date(e.start);
            startD.setHours(0,0,0,0);
            const endD = new Date(e.end);
            endD.setHours(23,59,59,999);

            while (startD <= endD) {
                // Přičteme timezone offset, aby toISOString vrátil lokální den
                const localDate = new Date(startD.getTime() - startD.getTimezoneOffset() * 60000);
                const dateStr = localDate.toISOString().split('T')[0];
                if (!map.has(dateStr)) map.set(dateStr, []);
                map.get(dateStr)!.push(e);
                startD.setDate(startD.getDate() + 1);
            }
        });
        
        return map;
    }, [events]);

    const getEventsForDay = (day: Date) => {
        const localDate = new Date(day.getTime() - day.getTimezoneOffset() * 60000);
        const dateStr = localDate.toISOString().split('T')[0];
        return eventsByDay.get(dateStr) || [];
    };



    return (
        <ThemedView style={{ flex: 1 }}>
            {/* Navigace */}
            <ThemedView style={styles.navBar}>
                <Pressable onPress={handlePrevMonth} style={styles.navButton}><ThemedText style={styles.navText}>← Předchozí</ThemedText></Pressable>
                <ThemedText style={styles.headerTitle}>{currentMonth.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}</ThemedText>
                <Pressable onPress={handleNextMonth} style={styles.navButton}><ThemedText style={styles.navText}>Další →</ThemedText></Pressable>
            </ThemedView>

            {/* Dny týdne */}
            <ThemedView style={styles.weekDays}>
                {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d, i) => (
                    <ThemedView key={i} style={styles.weekDayCell}><ThemedText style={{ fontWeight: '600' }}>{d}</ThemedText></ThemedView>
                ))}
            </ThemedView>

            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                {Array.from({ length: days.length / 7 }).map((_, rowIdx) => (
                    <ThemedView key={`row-${rowIdx}`} style={{ flexDirection: 'row', minHeight: (SCREEN_HEIGHT - 170) / Math.ceil(days.length / 7) }}>
                        {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, idx) => {
                            if (!day) return <ThemedView key={`empty-${rowIdx}-${idx}`} style={styles.dayCell} />;
                            const dayEvents = getEventsForDay(day);

                            return (
                                <Pressable key={`day-${day.toISOString()}`} onPress={() => onPressDay?.(day)} style={styles.dayCell}>
                                    <ThemedView key={idx}>
                                        <Pressable onPress={() => onPressDay?.(day)} style={{ padding: 2 }}>
                                            <ThemedText style={{ fontWeight: '500' }}>{day.getDate()}</ThemedText>
                                        </Pressable>

                                        {dayEvents.map((e, i) => {
                                            const colorObj = colors.find(c => c.user_id === e.user_id); // najde barvu pro daného uživatele
                                            const backgroundColor = e.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc'; // fallback pokud není barva
                                            const textColor = e.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';
                                            // Pro pravidelné události filtrujeme podle instance_date
                                            const itemInstanceDate = dayjs(e.start).format('YYYY-MM-DD');
                                            // Check for CLEARED marker for this specific instance
                                            const clearedMarker = userEvents.find(u => u.event_id === e.id && u.instance_date === `CLEARED-${itemInstanceDate}`);
                                            const instanceSpecificEvents = userEvents.filter(u => u.event_id === e.id && u.instance_date === itemInstanceDate);
                                            let relevantUserEvents: any[];
                                            if (e.pravidelnost) {
                                                if (clearedMarker) {
                                                    relevantUserEvents = [];
                                                } else if (instanceSpecificEvents.length > 0) {
                                                    relevantUserEvents = instanceSpecificEvents;
                                                } else {
                                                    relevantUserEvents = userEvents.filter(u => u.event_id === e.id && !u.instance_date);
                                                }
                                            } else {
                                                relevantUserEvents = userEvents.filter(u => u.event_id === e.id && !u.instance_date);
                                            }
                                            const count = relevantUserEvents.length;
                                            return (
                                                <Pressable onPress={() => onPressEvent?.(e)} key={eventInstanceKey(e)} style={[styles.eventBadge, { backgroundColor: backgroundColor, borderWidth: 0.5, borderColor: e.is_group ? "yellow" : borderColor }]}>
                                                    <ThemedText style={{ fontSize: 10, fontWeight: '600', color: textColor, lineHeight: 12 }} numberOfLines={1}>
                                                        {e.title}
                                                    </ThemedText>
                                                    <ThemedText style={{ fontSize: 9, color: textColor, opacity: 0.8, lineHeight: 11 }} numberOfLines={1}>
                                                        {dayjs(e.start).format('HH:mm')} - {dayjs(e.end).format('HH:mm')}
                                                    </ThemedText>
                                                    {e.is_group && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0 }}>
                                                            <ThemedText style={{ fontSize: 8, color: textColor, marginRight: 2, lineHeight: 10 }} numberOfLines={1}>
                                                                {count}/{e.pocet_lidi}
                                                            </ThemedText>
                                                            <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10, flex: 1 }} numberOfLines={1}>
                                                              {relevantUserEvents.map((ue, idx) => {
                                                                const participant = users.find(u => u.id === ue.user_id);
                                                                const name = participant ? participant.username : `User ${ue.user_id}`;
                                                                const userColorObj = colors.find(c => String(c.user_id) === String(ue.user_id));
                                                                const userColor = userColorObj?.background_color || '#ccc';
                                                                return (
                                                                  <ThemedText key={`${ue.event_id}-${ue.user_id}-${idx}`} style={{ fontSize: 8, color: textColor, lineHeight: 10 }}>
                                                                    <ThemedText style={{ color: userColor, fontSize: 8, lineHeight: 10 }}>● </ThemedText>
                                                                    {name}{idx < relevantUserEvents.length - 1 ? ', ' : ''}
                                                                  </ThemedText>
                                                                );
                                                              })}
                                                            </ThemedText>
                                                        </View>
                                                    )}
                                                    {!e.is_group && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 0 }}>
                                                            <View
                                                                style={{
                                                                    width: 6,
                                                                    height: 6,
                                                                    borderRadius: 2,
                                                                    backgroundColor: backgroundColor,
                                                                    marginRight: 1,
                                                                    borderColor: textColor,
                                                                    borderWidth: 0.5,
                                                                }}
                                                            />
                                                            <ThemedText style={{ fontSize: 8, color: textColor, lineHeight: 10 }} numberOfLines={1}>
                                                                {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý'}
                                                            </ThemedText>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            )
                                        })}
                                    </ThemedView>
                                </Pressable>
                            );
                        })}
                    </ThemedView>
                ))}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
    navButton: { padding: 6 },
    navText: { fontWeight: '500' },
    headerTitle: { fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
    weekDays: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#ccc' },
    weekDayCell: { flex: 1, padding: 6, alignItems: 'center', borderRightWidth: 0.5, borderColor: '#ccc' },
    dayCell: { width: `${100 / 7}%`, borderWidth: 0.5, borderColor: '#ccc', flex: 1 },
    eventBadge: { borderRadius: 6, paddingHorizontal: 2, height: 40, marginVertical: 0, justifyContent: 'center' }
});
