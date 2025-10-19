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

    if (!date) return null

    const dayEvents = events.filter(e => dayjs(e.start).isSame(dayjs(date), 'day'))

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onClose} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        {dayjs(date).format('dddd D. MMMM YYYY - HH:mm')}
                    </ThemedText>

                    {dayEvents.length > 0 ? (
                        <FlatList
                            data={dayEvents}
                            keyExtractor={(_, i) => i.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.eventItem}>
                                    <Text style={styles.eventTitle}>{item.title}</Text>
                                    <Text style={styles.eventTime}>
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
        backgroundColor: '#f6f6f6',
        borderRadius: 8,
        padding: 10,
        marginVertical: 6,
    },
    eventTitle: {
        fontWeight: '600',
    },
    eventTime: {
        color: '#666',
        fontSize: 13,
    },
    createButton: {
        borderRadius: 6,
    },
    closeButton: {
        marginTop: 6,
    },
})
