import { fetchColors } from '@/services/users/get_colors';
import { updateColor } from '@/services/users/update_color';
import { updateUser } from '@/services/users/update_user';
import { ThemedSafeView } from '@/components/ThemedSafeView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/useAuth';
import { loadNotificationSettings, saveNotificationSettings, type NotificationSettings } from '@/lib/notificationSettings';
import { registerAndSavePushToken } from '@/lib/push-notifications';
import {
    clearWebPushPromptDismiss,
    getBrowserNotificationPermission,
} from '@/lib/webPushPermission';
import { supabase } from '@/lib/supabaseClient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Appearance, TouchableOpacity, View, TextInput, Platform } from 'react-native';
import { Button, Switch } from 'react-native-paper';
import ColorPicker from '../../components/ColorPicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Color {
    id: number;
    name: string;
    background_color: string;
    text_color: string;
    user_id: number | null;
}

type EditableField = 'username' | 'jmeno' | 'prijmeni' | 'color' | 'email' | null;

export default function SettingsScreen() {
    const { user, logout, refreshUser } = useAuth()
    const [colors, setColors] = useState<Color[]>([]);
    const colorObj = colors.find(c => c.user_id === user?.id) ?? null;
    const [selectedColor, setSelectedColor] = useState<Color | null>(colorObj);
    const [errors, setErrors] = useState<{ color: boolean }>({ color: false });
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
    const [browserPushStatus, setBrowserPushStatus] = useState<string>('—');

    // Edit state
    const [editingField, setEditingField] = useState<EditableField>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text')
    const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text')

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
            const data = await fetchColors()
            setColors(data)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        let mounted = true;
        loadColors();
        const channel = supabase.channel('realtime:public:colors');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'colors' }, () => {
            if (mounted) loadColors();
        });
        channel.subscribe();
        return () => { mounted = false; supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (!editingField || editingField !== 'color') {
            setSelectedColor(colorObj);
        }
    }, [colorObj, editingField]);

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
        // Synchronně z kliknutí
        const permissionPromise =
            Notification.permission === 'granted'
                ? Promise.resolve('granted' as NotificationPermission)
                : Notification.requestPermission();

        void (async () => {
            const permission = await permissionPromise;
            refreshBrowserPushStatus();
            if (permission === 'granted' && userId) {
                await registerAndSavePushToken(String(userId), { skipPermissionRequest: true });
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
    const handleSaveNotificationToggle = async (field: 'notify_friend_requests' | 'notify_chat_messages' | 'notify_global_chat', value: boolean) => {
        if (!user) return;
        try {
            await updateUser(user.id, { [field]: value });
            if (refreshUser) await refreshUser();
            // Sync lokální nastavení (foreground bannery)
            if (notificationSettings) {
                const updated = { ...notificationSettings };
                if (field === 'notify_global_chat') updated.eventChanges = value;
                if (field === 'notify_chat_messages') updated.chatMessages = value;
                setNotificationSettings(updated);
                await saveNotificationSettings(updated);
            }
        } catch (e) {
            console.error(e);
            alert("Uložení selhalo.");
        }
    };

    const updateNotificationSetting = async (key: keyof NotificationSettings, value: boolean) => {
        if (!notificationSettings || !user) return;
        const updated = { ...notificationSettings, [key]: value };
        setNotificationSettings(updated);
        await saveNotificationSettings(updated);
        // Master vypínač → vypni i DB přepínače (FCM)
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
            if (editingField !== 'color') {
                await updateUser(user.id, { [editingField]: editValue });
                if (refreshUser) await refreshUser();
            } else if (selectedColor) {
                await updateColor(selectedColor.id, user.id);
            }
            setEditingField(null);
        } catch (e) {
            console.error(e);
            alert("Uložení selhalo.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            console.error(e);
        }
    };

    const startEditing = (field: EditableField, currentValue: string) => {
        setEditingField(field);
        setEditValue(currentValue || '');
    };

    const renderEditableRow = (label: string, field: EditableField, value?: string, canEdit: boolean = true) => {
        const isEditing = field !== null && editingField === field;

        if (isEditing && field !== 'color') {
            return (
                <ThemedView style={styles.editRow}>
                    <ThemedText style={[styles.label, { width: 80 }]}>{label}:</ThemedText>
                    <TextInput 
                        style={[styles.input, { color: buttonColor, borderColor: buttonColor }]}
                        value={editValue}
                        onChangeText={setEditValue}
                        autoFocus
                    />
                    <View style={styles.editActions}>
                        <TouchableOpacity onPress={() => setEditingField(null)} style={styles.iconBtn}>
                            <MaterialCommunityIcons name="close" size={20} color="red" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSaveProfileField} style={styles.iconBtn} disabled={saving}>
                            <MaterialCommunityIcons name="check" size={20} color="green" />
                        </TouchableOpacity>
                    </View>
                </ThemedView>
            );
        }

        return (
            <ThemedView style={styles.fieldRow}>
                <ThemedText style={styles.label}>
                    {label}: {value || ''}
                </ThemedText>
                {canEdit && (
                    <TouchableOpacity onPress={() => startEditing(field, value || '')} style={styles.pencil}>
                        <MaterialCommunityIcons name="pencil" size={16} color={buttonColor} />
                    </TouchableOpacity>
                )}
            </ThemedView>
        );
    };

    return (
        <ThemedSafeView style={styles.container}>
            <ThemedText type="title" style={styles.header}>Nastavení</ThemedText>

            <KeyboardScreen scroll contentContainerStyle={styles.scrollContent}>
                {/* Profil */}
                <ThemedView style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Profil</ThemedText>

                    {renderEditableRow('Přezdívka', 'username', user?.username)}
                    {renderEditableRow('Jméno', 'jmeno', user?.jmeno)}
                    {renderEditableRow('Příjmení', 'prijmeni', user?.prijmeni)}
                    {renderEditableRow('E-mail', 'email', user?.email)}

                    {/* Barva */}
                    {editingField === 'color' ? (
                        <ThemedView style={styles.field}>
                            <ColorPicker
                                colors={colors}
                                selectedColor={selectedColor}
                                setSelectedColor={setSelectedColor}
                                error={errors.color}
                                setError={(val) => setErrors((e) => ({ ...e, color: val }))}
                            />
                            <View style={[styles.editActions, { marginTop: 12 }]}>
                                <Button mode="outlined" onPress={() => setEditingField(null)} style={{flex: 1, marginRight: 8}}>
                                    Zrušit
                                </Button>
                                <Button mode="contained" onPress={handleSaveProfileField} loading={saving} style={{flex: 1}}>
                                    Uložit
                                </Button>
                            </View>
                        </ThemedView>
                    ) : (
                        renderEditableRow('Tvoje barva', 'color', colorObj?.name || 'Nevybrána')
                    )}

                </ThemedView>

                {/* Notifikace */}
                {notificationSettings && (
                    <ThemedView style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Notifikace</ThemedText>

                        <ThemedView style={styles.settingRow}>
                            <ThemedText>Upozornění zapnuta</ThemedText>
                            <Switch
                                value={notificationSettings.enabled}
                                onValueChange={(v) => updateNotificationSetting('enabled', v)}
                                color={buttonColor}
                            />
                        </ThemedView>

                        <ThemedView style={styles.settingRow}>
                            <ThemedText>Žádosti o přátelství</ThemedText>
                            <Switch
                                value={user?.notify_friend_requests ?? true}
                                onValueChange={(v) => handleSaveNotificationToggle('notify_friend_requests', v)}
                                disabled={!notificationSettings.enabled}
                                color={buttonColor}
                            />
                        </ThemedView>

                        <ThemedView style={styles.settingRow}>
                            <ThemedText>Zprávy v mých událostech</ThemedText>
                            <Switch
                                value={user?.notify_chat_messages ?? true}
                                onValueChange={(v) => handleSaveNotificationToggle('notify_chat_messages', v)}
                                disabled={!notificationSettings.enabled}
                                color={buttonColor}
                            />
                        </ThemedView>

                        <ThemedView style={styles.settingRow}>
                            <ThemedText>Oznámení o událostech</ThemedText>
                            <Switch
                                value={user?.notify_global_chat ?? true}
                                onValueChange={(v) => handleSaveNotificationToggle('notify_global_chat', v)}
                                disabled={!notificationSettings.enabled}
                                color={buttonColor}
                            />
                        </ThemedView>

                        {Platform.OS === 'web' && (
                            <ThemedView style={{ marginTop: 12, gap: 8 }}>
                                <ThemedText style={{ opacity: 0.7 }}>
                                    Prohlížeč: {browserPushStatus}
                                </ThemedText>
                                <Button
                                    mode="outlined"
                                    onPress={handleEnableBrowserPush}
                                    textColor={buttonColor}
                                    style={{ borderColor: buttonColor }}
                                >
                                    Povolit oznámení prohlížeče
                                </Button>
                            </ThemedView>
                        )}
                    </ThemedView>
                )}

                {/* Motiv aplikace */}
                <ThemedView style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Motiv aplikace</ThemedText>

                    <ThemedView style={styles.settingRow}>
                        <ThemedText>Světlý</ThemedText>
                        <Switch
                            value={theme === 'light'}
                            onValueChange={(v) => {
                                setTheme(v ? 'light' : 'system');
                                Appearance.setColorScheme(v ? 'light' : null);
                            }}
                            color={buttonColor}
                        />
                    </ThemedView>

                    <ThemedView style={styles.settingRow}>
                        <ThemedText>Tmavý</ThemedText>
                        <Switch
                            value={theme === 'dark'}
                            onValueChange={(v) => {
                                setTheme(v ? 'dark' : 'system');
                                Appearance.setColorScheme(v ? 'dark' : null);
                            }}
                            color={buttonColor}
                        />
                    </ThemedView>

                    <ThemedView style={styles.settingRow}>
                        <ThemedText>Podle systému</ThemedText>
                        <Switch
                            value={theme === 'system'}
                            onValueChange={(v) => {
                                setTheme(v ? 'system' : 'light');
                                Appearance.setColorScheme(null);
                            }}
                            color={buttonColor}
                        />
                    </ThemedView>
                </ThemedView>

                {/* Odhlásit se */}
                <ThemedView style={styles.section}>
                    <Button
                        mode="contained"
                        style={styles.logoutButton}
                        labelStyle={{ color: buttonTextColor }}
                        buttonColor="red"
                        onPress={handleLogout}
                    >
                        Odhlásit se
                    </Button>
                </ThemedView>
            </KeyboardScreen>
        </ThemedSafeView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    header: {
        marginBottom: 16,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    sectionTitle: {
        marginBottom: 12,
    },
    field: {
        marginBottom: 12,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginHorizontal: 8,
    },
    editActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        padding: 4,
        marginLeft: 4,
    },
    label: {
        // marginBottom: 4,
    },
    pencil: {
        marginLeft: 8,
        padding: 4,
    },
    button: {
        borderRadius: 6,
        width: '100%',
        marginTop: 8,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    logoutButton: {
        borderRadius: 6,
        width: '100%',
    },
});
