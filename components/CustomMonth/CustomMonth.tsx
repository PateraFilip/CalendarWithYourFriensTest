import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface Event {
    title: string;
    start: Date;
    end: Date;
    user_id: number;
    pocet_lidi: number;
    pravidelnost: boolean;
    is_group: boolean;
}

interface WeeklyEvent {
    title: string;
    cas_od: Date;
    cas_do: Date;
    user_id: number;
    den: string;
}

interface MonthCalendarProps {
    events: Event[];
    weeklyEvents: WeeklyEvent[];
    onPressDay?: (date: Date) => void;
    defaultDate?: Date;
}

const COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
    '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

const COLORS_TEXT = [
    '#FFF', '#FFF', '#000', '#FFF', '#FFF',
    '#FFF', '#000', '#FFF', '#000', '#000',
    '#FFF', '#000', '#FFF', '#000', '#FFF',
    '#000', '#FFF', '#000', '#FFF', '#FFF'
];

export default function MonthCalendar({ events, weeklyEvents, onPressDay, defaultDate }: MonthCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(defaultDate || new Date());
    const SCREEN_HEIGHT = Dimensions.get('window').height;

    const getColor = (id: string | number) => {
        const n = typeof id === 'string' ? [...id].reduce((a, c) => a + c.charCodeAt(0), 0) : id;
        return COLORS[n % COLORS.length];
    };
    const getTextColor = (id: string | number) => {
        const n = typeof id === 'string' ? [...id].reduce((a, c) => a + c.charCodeAt(0), 0) : id;
        return COLORS_TEXT[n % COLORS.length];
    };

    const firstDayOfMonth = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);

    const days = useMemo(() => {
        const startDay = (firstDayOfMonth.getDay() + 6) % 7; // pondělí = 0
        const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const daysArray: (Date | null)[] = [];

        for (let i = 0; i < startDay; i++) daysArray.push(null);
        for (let i = 1; i <= totalDays; i++) daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
        while (daysArray.length % 7 !== 0) daysArray.push(null);

        return daysArray;
    }, [currentMonth, firstDayOfMonth]);

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

            if (end < start) {
                if (wDay === weekDay) end.setDate(end.getDate() + 1);
                else if (wDay === weekDayPrev) start.setDate(start.getDate() - 1);
            }

            weeklyDayEvents.push({
                title: w.title,
                start,
                end,
                user_id: w.user_id,
                pocet_lidi: 1,
                pravidelnost: true,
                is_group: false
            });
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

            {/* Kalendářní mřížka */}
            <ScrollView style={{ height: SCREEN_HEIGHT - 100 }}>
                {Array.from({ length: days.length / 7 }).map((_, rowIdx) => (
                    <ThemedView key={rowIdx} style={{ flexDirection: 'row', minHeight: (SCREEN_HEIGHT - 170) / Math.ceil(days.length / 7) }}>
                        {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, idx) => {
                            if (!day) return <ThemedView key={idx} style={styles.dayCell} />;
                            const dayEvents = getEventsForDay(day);

                            return (
                                <ThemedView key={idx} style={styles.dayCell}>
                                    <Pressable onPress={() => onPressDay?.(day)} style={{ padding: 2 }}>
                                        <ThemedText style={{ fontWeight: '500' }}>{day.getDate()}</ThemedText>
                                    </Pressable>

                                    {dayEvents.map((e, i) => (
                                        <Pressable key={i} style={[styles.eventBadge, { backgroundColor: getColor(e.user_id) }]}>
                                            <ThemedText style={{ fontSize: 10, color: getTextColor(e.user_id), lineHeight: 16 }}>{e.title}</ThemedText>
                                        </Pressable>
                                    ))}
                                </ThemedView>
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
