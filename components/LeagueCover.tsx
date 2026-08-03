import { Brand } from '@/constants/brand';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  uri?: string | null;
  size?: number;
  mine?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Cover tabulky — vlastní obrázek, jinak trofej. */
export function LeagueCover({ uri, size = 64, mine = false, style }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
          style as any,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Brand.primarySoft,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={mine ? 'trophy' : 'trophy-outline'}
        size={Math.round(size * 0.5)}
        color={Brand.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Brand.primarySoft,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
