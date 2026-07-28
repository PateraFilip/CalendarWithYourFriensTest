import { AuthBrandMark } from '@/components/AuthBrandMark'
import { Brand, BrandSurfaces } from '@/constants/brand'
import { ThemedText } from '@/components/themed-text'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { KeyboardScreen } from '@/components/KeyboardScreen'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_APK_URL } from '@/lib/appVersion'
import { loadStorage } from '@/lib/storage'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native'
import { Button, TextInput, useTheme } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import Loading from '../loading'

const isNative = Platform.OS !== 'web'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showBiometric, setShowBiometric] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  })

  const router = useRouter()
  const theme = useTheme()
  const scheme = useColorScheme() ?? 'light'
  const surfaces = BrandSurfaces[scheme]

  const { login, loading, unlockWithBiometric, canUnlockWithBiometric } = useAuth()

  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary
  const onButton = scheme === 'dark' ? '#0B1220' : Brand.onPrimary

  useEffect(() => {
    loadStorage('lastEmail').then((stored) => {
      if (stored) setEmail(stored)
    })
    loadStorage('rememberMe').then((v) => {
      if (v === 'true') setRememberMe(true)
    })
    if (isNative) {
      canUnlockWithBiometric().then(setShowBiometric)
    }
  }, [])

  useEffect(() => {
    if (!isNative || rememberMe) {
      setShowBiometric(false)
      return
    }
    canUnlockWithBiometric().then(setShowBiometric)
  }, [rememberMe])

  const handleBiometricLogin = async () => {
    if (!isNative || rememberMe) return
    try {
      const ok = await unlockWithBiometric()
      if (!ok) {
        alert(
          'Biometrie se nezdařila, nebo chybí uložená session. Přihlas se heslem bez „Zůstat přihlášen“ — příště můžeš použít otisk / Face ID.'
        )
        return
      }
      router.replace('/(tabs)')
    } catch (err) {
      console.error(err)
      alert('Chyba při biometrickém přihlášení.')
    }
  }

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
    <ThemedSafeView
      style={[styles.container, { backgroundColor: surfaces.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardScreen
        scroll
        gap={28}
        style={{ width: '100%' }}
        contentContainerStyle={styles.scrollContent}
      >
        <AuthBrandMark />

        <View style={styles.form}>
          <TextInput
            label="E-mail"
            value={email}
            onChangeText={(text) => {
              setEmail(text)
              if (errors.email) setErrors((e) => ({ ...e, email: false }))
            }}
            mode="outlined"
            activeOutlineColor={accent}
            outlineColor={surfaces.border}
            textColor={surfaces.text}
            placeholder="jmeno@domena.cz"
            style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            left={
              <TextInput.Icon
                icon={() => (
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={20}
                    color={errors.email ? theme.colors.error : accent}
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
              if (errors.password) setErrors((e) => ({ ...e, password: false }))
            }}
            mode="outlined"
            activeOutlineColor={accent}
            outlineColor={surfaces.border}
            textColor={surfaces.text}
            secureTextEntry={!showPassword}
            style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
            error={errors.password}
            autoComplete="password"
            left={
              <TextInput.Icon
                icon={() => (
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color={errors.password ? theme.colors.error : accent}
                  />
                )}
              />
            }
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword((v) => !v)}
                forceTextInputFocus={false}
              />
            }
          />

          <View style={styles.rememberRow}>
            <Switch
              value={rememberMe}
              onValueChange={() => setRememberMe(!rememberMe)}
              trackColor={{ false: '#767577', true: accent }}
              thumbColor="#fff"
            />
            <ThemedText style={{ marginLeft: 8, color: surfaces.text }}>
              Zůstat přihlášen
            </ThemedText>
          </View>

          <Button
            mode="contained"
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={[styles.buttonLabel, { color: onButton }]}
            buttonColor={accent}
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
          >
            Přihlásit se
          </Button>

          {isNative && showBiometric && !rememberMe && (
            <Button
              mode="outlined"
              style={[styles.button, { marginTop: 10, borderColor: accent }]}
              labelStyle={{ color: accent }}
              onPress={handleBiometricLogin}
              icon="fingerprint"
              disabled={loading}
            >
              Přihlásit otiskem / Face ID
            </Button>
          )}

          <View style={styles.linksRow}>
            <Pressable
              onPress={() => router.push('/reset_password')}
              disabled={loading}
              hitSlop={12}
              style={styles.linkHit}
            >
              <ThemedText style={[styles.link, { color: accent }]}>
                Zapomenuté heslo
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/register')}
              disabled={loading}
              hitSlop={12}
              style={styles.linkHit}
            >
              <ThemedText style={[styles.link, { color: accent }]}>
                Registrovat se
              </ThemedText>
            </Pressable>
          </View>

          {!isNative && (
            <Button
              mode="text"
              style={{ marginTop: 8 }}
              labelStyle={{ color: surfaces.textSecondary }}
              icon="android"
              disabled={loading}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = DEFAULT_APK_URL
                }
              }}
            >
              Stáhnout Android appku
            </Button>
          )}
        </View>
      </KeyboardScreen>
    </ThemedSafeView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: 14,
  },
  input: {
    width: '100%',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 2,
  },
  button: {
    borderRadius: 14,
    width: '100%',
    marginTop: 6,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  linkHit: {
    paddingVertical: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
})
