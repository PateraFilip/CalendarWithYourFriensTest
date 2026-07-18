import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  ViewStyle,
  Keyboard,
  View,
  Dimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  /** false = jen obal s paddingem (vnitřní layout si řeší scroll sám) */
  scroll?: boolean;
  /** Extra mezera nad klávesnicí (px) */
  gap?: number;
};

function keyboardPadding(height: number, bottomInset: number, gap: number) {
  // Android + softwareKeyboardLayoutMode:resize už zmenší window —
  // pak by plný padding zdvojil posun. Detekujeme podle screen vs window.
  if (Platform.OS === 'android') {
    const screenH = Dimensions.get('screen').height;
    const windowH = Dimensions.get('window').height;
    const shrunk = screenH - windowH;
    if (shrunk > height * 0.45) {
      // Window už je zmenšené o klávesnici → jen malý gap + scroll
      return gap;
    }
    return Math.max(0, height - Math.min(bottomInset, 24)) + gap;
  }
  return Math.max(0, height) + gap;
}

/**
 * Posune obsah o reálnou výšku klávesnice (spolehlivější než KeyboardAvoidingView).
 */
export function KeyboardScreen({
  children,
  style,
  contentContainerStyle,
  scroll = true,
  gap = 20,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      setKeyboardPad(keyboardPadding(h, insets.bottom, gap));
      // Po otevření posuň formulář nahoru (aktivní input)
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 80);
    };
    const onHide = () => setKeyboardPad(0);

    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [gap, insets.bottom]);

  if (Platform.OS === 'web') {
    if (!scroll) return <View style={[{ flex: 1 }, style]}>{children}</View>;
    return (
      <ScrollView
        style={[{ flex: 1 }, style]}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  if (!scroll) {
    return (
      <View style={[styles.flex, style, { paddingBottom: keyboardPad }]}>
        {children}
      </View>
    );
  }

  const basePad =
    typeof contentContainerStyle === 'object' &&
    contentContainerStyle &&
    !Array.isArray(contentContainerStyle) &&
    typeof (contentContainerStyle as ViewStyle).paddingBottom === 'number'
      ? ((contentContainerStyle as ViewStyle).paddingBottom as number)
      : 0;

  return (
    <View style={[styles.flex, style]}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          { flexGrow: 1 },
          contentContainerStyle,
          {
            paddingBottom: basePad + keyboardPad,
          },
          // Po props — při klávesnici necentrovat (login by jinak nechal inputy pod klávesnicí)
          keyboardPad > 0 ? { justifyContent: 'flex-start' as const } : null,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
