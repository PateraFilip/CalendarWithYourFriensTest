import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'
import dayjs from 'dayjs'
import 'dayjs/locale/cs'
import { ChevronDown } from 'lucide-react-native'
import React, { useState } from 'react'
import { Pressable, StyleSheet, Switch, TextInput } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { Button, IconButton, TextInput as PaperTextInput } from 'react-native-paper'

dayjs.locale('cs')

export default function Add_events() {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [name, setName] = useState('')
    const [type, setType] = useState(false)
    const [pravidelnost, setPravidelnost] = useState(false)
    const [isStartDatePickerVisible, setStartDatePickerVisibility] = useState(false);
    const [isEndDatePickerVisible, setEndDatePickerVisibility] = useState(false);
    const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null)
    const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null)
    const [peopleCount, setPeopleCount] = useState(1)


    const addEvent = async () => {
        const response = await fetch("https://<your-project>.functions.supabase.co/addEvent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                nazev: name,
                zakladatel_id: 1,
                pocet_lidi: peopleCount,
                den_od: selectedStartDate?.getDate(),
                cas_od: selectedStartDate?.getTime(),
                cas_do: selectedEndDate?.getTime(),
                den_do: selectedEndDate?.getDate(),
                pravidelnost: pravidelnost,
                group: type
            }),
        });

        const data = await response.json();
        if (response.ok) {
            console.log("Event added:", data);
        } else {
            console.error("Error adding event:", data.error);
        }
    };



    const handleStartConfirm = (date: Date) => {
        setSelectedStartDate(date);
        setStartDatePickerVisibility(false);
    };

    const handleStartCancel = () => {
        setStartDatePickerVisibility(false);
    };

    const handleEndConfirm = (date: Date) => {
        setSelectedEndDate(date);
        setEndDatePickerVisibility(false);
    };

    const handleEndCancel = () => {
        setEndDatePickerVisibility(false);
    };

    const handleCreate = () => {
        if (!name.trim()) return
        setName('')
        setPeopleCount(1)
    }

    const increase = () => setPeopleCount(prev => prev + 1)
    const decrease = () => setPeopleCount(prev => (prev > 1 ? prev - 1 : 1))

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView style={styles.field}>
                <ThemedText style={styles.label}>Název události</ThemedText>
                <TextInput
                    accessible
                    accessibilityLabel="Název události"
                    placeholder="Zadej název..."
                    placeholderTextColor={buttonColor}
                    value={name}
                    onChangeText={text => setName(text)}
                    returnKeyType="next"
                    style={[styles.input, { color: buttonColor }]}
                />

            </ThemedView>
            <ThemedView style={[styles.field, styles.rowCenter]}>
                <ThemedText style={styles.label}>Skupinová událost</ThemedText>
                <Switch
                    accessibilityLabel="Skupinová událost"
                    value={type}
                    onValueChange={val => setType(val)}
                />
            </ThemedView>
            {!type && (
                <ThemedView style={[styles.field, styles.rowCenter]}>
                    <ThemedText style={styles.label}>Týdenní pravidelnost</ThemedText>
                    <Switch
                        accessibilityLabel="Týdenní pravidelnost"
                        value={pravidelnost}
                        onValueChange={val => setPravidelnost(val)}
                    />
                </ThemedView>
            )}
            <ThemedView style={styles.field}>
                <ThemedText style={styles.label}>Začátek</ThemedText>
                <Pressable
                    style={[styles.input, { justifyContent: 'space-between', flexDirection: "row", alignContent: "center" }]}
                    onPress={() => setStartDatePickerVisibility(true)}
                >
                    <ThemedText>
                        {selectedStartDate
                            ? dayjs(selectedStartDate).format('DD. MM. YYYY HH:mm')
                            : 'Vyber datum a čas'}
                    </ThemedText>
                    <ChevronDown size={24} color={buttonColor} />
                </Pressable>
                <DateTimePickerModal
                    isVisible={isStartDatePickerVisible}
                    mode="datetime"
                    date={selectedStartDate || new Date()}
                    onConfirm={handleStartConfirm}
                    onCancel={handleStartCancel}
                    locale="cs-CZ"
                    is24Hour={true}
                />
            </ThemedView>
            <ThemedView style={styles.field}>
                <ThemedText style={styles.label}>Konec</ThemedText>
                <Pressable
                    style={[styles.input, { justifyContent: 'space-between', flexDirection: "row", alignContent: "center" }]}
                    onPress={() => setEndDatePickerVisibility(true)}
                >
                    <ThemedText>
                        {selectedEndDate
                            ? dayjs(selectedEndDate).format('DD. MM. YYYY HH:mm')
                            : 'Vyber datum a čas'}
                    </ThemedText>
                    <ChevronDown size={24} color={buttonColor} />
                </Pressable>
                <DateTimePickerModal
                    isVisible={isEndDatePickerVisible}
                    mode="datetime"
                    date={selectedEndDate || new Date()}
                    onConfirm={handleEndConfirm}
                    onCancel={handleEndCancel}
                    locale="cs-CZ"
                    is24Hour={true}
                />
            </ThemedView>
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
                            const num = parseInt(text, 10)
                            if (!isNaN(num)) setPeopleCount(num)
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
                <Button
                    mode="contained"
                    onPress={handleCreate}
                    disabled={!name.trim()}
                    buttonColor={buttonColor}
                    labelStyle={{ color: buttonTextColor }}
                    style={styles.createButton}
                >
                    Vytvořit událost
                </Button>
            </ThemedView>


        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    field: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        marginBottom: 6,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16
    },
    textarea: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        backgroundColor: '#fff',
    },
    inputError: {
        borderColor: '#d9534f',
    },
    error: {
        marginTop: 6,
        color: '#d9534f',
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    peopleSection: {
        alignItems: 'center',
        gap: 6,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 10
    },
    counterInput: {
        textAlign: 'center',
    },
    createButton: {
        borderRadius: 6,
    },
})
