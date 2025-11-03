import { fetchUserEvents } from '@/api/getUserEvents'
import { joinEvent } from '@/api/join_event'
import { ThemedText } from '@/components/themed-text'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button, Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface CellModalProps {
    visible: boolean
    date: Date | null
    events: {
        id: number;
        title: string;
        start: Date;
        end: Date;
        user_id: number;
        pocet_lidi: number;
        pravidelnost: boolean;
        is_group: boolean;
    }[]
    weeklyEvents: {
        id: number;
        title: string;
        cas_od: Date;
        cas_do: Date;
        user_id: number;
        den: string;
    }[]
    onCreateEvent: () => void
    onDismiss: () => void
    onPressEvent?: (event: Event) => void;
    colors: {
        id: number;
        name: string;
        background_color: string;
        text_color: string;
        user_id: number;
    }[]
}

interface UserEvent {
    event_id: number;
    user_id: number;
}

export const CellModal: React.FC<CellModalProps> = ({ visible,
    date,
    events,
    weeklyEvents,
    colors,
    onCreateEvent,
    onDismiss,
    onPressEvent }) => {

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')
    const { user } = useAuth()
    const [userEvents, setUserEvents] = useState<UserEvent[]>([])

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


    function onJoinEvent(event_id: number) {
        if (!user?.id) {
            console.error("Uživatel není přihlášen!");
            return;
        }

        const joinParams = {
            user_id: user.id,
            event_id: event_id,
        };

        joinEvent(joinParams);
    }

    if (!date) return null
    const hourEvents = [
        // Jednorázové eventy
        ...events.filter(e =>
            e.start.getTime() < date.getTime() + 60 * 60 * 1000 &&
            e.end.getTime() > date.getTime()
        ),

        // Týdenní eventy
        ...weeklyEvents
            .filter(w => {
                const daysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
                const eventDay = daysShort[date.getDay()];
                const eventDayPrev = daysShort[(date.getDay() + 6) % 7]
                if ((w.den.trim().normalize() !== eventDay && w.den.trim().normalize() !== eventDayPrev) || (w.den.trim().normalize() === eventDayPrev && w.cas_do > w.cas_od)) return;

                const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
                let end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
                if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
                else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);

                // zkontroluj, jestli spadá do této hodiny
                return start.getTime() < date.getTime() + 60 * 60 * 1000 && end.getTime() > date.getTime();
            })
            .map(w => {
                const daysShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
                const eventDay = daysShort[date.getDay()];
                const eventDayPrev = daysShort[(date.getDay() + 6) % 7]
                const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_od.getHours(), w.cas_od.getMinutes());
                let end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), w.cas_do.getHours(), w.cas_do.getMinutes());
                if (end < start && w.den.trim().normalize() === eventDay) end.setDate(end.getDate() + 1);
                else if (end < start && w.den.trim().normalize() === eventDayPrev) start.setDate(start.getDate() - 1);


                // běžný výstup
                return {
                    id: w.id,
                    title: w.title,
                    start,
                    end,
                    user_id: w.user_id,
                    pocet_lidi: 1,
                    pravidelnost: true,
                    is_group: false,
                };
            })
    ];

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        {capitalize(dayjs(date).format('dddd D. MMMM YYYY - HH:mm'))}
                    </ThemedText>

                    {hourEvents.length > 0 ? (
                        <FlatList
                            data={hourEvents}
                            keyExtractor={(_, i) => i.toString()}
                            style={{ maxHeight: 500 }}
                            renderItem={({ item }) => {
                                // 🧮 Spočítej, kolikrát se item.id vyskytuje v userEvents.event_id
                                const count = userEvents.filter(u => u.event_id === item.id).length;
                                const userJoined = userEvents.filter(u => u.event_id === item.id && u.user_id === user?.id)
                                const colorObj = colors.find(c => c.user_id === item.user_id); // najde barvu pro daného uživatele
                                const backgroundColor = item.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc'; // fallback pokud není barva
                                const textColor = item.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';

                                return (
                                    <TouchableOpacity
                                        onPress={() => onPressEvent?.(item)}
                                        style={[styles.eventItem, { backgroundColor: backgroundColor, borderWidth: 1, borderColor: item.is_group ? "yellow" : buttonColor }]}
                                    >
                                        <View style={[styles.eventItem, { backgroundColor: backgroundColor }]}>
                                            <View style={{ flexDirection: 'row', justifyContent: "space-between" }}>
                                                <Text style={[styles.eventTitle, { color: textColor }]}>{item.title}</Text>
                                                {item.is_group && (<Text style={[styles.eventTime, { color: textColor }]}>{count}/{item.pocet_lidi}</Text>)}
                                            </View>
                                            <Text style={[styles.eventTime, { color: textColor }]}>
                                                {dayjs(item.start).format('D. MMMM YYYY  HH:mm')} - {dayjs(item.end).format('D. MMMM YYYY  HH:mm')}
                                            </Text>
                                            {item.is_group && item.pocet_lidi > count && userJoined.length != 1 && (
                                                <Button
                                                    mode="contained"
                                                    onPress={() => onJoinEvent(item.id)}
                                                    buttonColor={buttonColor}
                                                    labelStyle={{ color: buttonTextColor }}
                                                    style={styles.createButton}
                                                >
                                                    Přidat se
                                                </Button>
                                            )}

                                        </View>
                                    </TouchableOpacity>
                                )
                            }}

                        />
                    ) : (
                        <ThemedText>
                            Žádné události pro tento den
                        </ThemedText>
                    )}

                    <Button
                        mode="contained"
                        onPress={onCreateEvent}
                        buttonColor={buttonColor}
                        labelStyle={{ color: buttonTextColor }}
                        style={styles.createButton}
                    >
                        Vytvořit událost
                    </Button>
                </ThemedView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        margin: 20,
    },
    content: {
        padding: 20,
        borderRadius: 20,
        gap: 16,
    },
    title: {
        textAlign: 'center',
    },
    eventItem: {
        borderRadius: 8,
        padding: 10,
        marginVertical: 6,
    },
    eventTitle: {
        fontWeight: '600',
    },
    eventTime: {
        fontSize: 13,
    },
    createButton: {
        borderRadius: 6,
    },
})
