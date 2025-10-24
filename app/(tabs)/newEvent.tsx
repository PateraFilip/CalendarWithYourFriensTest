import { createEvent } from '@/api/create_event';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, IconButton, TextInput as PaperTextInput, Switch, TextInput } from 'react-native-paper';
import { DatePickerModal, TimePickerModal, cs, registerTranslation } from 'react-native-paper-dates';
import RNPickerSelect from 'react-native-picker-select';

dayjs.locale('cs');
registerTranslation('cs', cs);

export default function NewEvent() {
    const [name, setName] = useState('');
    const [type, setType] = useState(false);
    const [pravidelnost, setPravidelnost] = useState(false);
    const [peopleCount, setPeopleCount] = useState(1);
    const { user } = useAuth()
    const { pickedDate, signal } = useLocalSearchParams();

    // ---- Date & Time Range state ----
    const [dateRange, setDateRange] = useState<{ startDate?: Date; endDate?: Date }>({});
    const [dateModalVisible, setDateModalVisible] = useState(false);

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
    const decrease = () => setPeopleCount(prev => (prev > 1 ? prev - 1 : 1));

    const handleCreate = async () => {
        if (!name.trim() || !dateRange.startDate || !timeRange.start || !user?.id) return;

        const start = new Date(dateRange.startDate);
        start.setHours(timeRange.start.getHours());
        start.setMinutes(timeRange.start.getMinutes());

        const end = dateRange.endDate && timeRange.end ? new Date(dateRange.endDate) : null;
        if (end && timeRange.end) {
            end.setHours(timeRange.end.getHours());
            end.setMinutes(timeRange.end.getMinutes());
        }

        try {
            await createEvent({
                title: name,
                user_id: user.id,
                start,
                end,
                peopleCount,
                pravidelnost: pravidelnost,
                is_group: type,
            })

            // reset form
            setName('')
            setPeopleCount(1)
            setDateRange({})
            setTimeRange({})

        } catch (err) {
            console.error('❌ Chyba při vytváření události:', err)
        }
    }


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
                    <Switch value={type} color={buttonColor} onValueChange={setType} />
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
                        onValueChange={(value) => console.log(value)}
                        items={[
                            { label: 'Týdenní', value: 'weekly' },
                            { label: 'Směny na měsíc', value: 'monthly' },
                        ]}
                    />
                )}


                {/* --- Date Range Picker --- */}
                <ThemedView style={styles.field}>
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

                    <DatePickerModal
                        locale="cs"
                        mode="range"
                        visible={dateModalVisible}
                        onDismiss={() => setDateModalVisible(false)}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        onConfirm={({ startDate, endDate }) => {
                            setDateModalVisible(false);
                            // pokud uživatel vybral jen jeden den, nastavíme start = end
                            if (!endDate) endDate = startDate;
                            setDateRange({ startDate, endDate });
                        }}
                    />
                </ThemedView>

                {/* --- Time Range Picker --- */}
                <ThemedView style={styles.field}>
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
                    mode="contained"
                    onPress={handleCreate}
                    disabled={!name.trim() || !dateRange.startDate || !timeRange.start}
                    buttonColor={buttonColor}
                    labelStyle={{ color: buttonTextColor }}
                    style={styles.createButton}
                >
                    Vytvořit událost
                </Button>


            </ScrollView>
        </ThemedSafeView>
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
