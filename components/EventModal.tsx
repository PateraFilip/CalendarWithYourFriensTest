import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useThemeColor } from '@/hooks/use-theme-color'
import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, IconButton, Modal, Portal, TextInput } from 'react-native-paper'

interface EventModalProps {
    visible: boolean
    onDismiss: () => void
    onCreate: (title: string, peopleCount: number) => void
}

export const EventModal: React.FC<EventModalProps> = ({ visible, onDismiss, onCreate }) => {
    const [title, setTitle] = useState('')
    const [peopleCount, setPeopleCount] = useState(1)

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

    const handleCreate = () => {
        if (!title.trim()) return
        onCreate(title.trim(), peopleCount)
        setTitle('')
        setPeopleCount(1)
        onDismiss()
    }

    const increase = () => setPeopleCount(prev => prev + 1)
    const decrease = () => setPeopleCount(prev => (prev > 1 ? prev - 1 : 1))

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        Přidání nové události
                    </ThemedText>

                    <TextInput
                        label="Název události"
                        value={title}
                        onChangeText={setTitle}
                        mode="outlined"
                        activeOutlineColor={buttonColor}
                    />

                    <View style={styles.peopleSection}>
                        <ThemedText style={styles.label}>Počet lidí</ThemedText>

                        <View style={styles.counterRow}>
                            <IconButton
                                icon="minus"
                                mode="contained"
                                onPress={decrease}
                                iconColor={buttonTextColor}
                                containerColor={buttonColor}
                            />
                            <TextInput
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
                        </View>
                    </View>

                    <Button
                        mode="contained"
                        onPress={handleCreate}
                        disabled={!title.trim()}
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
    peopleSection: {
        alignItems: 'center',
        gap: 6,
    },
    label: {
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
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
