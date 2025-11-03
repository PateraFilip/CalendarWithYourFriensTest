import { StyleSheet } from 'react-native';

import { fetchColors } from '@/api/get_colors';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import React, { useEffect, useState } from 'react';
import { Button } from 'react-native-paper';
import ColorPicker from '../../components/ColorPicker';


interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number | null;
}

export default function TabTwoScreen() {
    const { user } = useAuth()
    const [colors, setColors] = useState<Color[]>([]);
    const [selectedColor, setSelectedColor] = useState<Color | null>(null);
    const [errors, setErrors] = useState<{ color: boolean }>(
        {
            color: false
        }
    )

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )

    useEffect(() => {
        fetchColors()
            .then(setColors)
            .catch(console.error);
    }, []);

    const handleChangeColor = async () => {
        const newErrors = {
            color: selectedColor === null,
        }

        setErrors(newErrors);
        if (!newErrors.color && selectedColor) {
            try {

            } catch (err) {
                console.error(err)
                alert('Chyba připojení')
            }
        }
    }

    return (
        <ThemedView style={styles.titleContainer}>
            <ThemedText>Přezdívka: {user?.username}</ThemedText>
            <ThemedText>Jméno: {user?.name}</ThemedText>
            <ThemedText>Příjmení: {user?.lastname}</ThemedText>
            <ThemedText>Email: {user?.email}</ThemedText>
            <ThemedView style={styles.input}>
                <ColorPicker
                    colors={colors}
                    selectedColor={selectedColor}
                    setSelectedColor={setSelectedColor}
                    error={errors.color}
                    setError={(val) => setErrors((e) => ({ ...e, color: val }))}
                />
            </ThemedView>

            <Button
                mode="contained"
                style={styles.button}
                labelStyle={{ color: buttonTextColor }}
                buttonColor={buttonColor}
                onPress={handleChangeColor} // volání FastAPI
            >
                Registrovat se
            </Button>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    titleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    input: {
        width: '100%',
        backgroundColor: 'transparent'
    },
    button: {
        borderRadius: 6,
        width: '100%',
    },
})
