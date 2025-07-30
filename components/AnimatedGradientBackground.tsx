// components/AnimatedGradientBackground.tsx
import { LinearGradient } from "expo-linear-gradient";
import React, { PropsWithChildren, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const AnimatedGradientBackground = ({ children }: PropsWithChildren) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 7000 }), -1, true);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      flex: 1,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 0.5, 1],
        ["#0c2a69", "#1e3a8a", "#172554"]
      ),
    };
  });

  return (
    <Animated.View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[
          "rgba(20, 26, 31, 1)",
          "rgba(20, 26, 31, 0.8)",
          "rgba(30, 41, 59, 0.6)",
        ]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(30, 64, 175, 0.3)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Animated.View>
  );
};

export default AnimatedGradientBackground;
