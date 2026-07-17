import React from 'react';
import { Linking, Platform, StyleSheet, Text, type TextStyle, type StyleProp } from 'react-native';

const YOUTUBE_IOS_PUSH_GUIDE = 'https://www.youtube.com/watch?v=D4ZzDQRGmRk';

type Props = {
  href?: string;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Na webu skutečný <a href> (funguje i přes popup blocker).
 * Na mobilu Linking.openURL.
 */
export function ExternalLink({
  href = YOUTUBE_IOS_PUSH_GUIDE,
  children,
  style,
}: Props) {
  if (Platform.OS === 'web') {
    return (
      // eslint-disable-next-line react/no-unknown-property -- DOM <a> na RN Web
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#FF00AA',
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'underline',
          cursor: 'pointer',
          display: 'inline-block',
          marginTop: 8,
          padding: '8px 0',
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <Text
      accessibilityRole="link"
      style={[styles.link, style]}
      onPress={() => {
        void Linking.openURL(href);
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: '#FF00AA',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 8,
    paddingVertical: 8,
  },
});
