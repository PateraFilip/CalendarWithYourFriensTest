import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: string | null;
    username?: string | null;
}

interface ColorPickerProps {
    colors: Color[];
    selectedColor: Color | null;
    setSelectedColor: (color: Color | null) => void;
    error?: boolean;
    setError?: (value: boolean) => void;
}

export default function ColorPicker({ colors, selectedColor, setSelectedColor, error, setError }: ColorPickerProps) {
    const [modalVisible, setModalVisible] = useState(false);
    const theme = useTheme()
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')

    const handleSelect = (color: Color) => {
        if (!color.user_id) {
            setSelectedColor(color);
            setModalVisible(false);
            if (setError) setError(false);
        }
    };

    return (
        <View>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
                <TextInput
                    mode="outlined"
                    label="Barva"
                    editable={false}
                    error={error}
                    value={selectedColor ? selectedColor.name : undefined}
                    style={{ backgroundColor: 'transparent' }}
                    onChange={() => { error = false }}
                    right={selectedColor ? (
                        <TextInput.Icon
                            icon={() => (
                                <View
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: 8,
                                        backgroundColor: selectedColor.background_color,
                                        marginRight: 8,
                                        borderWidth: 1,
                                        borderColor: '#ccc',
                                    }}
                                />
                            )}
                        />
                    ) : undefined}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="palette"
                                    size={20}
                                    color={
                                        error
                                            ? theme.colors.error
                                            : buttonColor
                                    }
                                />
                            )}
                        />
                    }
                />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <ThemedView type="surface" style={styles.modalContent}>
                        <View style={styles.header}>
                            <ThemedText style={styles.headerText}>Vyber barvu</ThemedText>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color={buttonColor} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {[...colors]
                                .sort((a, b) => (a.user_id ? 1 : 0) - (b.user_id ? 1 : 0))
                                .map((item) => {
                                const disabled = !!item.user_id;
                                return (
                                    <TouchableOpacity
                                        key={item.id.toString()}
                                        style={[styles.item, disabled && styles.disabledItem]}
                                        onPress={() => handleSelect(item)}
                                        disabled={disabled}
                                    >
                                        <View
                                            style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: 10,
                                                backgroundColor: item.background_color,
                                                marginRight: 8,
                                                borderWidth: 1,
                                                borderColor: '#ccc',
                                            }}
                                        />
                                        <ThemedText style={{ color: disabled ? '#999' : '#000' }}>
                                            {item.name} {disabled && `(už má ${item.username || item.user_id})`}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </ThemedView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    modalContent: {
        borderRadius: 12,
        padding: 16,
        maxHeight: '70%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    disabledItem: {
        opacity: 0.6,
    },
});
