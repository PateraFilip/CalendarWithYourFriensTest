import { ExternalLink } from '@/components/ExternalLink';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { Brand, BrandSurfaces } from '@/constants/brand';
import { useAuth } from '@/hooks/useAuth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppData } from '@/contexts/AppDataContext';
import { DEFAULT_APK_URL } from '@/lib/appVersion';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from '@/lib/notificationSettings';
import { registerAndSavePushToken } from '@/lib/push-notifications';
import {
  clearWebPushPromptDismiss,
  getBrowserNotificationPermission,
} from '@/lib/webPushPermission';
import { supabase } from '@/lib/supabaseClient';
import { fetchColors } from '@/services/users/get_colors';
import { updateColor } from '@/services/users/update_color';
import { updateUser } from '@/services/users/update_user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Appearance,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Switch, TextInput } from 'react-native-paper';

interface Color {
  id: number;
  name: string;
  background_color: string;
  text_color: string;
  user_id: number | string | null;
}

type EditableField = 'username' | 'jmeno' | 'prijmeni' | 'email' | null;
type ThemeMode = 'light' | 'dark' | 'system';

function initials(user: {
  jmeno?: string | null;
  prijmeni?: string | null;
  username?: string | null;
}): string {
  const a = (user.jmeno || '').trim().charAt(0);
  const b = (user.prijmeni || '').trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  return (user.username || '?').slice(0, 2).toUpperCase();
}

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { refreshColors } = useAppData();
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const accent = scheme === 'dark' ? Brand.primaryMuted : Brand.primary;
  const onAccent = scheme === 'dark' ? '#0B1220' : Brand.onPrimary;

  const [colors, setColors] = useState<Color[]>([]);
  const colorObj = colors.find((c) => String(c.user_id) === String(user?.id)) ?? null;
  const [selectedColor, setSelectedColor] = useState<Color | null>(colorObj);
  const [savingColor, setSavingColor] = useState(false);

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [browserPushStatus, setBrowserPushStatus] = useState('—');

  const [editingField, setEditingField] = useState<EditableField>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const selectableColors = useMemo(
    () =>
      colors.filter(
        (c) => !c.user_id || String(c.user_id) === String(user?.id)
      ),
    [colors, user?.id]
  );

  const refreshBrowserPushStatus = () => {
    if (Platform.OS !== 'web') return;
    const p = getBrowserNotificationPermission();
    if (p === 'granted') setBrowserPushStatus('Povoleno');
    else if (p === 'denied') setBrowserPushStatus('Zakázáno v prohlížeči');
    else if (p === 'default') setBrowserPushStatus('Zatím nerozhodnuto');
    else setBrowserPushStatus('Nepodporováno');
  };

  const loadColors = async () => {
    try {
      setColors(await fetchColors());
    } catch (err) {
      console.error(err);
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
    setSelectedColor(colorObj);
  }, [colorObj?.id]);

  useEffect(() => {
    loadNotificationSettings().then(setNotificationSettings);
    refreshBrowserPushStatus();
  }, []);

  const handleEnableBrowserPush = () => {
    if (Platform.OS !== 'web' || typeof Notification === 'undefined') return;

    void clearWebPushPromptDismiss();

    if (Notification.permission === 'denied') {
      alert(
        'Chrome má oznámení zakázaná.\n\n' +
          '1) Klikni na zámek vedle URL\n' +
          '2) Oznámení → Povolit\n' +
          '3) Obnov stránku'
      );
      refreshBrowserPushStatus();
      return;
    }

    const userId = (user as any)?.auth_user_id || user?.id;
    const permissionPromise =
      Notification.permission === 'granted'
        ? Promise.resolve('granted' as NotificationPermission)
        : Notification.requestPermission();

    void (async () => {
      const permission = await permissionPromise;
      refreshBrowserPushStatus();
      if (permission === 'granted' && userId) {
        await registerAndSavePushToken(String(userId), {
          skipPermissionRequest: true,
        });
        alert('Oznámení prohlížeče jsou zapnutá.');
      } else if (permission === 'denied') {
        alert('Oznámení zůstala zakázaná. Povol je u zámku v adresním řádku.');
      } else {
        alert(
          'Podívej se nahoru k URL — Chrome může zobrazit bublinu „Povolit“. Po povolení obnov stránku.'
        );
      }
    })();
  };

  const handleSaveNotificationToggle = async (
    field:
      | 'notify_friend_requests'
      | 'notify_chat_messages'
      | 'notify_global_chat',
    value: boolean
  ) => {
    if (!user) return;
    try {
      await updateUser(user.id, { [field]: value });
      if (refreshUser) await refreshUser();
      if (notificationSettings) {
        const updated = { ...notificationSettings };
        if (field === 'notify_global_chat') updated.eventChanges = value;
        if (field === 'notify_chat_messages') updated.chatMessages = value;
        setNotificationSettings(updated);
        await saveNotificationSettings(updated);
      }
    } catch (e) {
      console.error(e);
      alert('Uložení selhalo.');
    }
  };

  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    if (!notificationSettings || !user) return;
    const updated = { ...notificationSettings, [key]: value };
    setNotificationSettings(updated);
    await saveNotificationSettings(updated);
    if (key === 'enabled') {
      try {
        await updateUser(user.id, {
          notify_friend_requests: value,
          notify_chat_messages: value,
          notify_global_chat: value,
        });
        if (refreshUser) await refreshUser();
        const synced = {
          ...updated,
          eventChanges: value,
          chatMessages: value,
          groupEvents: value,
        };
        setNotificationSettings(synced);
        await saveNotificationSettings(synced);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveProfileField = async () => {
    if (!user || !editingField) return;
    setSaving(true);
    try {
      await updateUser(user.id, { [editingField]: editValue.trim() });
      if (refreshUser) await refreshUser();
      setEditingField(null);
    } catch (e) {
      console.error(e);
      alert('Uložení selhalo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectColor = async (color: Color) => {
    if (!user || savingColor) return;
    if (String(color.user_id) === String(user.id)) {
      setSelectedColor(color);
      return;
    }
    setSavingColor(true);
    setSelectedColor(color);
    try {
      await updateColor(color.id, user.id);
      await loadColors();
      await refreshColors();
    } catch (e) {
      console.error(e);
      alert('Změna barvy selhala.');
      setSelectedColor(colorObj);
    } finally {
      setSavingColor(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    if (mode === 'system') Appearance.setColorScheme(null);
    else Appearance.setColorScheme(mode);
  };

  const startEditing = (field: EditableField, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const displayName =
    [user?.jmeno, user?.prijmeni].filter(Boolean).join(' ') ||
    user?.username ||
    'Profil';

  const renderProfileRow = (
    label: string,
    field: EditableField,
    value?: string,
    opts?: { keyboardType?: 'default' | 'email-address'; editable?: boolean }
  ) => {
    const canEdit = opts?.editable !== false;
    const isEditing = field !== null && editingField === field;

    if (isEditing) {
      return (
        <View
          key={String(field)}
          style={[styles.row, styles.rowEditing, { borderBottomColor: surfaces.border }]}
        >
          <TextInput
            mode="outlined"
            label={label}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            keyboardType={opts?.keyboardType ?? 'default'}
            autoCapitalize={field === 'email' || field === 'username' ? 'none' : 'words'}
            style={[styles.editInput, { backgroundColor: surfaces.surfaceElevated }]}
            outlineColor={surfaces.border}
            activeOutlineColor={accent}
            textColor={surfaces.text}
            dense
          />
          <Pressable
            onPress={() => setEditingField(null)}
            hitSlop={8}
            style={styles.iconHit}
          >
            <MaterialCommunityIcons name="close" size={22} color={Brand.danger} />
          </Pressable>
          <Pressable
            onPress={handleSaveProfileField}
            hitSlop={8}
            style={styles.iconHit}
            disabled={saving}
          >
            <MaterialCommunityIcons name="check" size={22} color={Brand.success} />
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        key={String(field)}
        onPress={() => canEdit && startEditing(field, value || '')}
        disabled={!canEdit}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: surfaces.border },
          pressed && canEdit && { opacity: 0.7 },
        ]}
      >
        <View style={styles.rowText}>
          <ThemedText style={[styles.rowLabel, { color: surfaces.textSecondary }]}>
            {label}
          </ThemedText>
          <ThemedText style={[styles.rowValue, { color: surfaces.text }]} numberOfLines={1}>
            {value || '—'}
          </ThemedText>
        </View>
        {canEdit && (
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color={surfaces.textSecondary}
          />
        )}
      </Pressable>
    );
  };

  const renderToggleRow = (
    title: string,
    subtitle: string | undefined,
    value: boolean,
    onChange: (v: boolean) => void,
    disabled?: boolean,
    isLast?: boolean
  ) => (
    <View
      style={[
        styles.toggleRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: surfaces.border },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={styles.toggleText}>
        <ThemedText style={[styles.toggleTitle, { color: surfaces.text }]}>{title}</ThemedText>
        {!!subtitle && (
          <ThemedText style={[styles.toggleSub, { color: surfaces.textSecondary }]}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        color={accent}
      />
    </View>
  );

  return (
    <ThemedSafeView style={[styles.container, { backgroundColor: surfaces.background }]}>
      <KeyboardScreen scroll contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBlock}>
          <ThemedText style={[styles.header, { color: surfaces.text }]}>Nastavení</ThemedText>
        </View>

        {/* Profil hero */}
        <View style={[styles.hero, { backgroundColor: surfaces.surface }]}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: selectedColor?.background_color || Brand.primary,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.avatarText,
                { color: selectedColor?.text_color || Brand.onPrimary },
              ]}
            >
              {initials({
                jmeno: (user as any)?.jmeno,
                prijmeni: (user as any)?.prijmeni,
                username: user?.username,
              })}
            </ThemedText>
          </View>
          <View style={styles.heroText}>
            <ThemedText style={[styles.heroName, { color: surfaces.text }]} numberOfLines={1}>
              {displayName}
            </ThemedText>
            {!!user?.username && (
              <ThemedText style={{ color: surfaces.textSecondary }} numberOfLines={1}>
                @{user.username}
              </ThemedText>
            )}
            {!!user?.email && (
              <ThemedText
                style={[styles.heroEmail, { color: surfaces.textSecondary }]}
                numberOfLines={1}
              >
                {user.email}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Profil */}
        <ThemedText style={[styles.sectionLabel, { color: surfaces.textSecondary }]}>
          Profil
        </ThemedText>
        <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
          {renderProfileRow('Přezdívka', 'username', user?.username)}
          {renderProfileRow('Jméno', 'jmeno', (user as any)?.jmeno)}
          {renderProfileRow('Příjmení', 'prijmeni', (user as any)?.prijmeni)}
          {renderProfileRow('E-mail', 'email', user?.email, {
            keyboardType: 'email-address',
          })}
        </View>

        {/* Barva */}
        <ThemedText style={[styles.sectionLabel, { color: surfaces.textSecondary }]}>
          Barva kalendáře
        </ThemedText>
        <View style={[styles.group, styles.colorGroup, { backgroundColor: surfaces.surface }]}>
          {selectableColors.length === 0 ? (
            <ThemedText style={{ color: surfaces.textSecondary, fontSize: 14 }}>
              Momentálně nejsou volné žádné barvy.
            </ThemedText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatchRow}
            >
              {selectableColors.map((color) => {
                const selected = selectedColor?.id === color.id;
                return (
                  <Pressable
                    key={color.id}
                    onPress={() => handleSelectColor(color)}
                    disabled={savingColor}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: color.background_color,
                        borderColor: selected ? surfaces.text : 'transparent',
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
          {!!selectedColor && (
            <ThemedText style={[styles.colorName, { color: surfaces.textSecondary }]}>
              {selectedColor.name}
            </ThemedText>
          )}
        </View>

        {/* Notifikace */}
        {notificationSettings && (
          <>
            <ThemedText style={[styles.sectionLabel, { color: surfaces.textSecondary }]}>
              Oznámení
            </ThemedText>
            <View style={[styles.group, { backgroundColor: surfaces.surface }]}>
              {renderToggleRow(
                'Upozornění zapnuta',
                'Hlavní vypínač všech push oznámení',
                notificationSettings.enabled,
                (v) => updateNotificationSetting('enabled', v)
              )}
              {renderToggleRow(
                'Žádosti o přátelství',
                undefined,
                user?.notify_friend_requests ?? true,
                (v) => handleSaveNotificationToggle('notify_friend_requests', v),
                !notificationSettings.enabled
              )}
              {renderToggleRow(
                'Zprávy v mých událostech',
                undefined,
                user?.notify_chat_messages ?? true,
                (v) => handleSaveNotificationToggle('notify_chat_messages', v),
                !notificationSettings.enabled
              )}
              {renderToggleRow(
                'Oznámení o událostech',
                undefined,
                user?.notify_global_chat ?? true,
                (v) => handleSaveNotificationToggle('notify_global_chat', v),
                !notificationSettings.enabled,
                true
              )}
            </View>
          </>
        )}

        {Platform.OS === 'web' && (
          <>
            <ThemedText style={[styles.sectionLabel, { color: surfaces.textSecondary }]}>
              Web a Android
            </ThemedText>
            <View style={[styles.group, styles.webGroup, { backgroundColor: surfaces.surface }]}>
              <ThemedText style={[styles.webStatus, { color: surfaces.textSecondary }]}>
                Prohlížeč: {browserPushStatus}
              </ThemedText>
              <Button
                mode="outlined"
                onPress={handleEnableBrowserPush}
                textColor={accent}
                style={[styles.webBtn, { borderColor: accent }]}
              >
                Povolit oznámení prohlížeče
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = DEFAULT_APK_URL;
                  } else {
                    void Linking.openURL(DEFAULT_APK_URL);
                  }
                }}
                buttonColor={accent}
                textColor={onAccent}
                icon="android"
                style={styles.webBtn}
              >
                Stáhnout Android appku (APK)
              </Button>
              <ThemedText style={[styles.hint, { color: surfaces.textSecondary }]}>
                Instalace mimo Google Play: v telefonu povol instalaci z prohlížeče /
                neznámých zdrojů.
              </ThemedText>

              <View style={[styles.iosHintBox, { borderColor: surfaces.border }]}>
                <ThemedText style={[styles.iosHintTitle, { color: surfaces.text }]}>
                  iPhone (Safari)
                </ThemedText>
                <ThemedText style={[styles.hint, { color: surfaces.textSecondary }]}>
                  Na iPhonu oznámení z webu fungují jen u aplikace přidané na Domovskou
                  obrazovku (iOS 16.4+):
                </ThemedText>
                <ThemedText style={[styles.iosStep, { color: surfaces.text }]}>
                  1. Otevři stránku v Safari
                </ThemedText>
                <ThemedText style={[styles.iosStep, { color: surfaces.text }]}>
                  2. Sdílet (□↑) → Přidat na Domovskou obrazovku
                </ThemedText>
                <ThemedText style={[styles.iosStep, { color: surfaces.text }]}>
                  3. Otevři appku ikonou z Domovské obrazovky
                </ThemedText>
                <ThemedText style={[styles.iosStep, { color: surfaces.text }]}>
                  4. Tady klepni na „Povolit oznámení prohlížeče“
                </ThemedText>
                <ExternalLink href="https://www.youtube.com/watch?v=D4ZzDQRGmRk">
                  Video návod (YouTube) ↗
                </ExternalLink>
              </View>
            </View>
          </>
        )}

        {/* Motiv */}
        <ThemedText style={[styles.sectionLabel, { color: surfaces.textSecondary }]}>
          Vzhled
        </ThemedText>
        <View style={[styles.group, styles.themeGroup, { backgroundColor: surfaces.surface }]}>
          {(
            [
              { value: 'light', label: 'Světlý', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Tmavý', icon: 'moon-waning-crescent' },
              { value: 'system', label: 'Systém', icon: 'theme-light-dark' },
            ] as const
          ).map((opt) => {
            const selected = theme === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => applyTheme(opt.value)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: selected ? Brand.primarySoft : surfaces.surfaceElevated,
                    borderColor: selected ? accent : surfaces.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={opt.icon}
                  size={18}
                  color={selected ? accent : surfaces.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.themeChipLabel,
                    { color: selected ? accent : surfaces.text },
                  ]}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Button
          mode="contained"
          style={styles.logoutButton}
          contentStyle={styles.logoutContent}
          labelStyle={styles.logoutLabel}
          buttonColor={Brand.danger}
          textColor={Brand.onPrimary}
          onPress={handleLogout}
          loading={loggingOut}
          disabled={loggingOut}
          icon="logout"
        >
          Odhlásit se
        </Button>
      </KeyboardScreen>
    </ThemedSafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  headerBlock: {
    marginBottom: 16,
    paddingTop: 4,
  },
  header: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 40,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rowEditing: {
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  editInput: {
    flex: 1,
  },
  iconHit: {
    padding: 4,
  },
  colorGroup: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
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
  colorName: {
    fontSize: 13,
    marginLeft: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  webGroup: {
    padding: 16,
    gap: 10,
  },
  webStatus: {
    fontSize: 13,
  },
  webBtn: {
    borderRadius: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  iosHintBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  iosHintTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  iosStep: {
    fontSize: 13,
    lineHeight: 20,
  },
  themeGroup: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  themeChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 28,
    borderRadius: 14,
  },
  logoutContent: {
    paddingVertical: 6,
  },
  logoutLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
});
