import { ThemedView } from '@/components/themed-view'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { useThemeColor } from '@/hooks/use-theme-color'
import { Link, useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { Button, TextInput, useTheme } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import Loading from '../loading'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<{ email: boolean; password: boolean }>(
        {
            email: false,
            password: false,
        }
    )

    const router = useRouter()
    const theme = useTheme()

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )

    const handleLogin = async () => {
        const newErrors = {
            email: email.trim() === '',
            password: password.trim() === '',
        }

        setErrors(newErrors)
        if (!newErrors.email && !newErrors.password) {
            setLoading(true)
            try {
                const response = await fetch(
                    'https://tzbpcbmxwbsixrtorijk.supabase.co/functions/v1/smart-processor',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization:
                                'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw',
                        },
                        body: JSON.stringify({
                            username: email,
                            password,
                            action: 'login',
                        }),
                    }
                )

                const data = await response.json()

                if (!response.ok) {
                    alert(data.error || 'Přihlášení selhalo')
                    return
                }

                router.replace('/(tabs)')
            } catch (err) {
                console.error(err)
                alert('Chyba připojení')
            } finally {
                setLoading(false)
            }
        }
    }

    if (loading) return <Loading />

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
                    onChangeText={(text) => {
                        setEmail(text)
                        if (errors.email)
                            setErrors((e) => ({ ...e, email: false }))
                    }}
                    mode="outlined"
                    activeOutlineColor="#000"
                    style={styles.input}
                    error={errors.email}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="account-outline"
                                    size={20}
                                    color={
                                        errors.email
                                            ? theme.colors.error
                                            : buttonColor
                                    }
                                />
                            )}
                        />
                    }
                />

                <TextInput
                    label="Heslo"
                    value={password}
                    onChangeText={(text) => {
                        setPassword(text)
                        if (errors.password)
                            setErrors((e) => ({ ...e, password: false }))
                    }}
                    mode="outlined"
                    activeOutlineColor="#000"
                    secureTextEntry
                    style={styles.input}
                    error={errors.password}
                    left={
                        <TextInput.Icon
                            icon={() => (
                                <MaterialCommunityIcons
                                    name="lock-outline"
                                    size={20}
                                    color={
                                        errors.password
                                            ? theme.colors.error
                                            : buttonColor
                                    }
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
                    onPress={handleLogin} // volání FastAPI
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
