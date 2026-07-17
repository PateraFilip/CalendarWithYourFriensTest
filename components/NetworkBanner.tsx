import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

/**
 * Offline banner — na webu přes navigator.onLine, na native bez window API.
 */
export function NetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // Native: bez @react-native-community/netinfo necháme banner vypnutý
      return;
    }

    const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
    if (!win || typeof win.addEventListener !== 'function') return;

    const update = () => {
      const nav = win.navigator;
      setOffline(!!nav && 'onLine' in nav ? !nav.onLine : false);
    };

    update();
    win.addEventListener('online', update);
    win.addEventListener('offline', update);
    return () => {
      win.removeEventListener('online', update);
      win.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLabel="Jste offline">
      <ThemedText style={styles.text}>Jste offline — některé změny se neuloží</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
