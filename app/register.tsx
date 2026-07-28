import { Brand, BrandSurfaces } from '@/constants/brand';
import { fetchColors } from '@/services/users/get_colors';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import dayjs from 'dayjs';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Loading from './loading';

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: string | null;
}

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordControl, setPasswordControl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastname, setLastname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [username, setUsername] = useState('');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordControl, setShowPasswordControl] = useState(false);
  const [errors, setErrors] = useState({
    email: false,
    password: false,
    passwordControl: false,
    firstName: false,
    lastname: false,
    birthDate: false,
    username: false,
    color: false,
  });

  const router = useRouter();
  const theme = useTheme();
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [colors, setColors] = useState<Color[]>([]);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { loading } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary;
  const onButton = scheme === 'dark' ? '#0B1220' : Brand.onPrimary;
  const fieldIcon = (err: boolean) =>
    err ? theme.colors.error : surfaces.textSecondary;

  const availableColors = useMemo(
    () => colors.filter((c) => !c.user_id),
    [colors]
  );

  const loadColors = async () => {
    try {
      const data = await fetchColors();
      setColors(data);
    } catch (err) {
      console.error('Error loading colors:', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadColors();

    const channel = supabase.channel('realtime:public:colors');
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'colors' },
      () => {
        if (mounted) loadColors();
      }
    );
    channel.subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!availableColors.length) return;
    const stillFree =
      selectedColor &&
      availableColors.some((c) => c.id === selectedColor.id);
    if (!stillFree) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors]);

  const formatDate = (d: string | Date) => dayjs(d).format('DD. MM. YYYY');

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
    };

    if (
      !newErrors.password &&
      !newErrors.passwordControl &&
      password !== passwordControl
    ) {
      newErrors.password = true;
      newErrors.passwordControl = true;
      alert('Hesla se neshodují');
    }

    setErrors(newErrors);
    if (
      submitting ||
      Object.values(newErrors).some(Boolean) ||
      !selectedColor
    ) {
      return;
    }

    setSubmitting(true);
    try {
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
        await loadColors();
        return;
      }

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
        if (
          error.message?.includes('email') ||
          error.message?.includes('confirmation')
        ) {
          console.warn('Email confirmation failed, continuing registration');
        } else {
          throw error;
        }
      }

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

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        alert(
          'Registrace proběhla, ale přihlášení selhalo. Zkus se přihlásit manuálně.'
        );
        router.replace('/(login)');
        return;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      alert(err.message || 'Registrace selhala!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

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
          disabled={submitting}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={surfaces.text}
          />
        </Pressable>

        <KeyboardScreen
          scroll
          gap={12}
          style={{ width: '100%', flex: 1 }}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <ThemedText style={[styles.title, { color: surfaces.text }]}>
              Registrovat se
            </ThemedText>
            <ThemedText
              style={[styles.subtitle, { color: surfaces.textSecondary }]}
            >
              Vytvořte si účet a začněte plánovat.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextInput
              label="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.email ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
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
                      color={fieldIcon(errors.email)}
                    />
                  )}
                />
              }
            />

            <TextInput
              label="Heslo"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password)
                  setErrors((e) => ({ ...e, password: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.password ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              secureTextEntry={!showPassword}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
              error={errors.password}
              autoComplete="new-password"
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color={fieldIcon(errors.password)}
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
              label="Potvrďte heslo"
              value={passwordControl}
              onChangeText={(text) => {
                setPasswordControl(text);
                if (errors.passwordControl)
                  setErrors((e) => ({ ...e, passwordControl: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.passwordControl ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              secureTextEntry={!showPasswordControl}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
              error={errors.passwordControl}
              autoComplete="new-password"
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color={fieldIcon(errors.passwordControl)}
                    />
                  )}
                />
              }
              right={
                <TextInput.Icon
                  icon={showPasswordControl ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPasswordControl((v) => !v)}
                  forceTextInputFocus={false}
                />
              }
            />

            <TextInput
              label="Jméno"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                if (errors.firstName)
                  setErrors((e) => ({ ...e, firstName: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.firstName ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
              error={errors.firstName}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={fieldIcon(errors.firstName)}
                    />
                  )}
                />
              }
            />

            <TextInput
              label="Příjmení"
              value={lastname}
              onChangeText={(text) => {
                setLastname(text);
                if (errors.lastname)
                  setErrors((e) => ({ ...e, lastname: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.lastname ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
              error={errors.lastname}
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={fieldIcon(errors.lastname)}
                    />
                  )}
                />
              }
            />

            <TextInput
              label="Uživatelské jméno"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (errors.username)
                  setErrors((e) => ({ ...e, username: false }));
              }}
              mode="outlined"
              activeOutlineColor={accent}
              outlineColor={
                errors.username ? theme.colors.error : surfaces.border
              }
              textColor={surfaces.text}
              style={[
                styles.input,
                { backgroundColor: surfaces.surfaceElevated },
              ]}
              error={errors.username}
              autoCapitalize="none"
              left={
                <TextInput.Icon
                  icon={() => (
                    <MaterialCommunityIcons
                      name="at"
                      size={20}
                      color={fieldIcon(errors.username)}
                    />
                  )}
                />
              }
            />

            <Pressable onPress={() => setDateModalVisible(true)}>
              <TextInput
                value={birthDate ? formatDate(birthDate) : undefined}
                mode="outlined"
                label="Datum narození"
                editable={false}
                activeOutlineColor={accent}
                outlineColor={
                  errors.birthDate ? theme.colors.error : surfaces.border
                }
                textColor={surfaces.text}
                error={errors.birthDate}
                onPressIn={() => setDateModalVisible(true)}
                left={
                  <TextInput.Icon
                    icon={() => (
                      <MaterialCommunityIcons
                        name="calendar-outline"
                        size={20}
                        color={fieldIcon(errors.birthDate)}
                      />
                    )}
                  />
                }
                right={
                  <TextInput.Icon
                    icon="chevron-down"
                    forceTextInputFocus={false}
                    onPress={() => setDateModalVisible(true)}
                  />
                }
                style={[
                  styles.input,
                  { backgroundColor: surfaces.surfaceElevated },
                ]}
              />
            </Pressable>

            <DatePickerModal
              startWeekOnMonday
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

            <View style={styles.colorSection}>
              <ThemedText
                style={[
                  styles.colorLabel,
                  {
                    color: errors.color
                      ? theme.colors.error
                      : surfaces.textSecondary,
                  },
                ]}
              >
                Barva kalendáře
              </ThemedText>

              {availableColors.length === 0 ? (
                <ThemedText
                  style={{ color: surfaces.textSecondary, fontSize: 13 }}
                >
                  Momentálně nejsou volné žádné barvy.
                </ThemedText>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.swatchRow}
                >
                  {availableColors.map((color) => {
                    const selected = selectedColor?.id === color.id;
                    return (
                      <Pressable
                        key={color.id}
                        onPress={() => {
                          setSelectedColor(color);
                          setErrors((e) => ({ ...e, color: false }));
                        }}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: color.background_color,
                            borderColor: selected
                              ? surfaces.text
                              : 'transparent',
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={color.name}
                      >
                        {selected && (
                          <MaterialCommunityIcons
                            name="check"
                            size={18}
                            color={color.text_color || '#fff'}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Button
              mode="contained"
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={[styles.buttonLabel, { color: onButton }]}
              buttonColor={accent}
              onPress={handleRegister}
              loading={submitting}
              disabled={submitting}
            >
              Registrovat se
            </Button>
          </View>
        </KeyboardScreen>
      </ThemedSafeView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  hero: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    gap: 12,
  },
  input: {
    width: '100%',
  },
  colorSection: {
    marginTop: 8,
    gap: 12,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  button: {
    borderRadius: 14,
    width: '100%',
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
