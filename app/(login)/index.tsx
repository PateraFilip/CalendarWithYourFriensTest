import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { useThemeColor } from '@/hooks/use-theme-color'
import { useAuth } from '@/hooks/useAuth'
import { loadStorage } from '@/lib/storage'
import { Link, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Platform, StyleSheet, Switch, View } from 'react-native'
import { Button, TextInput, useTheme } from 'react-native-paper'
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import Loading from '../loading'

const isNative = Platform.OS !== 'web'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const [errors, setErrors] = useState<{ email: boolean; password: boolean }>(
        {
            email: false,
            password: false,
        }
    )

    const router = useRouter()
    const theme = useTheme()

    const { login, loading, unlockWithBiometric } = useAuth()

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor(
        { light: '#fff', dark: '#000' },
        'text'
    )

    useEffect(() => {
        loadStorage('lastEmail').then((stored) => {
            if (stored) setEmail(stored);
        });
        loadStorage('rememberMe').then((v) => {
            if (v === 'true') setRememberMe(true);
        });
    }, []);

    const handleBiometricLogin = async () => {
        if (!isNative) return;
        try {
            const ok = await unlockWithBiometric();
            if (!ok) {
                alert(
                    'Biometrie se nezdařila, nebo nemáš uloženou session. Přihlaš se heslem se zapnutým „Zůstat přihlášen“ — pak tě příště odemkne otisk.'
                );
                return;
            }
            router.replace('/(tabs)');
        } catch (err) {
            console.error(err);
            alert('Chyba při biometrickém přihlášení.');
        }
    };

    const handleLogin = async () => {
        const newErrors = {
            email: email.trim() === '',
            password: password.trim() === '',
        }

        setErrors(newErrors)
        if (!newErrors.email && !newErrors.password) {
            try {
                await login(email, password, rememberMe)
                router.replace('/(tabs)')
            } catch (err) {
                console.error(err)
                alert('Chyba připojení')
            }
        }
    }

    if (loading) return <Loading />

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedView type='surface' style={styles.box}>
                <ThemedText type='title'>
                    Kalendář
                </ThemedText>
                <TextInput
                    label="E-mail"
                    value={email}
                    onChangeText={(text) => {
                        setEmail(text)
                        if (errors.email)
                            setErrors((e) => ({ ...e, email: false }))
                    }}
                    mode="outlined"
                    activeOutlineColor={buttonColor}
                    style={styles.input}
                    error={errors.email}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                    activeOutlineColor={buttonColor}
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

                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <Switch
                        value={rememberMe}
                        onValueChange={() => setRememberMe(!rememberMe)}
                        trackColor={{ false: '#767577', true: buttonColor }}
                    />
                    <ThemedText style={{ marginLeft: 8 }}>
                        {isNative
                            ? 'Zůstat přihlášen (otisk odemkne appku)'
                            : 'Zůstat přihlášen'}
                    </ThemedText>
                </View>

                <Button
                    mode="contained"
                    style={styles.button}
                    labelStyle={{ color: buttonTextColor }}
                    buttonColor={buttonColor}
                    onPress={handleLogin}
                >
                    Přihlásit se
                </Button>
                {isNative && (
                    <Button
                        mode="outlined"
                        style={[styles.button, { marginTop: 8 }]}
                        labelStyle={{ color: buttonColor }}
                        onPress={handleBiometricLogin}
                        icon="fingerprint"
                    >
                        Odemknout otiskem / Face ID
                    </Button>
                )}

                <View style={{ width: '100%' }}>
                    <Link
                        href="/reset_password"
                        style={{
                            color: buttonColor,
                            textAlign: 'left',
                            fontWeight: 'bold',
                        }}
                    >
                        Zapomenuté heslo
                    </Link>
                </View>
                <View style={{ width: '100%' }}>
                    <Link
                        href="/register"
                        style={{
                            color: buttonColor,
                            textAlign: 'left',
                            fontWeight: 'bold',
                        }}
                    >
                        Registrovat se
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
        width: wp('60%'),
        height: hp('30%'),
        resizeMode: 'contain',
    },
    box: {
        width: '85%',
        borderRadius: 16,
        padding: 20,
        gap: 20,
        alignItems: 'center',
        borderWidth: 0,
        elevation: 1
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
