import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const API_KEY =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYm14d2JzaXhydG9yaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTIwMjEsImV4cCI6MjA3NTc2ODAyMX0.QTlHAHIPIJJ8FHDQowpZQIOckhHnAykn2CLbfJ2YbOw'

export default function ModalScreen() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordControl, setNewPasswordControl] = useState('')
  const [errors, setErrors] = useState<{ email: boolean; newPassword: boolean, newPasswordControl: boolean, code: boolean }>(
    {
      email: false,
      newPassword: false,
      newPasswordControl: false,
      code: false
    }
  )

  const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
  const buttonTextColor = useThemeColor(
    { light: '#fff', dark: '#000' },
    'text'
  )

  const handleForgot = async () => {
    console.log(email)
    const res = await fetch('https://tzbpcbmxwbsixrtorijk.functions.supabase.co/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: API_KEY,
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (data.success) Alert.alert('Hotovo', 'Zkontroluj e-mail');
    else Alert.alert('Chyba', data.error || 'Nepodařilo se odeslat');
  };

  const handleReset = async () => {
    const newErrors = {
      email: email.trim() === '',
      newPassword: newPassword.trim() === '',
      newPasswordControl: newPasswordControl.trim() === '',
      code: code.trim() === '',
    }
    if (!newErrors.newPassword && !newErrors.newPasswordControl && newPassword !== newPasswordControl) {
      newErrors.newPassword = true;
      newErrors.newPasswordControl = true;
      alert('Hesla se neshodují');
    }
    setErrors(newErrors);
    if (!newErrors.email && !newErrors.newPassword && !newErrors.newPasswordControl && !newErrors.code) {
      try {
        const res = await fetch('https://tzbpcbmxwbsixrtorijk.functions.supabase.co/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: API_KEY,
          },
          body: JSON.stringify({ email, code, newPassword }),
        });
        const data = await res.json();
        if (data.success) Alert.alert('Hotovo', 'Heslo bylo změněno');
        else Alert.alert('Chyba', data.error || 'Neplatný kód');
      } catch (err) {
        console.error(err)
        alert('Chyba připojení')
      }
    };
  }


  return (<>
    <Stack.Screen
      options={{
        title: "Reset hesla", // text v headeru
      }}
    />
    <ThemedSafeView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ width: "100%" }}
        contentContainerStyle={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 32,
        }}
      >
        <ThemedView style={styles.box}>
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
            onPress={handleForgot} // volání FastAPI
          >
            Poslat kod pro resetování hesla
          </Button>

          <TextInput
            label="Resetovací kód"
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
            onPress={handleReset} // volání FastAPI
          >
            Změnit heslo
          </Button>
        </ThemedView>
      </ScrollView>
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
