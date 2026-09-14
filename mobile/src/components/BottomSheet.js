import React, { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Modal, View, Pressable, Animated, PanResponder, StyleSheet, Dimensions } from "react-native";
import { C } from "../theme";

// Google/Material-style draggable bottom sheet. Slides up on mount; drag the grab-handle
// down to dismiss — the sheet follows your finger and the backdrop dims with the drag.
// Release past a distance/velocity threshold closes it; otherwise it springs back.
// Core Animated + PanResponder only (no reanimated), so it also works on web.
//
// Content is passed as children (typically a <GlassSurface topOnly>). The drag zone is a wide
// strip across the top — but it's inset from the right so corner buttons (e.g. a ✕) stay
// tappable. Any in-sheet close affordance (a ✕) should call the animated close via ref:
//   const ref = useRef(); <BottomSheet ref={ref} …>  …onPress={() => ref.current?.close()}
// so it slides out instead of vanishing.
const BottomSheet = forwardRef(function BottomSheet({ onClose, children }, ref) {
  const screenH = Dimensions.get("window").height;
  const ty = useRef(new Animated.Value(screenH)).current; // start off-screen
  const sheetH = useRef(screenH);
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(ty, { toValue: sheetH.current, duration: 240, useNativeDriver: true }).start(onClose);
  };
  useImperativeHandle(ref, () => ({ close }), []);

  useEffect(() => {
    Animated.spring(ty, { toValue: 0, useNativeDriver: true, friction: 12, tension: 90 }).start();
  }, []);

  const pan = useRef(
    PanResponder.create({
      // Claim the gesture as soon as it's a clear downward drag on the handle strip.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 2 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.5) close();
        else Animated.spring(ty, { toValue: 0, useNativeDriver: true, friction: 12, tension: 90 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(ty, { toValue: 0, useNativeDriver: true, friction: 12, tension: 90 }).start();
      },
    })
  ).current;

  // Backdrop dims as the sheet travels down.
  const backdropOpacity = ty.interpolate({
    inputRange: [0, screenH], outputRange: [0.5, 0], extrapolate: "clamp",
  });

  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: backdropOpacity }]} pointerEvents="none" />
        </Pressable>

        <Animated.View
          onLayout={(e) => { sheetH.current = e.nativeEvent.layout.height || screenH; }}
          style={{ transform: [{ translateY: ty }] }}
        >
          {children}
          {/* Wide drag strip across the top, inset from the right so corner buttons (✕) still
              get taps. Rendered above content; the visible pill is non-interactive on top. */}
          <View {...pan.panHandlers} style={styles.grabZone} pointerEvents="box-only" />
          <View style={styles.grabber} pointerEvents="none">
            <View style={styles.pill} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  grabZone: {
    position: "absolute", top: 0, left: 0, right: 64, height: 44,
  },
  grabber: {
    position: "absolute", top: 9, left: 0, right: 0, alignItems: "center",
  },
  pill: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: C.fgDim, opacity: 0.5,
  },
});

export default BottomSheet;
