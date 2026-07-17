import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';

/**
 * Jednoduchý offline banner (web: navigator.onLine; native: best-effort fetch ping).
 */
export function NetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => {
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        setOffline(!navigator.onLine);
      }
    };
    update();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }
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
