import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { registerAndSavePushToken } from '@/lib/push-notifications';
import {
  clearWebPushPromptDismiss,
  dismissWebPushPrompt,
  isWebPushPromptDismissed,
} from '@/lib/webPushPermission';

type Mode = 'ask' | 'denied' | 'waiting';

/**
 * Chrome u nových webů často ukáže jen bublinu u URL.
 * Po „Teď ne“ / denied se banner schová — znovu: Nastavení → Povolit oznámení prohlížeče.
 */
export function WebNotificationPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('ask');
  const [hint, setHint] = useState<string | null>(null);

  const refreshVisibility = async () => {
    if (Platform.OS !== 'web' || !user?.id || typeof Notification === 'undefined') {
      setVisible(false);
      return;
    }

    if (Notification.permission === 'granted') {
      setVisible(false);
      const userId = (user as any).auth_user_id || user.id;
      void registerAndSavePushToken(String(userId), { skipPermissionRequest: true });
      return;
    }

    const dismissed = await isWebPushPromptDismissed();

    if (Notification.permission === 'denied') {
      // Ukaž návod, pokud to uživatel neschoval
      if (!dismissed) {
        setMode('denied');
        setVisible(true);
      } else {
        setVisible(false);
      }
      return;
    }

    // default — ptát se, pokud neschováno
    if (!dismissed) {
      setMode('ask');
      setVisible(true);
    } else {
      setVisible(false);
    }
  };

  useEffect(() => {
    void refreshVisibility();
  }, [user?.id]);

  // Po návratu na tab zkontroluj, jestli uživatel mezitím povolil v Chrome
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onFocus = () => void refreshVisibility();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user?.id]);

  if (Platform.OS !== 'web' || !visible) return null;

  const finishGranted = async (userId: string) => {
    const token = await registerAndSavePushToken(String(userId), {
      skipPermissionRequest: true,
    });
    setVisible(false);
    await dismissWebPushPrompt();
    if (!token) {
      window.alert(
        'Oznámení jsou povolená, ale registrace push tokenu se nepovedla. Zkus obnovit stránku.'
      );
    }
  };

  const enable = () => {
    if (typeof Notification === 'undefined') return;

    const userId = (user as any)?.auth_user_id || user?.id;
    if (!userId) {
      window.alert('Nejsi přihlášen.');
      return;
    }

    if (Notification.permission === 'denied') {
      window.alert(
        'Chrome má oznámení pro tento web zakázaná.\n\n' +
          '1) Klikni na zámek / tunel vedle URL\n' +
          '2) Oznámení → Povolit\n' +
          '3) Obnov stránku\n\n' +
          'Nebo: Nastavení webu → Oznámení.'
      );
      return;
    }

    // Synchronně v click handleru
    const permissionPromise: Promise<NotificationPermission> =
      Notification.permission === 'granted'
        ? Promise.resolve('granted')
        : Notification.requestPermission();

    setBusy(true);
    setMode('waiting');
    setHint(
      'Podívej se nahoru k adresnímu řádku — Chrome často ukáže „Povolit“ vedle URL (zvoneček / bublina).'
    );

    void (async () => {
      try {
        const permission = await new Promise<NotificationPermission>((resolve) => {
          let done = false;
          const finish = (p: NotificationPermission) => {
            if (done) return;
            done = true;
            clearInterval(iv);
            clearTimeout(to);
            resolve(p);
          };

          permissionPromise.then(finish).catch(() => finish(Notification.permission));

          const iv = setInterval(() => {
            if (Notification.permission !== 'default') {
              finish(Notification.permission);
            }
          }, 250);

          // Po 45s přestaň viset — nech banner s nápovědou
          const to = setTimeout(() => finish(Notification.permission), 45000);
        });

        if (permission === 'granted') {
          await finishGranted(String(userId));
          return;
        }

        if (permission === 'denied') {
          setMode('denied');
          setHint(null);
          return;
        }

        // pořád default — Chrome UI zmizelo bez rozhodnutí
        setMode('ask');
        setHint(
          'Chrome dialog nezobrazil. Zkus znovu Povolit, nebo klikni na zámek u URL → Oznámení.'
        );
      } catch (e: any) {
        console.error(e);
        window.alert(e?.message || 'Nepodařilo se nastavit oznámení.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const dismiss = async () => {
    await dismissWebPushPrompt();
    setVisible(false);
    setHint(null);
    setBusy(false);
  };

  const title =
    mode === 'denied'
      ? 'Oznámení jsou v Chrome zakázaná'
      : mode === 'waiting'
        ? 'Čekám na Chrome…'
        : 'Zapnout oznámení?';

  const body =
    hint ||
    (mode === 'denied'
      ? 'Klikni na zámek vedle URL → Oznámení → Povolit, pak obnov stránku. Znovu otevřít lze i v Nastavení.'
      : 'Dostaneš upozornění na pozvánky, chat a změny událostí i když máš kartu na pozadí.');

  return (
    <View style={styles.banner} pointerEvents="box-none">
      <View style={styles.card}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.body}>{body}</ThemedText>
        <View style={styles.row}>
          <Pressable onPress={dismiss} style={styles.secondary}>
            <ThemedText style={styles.secondaryText}>Teď ne</ThemedText>
          </Pressable>
          {mode !== 'denied' && (
            <Pressable onPress={enable} style={styles.primary} disabled={busy}>
              <ThemedText style={styles.primaryText}>
                {busy ? 'Čekám na Chrome…' : 'Povolit'}
              </ThemedText>
            </Pressable>
          )}
          {mode === 'denied' && (
            <Pressable
              onPress={() => {
                void clearWebPushPromptDismiss();
                enable();
              }}
              style={styles.primary}
            >
              <ThemedText style={styles.primaryText}>Jak povolit</ThemedText>
            </Pressable>
          )}
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
