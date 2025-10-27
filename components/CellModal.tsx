import { CalendarEvent } from '@/app/(tabs)'
import { ThemedText } from '@/components/themed-text'
import { useThemeColor } from '@/hooks/use-theme-color'
import dayjs from 'dayjs'
import React from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Button, Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'

interface CellModalProps {
    visible: boolean
    date: Date | null
    events: CalendarEvent[];
    onCreateEvent: () => void
    onDismiss: () => void
    onPressEvent?: (event: CalendarEvent) => void;
}

export const CellModal: React.FC<CellModalProps> = ({ visible,
    date,
    events,
    onCreateEvent,
    onDismiss,
    onPressEvent }) => {

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

    const COLORS = [
        '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
        '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
        '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
        '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
    ];

    const COLORS_TEXT = [
        '#FFFFFF', '#FFFFFF', '#000000', '#FFFFFF', '#FFFFFF',
        '#FFFFFF', '#000000', '#FFFFFF', '#000000', '#000000',
        '#FFFFFF', '#000000', '#FFFFFF', '#000000', '#FFFFFF',
        '#000000', '#FFFFFF', '#000000', '#FFFFFF', '#FFFFFF',
    ];

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

    if (!date) return null
    const hourEvents = events.filter(e => e.start.getTime() < (date.getTime() + 60 * 60 * 1000) && e.end.getTime() > date.getTime())
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
                            keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => onPressEvent?.(item)}
                                    style={[styles.eventItem, { backgroundColor: getColorByUserId(item.user_id) }]}
                                >
                                    <Text style={[styles.eventTitle, { color: getColorTextByUserId(item.user_id) }]}>{item.title}</Text>
                                    <Text style={[styles.eventTime, { color: getColorTextByUserId(item.user_id) }]}>
                                        {dayjs(item.start).format('D. MMMM YYYY  HH:mm')} - {dayjs(item.end).format('D. MMMM YYYY  HH:mm')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            style={{ maxHeight: 200 }}
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
