import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { registerAndSavePushToken } from '@/lib/push-notifications';
import { loadStorage, saveStorage } from '@/lib/storage';

const DISMISS_KEY = 'webPushPromptDismissed';

/**
 * Prohlížeče vyžadují klik uživatele pro Notification.requestPermission().
 * Bez banneru se dialog často vůbec neukáže.
 */
export function WebNotificationPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !user?.id) {
      setVisible(false);
      return;
    }
    if (typeof Notification === 'undefined') {
      setVisible(false);
      return;
    }

    let cancelled = false;
    (async () => {
      if (Notification.permission === 'granted') {
        const userId = (user as any).auth_user_id || user.id;
        void registerAndSavePushToken(String(userId));
        if (!cancelled) setVisible(false);
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setVisible(false);
        return;
      }
      const dismissed = await loadStorage(DISMISS_KEY);
      if (!cancelled) setVisible(dismissed !== 'true');
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (Platform.OS !== 'web' || !visible) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const userId = (user as any)?.auth_user_id || user?.id;
      if (!userId) return;
      const token = await registerAndSavePushToken(String(userId));
      if (token || Notification.permission !== 'default') {
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    await saveStorage(DISMISS_KEY, 'true');
    setVisible(false);
  };

  return (
    <View style={styles.banner} pointerEvents="box-none">
      <View style={styles.card}>
        <ThemedText style={styles.title}>Zapnout oznámení?</ThemedText>
        <ThemedText style={styles.body}>
          Dostaneš upozornění na pozvánky, chat a změny událostí i když máš kartu na pozadí.
        </ThemedText>
        <View style={styles.row}>
          <Pressable onPress={dismiss} style={styles.secondary} disabled={busy}>
            <ThemedText style={styles.secondaryText}>Teď ne</ThemedText>
          </Pressable>
          <Pressable onPress={enable} style={styles.primary} disabled={busy}>
            <ThemedText style={styles.primaryText}>
              {busy ? 'Čekej…' : 'Povolit'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  body: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  secondary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  secondaryText: {
    color: '#aaa',
    fontSize: 14,
  },
  primary: {
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
