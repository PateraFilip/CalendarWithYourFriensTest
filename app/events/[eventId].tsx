import { createException } from '@/api/create_exception'
import { deleteEvent, deleteWeeklyEvent } from '@/api/delete_event'
import { fetchUserEvents } from '@/api/getUserEvents'
import { joinEvent } from '@/api/join_event'
import { updateEvent, updateWeeklyEvent } from '@/api/update_event'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@supabase/supabase-js'
import dayjs from 'dayjs'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'; // nebo jiná ikona
import React, { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Button, IconButton, Modal, TextInput as PaperTextInput, Portal, Switch, TextInput } from 'react-native-paper'
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates'

interface UserEvent {
    event_id: number;
    user_id: number;
}

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)


export default function EventDetail() {
    const router = useRouter()
    const { event: eventParam } = useLocalSearchParams<{ event: string }>()
    const eventObj = eventParam ? JSON.parse(eventParam) : null
    const [userEvents, setUserEvents] = useState<UserEvent[]>([])
    const daysLong = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    const { user } = useAuth()

    const [isModalVisible, setModalVisible] = useState(false)
    const [isModalExceptionVisible, setModalExceptionVisible] = useState(false)
    const [title, setTitle] = useState(eventObj?.title || '')
    const [type, setType] = useState(eventObj?.is_group || false);
    const [dateModalVisible, setDateModalVisible] = useState(false);
    const [dateRange, setDateRange] = useState<{
        startDate?: Date;
        endDate?: Date;
    }>({
        startDate: eventObj ? new Date(eventObj.start) : undefined,
        endDate: eventObj ? new Date(eventObj.end) : undefined,
    });
    const [timeRange, setTimeRange] = useState<{ start?: Date; end?: Date }>({
        start: eventObj ? new Date(eventObj.start) : undefined,
        end: eventObj ? new Date(eventObj.end) : undefined,
    });
    const [timeModalVisible, setTimeModalVisible] = useState(false);
    const [timeStep, setTimeStep] = useState<'start' | 'end'>('start'); // krok výběru času
    const [peopleCount, setPeopleCount] = useState(eventObj?.pocet_lidi || 2);


    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');

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


    if (!eventObj) return <ThemedSafeView><ThemedText>Event nenalezen</ThemedText></ThemedSafeView>

    const formatDate = (d: string | Date) => dayjs(d).format('DD. MM. YYYY')
    const formatTime = (d: string | Date) => dayjs(d).format('HH:mm')

    const handleEdit = () => {
        setModalVisible(true)
    }

    const handleEditException = () => {
        setModalExceptionVisible(true)
    }

    const handleDelete = () => {
        Alert.alert(
            'Smazat událost',
            'Opravdu chcete tuto událost smazat?',
            [
                { text: 'Zrušit', style: 'cancel' },
                {
                    text: 'Smazat',
                    style: 'destructive',
                    onPress: () => {
                        if (!eventObj.pravidelnost) {
                            deleteEvent(eventObj.id);
                        }
                        else if (eventObj.pravidelnost) {
                            deleteWeeklyEvent(eventObj.id);
                        }


                        router.back()
                    }
                }
            ]
        )
    }

    const handleDeleteException = () => {
        Alert.alert(
            'Smazat událost',
            'Opravdu chcete tuto událost smazat?',
            [
                { text: 'Zrušit', style: 'cancel' },
                {
                    text: 'Smazat',
                    style: 'destructive',
                    onPress: async () => {
                        const startDate = new Date(eventObj.start);
                        const endDate = new Date(eventObj.end);

                        console.log("🕓 start:", startDate, "end:", endDate);
                        await createException({
                            event_id: eventObj.id,
                            start: startDate,
                            end: endDate,
                            typ: "DELETE",
                            puvodni_den: startDate,
                            puvodni_cas_od: startDate,
                            puvodni_cas_do: endDate
                        })
                        router.back()
                    }
                }
            ]
        )
    }

    const handleSaveChanges = async () => {
        if (!title.trim() || !dateRange.startDate || !timeRange.start) return;
        const start = new Date(dateRange.startDate);
        start.setHours(timeRange.start.getHours());
        start.setMinutes(timeRange.start.getMinutes());

        const end = dateRange.endDate && timeRange.end ? new Date(dateRange.endDate) : null;
        if (end && timeRange.end) {
            end.setHours(timeRange.end.getHours());
            end.setMinutes(timeRange.end.getMinutes());
        }
        if (!eventObj.pravidelnost) {
            await updateEvent({
                id: eventObj.id,
                title: title,
                start,
                end,
                peopleCount,
                pravidelnost: false,
                is_group: type,
            })
        }
        else if (eventObj.pravidelnost) {
            await updateWeeklyEvent({
                id: eventObj.id,
                title: title,
                start,
                end
            })
        }

        router.back()
        setModalVisible(false)
    }

    const handleSaveExceptionChanges = async () => {
        if (!title.trim() || !dateRange.startDate || !timeRange.start) return;
        const start = new Date(dateRange.startDate);
        start.setHours(timeRange.start.getHours());
        start.setMinutes(timeRange.start.getMinutes());

        const end = dateRange.endDate && timeRange.end ? new Date(dateRange.endDate) : null;
        if (end && timeRange.end) {
            end.setHours(timeRange.end.getHours());
            end.setMinutes(timeRange.end.getMinutes());
        }
        const startDate = new Date(eventObj.start);
        const endDate = new Date(eventObj.end);
        await createException({
            event_id: eventObj.id,
            start,
            end,
            typ: "UPDATE",
            puvodni_den: startDate,
            puvodni_cas_od: startDate,
            puvodni_cas_do: endDate
        })
        router.back()
        setModalExceptionVisible(false)
    }

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

    const handleTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
        if (timeStep === 'start') {
            const start = new Date();
            start.setHours(hours);
            start.setMinutes(minutes);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            setTimeRange({ start, end });
            setTimeStep('end');
            setTimeout(() => setTimeModalVisible(true), 100); // otevře modal pro end
        } else if (timeRange.start && dateRange.startDate && dateRange.endDate) {
            if (((hours < timeRange?.start?.getHours()) || (hours == timeRange?.start?.getHours() && minutes < timeRange?.start?.getMinutes())) && dateRange.startDate.getTime() >= dateRange.endDate.getTime()) {
                Alert.alert('⚠️ Neplatný čas', `Čas nemůže být dříve než ${timeRange.start}`);
                return;
            }
            const end = new Date();
            end.setHours(hours);
            end.setMinutes(minutes);
            const start = timeRange.start;
            setTimeRange(prev => ({ ...prev, end }));
            setTimeStep('start'); // reset na start pro další kliknutí
            setTimeModalVisible(false);
        }
        else {
            const end = new Date();
            end.setHours(hours);
            end.setMinutes(minutes);
            const start = timeRange.start;
            setTimeRange(prev => ({ ...prev, end }));
            setTimeStep('start'); // reset na start pro další kliknutí
            setTimeModalVisible(false);
        }
    };

    const increase = () => setPeopleCount(prev => prev + 1);
    const decrease = () => setPeopleCount(prev => (prev > 2 ? prev - 1 : 2));

    const count = userEvents.filter(u => u.event_id === eventObj.id).length;
    const userJoined = userEvents.filter(u => u.event_id === eventObj.id)
    const isUserJoined = userEvents.filter(u => u.event_id === eventObj.id && u.user_id === user?.id)

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <ThemedSafeView style={styles.container}>
                {/* Vlastní header uvnitř SafeArea */}
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Pressable onPress={() => router.back()} >
                        <ArrowLeft size={30} color={buttonColor} />
                    </Pressable>
                    <ThemedText type='subtitle' style={{ marginLeft: 20 }}>
                        Detail události
                    </ThemedText>
                </ThemedView>


                <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Název události</ThemedText>
                        <ThemedText>{eventObj.title}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Zakladatel ID</ThemedText>
                        <ThemedText>{eventObj.user_id}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Den</ThemedText>
                        {eventObj.start == eventObj.end && (<ThemedText>{daysLong[new Date(eventObj.start).getDay()]}</ThemedText>)}
                        {eventObj.start != eventObj.end && (<ThemedText>{daysLong[new Date(eventObj.start).getDay()]} - {daysLong[new Date(eventObj.end).getDay()]}</ThemedText>)}
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Datum</ThemedText>
                        {eventObj.start == eventObj.end && (<ThemedText>{formatDate(eventObj.start)}</ThemedText>)}
                        {eventObj.start != eventObj.end && (<ThemedText>{formatDate(eventObj.start)} - {formatDate(eventObj.end)}</ThemedText>)}
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Čas</ThemedText>
                        <ThemedText>{formatTime(eventObj.cas_od || eventObj.start)} - {formatTime(eventObj.cas_do || eventObj.end)}</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Počet lidí</ThemedText>
                        {eventObj.is_group && (<ThemedText>{count} / {eventObj.pocet_lidi}</ThemedText>)}
                        {!eventObj.is_group && (<ThemedText>1 / 1</ThemedText>)}
                    </ThemedView>

                    <ThemedView style={styles.field}>
                        <ThemedText style={styles.label}>Přihlášení uživatelé</ThemedText>
                        {eventObj.is_group && (<ThemedText>{userJoined.map(u => {
                            return (u.user_id)
                        }).join(', ')}</ThemedText>)}
                        {!eventObj.is_group && (<ThemedText>{eventObj.user_id}</ThemedText>)}
                    </ThemedView>
                    {eventObj.is_group && eventObj.pocet_lidi > count && isUserJoined.length != 1 && (
                        <View style={styles.buttons}>
                            <Button
                                mode="contained"
                                onPress={() => onJoinEvent(eventObj.id)}
                                buttonColor={buttonColor}
                                labelStyle={{ color: buttonTextColor }}
                                style={styles.createButton}
                            >
                                Přidat se
                            </Button>
                        </View>)}

                    {eventObj.user_id === user?.id && (
                        <View style={styles.buttons}>
                            {eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleEditException}
                                    style={[styles.button, { backgroundColor: buttonColor }]}
                                    labelStyle={{ color: buttonTextColor }}
                                >
                                    Upravit událost pro tento den
                                </Button>
                            )}
                            {eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleEdit}
                                    style={[styles.button, { backgroundColor: buttonColor }]}
                                    labelStyle={{ color: buttonTextColor }}
                                >
                                    Upravit pravidelnou událost pro každý týden
                                </Button>
                            )}
                            {!eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleEdit}
                                    style={[styles.button, { backgroundColor: buttonColor }]}
                                    labelStyle={{ color: buttonTextColor }}
                                >
                                    Upravit událost
                                </Button>)}
                            {eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleDeleteException}
                                    style={[styles.button, { backgroundColor: 'red' }]}
                                    labelStyle={{ color: '#fff' }}
                                >
                                    Smazat událost pro tento den
                                </Button>)}
                            {eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleDelete}
                                    style={[styles.button, { backgroundColor: 'red' }]}
                                    labelStyle={{ color: '#fff' }}
                                >
                                    Smazat pravidelnou událost pro každý týden
                                </Button>)}

                            {!eventObj.pravidelnost && (
                                <Button
                                    mode="contained"
                                    onPress={handleDelete}
                                    style={[styles.button, { backgroundColor: 'red' }]}
                                    labelStyle={{ color: '#fff' }}
                                >
                                    Smazat událost
                                </Button>)}

                        </View>)}
                </ScrollView>
                <Portal>
                    <Modal
                        visible={isModalVisible}
                        onDismiss={() => setModalVisible(false)}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <ThemedView style={styles.content}>
                            <ThemedText style={styles.modalTitle}>Upravit událost</ThemedText>

                            <ThemedView style={styles.field}>
                                <ThemedText style={styles.label}>Název události</ThemedText>
                                <PaperTextInput
                                    placeholder="Zadej název..."
                                    value={title}
                                    onChangeText={setTitle}
                                    mode="outlined"
                                    style={styles.input}
                                    activeOutlineColor={buttonColor}
                                />
                            </ThemedView>

                            {eventObj.pravidelnost && (<ThemedView style={styles.field}>
                                <ThemedText style={styles.label}>Den</ThemedText>
                                <ThemedText>{daysLong[new Date(eventObj.start).getDay()]}</ThemedText>
                            </ThemedView>)}

                            {/* Skupinová událost */}
                            {!eventObj.pravidelnost && (<ThemedView style={[styles.field, styles.rowCenter]}>
                                <ThemedText style={styles.label}>Skupinová událost</ThemedText>
                                <Switch value={type} color={buttonColor} onValueChange={(value) => {
                                    setType(value);
                                }} />
                            </ThemedView>)}


                            {/* --- Date Range Picker --- */}
                            {!eventObj.pravidelnost && (<ThemedView style={styles.field}>
                                <Pressable onPress={() => setDateModalVisible(true)}>
                                    <PaperTextInput
                                        value={
                                            dateRange.startDate
                                                ? `${formatDate(dateRange.startDate)} → ${dateRange.endDate ? formatDate(dateRange.endDate) : ''}`
                                                : 'Vyber datum'
                                        }
                                        mode="outlined"
                                        editable={false}
                                        onPressIn={() => setDateModalVisible(true)}
                                        right={
                                            <TextInput.Icon
                                                icon="calendar-outline"
                                                onPress={() => setDateModalVisible(true)}
                                            />
                                        }
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                </Pressable>

                                <DatePickerModal
                                    locale="cs"
                                    mode="range"
                                    visible={dateModalVisible}
                                    onDismiss={() => setDateModalVisible(false)}
                                    startDate={dateRange.startDate}
                                    endDate={dateRange.endDate}
                                    onConfirm={({ startDate, endDate }) => {
                                        setDateModalVisible(false);
                                        if (!endDate) endDate = startDate;

                                        setDateRange({ startDate, endDate });
                                    }}
                                />
                            </ThemedView>)}

                            {/* --- Time Range Picker --- */}
                            <ThemedView style={styles.field}>
                                <Pressable onPress={() => {
                                    setTimeStep('start');
                                    setTimeModalVisible(true);
                                }}>
                                    <PaperTextInput
                                        value={
                                            timeRange.start
                                                ? `${formatTime(timeRange.start)} → ${timeRange.end ? formatTime(timeRange.end) : ''}`
                                                : 'Vyber čas'
                                        }
                                        mode="outlined"
                                        editable={false}
                                        onPressIn={() => {
                                            setTimeStep('start');
                                            setTimeModalVisible(true);
                                        }}
                                        right={
                                            <TextInput.Icon
                                                icon="clock-outline"
                                                onPress={() => {
                                                    setTimeStep('start');
                                                    setTimeModalVisible(true);
                                                }}
                                            />
                                        }
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                </Pressable>

                                <TimePickerModal
                                    visible={timeModalVisible}
                                    onDismiss={() => setTimeModalVisible(false)}
                                    onConfirm={handleTimeConfirm}
                                    hours={timeStep === 'start' ? timeRange.start?.getHours() : timeRange.end?.getHours()}
                                    minutes={timeStep === 'start' ? timeRange.start?.getMinutes() : timeRange.end?.getMinutes()}
                                    use24HourClock
                                    label={timeStep === 'start' ? 'Vyber čas od' : 'Vyber čas do'}
                                />
                            </ThemedView>


                            {/* Počet lidí */}
                            {type && (
                                <ThemedView style={styles.peopleSection}>
                                    <ThemedText style={styles.label}>Počet lidí</ThemedText>
                                    <ThemedView style={styles.counterRow}>
                                        <IconButton
                                            icon="minus"
                                            mode="contained"
                                            onPress={decrease}
                                            iconColor={buttonTextColor}
                                            containerColor={buttonColor}
                                        />
                                        <PaperTextInput
                                            value={String(peopleCount)}
                                            onChangeText={text => {
                                                const num = parseInt(text, 10);
                                                if (!isNaN(num)) setPeopleCount(num);
                                            }}
                                            keyboardType="numeric"
                                            mode="outlined"
                                            style={styles.counterInput}
                                            activeOutlineColor={buttonColor}
                                        />
                                        <IconButton
                                            icon="plus"
                                            mode="contained"
                                            onPress={increase}
                                            iconColor={buttonTextColor}
                                            containerColor={buttonColor}
                                        />
                                    </ThemedView>
                                </ThemedView>
                            )}

                            <Button
                                mode='contained'
                                onPress={handleSaveChanges}
                                style={{ backgroundColor: buttonColor, marginBottom: 8 }}
                                labelStyle={{ color: buttonTextColor }}
                            >
                                Uložit změny
                            </Button>

                            <Button mode='text' onPress={() => setModalVisible(false)}>
                                Zrušit
                            </Button>
                        </ThemedView>
                    </Modal>
                </Portal>
                <Portal>
                    <Modal
                        visible={isModalExceptionVisible}
                        onDismiss={() => setModalExceptionVisible(false)}
                        contentContainerStyle={styles.modalContainer}
                    >
                        <ThemedView style={styles.content}>
                            <ThemedText style={styles.modalTitle}>Upravit událost</ThemedText>

                            <ThemedView style={styles.field}>
                                <ThemedText style={styles.label}>Název události</ThemedText>
                                <ThemedText>{title}</ThemedText>
                            </ThemedView>

                            {/* --- Date Range Picker --- */}
                            <ThemedView style={styles.field}>
                                <ThemedText style={styles.label}>Datum</ThemedText>
                                <ThemedText>{formatDate(eventObj.start)} → {formatDate(eventObj.end)}</ThemedText>
                            </ThemedView>

                            {/* --- Time Range Picker --- */}
                            <ThemedView style={styles.field}>
                                <Pressable onPress={() => {
                                    setTimeStep('start');
                                    setTimeModalVisible(true);
                                }}>
                                    <PaperTextInput
                                        value={
                                            timeRange.start
                                                ? `${formatTime(timeRange.start)} → ${timeRange.end ? formatTime(timeRange.end) : ''}`
                                                : 'Vyber čas'
                                        }
                                        mode="outlined"
                                        editable={false}
                                        onPressIn={() => {
                                            setTimeStep('start');
                                            setTimeModalVisible(true);
                                        }}
                                        right={
                                            <TextInput.Icon
                                                icon="clock-outline"
                                                onPress={() => {
                                                    setTimeStep('start');
                                                    setTimeModalVisible(true);
                                                }}
                                            />
                                        }
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                </Pressable>

                                <TimePickerModal
                                    visible={timeModalVisible}
                                    onDismiss={() => setTimeModalVisible(false)}
                                    onConfirm={handleTimeConfirm}
                                    hours={timeStep === 'start' ? timeRange.start?.getHours() : timeRange.end?.getHours()}
                                    minutes={timeStep === 'start' ? timeRange.start?.getMinutes() : timeRange.end?.getMinutes()}
                                    use24HourClock
                                    label={timeStep === 'start' ? 'Vyber čas od' : 'Vyber čas do'}
                                />
                            </ThemedView>

                            <Button
                                mode='contained'
                                onPress={handleSaveExceptionChanges}
                                style={{ backgroundColor: buttonColor, marginBottom: 8 }}
                                labelStyle={{ color: buttonTextColor }}
                            >
                                Uložit změny
                            </Button>

                            <Button mode='text' onPress={() => setModalExceptionVisible(false)}>
                                Zrušit
                            </Button>
                        </ThemedView>
                    </Modal>
                </Portal>
            </ThemedSafeView>
        </>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, paddingTop: 0 },
    field: { marginBottom: 16 },
    label: { fontWeight: '600', marginBottom: 4 },
    buttons: { flexDirection: 'column', marginTop: 24, gap: 12 },
    button: { borderRadius: 6, width: '100%' },
    modalContainer: {
        margin: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
    input: { fontSize: 16, backgroundColor: 'transparent' },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    peopleSection: { alignItems: 'center', gap: 6 },
    counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    counterInput: { textAlign: 'center', width: 60, backgroundColor: 'transparent' },
    content: {
        padding: 20,
        borderRadius: 20,
        gap: 16,
    },
    createButton: {
        borderRadius: 6,
    },
})
