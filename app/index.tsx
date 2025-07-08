// app/index.tsx
import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AnimatedGradientBackground from "../components/AnimatedGradientBackground"; // Assuming path is correct
import DebugSupabase from "../components/DebugSupabase";

export default function AuthHomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <AnimatedGradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Job Notifier</Text>
            <Text style={styles.subtitle}>
              Never miss your dream job again.
            </Text>
          </View>
          <DebugSupabase />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/(auth)/signup")}
            >
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AnimatedGradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#CBD5E1",
    marginTop: 16,
    textAlign: "center",
  },
  buttonContainer: {
    paddingBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#475569",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#CBD5E1",
    fontSize: 18,
    fontWeight: "600",
  },
});
