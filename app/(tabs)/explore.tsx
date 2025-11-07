import { fetchColors } from '@/api/get_colors';
import { fetchUsers } from '@/api/get_users';
import { updateColor } from '@/api/update_color';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import 'dayjs/locale/cs';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import RNPickerSelect from 'react-native-picker-select';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ColorPicker from '../../components/ColorPicker';


interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number | null;
}

interface User {
    id: number;
    username: string;
    jmeno: string;
    prijmeni: string;
    email: string;
    datum_narozeni: string
}

const SUPABASE_URL = 'https://tzbpcbmxwbsixrtorijk.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function TabTwoScreen() {
    const { user } = useAuth()
    const [colors, setColors] = useState<Color[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User>();
    const usersItems = users
        .map(u => ({
            value: u.id,
            label: u.username,
        }))
        .sort((a, b) => (a.value === user?.id ? -1 : b.value === user?.id ? 1 : 0));

    const colorObj = colors.find(c => c.user_id === user?.id) ?? null; // najde barvu pro daného uživatele
    const [selectedColor, setSelectedColor] = useState<Color | null>(colorObj);
    const [errors, setErrors] = useState<{ color: boolean }>(
        {
            color: false
        }
    )

    const loadColors = async () => {
        try {
            const data = await fetchColors()
            setColors(data)
        } catch (err) {
            console.error(err)
        }
    }

    const loadUsers = async () => {
        try {
            const data = await fetchUsers()
            setUsers(data)
        } catch (err) {
            console.error(err)
        }
    }

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )
    const labelColor = useThemeColor(
        { light: '#f8f8f8ff', dark: '#1C1C1E' },
        'text'
    )

    useEffect(() => {
        let mounted = true;

        loadColors(); // načtení na start

        const channel = supabase.channel('realtime:public:colors');

        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'colors'
        }, (payload) => {
            console.log('Change in colors:', payload);
            if (mounted) {
                loadColors(); // načti nové eventy
            }
        });

        channel.subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

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

    useEffect(() => {
        setSelectedColor(colorObj);
    }, [colorObj]);

    const handleChangeColor = async () => {
        const newErrors = {
            color: selectedColor === null,
        }

        setErrors(newErrors);
        if (!newErrors.color && selectedColor && user) {
            try {
                updateColor(selectedColor.id, user.id)
            } catch (err) {
                console.error(err)
                alert('Chyba připojení')
            }
        }
    }

    const formatDate = (d?: Date) => (d ? dayjs(d).format('DD. MM. YYYY') : '');

    return (
        <ThemedView style={styles.container}>
            <ThemedView style={styles.field}>
                <ThemedView style={[styles.input, { borderWidth: 1, borderRadius: 10, borderColor: buttonColor }]}>
                    <ThemedText style={{ position: 'absolute', top: -12, left: 10, fontSize: 14, backgroundColor: labelColor, paddingHorizontal: 5 }}>
                        Vyber uživatele
                    </ThemedText>
                    <RNPickerSelect
                        onValueChange={(value) => {
                            setSelectedUser(users.find(u => u.id === value) ?? undefined)
                            setSelectedColor(colors.find(c => c.user_id === value) ?? null)
                        }}
                        value={selectedUser?.id}
                        items={usersItems}
                        placeholder={{}}
                        style={{
                            inputAndroid: {
                                color: buttonColor
                            },
                            placeholder: {
                                color: buttonColor, // barva placeholderu
                            },
                        }}
                    />
                </ThemedView>
                <ThemedText>Přezdívka: {selectedUser?.username}</ThemedText>
                <ThemedText>Jméno: {selectedUser?.jmeno}</ThemedText>
                <ThemedText>Příjmení: {selectedUser?.prijmeni}</ThemedText>
                <ThemedText>Email: {selectedUser?.email}</ThemedText>
                <ThemedText>Datum narození: {' '}
                    {selectedUser?.datum_narozeni
                        ? formatDate(new Date(selectedUser.datum_narozeni))
                        : ''}</ThemedText>
                {selectedUser?.id == user?.id && (<ThemedView style={styles.input}>
                    <ColorPicker
                        colors={colors}
                        selectedColor={selectedColor}
                        setSelectedColor={setSelectedColor}
                        error={errors.color}
                        setError={(val) => setErrors((e) => ({ ...e, color: val }))}
                    />
                </ThemedView>
                )}
                {selectedUser?.id != user?.id && (<ThemedView style={styles.input}>
                    <TextInput
                        mode="outlined"
                        label="Barva"
                        editable={false}
                        value={selectedColor ? selectedColor.name : undefined}
                        style={{ backgroundColor: 'transparent' }}
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
                                        color={buttonColor}
                                    />
                                )}
                            />
                        }
                    />
                </ThemedView>)}

                {colorObj?.id != selectedColor?.id && selectedUser?.id == user?.id && (<Button
                    mode="contained"
                    style={styles.button}
                    labelStyle={{ color: buttonTextColor }}
                    buttonColor={buttonColor}
                    onPress={handleChangeColor} // volání FastAPI
                >
                    Potvdit změnu barvy
                </Button>)}
            </ThemedView>
        </ThemedView >
    )
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        backgroundColor: 'transparent'
    },
    button: {
        borderRadius: 6,
        width: '100%',
    },
    container: { flex: 1, padding: 16, justifyContent: "center" },
    field: { marginBottom: 12 },
})
