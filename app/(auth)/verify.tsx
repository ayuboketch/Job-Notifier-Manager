// app/(auth)/verify.tsx
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AnimatedGradientBackground from "../../components/AnimatedGradientBackground";

// This screen shows a simple loading state for email verification
// The main app layout will handle the actual navigation logic

export default function VerifyScreen() {
  return (
    <View style={styles.container}>
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.text}>Verifying your email...</Text>
            <Text style={styles.subText}>
              Please wait while we confirm your account
            </Text>
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141a1f",
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  text: {
    color: "white",
    fontSize: 18,
    marginTop: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  subText: {
    color: "#CBD5E1",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
