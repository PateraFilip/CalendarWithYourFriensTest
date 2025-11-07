import { fetchColors } from '@/api/get_colors'
import { fetchEventsException } from '@/api/get_event_exceptions'
import { fetchEvents } from '@/api/get_events'
import { fetchWeeklyEvents } from '@/api/get_weekly_events'
import { CellModal } from '@/components/CellModal'
import DayCalendar from '@/components/CustomDay/CustomDay'
import MonthCalendar from '@/components/CustomMonth/CustomMonth'
import WeekCalendar from '@/components/CustomWeek/CustomWeek'
import { FilterModal } from '@/components/FilterModal'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeNotifications } from '@/hooks/useNotificationHandler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApp } from '@react-native-firebase/app'
import { getMessaging, getToken } from '@react-native-firebase/messaging'
import SegmentedControl from '@react-native-segmented-control/segmented-control'
import { createClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import * as Notifications from 'expo-notifications'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Dimensions, StyleSheet } from 'react-native'
import { Button } from 'react-native-paper'
import { ThemedView } from './themed-view'



export async function registerAndSavePushToken(userId: number) {
    try {
        const messaging = getMessaging(getApp());
        const token = await getToken(messaging);
        console.log('FCM token:', token);

        const { error } = await supabase
            .from('user_devices')
            .upsert(
                { user_id: userId, fcm_token: token },
                { onConflict: 'fcm_token' } // <– musí odpovídat UNIQUE constraintu v DB
            );

        if (error) {
            console.error('Chyba při ukládání tokenu:', error);
        } else {
            console.log('Token uložen nebo již existoval ✅');
        }

        return token;
    } catch (err) {
        console.error('Neočekávaná chyba při registraci FCM tokenu:', err);
        return null;
    }
}


const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface WeeklyEvent {
    id: number;
    title: string;
    cas_od: Date;
    cas_do: Date;
    user_id: number;
    den: string;
}

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


dayjs.locale('cs')

export default function SharedCalendar() {
    const SCREEN_HEIGHT = Dimensions.get('window').height
    const router = useRouter()
    const [colors, setColors] = useState<Color[]>([])
    const [events, setEvents] = useState<Event[]>([])
    const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([])
    const [eventException, setEventException] = useState<EventException[]>([])
    const { user } = useAuth()

    async function requestUserPermission() {
        const { status } = await Notifications.getPermissionsAsync()
        if (status !== 'granted') {
            const { status: newStatus } = await Notifications.requestPermissionsAsync()
            if (newStatus !== 'granted') return null
        }
    }


    useEffect(() => {
        requestUserPermission()
    }, [])

    useEffect(() => {
        const initNotifications = async () => {
            if (!user?.id) return; // počkej, dokud user není dostupný
            await registerAndSavePushToken(user.id);
        };

        initNotifications();
    }, [user]);

    const loadEvents = async () => {
        try {
            const data = await fetchEvents()
            setEvents(data)
        } catch (err) {
            console.error(err)
        }
    }

    const loadColors = async () => {
        try {
            const data = await fetchColors()
            setColors(data)
        } catch (err) {
            console.error(err)
        }
    }

    const loadWeeklyEvents = async () => {
        try {
            const data = await fetchWeeklyEvents()
            setWeeklyEvents(data)
        } catch (err) {
            console.error(err)
        }
    }

    const loadEventsException = async () => {
        try {
            const data = await fetchEventsException()
            setEventException(data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        let mounted = true;

        loadColors(); // načtení na start

        const channel = supabase.channel('realtime:public:colors');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'colors'
        }, (payload) => {
            console.log('Change in colors:', payload);
            if (mounted) {
                loadColors(); // načti nové eventy
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

        loadEvents(); // načtení na start
        console.log(events)

        const channel = supabase.channel('realtime:public:events');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'events'
        }, (payload) => {
            console.log('Change in events:', payload);
            if (mounted) {
                useRealtimeNotifications(payload, user)
                loadEvents(); // načti nové eventy
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

        loadWeeklyEvents()

        const channel = supabase.channel('realtime:public:weekly_events');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'weekly_events'
        }, (payload) => {
            console.log('Change in events:', payload);
            if (mounted) loadWeeklyEvents(); // načti nové eventy
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        loadEventsException()

        const channel = supabase.channel('realtime:public:event_exceptions');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'event_exceptions'
        }, (payload) => {
            console.log('Change in events:', payload);
            if (mounted) loadEventsException(); // načti nové eventy
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem('userFilter');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setFilter(parsed);
                    filterEvents(parsed);
                } else {
                    // pokud není nic uložené, zobraz všechny eventy
                    filterEvents({});
                }
            } catch (e) {
                console.error('Chyba při načítání filtru:', e);
            }
        })();
    }, [events, weeklyEvents]); // spustí se i když se změní data


    // run once
    const { calendar, day } = useLocalSearchParams();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [cellModalVisible, setCellModalVisible] = useState(false)
    const [navigateAfterClose, setNavigateAfterClose] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(1)
    const [filterModalVisible, setFilterModalVisible] = useState(false)
    const [filter, setFilter] = useState<{ [id: number]: boolean }>({});
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
    const [filteredWeeklyEvents, setFilteredWeeklyEvents] = useState<WeeklyEvent[]>([])

    useEffect(() => {
        // pokud existuje calendar a day, nastav defaultní hodnoty
        if (calendar) {
            setSelectedIndex(Number(calendar));
        }
        if (day) {
            setSelectedDate(new Date(day));
        }
    }, [calendar, day]);

    const handlePressDay = (date: Date) => {
        setSelectedDate(date)
        setSelectedIndex(0)
    }

    const handleCellPress = (date: Date) => {
        setSelectedDate(date)
        setCellModalVisible(true)
    }

    const filterEvents = (filter: { [id: number]: boolean }) => {
        if (!filter || Object.keys(filter).length === 0) {
            setFilteredEvents(events);
            setFilteredWeeklyEvents(weeklyEvents);
            return;
        }
        setFilteredEvents(events.filter(e => e.is_group === true || filter[e.user_id]));
        setFilteredWeeklyEvents(weeklyEvents.filter(e => filter[e.user_id]));
    };

    const selectCalendar = () => {
        if (selectedIndex === 1) {
            return (
                <WeekCalendar
                    events={filteredEvents}
                    weeklyEvents={filteredWeeklyEvents}
                    eventsException={eventException}
                    onPressCell={handleCellPress}
                    onPressDay={handlePressDay}
                    hourHeight={(SCREEN_HEIGHT - 170) / 7}
                    colors={colors}
                />
            )
        } else if (selectedIndex === 0) {
            return (
                <DayCalendar
                    events={filteredEvents}
                    weeklyEvents={filteredWeeklyEvents}
                    eventsException={eventException}
                    defaultDate={selectedDate ?? new Date()}
                    onPressCell={handleCellPress}
                    hourHeight={100}
                    colors={colors}
                />
            )
        } else {
            return (
                <MonthCalendar
                    events={filteredEvents}
                    weeklyEvents={filteredWeeklyEvents}
                    eventsException={eventException}
                    defaultDate={selectedDate ?? new Date()}
                    onPressDay={handlePressDay}
                    colors={colors}
                />
            )
        }
    }

    // useEffect sleduje zavření modalu a spustí navigaci
    useEffect(() => {
        if (!cellModalVisible && navigateAfterClose) {
            router.replace({
                pathname: '/newEvent',
                params: {
                    pickedDate: selectedDate?.toISOString(),
                    signal: Date.now()
                }
            })
        }
    }, [cellModalVisible, navigateAfterClose])

    const handleFilter = () => {
        setFilterModalVisible(true)
    }

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView>
                <Button
                    mode="contained"
                    onPress={handleFilter} // volání FastAPI
                    style={styles.filterButton}
                >
                    Filtry ({Object.values(filter).filter(v => !v).length})
                </Button>
                <SegmentedControl
                    values={['Den', 'Týden', 'Měsíc']}
                    selectedIndex={selectedIndex}
                    onChange={event =>
                        setSelectedIndex(event.nativeEvent.selectedSegmentIndex)
                    }
                />
            </ThemedView>

            {selectCalendar()}

            <CellModal
                visible={cellModalVisible}
                date={selectedDate}
                events={events}
                weeklyEvents={weeklyEvents}
                colors={colors}
                eventsException={eventException}
                onCreateEvent={() => {
                    setNavigateAfterClose(true)
                    setCellModalVisible(false)
                }}
                onPressEvent={(event: Event) => {
                    setCellModalVisible(false)
                    router.push({
                        pathname: `/events/${event.id}`,
                        params: { event: JSON.stringify(event) } // serializace objektu
                    })
                }}

                onDismiss={() => setCellModalVisible(false)}
            />
            <FilterModal
                visible={filterModalVisible}
                onDismiss={async (checkedUsers) => {
                    try {
                        // 1️⃣ Ulož filtr do AsyncStorage
                        await AsyncStorage.setItem('userFilter', JSON.stringify(checkedUsers));

                        // 2️⃣ Nastav do state + přefiltruj eventy
                        setFilter(checkedUsers);
                        filterEvents(checkedUsers);
                    } catch (e) {
                        console.error('Chyba při ukládání filtru:', e);
                    } finally {
                        setFilterModalVisible(false);
                    }
                }}
                colors={colors}
            />



        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    filterButton: {
        width: 150,
        alignSelf: "flex-end"
    }
})
