import { cancelEvent } from '@/services/events/cancel_event'
import { fetchUserEvents, UserEvent } from '@/services/events/getUserEvents'
import { joinEvent } from '@/services/events/join_event'
import { ThemedText } from '@/components/themed-text'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import { useAppData } from '@/contexts/AppDataContext'
import { dedupeCalendarEvents, eventInstanceKey } from '@/lib/calendarEvents'
import { getEventParticipants } from '@/lib/eventParticipants'
import { supabase } from '@/lib/supabaseClient'
import dayjs from 'dayjs'
import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button, Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'
import { router } from 'expo-router'

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
        original_start?: Date;
        original_end?: Date;
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
    users: {
        id: number;
        username: string;
        jmeno: string;
        prijmeni: string;
        email: string;
        datum_narozeni: string
    }[]
}

export const CellModal: React.FC<CellModalProps> = ({ visible,
    date,
    events,
    weeklyEvents,
    colors,
    users,
    onCreateEvent,
    onDismiss,
    onPressEvent }) => {

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')
    const { user } = useAuth()
    const { userEvents: appUserEvents } = useAppData()
    const [localUserEvents, setLocalUserEvents] = useState<UserEvent[]>([])

    const userEvents = useMemo(() => {
        const map = new Map<string, UserEvent>()
        for (const ue of [...(appUserEvents as UserEvent[] | undefined || []), ...localUserEvents]) {
            const key = `${ue.event_id}|${ue.user_id}|${ue.instance_date ?? ''}`
            map.set(key, ue)
        }
        return Array.from(map.values())
    }, [appUserEvents, localUserEvents])

    const loadUserEvent = async () => {
        try {
            const data = await fetchUserEvents()
            setLocalUserEvents(data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        if (!visible) return
        void loadUserEvent()
    }, [visible])

    useEffect(() => {
        let mounted = true;

        void loadUserEvent()

        const channel = supabase.channel('realtime:public:user_events');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'event_users'
        }, () => {
            if (mounted) void loadUserEvent();
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);


    function onJoinEvent(event_id: number, isRecurring: boolean, eventDate: Date) {
        if (!user?.id) {
            console.error("Uživatel není přihlášen!");
            return;
        }

        const joinParams = {
            user_id: user.id,
            event_id: event_id,
            instance_date: isRecurring ? dayjs(eventDate).format('YYYY-MM-DD') : undefined,
        };

        joinEvent(joinParams).then(() => loadUserEvent()).catch(console.error);
    }

    function onCancelEvent(event_id: number, isRecurring: boolean, eventDate: Date) {
        if (!user?.id) {
            console.error("Uživatel není přihlášen!");
            return;
        }

        const cancelParams = {
            user_id: user.id,
            event_id: event_id,
            instance_date: isRecurring ? dayjs(eventDate).format('YYYY-MM-DD') : undefined,
        };

        cancelEvent(cancelParams).then(() => loadUserEvent()).catch(console.error);
    }

    if (!date) return null

    const hourStart = dayjs(date).startOf('hour').toDate()
    const hourEnd = dayjs(date).startOf('hour').add(1, 'hour').toDate()
    const hourEvents = dedupeCalendarEvents(
        events.filter((e) => e.start < hourEnd && e.end > hourStart)
    ) as any[]
    void weeklyEvents

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
                            keyExtractor={(item) => eventInstanceKey(item)}
                            style={{ maxHeight: 500 }}
                            renderItem={({ item }) => {
                                const relevantUserEvents = item.is_group
                                    ? getEventParticipants(userEvents, item)
                                    : []
                                const count = relevantUserEvents.length;
                                const userJoined = relevantUserEvents.filter(
                                    (u) => String(u.user_id) === String(user?.id)
                                )
                                const colorObj = colors.find(c => String(c.user_id) === String(item.user_id));
                                const backgroundColor = item.is_group ? '#FF00AA' : colorObj?.background_color ?? '#ccc';
                                const textColor = item.is_group ? '#FFFFFF' : colorObj?.text_color ?? '#000';
                                const owner = users.find(u => String(u.id) === String(item.user_id));
                                const ownerName = owner?.username || owner?.jmeno || 'Neznámý';

                                return (
                                    <TouchableOpacity
                                        onPress={() => onPressEvent?.(item)}
                                        style={[styles.eventItem, { backgroundColor: backgroundColor, borderWidth: 1, borderColor: item.is_group ? "yellow" : buttonColor }]}
                                    >
                                        <View style={[styles.eventItem, { backgroundColor: backgroundColor }]}>
                                            <View style={{ flexDirection: 'row', justifyContent: "space-between" }}>
                                                <Text style={[styles.eventTitle, { color: textColor }]}>{item.title}</Text>
                                                {item.is_group && (
                                                    <Text style={[styles.eventTime, { color: textColor }]}>
                                                        {count}/{item.pocet_lidi}
                                                    </Text>
                                                )}
                                            </View>
                                            {!item.is_group ? (
                                                <View style={styles.ownerRow}>
                                                    <View
                                                        style={[
                                                            styles.ownerDot,
                                                            {
                                                                backgroundColor: backgroundColor,
                                                                borderColor: textColor,
                                                            },
                                                        ]}
                                                    />
                                                    <Text style={[styles.eventTime, { color: textColor }]}>
                                                        {ownerName}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.ownerRow}>
                                                    <Text style={[styles.eventTime, { color: textColor, flexShrink: 1 }]}>
                                                        {relevantUserEvents.length > 0
                                                            ? relevantUserEvents.map((ue, idx) => {
                                                                const participant = users.find(
                                                                    (u) => String(u.id) === String(ue.user_id)
                                                                );
                                                                const name =
                                                                    participant?.username ||
                                                                    participant?.jmeno ||
                                                                    `User ${ue.user_id}`;
                                                                const userColor =
                                                                    colors.find(
                                                                        (c) =>
                                                                            String(c.user_id) ===
                                                                            String(ue.user_id)
                                                                    )?.background_color || '#ccc';
                                                                return (
                                                                    <Text
                                                                        key={`${ue.event_id}-${ue.user_id}-${idx}`}
                                                                        style={{ color: textColor, fontSize: 13 }}
                                                                    >
                                                                        <Text style={{ color: userColor }}>● </Text>
                                                                        {name}
                                                                        {idx < relevantUserEvents.length - 1
                                                                            ? ', '
                                                                            : ''}
                                                                    </Text>
                                                                );
                                                            })
                                                            : (
                                                                <Text style={{ color: textColor, fontSize: 13, opacity: 0.85 }}>
                                                                    Žádní účastníci
                                                                </Text>
                                                            )}
                                                    </Text>
                                                </View>
                                            )}
                                            <Text style={[styles.eventTime, { color: textColor }]}>
                                                {(() => {
                                                    const startDate = (item as any).original_start || item.start;
                                                    const endDate = (item as any).original_end || item.end;
                                                    return dayjs(startDate).format('D. MMMM YYYY') === dayjs(endDate).format('D. MMMM YYYY')
                                                        ? `${dayjs(startDate).format('D. MMMM YYYY  HH:mm')} - ${dayjs(endDate).format('HH:mm')}`
                                                        : `${dayjs(startDate).format('D. MMMM YYYY  HH:mm')} - ${dayjs(endDate).format('D. MMMM YYYY  HH:mm')}`;
                                                })()}
                                            </Text>
                                            {item.is_group && item.pocet_lidi > count && userJoined.length != 1 && (
                                                <Button
                                                    mode="contained"
                                                    onPress={() => onJoinEvent(item.id, item.pravidelnost, item.start)}
                                                    buttonColor={buttonColor}
                                                    labelStyle={{ color: buttonTextColor }}
                                                    style={styles.createButton}
                                                >
                                                    Přidat se
                                                </Button>
                                            )}
                                            {item.is_group && userJoined.length == 1 && (
                                                <Button
                                                    mode="contained"
                                                    onPress={() => onCancelEvent(item.id, item.pravidelnost, item.start)}
                                                    buttonColor={buttonColor}
                                                    labelStyle={{ color: buttonTextColor }}
                                                    style={styles.createButton}
                                                >
                                                    Zrušit účast
                                                </Button>
                                            )}
                                            {!item.is_group && userJoined.length > 0 && (
                                                <View style={styles.chatButtonsRow}>
                                                    <Button
                                                        mode="outlined"
                                                        onPress={() => router.push({
                                                            pathname: `/events/[id]/chat`,
                                                            params: { id: item.id, event_title: item.title }
                                                        })}
                                                        style={[styles.chatButton, { flex: 1, marginRight: 4, borderColor: buttonColor }]}
                                                        labelStyle={{ color: textColor, fontSize: 11 }}
                                                    >
                                                        Obecný Chat
                                                    </Button>
                                                    {item.pravidelnost && (
                                                        <Button
                                                            mode="outlined"
                                                            onPress={() => router.push({
                                                                pathname: `/events/[id]/chat`,
                                                                params: { id: item.id, instance_date: dayjs(item.start).format('YYYY-MM-DD'), event_title: item.title }
                                                            })}
                                                            style={[styles.chatButton, { flex: 1, marginLeft: 4, borderColor: buttonColor }]}
                                                            labelStyle={{ color: textColor, fontSize: 11 }}
                                                        >
                                                            Chat k datu
                                                        </Button>
                                                    )}
                                                </View>
                                            )}

                                        </View>
                                    </TouchableOpacity>
                                )
                            }}

                        />
                    ) : (
                        <ThemedText>
                            Žádné události v tuto hodinu
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
    ownerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 2,
        flexWrap: 'wrap',
    },
    ownerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
        borderWidth: 0.5,
    },
    createButton: {
        borderRadius: 6,
    },
    chatButtonsRow: {
        flexDirection: 'row',
        marginTop: 8,
        justifyContent: 'space-between',
    },
    chatButton: {
        borderRadius: 6,
    },
})
