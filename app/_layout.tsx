// app/_layout.tsx
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../global.css";

const InitialLayout = () => {
  const { session, hasCompletedOnboarding, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Wait until the auth state is fully loaded before making decisions
    if (loading) {
      return;
    }

    const inAppGroup = segments[0] === "(app)";

    if (session) {
      // User is logged in
      if (hasCompletedOnboarding) {
        // SCENARIO: Returning user, already onboarded.
        // ACTION: Go to the main app dashboard.
        if (!inAppGroup) {
          router.replace("/(app)/dashboard");
        }
      } else {
        // SCENARIO: New user, just signed up/logged in for the first time.
        // ACTION: Go to the onboarding slides.
        router.replace("/onboarding");
      }
    } else {
      // SCENARIO: User is not logged in.
      // ACTION: Stay in the auth flow (or be sent to the auth home screen).
      // If they were somehow in the app, kick them out.
      if (inAppGroup) {
        router.replace("/");
      }
    }
  }, [session, hasCompletedOnboarding, loading]); // Dependencies that trigger this check

  // While loading auth state, show a spinner.
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Once loaded, show the screen determined by the logic above.
  return <Slot />;
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <InitialLayout />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#141a1f",
  },
});
