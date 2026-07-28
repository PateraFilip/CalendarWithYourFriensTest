import { AuthBrandMark } from '@/components/AuthBrandMark'
import { Brand, BrandSurfaces } from '@/constants/brand'
import { ThemedSafeView } from '@/components/ThemedSafeView'
import { ThemedText } from '@/components/themed-text'
import { KeyboardScreen } from '@/components/KeyboardScreen'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { supabase } from '@/lib/supabaseClient'
import { Stack, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native'
import { Button, TextInput, useTheme } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

type Step = 'email' | 'code' | 'password'

const OTP_MIN = 6
const OTP_MAX = 8

export default function ResetPasswordScreen() {
  const theme = useTheme()
  const router = useRouter()
  const scheme = useColorScheme() ?? 'light'
  const surfaces = BrandSurfaces[scheme]
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary
  const onButton = scheme === 'dark' ? '#0B1220' : Brand.onPrimary
  const codeInputRef = useRef<RNTextInput>(null)

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordControl, setNewPasswordControl] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [errors, setErrors] = useState<{
    email: boolean
    code: boolean
    newPassword: boolean
    newPasswordControl: boolean
  }>({
    email: false,
    code: false,
    newPassword: false,
    newPasswordControl: false,
  })

  const stepTitle =
    step === 'email'
      ? 'Zapomenuté heslo'
      : step === 'code'
        ? 'Ověření kódu'
        : 'Nové heslo'
  const stepTagline =
    step === 'email'
      ? 'Pošleme ti kód na e-mail'
      : step === 'code'
        ? 'Zadej kód z e-mailu'
        : 'Zvol si nové heslo'

  useEffect(() => {
    if (step !== 'code') return
    const t = setTimeout(() => {
      codeInputRef.current?.focus()
    }, 150)
    return () => clearTimeout(t)
  }, [step])

  const handleSendCode = async () => {
    const emailError = email.trim() === ''
    setErrors((e) => ({ ...e, email: emailError }))
    setErrorMsg(null)
    setInfo(null)
    if (emailError || busy) return

    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
      if (error) {
        setErrorMsg(error.message || 'Nepodařilo se odeslat kód')
        return
      }
      setInfo('Kód jsme poslali na e-mail. Zadej ho níže (obvykle 6 číslic).')
      setCode('')
      setStep('code')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyCode = async () => {
    const trimmed = code.trim()
    const codeError =
      trimmed === '' || trimmed.length < OTP_MIN || trimmed.length > OTP_MAX
    setErrors((e) => ({ ...e, code: codeError }))
    setErrorMsg(null)
    if (codeError) {
      setErrorMsg(`Zadej kód z e-mailu (${OTP_MIN}–${OTP_MAX} číslic).`)
      return
    }
    if (busy) return

    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: trimmed,
        type: 'recovery',
      })

      if (error) {
        setErrorMsg(error.message || 'Neplatný kód')
        return
      }
      setInfo(null)
      setStep('password')
    } catch (err) {
      console.error(err)
      setErrorMsg('Chyba při ověřování kódu')
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async () => {
    const newErrors = {
      email: false,
      code: false,
      newPassword: newPassword.trim() === '',
      newPasswordControl: newPasswordControl.trim() === '',
    }
    setErrorMsg(null)
    if (
      !newErrors.newPassword &&
      !newErrors.newPasswordControl &&
      newPassword !== newPasswordControl
    ) {
      newErrors.newPassword = true
      newErrors.newPasswordControl = true
      setErrorMsg('Hesla se neshodují')
    }
    setErrors(newErrors)
    if (newErrors.newPassword || newErrors.newPasswordControl || busy) return

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setErrorMsg(error.message || 'Chyba při změně hesla')
        return
      }

      setInfo('Heslo bylo změněno. Přihlas se znovu.')
      await supabase.auth.signOut()
      router.replace('/(login)')
    } catch (err) {
      console.error(err)
      setErrorMsg('Chyba připojení')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedSafeView
        style={[styles.container, { backgroundColor: surfaces.background }]}
        edges={['top', 'bottom']}
      >
        <Pressable
          onPress={() => router.replace('/(login)')}
          hitSlop={12}
          style={styles.backRow}
          disabled={busy}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={accent} />
          <ThemedText numberOfLines={1} style={[styles.backText, { color: accent }]}>
            Přihlášení
          </ThemedText>
        </Pressable>

        <KeyboardScreen
          scroll
          gap={14}
          style={{ width: '100%', flex: 1 }}
          contentContainerStyle={styles.scrollContent}
        >
          <AuthBrandMark title={stepTitle} tagline={stepTagline} compact />

          <View style={styles.form}>
            {!!info && (
              <ThemedText style={[styles.infoText, { color: Brand.success }]}>
                {info}
              </ThemedText>
            )}
            {!!errorMsg && (
              <ThemedText style={[styles.errorText, { color: Brand.danger }]}>
                {errorMsg}
              </ThemedText>
            )}

            {step === 'email' && (
              <>
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
                  style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
                  error={errors.email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!busy}
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
                <Button
                  mode="contained"
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: onButton }]}
                  buttonColor={accent}
                  onPress={handleSendCode}
                  loading={busy}
                  disabled={busy}
                >
                  Poslat kód e-mailem
                </Button>
              </>
            )}

            {step === 'code' && (
              <>
                {Platform.OS === 'web' ? (
                  <View style={styles.webField}>
                    <ThemedText
                      style={[styles.webLabel, { color: surfaces.textSecondary }]}
                    >
                      Kód z e-mailu
                    </ThemedText>
                    <RNTextInput
                      ref={codeInputRef}
                      value={code}
                      onChangeText={(text) => {
                        setCode(text.replace(/\D/g, '').slice(0, OTP_MAX))
                        if (errors.code) setErrors((e) => ({ ...e, code: false }))
                        setErrorMsg(null)
                      }}
                      style={[
                        styles.webInput,
                        {
                          borderColor: errors.code ? theme.colors.error : surfaces.border,
                          color: surfaces.text,
                          backgroundColor: surfaces.surfaceElevated,
                        },
                      ]}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={OTP_MAX}
                      editable={!busy}
                      placeholder="123456"
                      placeholderTextColor={surfaces.textSecondary}
                      autoFocus
                    />
                  </View>
                ) : (
                  <TextInput
                    ref={codeInputRef as any}
                    label="Kód z e-mailu (6–8 číslic)"
                    value={code}
                    onChangeText={(text) => {
                      setCode(text.replace(/\D/g, '').slice(0, OTP_MAX))
                      if (errors.code) setErrors((e) => ({ ...e, code: false }))
                      setErrorMsg(null)
                    }}
                    mode="outlined"
                    activeOutlineColor={accent}
                    outlineColor={surfaces.border}
                    textColor={surfaces.text}
                    style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
                    error={errors.code}
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    maxLength={OTP_MAX}
                    editable={!busy}
                    autoFocus
                  />
                )}
                <Button
                  mode="contained"
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: onButton }]}
                  buttonColor={accent}
                  onPress={handleVerifyCode}
                  loading={busy}
                  disabled={busy}
                >
                  Ověřit kód
                </Button>
                <Button
                  mode="text"
                  style={styles.button}
                  labelStyle={{ color: accent }}
                  onPress={() => {
                    setStep('email')
                    setErrorMsg(null)
                    setInfo(null)
                  }}
                  disabled={busy}
                >
                  Zpět
                </Button>
              </>
            )}

            {step === 'password' && (
              <>
                <TextInput
                  label="Nové heslo"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text)
                    if (errors.newPassword)
                      setErrors((e) => ({ ...e, newPassword: false }))
                  }}
                  mode="outlined"
                  activeOutlineColor={accent}
                  outlineColor={surfaces.border}
                  textColor={surfaces.text}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
                  error={errors.newPassword}
                  editable={!busy}
                  autoComplete="new-password"
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialCommunityIcons
                          name="lock-outline"
                          size={20}
                          color={
                            errors.newPassword ? theme.colors.error : accent
                          }
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

                <TextInput
                  label="Nové heslo znovu"
                  value={newPasswordControl}
                  onChangeText={(text) => {
                    setNewPasswordControl(text)
                    if (errors.newPasswordControl)
                      setErrors((e) => ({ ...e, newPasswordControl: false }))
                  }}
                  mode="outlined"
                  activeOutlineColor={accent}
                  outlineColor={surfaces.border}
                  textColor={surfaces.text}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { backgroundColor: surfaces.surfaceElevated }]}
                  error={errors.newPasswordControl}
                  editable={!busy}
                  autoComplete="new-password"
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialCommunityIcons
                          name="lock-outline"
                          size={20}
                          color={
                            errors.newPasswordControl
                              ? theme.colors.error
                              : accent
                          }
                        />
                      )}
                    />
                  }
                />
                <Button
                  mode="contained"
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={[styles.buttonLabel, { color: onButton }]}
                  buttonColor={accent}
                  onPress={handleResetPassword}
                  loading={busy}
                  disabled={busy}
                >
                  Změnit heslo
                </Button>
                <Button
                  mode="text"
                  style={styles.button}
                  labelStyle={{ color: accent }}
                  onPress={() => {
                    setStep('email')
                    setErrorMsg(null)
                    setInfo(null)
                  }}
                  disabled={busy}
                >
                  Zrušit
                </Button>
              </>
            )}
          </View>
        </KeyboardScreen>
      </ThemedSafeView>
    </>
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
    paddingBottom: 32,
    paddingTop: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    flexShrink: 0,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 0,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: 14,
  },
  input: {
    width: '100%',
  },
  button: {
    borderRadius: 14,
    width: '100%',
    marginTop: 4,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    width: '100%',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    width: '100%',
    fontSize: 14,
    lineHeight: 20,
  },
  webField: {
    width: '100%',
    gap: 6,
  },
  webLabel: {
    fontSize: 13,
  },
  webInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
})
