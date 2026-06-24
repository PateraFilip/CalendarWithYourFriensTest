import { fetchColors } from '@/api/users/get_colors';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ColorPicker from '../components/ColorPicker';
import Loading from './loading';

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: string | null; // Changed to string for UUID
}

export default function ModalScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordControl, setPasswordControl] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastname, setLastname] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [username, setUsername] = useState('')
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [errors, setErrors] = useState<{ email: boolean; password: boolean, passwordControl: boolean, firstName: boolean, lastname: boolean, birthDate: boolean, username: boolean, color: boolean }>(
    {
      email: false,
      password: false,
      passwordControl: false,
      firstName: false,
      lastname: false,
      birthDate: false,
      username: false,
      color: false
    }
  )

  const router = useRouter()
  const theme = useTheme()
  const [date, setDate] = React.useState<Date | undefined>(undefined);

  const [colors, setColors] = useState<Color[]>([]);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);


  const loadColors = async () => {
    try {
      const data = await fetchColors()
      setColors(data)
    } catch (err) {
      console.error('Error loading colors:', err)
    }
  }

  useEffect(() => {
    let mounted = true;

    loadColors(); // načtení na start

    const channel = supabase.channel('realtime:public:colors');

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'colors'
    }, (payload) => {
      console.log('Change in colors:', payload);
      if (mounted) {
        loadColors(); // načti nové eventy
      }
    });

    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);



  const { login, loading } = useAuth()

  const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
  const buttonTextColor = useThemeColor(
    { light: '#fff', dark: '#000' },
    'text'
  )

  const formatDate = (d: string | Date) => dayjs(d).format('DD. MM. YYYY')

  const handleRegister = async () => {
    const newErrors = {
      email: email.trim() === '',
      password: password.trim() === '',
      passwordControl: passwordControl.trim() === '',
      firstName: firstName.trim() === '',
      lastname: lastname.trim() === '',
      birthDate: birthDate.trim() === '',
      username: username.trim() === '',
      color: selectedColor === null,
    }

    if (!newErrors.password && !newErrors.passwordControl && password !== passwordControl) {
      newErrors.password = true;
      newErrors.passwordControl = true;
      alert('Hesla se neshodují');
    }

    setErrors(newErrors);
    if (!newErrors.email && !newErrors.password && !newErrors.passwordControl && !newErrors.firstName && !newErrors.lastname && !newErrors.birthDate && !newErrors.username && !newErrors.color && selectedColor) {
      try {
        // Check if color is available
        const { data: colorData, error: colorError } = await supabase
          .from('colors')
          .select('user_id')
          .eq('id', selectedColor.id)
          .single();

        if (colorError || !colorData) {
          alert('Chyba při kontrole barvy');
          return;
        }

        if (colorData.user_id) {
          alert('Tato barva je již obsazená');
          return;
        }

        // Sign up with Supabase Auth directly
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined,
            data: {
              username,
              firstname: firstName,
              lastname,
              birthDate,
              colorId: selectedColor.id,
            },
          },
        });

        if (error) {
          // If email confirmation fails, continue anyway
          if (error.message?.includes('email') || error.message?.includes('confirmation')) {
            console.warn('Email confirmation failed, continuing registration');
          } else {
            throw error;
          }
        }

        // Assign color to user
        if (data.user) {
          const { error: updateColorError } = await supabase
            .from('colors')
            .update({ user_id: data.user.id })
            .eq('id', selectedColor.id);

          if (updateColorError) {
            alert('Nepodařilo se přiřadit barvu');
            return;
          }
        }

        // Sign in after successful registration
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          alert('Registrace proběhla, ale přihlášení selhalo. Zkus se přihlásit manuálně.');
          router.replace('/(login)');
          return;
        }

        router.replace('/(tabs)')
      } catch (err: any) {
        alert(err.message || 'Registrace selhala!');
      }
    }
  }

  if (loading) return <Loading />
  return (
    <>
      <Stack.Screen
        options={{
          title: "Registrace", // text v headeru
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
          <ThemedView type='surface' style={styles.box}>
            <ThemedText type='title'>
              Registrace
            </ThemedText>

            <TextInput
              label="Jméno"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text)
                if (errors.firstName)
                  setErrors((e) => ({ ...e, firstName: false }))
              }}
              mode="outlined"
              activeOutlineColor={buttonColor}
              style={styles.input}
              error={errors.firstName}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={
                        errors.firstName
                          ? theme.colors.error
                          : buttonColor
                      }
                    />
                  )}
                />
              }
            />

            <TextInput
              label="Příjmení"
              value={lastname}
              onChangeText={(text) => {
                setLastname(text)
                if (errors.lastname)
                  setErrors((e) => ({ ...e, lastname: false }))
              }}
              mode="outlined"
              activeOutlineColor={buttonColor}
              style={styles.input}
              error={errors.lastname}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={
                        errors.lastname
                          ? theme.colors.error
                          : buttonColor
                      }
                    />
                  )}
                />
              }
            />

            <ThemedView style={styles.input}>
              <Pressable onPress={() => setDateModalVisible(true)}>
                <TextInput
                  value={birthDate ? formatDate(birthDate) : undefined}
                  mode="outlined"
                  label={"Datum narození"}
                  editable={false}
                  onChangeText={(text) => {
                    setBirthDate(text)
                    if (errors.birthDate)
                      setErrors((e) => ({ ...e, birthDate: false }))
                  }}
                  error={errors.birthDate}
                  onPressIn={() => setDateModalVisible(true)}
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialCommunityIcons
                          name="calendar-outline"
                          size={20}
                          color={
                            errors.birthDate
                              ? theme.colors.error
                              : buttonColor
                          }
                        />
                      )}
                    />
                  }
                  style={{ backgroundColor: 'transparent' }}
                />
              </Pressable>

              <DatePickerModal
                  startWeekOnMonday={true}
                locale="cs"
                mode="single"
                visible={dateModalVisible}
                onDismiss={() => setDateModalVisible(false)}
                date={date}
                onConfirm={(params) => {
                  if (!params.date) return;
                  setDateModalVisible(false);
                  setDate(params.date);
                  setBirthDate(params.date.toISOString());
                  setErrors((e) => ({ ...e, birthDate: false }));
                }}
              />
            </ThemedView>

            <TextInput
              label="Username"
              value={username}
              onChangeText={(text) => {
                setUsername(text)
                if (errors.username)
                  setErrors((e) => ({ ...e, username: false }))
              }}
              mode="outlined"
              activeOutlineColor={buttonColor}
              style={styles.input}
              error={errors.username}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={
                        errors.username
                          ? theme.colors.error
                          : buttonColor
                      }
                    />
                  )}
                />
              }
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

            <TextInput
              label="Heslo znovu"
              value={passwordControl}
              onChangeText={(text) => {
                setPasswordControl(text)
                if (errors.passwordControl)
                  setErrors((e) => ({ ...e, passwordControl: false }))
              }}
              mode="outlined"
              activeOutlineColor={buttonColor}
              secureTextEntry
              style={styles.input}
              error={errors.passwordControl}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color={
                        errors.passwordControl
                          ? theme.colors.error
                          : buttonColor
                      }
                    />
                  )}
                />
              }
            />

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
              onPress={handleRegister} // volání FastAPI
            >
              Registrovat se
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: '#000', // zvýraznění vybrané barvy
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
})
