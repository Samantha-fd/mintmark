import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const THUMB = 26;

type Props = {
  value: number;
  min?: number;
  max?: number;
  /** fires continuously while dragging */
  onChange?: (value: number) => void;
  /** fires once when the finger lifts — use for expensive recomputes */
  onCommit?: (value: number) => void;
};

export function Slider({ value, min = 0, max = 100, onChange, onCommit }: Props) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const usable = Math.max(1, trackWidth - THUMB);
  const pos = useSharedValue(((value - min) / (max - min)) * usable);
  const startPos = useSharedValue(0);

  const toValue = (p: number) => {
    'worklet';
    return min + (p / usable) * (max - min);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startPos.value = pos.value;
    })
    .onUpdate((e) => {
      pos.value = Math.max(0, Math.min(usable, startPos.value + e.translationX));
      if (onChange) runOnJS(onChange)(toValue(pos.value));
    })
    .onEnd(() => {
      if (onCommit) runOnJS(onCommit)(toValue(pos.value));
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: pos.value + THUMB / 2,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.container}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          setTrackWidth(w);
          pos.value = ((value - min) / (max - min)) * Math.max(1, w - THUMB);
        }}
      >
        <View style={[styles.track, { backgroundColor: theme.border }]} />
        <Animated.View
          style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]}
        />
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: theme.surface, borderColor: theme.accent },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    elevation: 2,
  },
});
