import { createEvent, createWeeklyEvent } from '@/api/create_event';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Button, Checkbox, Dialog, IconButton, TextInput as PaperTextInput, Portal, Switch, TextInput } from 'react-native-paper';
import { DatePickerModal, TimePickerModal, cs, registerTranslation } from 'react-native-paper-dates';
import RNPickerSelect from 'react-native-picker-select';

LocaleConfig.locales['cs'] = {
    monthNames: [
        'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ],
    monthNamesShort: [
        'Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer',
        'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'
    ],
    dayNames: ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'],
    dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'], // české zkratky
    today: 'Dnes'
};
LocaleConfig.defaultLocale = 'cs';


dayjs.locale('cs');
registerTranslation('cs', cs);

export default function NewEvent() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [type, setType] = useState(false);
    const [pravidelnost, setPravidelnost] = useState(false);
    const [peopleCount, setPeopleCount] = useState(2);
    const { user } = useAuth()
    const { pickedDate, signal } = useLocalSearchParams();
    const [repeatType, setRepeatType] = useState<'weekly' | 'monthly'>('weekly');
    const weekDays = [
        { label: 'Po', key: 'Po' },
        { label: 'Út', key: 'Út' },
        { label: 'St', key: 'St' },
        { label: 'Čt', key: 'Čt' },
        { label: 'Pá', key: 'Pá' },
        { label: 'So', key: 'So' },
        { label: 'Ne', key: 'Ne' },
    ];

    type CalendarDay = {
        selected: boolean;
        marked: boolean;
        selectedColor?: string;
    };

    type DayTime = { start?: Date; end?: Date };

    const [selectedDays, setSelectedDays] = useState<Record<string, { checked: boolean; time?: DayTime }>>({});

    const [dayForTime, setDayForTime] = useState<string | null>(null);
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [selectedDaysCalendar, setSelectedDaysCalendar] = useState<Record<string, CalendarDay>>({});
    const [calendarTimes, setCalendarTimes] = useState<Record<string, Date | undefined>>({});
    const [dayForCalendarTime, setDayForCalendarTime] = useState<string | null>(null);
    const [calendarTimePickerVisible, setCalendarTimePickerVisible] = useState(false);
    const [shiftLengthText, setShiftLengthText] = useState(''); // pro input
    const [shiftLength, setShiftLength] = useState<number | null>(null); // pro číslo
    const [error, setError] = useState('');



    // ---- Date & Time Range state ----
    const [dateRange, setDateRange] = useState<{ startDate?: Date; endDate?: Date }>({});
    const [dateModalVisible, setDateModalVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const [timeRange, setTimeRange] = useState<{ start?: Date; end?: Date }>({});
    const [timeModalVisible, setTimeModalVisible] = useState(false);
    const [timeStep, setTimeStep] = useState<'start' | 'end'>('start'); // krok výběru času

    useEffect(() => {
        if (!pickedDate) return

        // pokud je pickedDate pole, vezmi první hodnotu
        const dateStr = Array.isArray(pickedDate) ? pickedDate[0] : pickedDate
        const start = new Date(dateStr)


        // vytvoří nový objekt o hodinu později
        const end = new Date(start.getTime() + 60 * 60 * 1000) // 60min * 60s * 1000ms

        setDateRange({
            startDate: start,
            endDate: end,
        })

        setTimeRange({
            start,
            end,
        })
    }, [pickedDate, signal])


    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');

    const increase = () => setPeopleCount(prev => prev + 1);
    const decrease = () => setPeopleCount(prev => (prev > 2 ? prev - 1 : 2));

    const handleToggleDay = (dayKey: string) => {
        setSelectedDays(prev => ({
            ...prev,
            [dayKey]: { checked: !prev[dayKey]?.checked, time: prev[dayKey]?.time },
        }));
    };

    const openTimePickerForDay = (dayKey: string, step: 'start' | 'end') => {
        setDayForTime(dayKey);
        setTimeStep(step);
        setTimePickerVisible(true);
    };

    const handleConfirmTime = ({ hours, minutes }: { hours: number; minutes: number }) => {
        if (!dayForTime) return;

        const time = new Date();
        time.setHours(hours);
        time.setMinutes(minutes);

        setSelectedDays(prev => {
            const prevTime = prev[dayForTime]?.time || {};
            return {
                ...prev,
                [dayForTime]: {
                    ...prev[dayForTime],
                    checked: true,
                    time: { ...prevTime, [timeStep]: time }
                }
            };
        });

        if (timeStep === 'start') {
            setTimeStep('end');
            setTimeout(() => setTimePickerVisible(true), 100); // hned otevře end
        } else {
            setDayForTime(null);
            setTimeStep('start');
            setTimePickerVisible(false);
        }
    };

    const toggleDay = (day) => {
        const date = day.dateString;
        setSelectedDaysCalendar(prev => ({
            ...prev,
            [date]: prev[date]
                ? undefined
                : { selected: true, marked: true, selectedColor: '#00adf5' },
        }));
    };

    const openCalendarTimePicker = (date: string) => {
        setDayForCalendarTime(date);
        setCalendarTimePickerVisible(true);
    };

    const handleCalendarTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
        if (!dayForCalendarTime) return;
        const time = new Date();
        time.setHours(hours);
        time.setMinutes(minutes);

        setCalendarTimes(prev => ({
            ...prev,
            [dayForCalendarTime]: time,
        }));

        setDayForCalendarTime(null);
        setCalendarTimePickerVisible(false);
    };

    const handleCreate = async () => {

        if (type) {
            try {
                if (!name.trim() || !dateRange.startDate || !timeRange.start || !user?.id) return;
                const start = new Date(dateRange.startDate);
                start.setHours(timeRange.start.getHours());
                start.setMinutes(timeRange.start.getMinutes());

                const end = dateRange.endDate && timeRange.end ? new Date(dateRange.endDate) : null;
                if (end && timeRange.end) {
                    end.setHours(timeRange.end.getHours());
                    end.setMinutes(timeRange.end.getMinutes());
                }

                await createEvent({
                    title: name,
                    user_id: user.id,
                    start,
                    end,
                    peopleCount,
                    pravidelnost: false,
                    is_group: type,
                })

                if (!user?.id) {
                    console.error("Uživatel není přihlášen!");
                    return;
                }

                // reset všech stavů
                setName('');
                setPeopleCount(2);
                setDateRange({});
                setTimeRange({});
                setSelectedDays({});
                setSelectedDaysCalendar({});
                setCalendarTimes({});
                setShiftLengthText('');
                setShiftLength(null);
                setError('');
                setPravidelnost(false);
                setType(false);
                setRepeatType('weekly');
                router.replace('/(tabs)');


            } catch (err) {
                console.error('❌ Chyba při vytváření události:', err)
            }
        }
        else if (!type && !pravidelnost) {
            try {
                if (!name.trim() || !dateRange.startDate || !timeRange.start || !user?.id) return;
                const start = new Date(dateRange.startDate);
                start.setHours(timeRange.start.getHours());
                start.setMinutes(timeRange.start.getMinutes());

                const end = dateRange.endDate && timeRange.end ? new Date(dateRange.endDate) : null;
                if (end && timeRange.end) {
                    end.setHours(timeRange.end.getHours());
                    end.setMinutes(timeRange.end.getMinutes());
                }

                await createEvent({
                    title: name,
                    user_id: user.id,
                    start,
                    end,
                    peopleCount: 1,
                    pravidelnost: false,
                    is_group: false,
                })

                // reset všech stavů
                setName('');
                setPeopleCount(2);
                setDateRange({});
                setTimeRange({});
                setSelectedDays({});
                setSelectedDaysCalendar({});
                setCalendarTimes({});
                setShiftLengthText('');
                setShiftLength(null);
                setError('');
                setPravidelnost(false);
                setType(false);
                setRepeatType('weekly');
                router.replace('/(tabs)');


            } catch (err) {
                console.error('❌ Chyba při vytváření události:', err)
            }
        }
        else if (!type && pravidelnost && repeatType === "monthly") {
            try {
                if (!name.trim() || !user?.id) return;
                for (const date of Object.keys(selectedDaysCalendar)) {
                    const baseTime = calendarTimes[date];
                    if (!baseTime || !shiftLength) continue;

                    // Vytvoří kombinaci data z "date" a času z "baseTime"
                    let dateWithTime = dayjs(date)
                        .hour(dayjs(baseTime).hour())
                        .minute(dayjs(baseTime).minute())
                        .second(0)
                        .millisecond(0);

                    let start = dateWithTime.toDate();
                    let endTime = dateWithTime.add(shiftLength, 'hour');

                    // Pokud endTime přesahuje půlnoc, zvýšíme end date o 1
                    let end = endTime.toDate();
                    if (endTime.date() !== dateWithTime.date()) {
                        // endTime už je další den, takže end zůstává správně
                        end = endTime.toDate();
                    }

                    await createEvent({
                        title: name,
                        user_id: user.id,
                        start,
                        end,
                        peopleCount: 1,
                        pravidelnost: false,
                        is_group: false,
                    });
                }



                // reset form
                // reset všech stavů
                setName('');
                setPeopleCount(2);
                setDateRange({});
                setTimeRange({});
                setSelectedDays({});
                setSelectedDaysCalendar({});
                setCalendarTimes({});
                setShiftLengthText('');
                setShiftLength(null);
                setError('');
                setPravidelnost(false);
                setType(false);
                setRepeatType('weekly');
                router.replace('/(tabs)');


            } catch (err) {
                console.error('❌ Chyba při vytváření události:', err)
            }
        }
        else if (!type && pravidelnost && repeatType === "weekly") {
            try {
                if (!name.trim() || !user?.id) return;
                for (const { key } of weekDays) {
                    const day = selectedDays[key];
                    if (!day?.checked || !day.time?.start || !day.time?.end) continue;

                    await createWeeklyEvent({
                        title: name,
                        user_id: user.id,
                        den: key,
                        start: day.time.start,
                        end: day.time.end,
                    });
                }

                // reset form
                // reset všech stavů
                setName('');
                setPeopleCount(2);
                setDateRange({});
                setTimeRange({});
                setSelectedDays({});
                setSelectedDaysCalendar({});
                setCalendarTimes({});
                setShiftLengthText('');
                setShiftLength(null);
                setError('');
                setPravidelnost(false);
                setType(false);
                setRepeatType('weekly');
                router.replace('/(tabs)');



            } catch (err) {
                console.error('❌ Chyba při vytváření týdenní události:', err);
            }
        }

    }

    const isDisabled = (() => {
        if (!name.trim()) return true;

        if (!type && !pravidelnost) {
            return !dateRange.startDate || !dateRange.endDate || !timeRange.start || !timeRange.end;
        }

        if (pravidelnost && !type && repeatType == "weekly") {
            const isDisabled = Object.values(selectedDays).some(day =>
                day?.checked && (!day.time?.start || !day.time?.end)
            ) || Object.values(selectedDays).every(day => !day?.checked);
            return isDisabled
        }

        if (pravidelnost && !type && repeatType == "monthly") {
            const selectedDates = Object.keys(selectedDaysCalendar).filter(date => selectedDaysCalendar[date]);

            // Disable, pokud není vybraný žádný den
            if (selectedDates.length === 0) return true;

            // Disable, pokud některý vybraný den nemá čas
            if (selectedDates.some(date => !calendarTimes[date])) return true;

            // Disable, pokud není zadána platná délka směny
            if (!shiftLength || shiftLength < 1 || shiftLength > 24) return true;

            return false;
        }

        if (type) {
            return !dateRange.startDate || !dateRange.endDate || !timeRange.start || !timeRange.end;
        }

        return false;
    })();



    const formatDate = (d?: Date) => (d ? dayjs(d).format('DD. MM. YYYY') : '');
    const formatTime = (d?: Date) => (d ? dayjs(d).format('HH:mm') : '');

    // --- Funkce pro potvrzení času ---
    const handleTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
        if (timeStep === 'start') {
            const start = new Date();
            start.setHours(hours);
            start.setMinutes(minutes);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            setTimeRange({ start, end });
            setTimeStep('end');
            setTimeout(() => setTimeModalVisible(true), 100); // otevře modal pro end
        } else {
            const end = new Date();
            end.setHours(hours);
            end.setMinutes(minutes);
            const start = timeRange.start;
            setTimeRange(prev => ({ ...prev, end }));
            setTimeStep('start'); // reset na start pro další kliknutí
            setTimeModalVisible(false);
        }
    };

    return (
        <ThemedSafeView style={styles.container}>
            <ScrollView>

                {/* Název události */}
                <ThemedView style={styles.field}>
                    <ThemedText style={styles.label}>Název události</ThemedText>
                    <PaperTextInput
                        placeholder="Zadej název..."
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        style={styles.input}
                        activeOutlineColor={buttonColor}
                    />
                </ThemedView>

                {/* Skupinová událost */}
                <ThemedView style={[styles.field, styles.rowCenter]}>
                    <ThemedText style={styles.label}>Skupinová událost</ThemedText>
                    <Switch value={type} color={buttonColor} onValueChange={(value) => {
                        setType(value);
                        if (value) setPravidelnost(false);
                    }} />
                </ThemedView>

                {/* Týdenní pravidelnost */}
                {!type && (
                    <ThemedView style={[styles.field, styles.rowCenter]}>
                        <ThemedText style={styles.label}>Pravidelnost</ThemedText>
                        <Switch value={pravidelnost} color={buttonColor} onValueChange={setPravidelnost} />
                    </ThemedView>
                )}

                {!type && pravidelnost && (
                    <RNPickerSelect
                        onValueChange={(value) => setRepeatType(value)}
                        value={repeatType}
                        items={[
                            { label: 'Týdenní', value: 'weekly' },
                            { label: 'Směny na měsíc', value: 'monthly' },
                        ]}
                        placeholder={{}}
                    />
                )}


                {/* --- Date Range Picker --- */}
                {/* --- Date & Time Range Picker --- */}
                {!pravidelnost && (
                    <>
                        {/* --- Date Range Picker --- */}
                        <ThemedView style={styles.field}>
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
                    </>
                )}


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

                {pravidelnost && repeatType == "weekly" && (
                    <ThemedView style={{ marginTop: 10 }}>
                        {weekDays.map(({ label, key }) => (
                            <ThemedView key={key} style={{ marginBottom: 8 }}>
                                <ThemedView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <ThemedText>{label}</ThemedText>
                                    <Checkbox
                                        status={selectedDays[key]?.checked ? 'checked' : 'unchecked'}
                                        onPress={() => handleToggleDay(key)}
                                    />
                                </ThemedView>

                                {/* pokud je den vybrán, zobraz čas */}
                                {selectedDays[key]?.checked && (
                                    <>
                                        <Pressable onPress={() => openTimePickerForDay(key, 'start')}>
                                            <PaperTextInput
                                                mode="outlined"
                                                value={selectedDays[key]?.time?.start ? dayjs(selectedDays[key].time.start).format('HH:mm') : ''}
                                                placeholder="Začátek"
                                                editable={false}
                                                onPressIn={() => openTimePickerForDay(key, 'start')}
                                                right={<TextInput.Icon icon="clock-outline" onPress={() => openTimePickerForDay(key, 'start')} />}
                                                style={{ backgroundColor: 'transparent', marginLeft: 20, marginRight: 20, marginTop: 4 }}
                                            />
                                        </Pressable>
                                        <Pressable onPress={() => openTimePickerForDay(key, 'end')}>
                                            <PaperTextInput
                                                mode="outlined"
                                                value={selectedDays[key]?.time?.end ? dayjs(selectedDays[key].time.end).format('HH:mm') : ''}
                                                placeholder="Konec"
                                                editable={false}
                                                onPressIn={() => openTimePickerForDay(key, 'end')}
                                                right={<TextInput.Icon icon="clock-outline" onPress={() => openTimePickerForDay(key, 'end')} />}
                                                style={{ backgroundColor: 'transparent', marginLeft: 20, marginRight: 20, marginTop: 4 }}
                                            />
                                        </Pressable>
                                    </>
                                )}
                            </ThemedView>
                        ))}

                        <TimePickerModal
                            visible={timePickerVisible}
                            onDismiss={() => setTimePickerVisible(false)}
                            onConfirm={handleConfirmTime}
                            hours={
                                dayForTime && selectedDays[dayForTime]?.time
                                    ? (() => {
                                        const start = selectedDays[dayForTime]!.time!.start;
                                        if (!start) return undefined;
                                        const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // +8h
                                        return end.getHours();
                                    })()
                                    : undefined
                            }
                            minutes={
                                dayForTime && selectedDays[dayForTime]?.time
                                    ? (() => {
                                        const start = selectedDays[dayForTime]!.time!.start;
                                        if (!start) return undefined;
                                        const end = new Date(start.getTime() + 8 * 60 * 60 * 1000); // +8h
                                        return end.getMinutes();
                                    })()
                                    : undefined
                            }
                            use24HourClock
                            label={
                                dayForTime
                                    ? `Vyber čas ${timeStep === 'start' ? 'od' : 'do'} pro ${weekDays.find(d => d.key === dayForTime)?.label}`
                                    : 'Vyber čas'
                            }

                        />

                    </ThemedView>
                )}
                {repeatType === 'monthly' && (
                    <>
                        <Button
                            mode="contained"
                            buttonColor={buttonColor}
                            labelStyle={{ color: buttonTextColor }}
                            style={styles.createButton}
                            onPress={() => setModalVisible(true)}
                        >
                            Vybrat dny
                        </Button>

                        {/* --- Modal s kalendářem --- */}
                        <Portal>
                            <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
                                <Dialog.Title>Vyber dny</Dialog.Title>
                                <Dialog.ScrollArea>
                                    <ScrollView>
                                        <Calendar
                                            onDayPress={toggleDay}
                                            markedDates={selectedDaysCalendar}
                                            firstDay={1}
                                        />
                                    </ScrollView>
                                </Dialog.ScrollArea>
                                <Dialog.Actions>
                                    <Button onPress={() => setModalVisible(false)}>Hotovo</Button>
                                </Dialog.Actions>
                            </Dialog>
                        </Portal>
                    </>
                )}

                {repeatType === 'monthly' && (
                    <>
                        <PaperTextInput
                            label="Délka směny (h)"
                            value={shiftLengthText}
                            onChangeText={text => {
                                setShiftLengthText(text); // aktualizuj text

                                const num = parseFloat(text);

                                if (text === '') {
                                    setShiftLength(null);
                                    setError(''); // prázdný input není chyba
                                } else if (!isNaN(num) && num >= 1 && num <= 24) {
                                    setShiftLength(num);
                                    setError(''); // validní
                                } else {
                                    setShiftLength(null);
                                    setError('Zadej číslo od 1 do 24');
                                }
                            }}
                            keyboardType="numeric"
                            mode="outlined"
                            error={!!error}
                        />

                        {error ? (
                            <Text style={{ color: 'red', marginTop: 4 }}>{error}</Text>
                        ) : null}
                    </>
                )}

                {repeatType === 'monthly' && (
                    <ThemedView style={{ marginTop: 16 }}>
                        <ThemedText style={{ fontWeight: '600', marginBottom: 8 }}>Vybrané dny:</ThemedText>
                        {Object.keys(selectedDaysCalendar)
                            .filter(date => selectedDaysCalendar[date]) // filtrujeme undefined
                            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                            .map(date => (
                                <ThemedView key={date} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <ThemedText>{dayjs(date).format('DD. MM. YYYY')}</ThemedText>
                                    <Pressable style={{ marginLeft: 8, flex: 1 }} onPress={() => openCalendarTimePicker(date)}>
                                        <PaperTextInput
                                            value={calendarTimes[date] ? `${dayjs(calendarTimes[date]).format('HH:mm')} →  ${dayjs(calendarTimes[date]).add(shiftLength, 'hour').format('HH:mm')
                                                }` : ''}
                                            placeholder="Vyber čas"
                                            editable={false}
                                            onPressIn={() => openCalendarTimePicker(date)}
                                            right={
                                                <TextInput.Icon
                                                    icon="clock-outline"
                                                    onPress={() => openCalendarTimePicker(date)}
                                                />
                                            }
                                            style={{ marginLeft: 8, flex: 1 }}
                                        />
                                    </Pressable>

                                    {/* Křížek pro odstranění dne */}
                                    <IconButton
                                        icon="close"
                                        size={20}
                                        onPress={() => {
                                            setSelectedDaysCalendar(prev => {
                                                const copy = { ...prev };
                                                delete copy[date];
                                                return copy;
                                            });
                                            setCalendarTimes(prev => {
                                                const copy = { ...prev };
                                                delete copy[date];
                                                return copy;
                                            });
                                        }}
                                        containerColor="transparent"
                                    />
                                </ThemedView>
                            ))}


                        <TimePickerModal
                            visible={calendarTimePickerVisible}
                            onDismiss={() => setCalendarTimePickerVisible(false)}
                            onConfirm={handleCalendarTimeConfirm}
                            hours={dayForCalendarTime ? calendarTimes[dayForCalendarTime]?.getHours() : undefined}
                            minutes={dayForCalendarTime ? calendarTimes[dayForCalendarTime]?.getMinutes() : undefined}
                            use24HourClock
                            label="Vyber čas"
                        />
                    </ThemedView>
                )}

                <Button
                    mode="contained"
                    onPress={handleCreate}
                    disabled={isDisabled}
                    buttonColor={buttonColor}
                    labelStyle={{ color: buttonTextColor }}
                    style={styles.createButton}
                >
                    Vytvořit událost
                </Button>


            </ScrollView>
        </ThemedSafeView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    field: { marginBottom: 12 },
    label: { fontSize: 14, marginBottom: 6, fontWeight: '600' },
    input: { fontSize: 16, backgroundColor: 'transparent' },
    rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    peopleSection: { alignItems: 'center', gap: 6 },
    counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    counterInput: { textAlign: 'center', width: 60, backgroundColor: 'transparent' },
    createButton: { borderRadius: 6, width: '100%' },
});
