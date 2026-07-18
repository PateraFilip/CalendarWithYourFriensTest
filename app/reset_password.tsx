import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabaseClient';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Step = 'email' | 'code' | 'password';

const OTP_MIN = 6;
const OTP_MAX = 8;

export default function ModalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const codeInputRef = useRef<RNTextInput>(null);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordControl, setNewPasswordControl] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    email: boolean;
    code: boolean;
    newPassword: boolean;
    newPasswordControl: boolean;
  }>({
    email: false,
    code: false,
    newPassword: false,
    newPasswordControl: false,
  });

  const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const buttonTextColor = useThemeColor(
    { light: '#fff', dark: '#000' },
    'text'
  );

  // Po přechodu na krok s kódem fokusni pole (iOS Safari po alertu jinak často „nejde kliknout“)
  useEffect(() => {
    if (step !== 'code') return;
    const t = setTimeout(() => {
      codeInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [step]);

  const handleSendCode = async () => {
    const emailError = email.trim() === '';
    setErrors((e) => ({ ...e, email: emailError }));
    setErrorMsg(null);
    setInfo(null);
    if (emailError || busy) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setErrorMsg(error.message || 'Nepodařilo se odeslat kód');
        return;
      }
      // Bez window.alert — na iOS Safari po alertu často nejde fokusnout další input
      setInfo('Kód jsme poslali na e-mail. Zadej ho níže (obvykle 6 číslic).');
      setCode('');
      setStep('code');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmed = code.trim();
    const codeError =
      trimmed === '' || trimmed.length < OTP_MIN || trimmed.length > OTP_MAX;
    setErrors((e) => ({ ...e, code: codeError }));
    setErrorMsg(null);
    if (codeError) {
      setErrorMsg(`Zadej kód z e-mailu (${OTP_MIN}–${OTP_MAX} číslic).`);
      return;
    }
    if (busy) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: trimmed,
        type: 'recovery',
      });

      if (error) {
        setErrorMsg(error.message || 'Neplatný kód');
        return;
      }
      setInfo(null);
      setStep('password');
    } catch (err) {
      console.error(err);
      setErrorMsg('Chyba při ověřování kódu');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors = {
      email: false,
      code: false,
      newPassword: newPassword.trim() === '',
      newPasswordControl: newPasswordControl.trim() === '',
    };
    setErrorMsg(null);
    if (
      !newErrors.newPassword &&
      !newErrors.newPasswordControl &&
      newPassword !== newPasswordControl
    ) {
      newErrors.newPassword = true;
      newErrors.newPasswordControl = true;
      setErrorMsg('Hesla se neshodují');
    }
    setErrors(newErrors);
    if (newErrors.newPassword || newErrors.newPasswordControl || busy) return;

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message || 'Chyba při změně hesla');
        return;
      }

      setInfo('Heslo bylo změněno. Přihlas se znovu.');
      await supabase.auth.signOut();
      router.replace('/(login)');
    } catch (err) {
      console.error(err);
      setErrorMsg('Chyba připojení');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reset hesla',
        }}
      />
      <ThemedSafeView style={styles.container}>
        <KeyboardScreen
          scroll
          style={{ width: '100%' }}
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 32,
            flexGrow: 1,
          }}
        >
          <ThemedView style={styles.box}>
            {!!info && (
              <ThemedText style={styles.infoText}>{info}</ThemedText>
            )}
            {!!errorMsg && (
              <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
            )}

            {step === 'email' && (
              <>
                <TextInput
                  label="E-mail"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email)
                      setErrors((e) => ({ ...e, email: false }));
                  }}
                  mode="outlined"
                  activeOutlineColor={buttonColor}
                  style={styles.input}
                  error={errors.email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!busy}
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialCommunityIcons
                          name="at"
                          size={20}
                          color={
                            errors.email ? theme.colors.error : buttonColor
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
                {/*
                  Na webu (hlavně iOS Safari) Paper TextInput + number-pad + ikona
                  často blokuje fokus. Prostý RN TextInput je spolehlivější.
                */}
                {Platform.OS === 'web' ? (
                  <View style={styles.webField}>
                    <ThemedText style={styles.webLabel}>
                      Kód z e-mailu
                    </ThemedText>
                    <RNTextInput
                      ref={codeInputRef}
                      value={code}
                      onChangeText={(text) => {
                        setCode(text.replace(/\D/g, '').slice(0, OTP_MAX));
                        if (errors.code)
                          setErrors((e) => ({ ...e, code: false }));
                        setErrorMsg(null);
                      }}
                      style={[
                        styles.webInput,
                        {
                          borderColor: errors.code
                            ? theme.colors.error
                            : buttonColor,
                          color: buttonColor,
                        },
                      ]}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={OTP_MAX}
                      editable={!busy}
                      placeholder="123456"
                      placeholderTextColor="#888"
                      autoFocus
                    />
                  </View>
                ) : (
                  <TextInput
                    ref={codeInputRef as any}
                    label="Kód z e-mailu (6–8 číslic)"
                    value={code}
                    onChangeText={(text) => {
                      setCode(text.replace(/\D/g, '').slice(0, OTP_MAX));
                      if (errors.code)
                        setErrors((e) => ({ ...e, code: false }));
                      setErrorMsg(null);
                    }}
                    mode="outlined"
                    activeOutlineColor={buttonColor}
                    style={styles.input}
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
                  labelStyle={{ color: buttonTextColor }}
                  buttonColor={buttonColor}
                  onPress={handleVerifyCode}
                  loading={busy}
                  disabled={busy}
                >
                  Ověřit kód
                </Button>
                <Button
                  mode="text"
                  style={styles.button}
                  labelStyle={{ color: buttonColor }}
                  onPress={() => {
                    setStep('email');
                    setErrorMsg(null);
                    setInfo(null);
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
                    setNewPassword(text);
                    if (errors.newPassword)
                      setErrors((e) => ({ ...e, newPassword: false }));
                  }}
                  mode="outlined"
                  activeOutlineColor={buttonColor}
                  secureTextEntry
                  style={styles.input}
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
                            errors.newPassword
                              ? theme.colors.error
                              : buttonColor
                          }
                        />
                      )}
                    />
                  }
                />

                <TextInput
                  label="Nové heslo znovu"
                  value={newPasswordControl}
                  onChangeText={(text) => {
                    setNewPasswordControl(text);
                    if (errors.newPasswordControl)
                      setErrors((e) => ({ ...e, newPasswordControl: false }));
                  }}
                  mode="outlined"
                  activeOutlineColor={buttonColor}
                  secureTextEntry
                  style={styles.input}
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
                  onPress={handleResetPassword}
                  loading={busy}
                  disabled={busy}
                >
                  Změnit heslo
                </Button>
                <Button
                  mode="text"
                  style={styles.button}
                  labelStyle={{ color: buttonColor }}
                  onPress={() => {
                    setStep('email');
                    setErrorMsg(null);
                    setInfo(null);
                  }}
                  disabled={busy}
                >
                  Zrušit
                </Button>
              </>
            )}
          </ThemedView>
        </KeyboardScreen>
      </ThemedSafeView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  button: {
    borderRadius: 6,
    width: '100%',
  },
  box: {
    width: '85%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    alignItems: 'center',
    borderWidth: 0,
    elevation: 1,
  },
  infoText: {
    width: '100%',
    color: '#2e7d32',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    width: '100%',
    color: '#c62828',
    fontSize: 14,
    lineHeight: 20,
  },
  webField: {
    width: '100%',
    gap: 6,
  },
  webLabel: {
    fontSize: 13,
    opacity: 0.75,
  },
  webInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
});
