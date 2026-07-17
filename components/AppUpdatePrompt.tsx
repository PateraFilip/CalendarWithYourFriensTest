import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  checkForAppUpdate,
  type VersionCheckResult,
  WEB_APP_URL,
} from '@/lib/appVersion';

/** Na mobilu: výzva ke stažení nové verze (verze z /version.json na webu). */
export function AppUpdatePrompt() {
  const [info, setInfo] = useState<VersionCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const buttonColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const buttonTextColor = useThemeColor({ light: '#fff', dark: '#000' }, 'text');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void (async () => {
      const result = await checkForAppUpdate();
      if (!cancelled && result) setInfo(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === 'web' || !info || (dismissed && !info.forceUpdate)) {
    return null;
  }

  const openWeb = () => {
    void Linking.openURL(info.updateUrl || WEB_APP_URL);
  };

  const openApk = () => {
    void Linking.openURL(info.apkUrl);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {
      if (!info.forceUpdate) setDismissed(true);
    }}>
      <View style={styles.overlay}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.title}>
            Nová verze aplikace
          </ThemedText>
          <ThemedText style={styles.body}>{info.message}</ThemedText>
          <ThemedText style={styles.meta}>
            Tvoje verze: {info.currentVersion}
            {'\n'}
            Nejnovější: {info.latestVersion}
          </ThemedText>

          <Button
            mode="contained"
            onPress={openWeb}
            buttonColor={buttonColor}
            textColor={buttonTextColor}
            style={styles.btn}
          >
            Otevřít web (stažení)
          </Button>
          <Button
            mode="outlined"
            onPress={openApk}
            textColor={buttonColor}
            style={[styles.btn, { borderColor: buttonColor }]}
          >
            Stáhnout APK přímo
          </Button>

          {!info.forceUpdate && (
            <Button
              mode="text"
              onPress={() => setDismissed(true)}
              textColor={buttonColor}
              style={styles.btn}
            >
              Později
            </Button>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  body: {
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 20,
  },
  meta: {
    textAlign: 'center',
    opacity: 0.65,
    fontSize: 13,
    marginVertical: 6,
  },
  btn: {
    marginTop: 4,
    borderRadius: 8,
  },
});
