import { ThemedView } from '@/components/themed-view';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { API_URL } from '../../constants/api'; // pokud je api.ts v kořenovém adresáři

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )

    // ----- FastAPI login -----
    const handleLogin = async () => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: email, heslo: password }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                console.error("Login error:", errorData)
                alert(errorData.detail ? JSON.stringify(errorData.detail) : "Nepodařilo se přihlásit")
                return
            }

            const data = await response.json()
            console.log("Login success:", data)
            alert("Přihlášení proběhlo úspěšně!")

            // Příklad: přesměrování po úspěšném přihlášení
            router.replace('/(tabs)')
        } catch (error) {
            console.error("Error during login:", error)
            alert("Chyba při přihlášení. Zkontroluj připojení k internetu.")
        }
    }
    // --------------------------

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView style={styles.box}>
                <Image
                    source={require('@/assets/images/logo.png')}
                    style={styles.logo}
                />
                <TextInput
                    label="E-mail"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    style={styles.input}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="account-outline"
                                    size={20}
                                    color={buttonColor}
                                />
                            )}
                        />
                    }
                />

                <TextInput
                    label="Heslo"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="lock-outline"
                                    size={20}
                                    color={buttonColor}
                                />
                            )}
                        />
                    }
                />

                <Button
                    mode="contained"
                    style={styles.button}
                    labelStyle={{ color: buttonTextColor }}
                    buttonColor={buttonColor}
                    onPress={handleLogin}  // volání FastAPI
                >
                    Přihlásit se
                </Button>
                <View style={{ width: '100%' }}>
                    <Link
                        href="/modal"
                        style={{
                            color: buttonColor,
                            textAlign: 'left',
                            fontWeight: 'bold',
                        }}
                    >
                        Zapomenuté heslo
                    </Link>
                </View>
            </ThemedView>
        </ThemedSafeView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    logo: {
        width: 300,
        height: 300,
        resizeMode: 'contain',
    },
    box: {
        width: '85%',
        borderRadius: 16,
        padding: 20,
        elevation: 4,
        gap: 20,
        alignItems: 'center',
        borderWidth: 1,
    },
    input: {
        width: '100%',
    },
    button: {
        borderRadius: 6,
        width: '100%',
    },
})
