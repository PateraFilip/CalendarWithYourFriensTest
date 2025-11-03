import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText } from './themed-text';

interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number | null; // null = volná
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
            <Pressable onPress={() => setModalVisible(true)}>
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
            </Pressable>

            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPressOut={() => setModalVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <FlatList
                            data={colors}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => {
                                const disabled = !!item.user_id;
                                return (
                                    <TouchableOpacity
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
                                            {item.name} {disabled && `(už má ${item.user_id})`}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </Pressable>
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
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        maxHeight: '70%',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    disabledItem: {
        opacity: 0.6,
    },
});
