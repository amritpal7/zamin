import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

// Pressable with tactile "motion": a subtle spring scale-down on press-in, springing back
// on release. Used for cards that navigate (e.g. tapping a property → detail) so the tap
// feels responsive right before the screen slides in. Forwards all Pressable props; the
// visual `style` goes on the animated wrapper so the transform composes with it.
export default function PressableScale({ children, style, scaleTo = 0.97, onPressIn, onPressOut, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue, friction) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, friction, tension: 180 }).start();
  return (
    <Pressable
      {...props}
      onPressIn={(e) => { spring(scaleTo, 8); onPressIn?.(e); }}
      onPressOut={(e) => { spring(1, 5); onPressOut?.(e); }}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
