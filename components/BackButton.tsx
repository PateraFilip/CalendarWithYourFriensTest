import { Brand } from '@/constants/brand';
import { safeGoBack } from '@/lib/navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  /** Kam jít, když není historie (typicky po refreshi na webu). */
  fallbackHref?: Href;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Šipka zpět — funguje i na webu po refreshi. */
export function BackButton({
  fallbackHref = '/(tabs)',
  color = Brand.primary,
  size = 24,
  style,
  accessibilityLabel = 'Zpět',
}: Props) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => safeGoBack(router, fallbackHref)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        Platform.OS === 'web' && styles.btnWeb,
        pressed && styles.pressed,
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="arrow-left"
        size={size}
        color={color}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWeb: {
    // @ts-expect-error web-only
    cursor: 'pointer',
  },
  pressed: { opacity: 0.65 },
});
