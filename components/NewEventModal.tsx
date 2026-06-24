import { EventCreateForm } from '@/components/EventCreateForm';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { IconButton, Modal, Portal } from 'react-native-paper';

interface NewEventModalProps {
    visible: boolean;
    onDismiss: () => void;
    pickedDate?: Date;
    onSuccess?: () => void;
}

export function NewEventModal({ visible, onDismiss, pickedDate, onSuccess }: NewEventModalProps) {
    const { height } = useWindowDimensions();
    const backgroundColor = useThemeColor({ light: '#fff', dark: '#1C1C1E' }, 'background');
    const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

    const handleSuccess = () => {
        onSuccess?.();
        onDismiss();
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[styles.modal, { backgroundColor, maxHeight: height * 0.9 }]}
            >
                <ThemedText type="subtitle" style={styles.title}>Nová událost</ThemedText>
                <IconButton
                    icon="close"
                    onPress={onDismiss}
                    style={styles.closeButton}
                    iconColor={textColor}
                />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <EventCreateForm
                        pickedDate={pickedDate?.toISOString()}
                        onSuccess={handleSuccess}
                    />
                </ScrollView>
            </Modal>
        </Portal>
    );
}

const styles = StyleSheet.create({
    modal: {
        margin: 16,
        borderRadius: 16,
        paddingTop: 8,
    },
    title: {
        textAlign: 'center',
        marginBottom: 4,
    },
    closeButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1,
    },
});
