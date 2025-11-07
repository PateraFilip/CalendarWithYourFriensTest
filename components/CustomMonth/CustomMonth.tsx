import { fetchUsers } from '@/api/get_users';
import { fetchUserEvents } from '@/api/getUserEvents';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createClient } from '@supabase/supabase-js';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet } from 'react-native';
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
    defaultDate?: Date;
    colors: Color[];
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
}

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function MonthCalendar({ events, weeklyEvents, eventsException, onPressDay, defaultDate, colors }: MonthCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(defaultDate || new Date());
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

    const handlePrevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

    const getEventsForDay = (day: Date) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        // Jednorázové eventy
        const dayEvents = events.filter(e => new Date(e.start) <= dayEnd && new Date(e.end) >= dayStart);

        // Týdenní eventy
        const daysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const weekDay = daysShort[day.getDay()];
        const weekDayPrev = daysShort[(day.getDay() + 6) % 7];

        let weeklyDayEvents: Event[] = [];

        weeklyEvents.forEach(w => {
            const wDay = w.den.trim().normalize();
            if (wDay !== weekDay && wDay !== weekDayPrev) return;

            let start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
            let end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
            const exceptionDelete = eventsException.some(ex =>
                ex.event_id === w.id &&
                new Date(ex.puvodni_start).getTime() === start.getTime() &&
                ex.typ == "DELETE"
            );
            if (end < start) {
                if (wDay === weekDay) end.setDate(end.getDate() + 1);
                else if (wDay === weekDayPrev) start.setDate(start.getDate() - 1);
            }

            const exception = eventsException.find(ex =>
                ex.event_id === w.id &&
                new Date(ex.puvodni_start).getTime() === start.getTime()
            );
            if (exception) {
                console.log(`⚙️ Výjimka nalezena pro event ${w.id}, upravuji časy`);
                start.setTime(new Date(exception.start).getTime());
                end.setTime(new Date(exception.end).getTime());
                if (end < start) {
                    if (wDay === weekDay) end.setDate(end.getDate() + 1);
                    else if (wDay === weekDayPrev) start.setDate(start.getDate() - 1);
                }
            }
            if (exceptionDelete) {
                console.log(`⏭️ Event ${w.id} přeskočen kvůli výjimce`);
                return; // nepushuj tento event
            }
            if (wDay === weekDayPrev && end > start) {
                return
            }

            weeklyDayEvents.push({
                id: w.id,
                title: w.title,
                start,
                end,
                user_id: w.user_id,
                pocet_lidi: 1,
                pravidelnost: true,
                is_group: false
            });
            console.log(weeklyDayEvents)
        });

        // Odebrání duplicit z weeklyDayEvents
        const uniqueWeeklyDayEvents = Array.from(
            new Map(
                weeklyDayEvents.map(e => [`${e.title}_${e.user_id}`, e])
            ).values()
        );

        const uniqueDayEvents = Array.from(
            new Map(
                dayEvents.map(e => [`${e.title}_${e.user_id}`, e])
            ).values()
        );


        return [...uniqueDayEvents, ...uniqueWeeklyDayEvents];
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
                                            const count = userEvents.filter(u => u.event_id === e.id).length;
                                            return (
                                                <Pressable onPress={() => onPressDay?.(day)} key={`event-${e.id}-${day.toISOString()}`} style={[styles.eventBadge, { backgroundColor: backgroundColor, borderWidth: 0.5, borderColor: e.is_group ? "yellow" : borderColor }]}>
                                                    {!e.is_group && (<ThemedText style={{ fontSize: 10, color: textColor, lineHeight: 16 }} numberOfLines={1} ellipsizeMode="tail">{e.title} - {users.find(u => u.id === e.user_id)?.username ?? 'Neznámý uživatel'}</ThemedText>)}
                                                    {e.is_group && (<ThemedText style={{ fontSize: 10, color: textColor, lineHeight: 16 }} numberOfLines={1} ellipsizeMode="tail">{e.title} - {count}/{e.pocet_lidi}</ThemedText>)}
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
    eventBadge: { borderRadius: 6, paddingHorizontal: 2, height: 18, marginVertical: 1, justifyContent: 'center' }
});
