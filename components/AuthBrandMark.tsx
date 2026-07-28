import { BrandSurfaces } from '@/constants/brand';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type Props = {
  title?: string;
  tagline?: string;
  compact?: boolean;
};

/** Logo + brand text shared across login / register / reset. */
export function AuthBrandMark({
  title = 'Kalendář',
  tagline = 'Sdílej čas s přáteli',
  compact = false,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const surfaces = BrandSurfaces[scheme];
  const size = compact ? 88 : 112;

  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={[styles.logo, { width: size, height: size, borderRadius: size * 0.22 }]}
        accessibilityLabel="Logo Kalendář"
      />
      <ThemedText style={[styles.title, compact && styles.titleCompact, { color: surfaces.text }]}>
        {title}
      </ThemedText>
      {!!tagline && (
        <ThemedText style={[styles.tagline, { color: surfaces.textSecondary }]}>
          {tagline}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: 36,
    gap: 8,
  },
  heroCompact: {
    marginBottom: 20,
  },
  logo: {
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleCompact: {
    fontSize: 26,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400',
  },
});
