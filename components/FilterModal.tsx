import { fetchUsers } from '@/api/get_users'
import { ThemedText } from '@/components/themed-text'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Button, Checkbox, Modal, Portal } from 'react-native-paper'
import { ThemedView } from './themed-view'


const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

interface FilterModalProps {
    visible: boolean
    onDismiss: (checkedUsers: { [id: number]: boolean }) => void
    colors: {
        id: number;
        name: string;
        background_color: string;
        text_color: string;
        user_id: number;
    }[]
}

export const FilterModal: React.FC<FilterModalProps> = ({ visible,
    colors,
    onDismiss, }) => {

    const { user } = useAuth()
    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')
    const [users, setUsers] = useState<User[]>([]);
    const [checkedUsers, setCheckedUsers] = React.useState<{ [id: number]: boolean }>({});

    const loadUsers = async () => {
        try {
            const data = await fetchUsers()
            setUsers(data)
            const defaultChecked: { [id: number]: boolean } = {};
            data.forEach(u => {
                defaultChecked[u.id] = true;
            });
            setCheckedUsers(defaultChecked);
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        (async () => {
            try {
                const stored = await AsyncStorage.getItem('userFilter');
                if (stored) {
                    setCheckedUsers(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Chyba při načítání uložených checkboxů:', e);
            }
        })();
    }, [visible]);


    useEffect(() => {
        let mounted = true;

        loadUsers(); // načtení na start

        const channel = supabase.channel('realtime:public:users');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'users'
        }, (payload) => {
            console.log('Change in users:', payload);
            if (mounted) {
                loadUsers(); // načti nové eventy
            }
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const toggleUser = (id: number) => {
        setCheckedUsers(prev => ({
            ...prev,
            [id]: !prev[id], // přepíná stav konkrétního uživatele
        }));
    };

    return (
        <Portal>
            <Modal visible={visible} onDismiss={() => onDismiss(checkedUsers)} contentContainerStyle={styles.modalContainer}>
                <ThemedView style={styles.content}>
                    <ThemedText type="subtitle" style={styles.title}>
                        Filtry
                    </ThemedText>

                    {users.length > 0 ? (
                        <FlatList
                            data={users}
                            keyExtractor={(item) => item.id.toString()}
                            style={{ maxHeight: 500 }}
                            renderItem={({ item }) => {
                                const colorObj = colors.find(c => c.user_id === item.id);
                                const backgroundColor = colorObj?.background_color ?? '#ccc';
                                const textColor = colorObj?.text_color ?? '#000';

                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleUser(item.id)} // klikne na celý item
                                        style={[styles.filterItem, { backgroundColor, borderWidth: 1, borderColor: buttonColor }]}
                                    >
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <Text style={[styles.filterTitle, { color: textColor }]}>
                                                {item.username}
                                            </Text>

                                            <Checkbox
                                                status={checkedUsers[item.id] ? 'checked' : 'unchecked'}
                                                onPress={() => toggleUser(item.id)} // klikne přímo na checkbox
                                                color={textColor}
                                                uncheckedColor={textColor}
                                            />
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
                        onPress={() => onDismiss(checkedUsers)}
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
    filterItem: {
        borderRadius: 8,
        marginVertical: 6,
        paddingLeft: 5
    },
    filterTitle: {
    },
    createButton: {
        borderRadius: 6,
    },
})
