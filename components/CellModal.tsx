import { ThemedText } from '@/components/themed-text'
import { useThemeColor } from '@/hooks/use-theme-color'
import dayjs from 'dayjs'
import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'

interface CellModalProps {
    visible: boolean
    onClose: () => void
    date: Date | null
    events: { title: string; start: Date; end: Date; user_id: number }[]
    onCreateEvent: () => void
}

export const CellModal: React.FC<CellModalProps> = ({ visible, onClose, date, events, onCreateEvent }) => {
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

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

    const dayEvents = events.filter(e => dayjs(e.start).isSame(dayjs(date), 'day'))
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        {capitalize(dayjs(date).format('dddd D. MMMM YYYY - HH:mm'))}
                    </ThemedText>

                    {dayEvents.length > 0 ? (
                        <FlatList
                            data={dayEvents}
                            keyExtractor={(_, i) => i.toString()}
                            renderItem={({ item }) => (
                                <View style={[styles.eventItem, { backgroundColor: getColorByUserId(item.user_id) }]}>
                                    <Text style={[styles.eventTitle, { color: getColorTextByUserId(item.user_id) }]}>{item.title}</Text>
                                    <Text style={[styles.eventTime, { color: getColorTextByUserId(item.user_id) }]}>
                                        {dayjs(item.start).format('HH:mm')} - {dayjs(item.end).format('HH:mm')}
                                    </Text>
                                </View>
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
    closeButton: {
        marginTop: 6,
    },
})
