// FilterModal.tsx

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Checkbox, Modal, Portal } from 'react-native-paper';
import { ThemedView } from './themed-view';

interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string;
}

interface FilterModalProps {
    visible: boolean;
    onDismiss: () => void;
    onToggleUser: (id: number) => void;
    colors: {
        id: number;
        name: string;
        background_color: string;
        text_color: string;
        user_id: number;
    }[];
    users: User[];
    uncheckedUserIds: number[];
}

export const FilterModal: React.FC<FilterModalProps> = ({
    visible,
    colors,
    onDismiss,
    onToggleUser,
    uncheckedUserIds,
    users,
}) => {
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

    return (
        <Portal>
            <Modal visible={visible} onDismiss={() => onDismiss()} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        Filtry
                    </ThemedText>

                    {users.length > 0 ? (
                        <FlatList
                            data={users}
                            extraData={uncheckedUserIds}
                            keyExtractor={(item) => item.id.toString()}
                            style={{ maxHeight: 500 }}
                            renderItem={({ item }) => {
                                const colorObj = colors.find(c => c.user_id === item.id);
                                const backgroundColor = colorObj?.background_color ?? '#ccc';
                                const textColor = colorObj?.text_color ?? '#000';

                                // Zaškrtnutý je ten, jehož ID *NENÍ* v seznamu odškrtnutých
                                const isChecked = !uncheckedUserIds.includes(item.id);

                                return (
                                    <TouchableOpacity
                                        onPress={() => onToggleUser(item.id)}
                                        style={[styles.filterItem, { backgroundColor, borderWidth: 1, borderColor: buttonColor }]}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <Text style={[styles.filterTitle, { color: textColor }]}>
                                                {item.username}
                                            </Text>

                                            <View pointerEvents="none">
                                                <Checkbox
                                                    status={isChecked ? 'checked' : 'unchecked'}
                                                    color={textColor}
                                                    uncheckedColor={textColor}
                                                />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    ) : (
                        <ThemedText>Žádní uživatelé</ThemedText>
                    )}

                    <Button
                        mode="contained"
                        onPress={() => onDismiss()}
                        buttonColor={buttonColor}
                        labelStyle={{ color: buttonTextColor }}
                        style={styles.createButton}
                    >
                        Zavřít
                    </Button>
                </ThemedView>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    modalContainer: { margin: 20 },
    content: { padding: 20, borderRadius: 20, gap: 16 },
    title: { textAlign: 'center' },
    filterItem: { borderRadius: 8, marginVertical: 6, paddingLeft: 5 },
    filterTitle: {},
    createButton: { borderRadius: 6 },
})
