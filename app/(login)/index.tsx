import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { KeyboardScreen } from '@/components/KeyboardScreen'
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
    const [showBiometric, setShowBiometric] = useState(false)
    const [errors, setErrors] = useState<{ email: boolean; password: boolean }>(
        {
            email: false,
            password: false,
        }
    )

    const router = useRouter()
    const theme = useTheme()

    const { login, loading, unlockWithBiometric, canUnlockWithBiometric } = useAuth()

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
        if (isNative) {
            canUnlockWithBiometric().then(setShowBiometric);
        }
    }, []);

    // Biometrie jen když není „Zůstat přihlášen"
    useEffect(() => {
        if (!isNative || rememberMe) {
            setShowBiometric(false);
            return;
        }
        canUnlockWithBiometric().then(setShowBiometric);
    }, [rememberMe]);

    const handleBiometricLogin = async () => {
        if (!isNative || rememberMe) return;
        try {
            const ok = await unlockWithBiometric();
            if (!ok) {
                alert(
                    'Biometrie se nezdařila, nebo chybí uložená session. Přihlas se heslem bez „Zůstat přihlášen" — příště můžeš použít otisk / Face ID.'
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
            <KeyboardScreen
                scroll
                gap={28}
                style={{ width: '100%' }}
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 24,
                }}
            >
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
                            Zůstat přihlášen
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
                    {isNative && showBiometric && !rememberMe && (
                        <Button
                            mode="outlined"
                            style={[styles.button, { marginTop: 8 }]}
                            labelStyle={{ color: buttonColor }}
                            onPress={handleBiometricLogin}
                            icon="fingerprint"
                        >
                            Přihlásit otiskem / Face ID
                        </Button>
                    )}

                    <View style={{ width: '100%' }}>
                        <Link
                            href="../reset_password"
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
                            href="../register"
                            style={{
                                color: buttonColor,
                                textAlign: 'left',
                                fontWeight: 'bold',
                            }}
                        >
                            Registrovat se
                        </Link>
                    </View>

                    {!isNative && (
                        <Button
                            mode="outlined"
                            style={[styles.button, { marginTop: 4 }]}
                            labelStyle={{ color: buttonColor }}
                            textColor={buttonColor}
                            icon="android"
                            onPress={() => {
                                if (typeof window !== 'undefined') {
                                    window.location.href = '/downloads/CalendarWithFriends.apk';
                                }
                            }}
                        >
                            Stáhnout Android appku
                        </Button>
                    )}
                </ThemedView>
            </KeyboardScreen>
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
