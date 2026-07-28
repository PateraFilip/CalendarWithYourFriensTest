import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  enabled?: boolean;
  onSwipePrev: () => void;
  onSwipeNext: () => void;
  style?: ViewStyle;
};

/**
 * Fling-based period change — avoids capturing taps the way Pan can,
 * which was intermittently blocking the header hamburger menu.
 */
export function CalendarSwipeArea({
  children,
  enabled = true,
  onSwipePrev,
  onSwipeNext,
  style,
}: Props) {
  const gesture = useMemo(() => {
    const left = Gesture.Fling()
      .direction(Directions.LEFT)
      .enabled(enabled)
      .onEnd(() => {
        'worklet';
        runOnJS(onSwipeNext)();
      });

    const right = Gesture.Fling()
      .direction(Directions.RIGHT)
      .enabled(enabled)
      .onEnd(() => {
        'worklet';
        runOnJS(onSwipePrev)();
      });

    return Gesture.Simultaneous(left, right);
  }, [enabled, onSwipePrev, onSwipeNext]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.fill, style]} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
