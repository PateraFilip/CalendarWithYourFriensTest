import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import { View, ViewProps } from 'react-native';

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type = 'background', // 👈 přidáme typ
  ...otherProps
}: ViewProps & { lightColor?: string; darkColor?: string; type?: 'background' | 'surface' }) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, type)

  return <View style={[{ backgroundColor }, style]} {...otherProps} />
}
