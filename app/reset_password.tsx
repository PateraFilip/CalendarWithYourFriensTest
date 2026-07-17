import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedView } from '@/components/themed-view';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabaseClient';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Step = 'email' | 'code' | 'password';

export default function ModalScreen() {
  const theme = useTheme()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordControl, setNewPasswordControl] = useState('')
  const [errors, setErrors] = useState<{ email: boolean; code: boolean; newPassword: boolean, newPasswordControl: boolean }>(
    {
      email: false,
      code: false,
      newPassword: false,
      newPasswordControl: false,
    }
  )

  const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
  const buttonTextColor = useThemeColor(
    { light: '#fff', dark: '#000' },
    'text'
  )

  const handleSendCode = async () => {
    console.log(email)
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      Alert.alert('Chyba', error.message || 'Nepodařilo se odeslat');
    } else {
      Alert.alert('Hotovo', 'Zkontroluj e-mail pro 8-místný kód');
      setStep('code');
    }
  };

  const handleVerifyCode = async () => {
    const newErrors = {
      email: false,
      code: code.trim() === '' || code.length !== 8,
      newPassword: false,
      newPasswordControl: false,
    }
    setErrors(newErrors);

    if (!newErrors.code) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email,
          token: code,
          type: 'recovery',
        });

        if (error) {
          Alert.alert('Chyba', error.message || 'Neplatný kód');
        } else {
          console.log('Kód ověřen, uživatel dočasně přihlášen');
          setStep('password');
        }
      } catch (err) {
        console.error(err)
        Alert.alert('Chyba', 'Chyba při ověřování kódu');
      }
    }
  };

  const handleResetPassword = async () => {
    const newErrors = {
      email: false,
      code: false,
      newPassword: newPassword.trim() === '',
      newPasswordControl: newPasswordControl.trim() === '',
    }
    if (!newErrors.newPassword && !newErrors.newPasswordControl && newPassword !== newPasswordControl) {
      newErrors.newPassword = true;
      newErrors.newPasswordControl = true;
      alert('Hesla se neshodují');
    }
    setErrors(newErrors);

    if (!newErrors.newPassword && !newErrors.newPasswordControl) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          Alert.alert('Chyba', error.message || 'Chyba při změně hesla');
        } else {
          Alert.alert('Hotovo', 'Heslo bylo úspěšně změněno');
          setStep('email');
          setEmail('');
          setCode('');
          setNewPassword('');
          setNewPasswordControl('');
        }
      } catch (err) {
        console.error(err)
        Alert.alert('Chyba', 'Chyba připojení');
      }
    }
  };


  return (<>
    <Stack.Screen
      options={{
        title: "Reset hesla", // text v headeru
      }}
    />
    <ThemedSafeView style={styles.container}>
      <KeyboardScreen
        scroll
        style={{ width: '100%' }}
        contentContainerStyle={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 32,
        }}
      >
        <ThemedView style={styles.box}>
          {/* Step 1: Email input */}
          {step === 'email' && (
            <>
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
                left={
                  <TextInput.Icon
                    icon={() => (
                      <MaterialCommunityIcons
                        name="at"
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
              <Button
                mode="contained"
                style={styles.button}
                labelStyle={{ color: buttonTextColor }}
                buttonColor={buttonColor}
                onPress={handleSendCode}
              >
                Poslat 8-místný kód
              </Button>
            </>
          )}

          {/* Step 2: Code input */}
          {step === 'code' && (
            <>
              <TextInput
                label="8-místný kód z e-mailu"
                value={code}
                onChangeText={(text) => {
                  setCode(text)
                  if (errors.code)
                    setErrors((e) => ({ ...e, code: false }))
                }}
                mode="outlined"
                activeOutlineColor={buttonColor}
                style={styles.input}
                error={errors.code}
                keyboardType="number-pad"
                maxLength={8}
                left={
                  <TextInput.Icon
                    icon={() => (
                      <MaterialCommunityIcons
                        name="calculator"
                        size={20}
                        color={
                          errors.code
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
                onPress={handleVerifyCode}
              >
                Ověřit kód
              </Button>
              <Button
                mode="text"
                style={styles.button}
                labelStyle={{ color: buttonColor }}
                onPress={() => setStep('email')}
              >
                Zpět
              </Button>
            </>
          )}

          {/* Step 3: New password */}
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
                activeOutlineColor={buttonColor}
                secureTextEntry
                style={styles.input}
                error={errors.newPassword}
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
                  setNewPasswordControl(text)
                  if (errors.newPasswordControl)
                    setErrors((e) => ({ ...e, newPasswordControl: false }))
                }}
                mode="outlined"
                activeOutlineColor={buttonColor}
                secureTextEntry
                style={styles.input}
                error={errors.newPasswordControl}
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
              >
                Změnit heslo
              </Button>
              <Button
                mode="text"
                style={styles.button}
                labelStyle={{ color: buttonColor }}
                onPress={() => setStep('email')}
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
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent'
  },
  button: {
    borderRadius: 6,
    width: '100%',
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
})
