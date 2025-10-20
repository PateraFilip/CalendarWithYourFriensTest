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

interface MonthCalendarProps {
    events: Event[];
    onPressDay?: (date: Date) => void;
    defaultDate?: Date;
}

export default function MonthCalendar({ events, onPressDay, defaultDate }: MonthCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(defaultDate || new Date());
    const SCREEN_HEIGHT = Dimensions.get('window').height;

    // Předdefinované barvy
    const COLORS = [
        '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
        '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
        '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
        '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
    ];

    const COLORS_TEXT = [
        '#FFFFFF', // e6194b
        '#FFFFFF', // 3cb44b
        '#000000', // ffe119
        '#FFFFFF', // 4363d8
        '#FFFFFF', // f58231
        '#FFFFFF', // 911eb4
        '#000000', // 46f0f0
        '#FFFFFF', // f032e6
        '#000000', // bcf60c
        '#000000', // fabebe
        '#FFFFFF', // 008080
        '#000000', // e6beff
        '#FFFFFF', // 9a6324
        '#000000', // fffac8
        '#FFFFFF', // 800000
        '#000000', // aaffc3
        '#FFFFFF', // 808000
        '#000000', // ffd8b1
        '#FFFFFF', // 000075
        '#FFFFFF', // 808080
    ];

    // Funkce na přiřazení barvy podle userId
    function getColorByUserId(userId: string | number) {
        const idNum = typeof userId === 'string'
            ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            : userId;

        return COLORS[idNum % COLORS.length];
    }

    function getColorTextByUserId(userId: string | number) {
        const idNum = typeof userId === 'string'
            ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            : userId;

        return COLORS_TEXT[idNum % COLORS.length];
    }


    // Funkce pro získání prvního dne v měsíci
    const firstDayOfMonth = useMemo(() => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        return d;
    }, [currentMonth]);

    // Funkce pro získání všech dní viditelných v kalendáři (včetně "padding" dní před a po)
    const days = useMemo(() => {
        const startDay = firstDayOfMonth.getDay(); // 0 = neděle
        const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

        const daysArray: (Date | null)[] = [];

        // přidání prázdných dní před začátkem měsíce (pondělí = 1, pokud chceme pondělí jako první den)
        const paddingBefore = (startDay + 6) % 7;
        for (let i = 0; i < paddingBefore; i++) daysArray.push(null);

        // samotné dny měsíce
        for (let i = 1; i <= totalDays; i++) {
            daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
        }

        // doplnění prázdných dní, aby byl počet dnů násobkem 7
        while (daysArray.length % 7 !== 0) daysArray.push(null);

        return daysArray;
    }, [currentMonth, firstDayOfMonth]);

    const handlePrevMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const getEventsForDay = (day: Date) => {
        return events.filter(
            e =>
                e.start.getFullYear() === day.getFullYear() &&
                e.start.getMonth() === day.getMonth() &&
                e.start.getDate() === day.getDate()
        );
    };

    return (
        <ThemedView style={{ flex: 1 }}>
            {/* 🔹 Navigace mezi měsíci */}
            <ThemedView style={styles.navBar}>
                <Pressable onPress={handlePrevMonth} style={styles.navButton}>
                    <ThemedText style={styles.navText}>← Předchozí</ThemedText>
                </Pressable>
                <ThemedText style={styles.headerTitle}>
                    {currentMonth.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
                </ThemedText>
                <Pressable onPress={handleNextMonth} style={styles.navButton}>
                    <ThemedText style={styles.navText}>Další →</ThemedText>
                </Pressable>
            </ThemedView>

            {/* 📅 Kalendářní mřížka */}
            <ThemedView style={{ flex: 1, backgroundColor: "white", height: SCREEN_HEIGHT - 100 }}>
                <ThemedView style={styles.weekDays}>
                    {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map((d, i) => (
                        <ThemedView key={i} style={styles.weekDayCell}>
                            <ThemedText style={{ fontWeight: '600' }}>{d}</ThemedText>
                        </ThemedView>
                    ))}
                </ThemedView>

                <ThemedView style={{ marginTop: 0, flex: 1 }}>
                    {Array.from({ length: days.length / 7 }).map((_, rowIndex) => (
                        <ThemedView key={rowIndex} style={{ flexDirection: 'row', flex: 1 }}>
                            {days.slice(rowIndex * 7, rowIndex * 7 + 7).map((day, index) => {
                                if (!day) return <ThemedView key={index} style={styles.dayCell} />;

                                const dayEvents = getEventsForDay(day);

                                return (
                                    <ThemedView key={index} style={styles.dayCell}>
                                        <Pressable
                                            onPress={() => onPressDay?.(day)}
                                        >
                                            <ThemedText style={{ fontWeight: '500', margin: 2 }}>{day.getDate()}</ThemedText>
                                        </Pressable>

                                        {dayEvents.length > 0 && (
                                            <ScrollView
                                                nestedScrollEnabled
                                                showsVerticalScrollIndicator
                                            >
                                                {dayEvents.map((e, idx) => (
                                                    <Pressable
                                                        key={idx}
                                                        style={[styles.eventBadge, { backgroundColor: getColorByUserId(e.user_id) }]}
                                                        onPress={() => onPressDay?.(day)}
                                                    >
                                                        <ThemedText style={{ fontSize: 10, lineHeight: 18, color: getColorTextByUserId(e.user_id) }}>{e.title}</ThemedText>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        )}
                                        <Pressable
                                            onPress={() => onPressDay?.(day)}
                                            style={{ flex: 1 }}
                                        >
                                        </Pressable>
                                    </ThemedView>

                                );
                            })}
                        </ThemedView>
                    ))}
                </ThemedView>

            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
    },
    navButton: {
        padding: 6,
    },
    navText: {
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    weekDays: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderColor: '#ccc',
    },
    weekDayCell: {
        flex: 1,
        padding: 6,
        alignItems: 'center',
        borderRightWidth: 0.5,
        borderColor: '#ccc',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: `${100 / 7}%`,
        height: "100%",
        borderWidth: 0.5,
        borderColor: '#ccc'
    },
    dayCellPress: {
        width: `100%`,
        flex: 1,
        borderWidth: 0.5,
        borderColor: '#ccc'
    },
    eventBadge: {
        borderRadius: 8,
        paddingHorizontal: 2,
        height: 18,
        paddingTop: 0
    },
});
