// app/(auth)/verify.tsx
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function VerifyScreen() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // When the user clicks the link, the app opens here. The Supabase client
    // automatically handles the token from the URL and establishes a session.
    // The `onAuthStateChange` listener in your AuthContext detects this new session.
    // Your root layout `(auth)/_layout.tsx` will then see `session` is no longer null
    // and automatically redirect to the `(app)` group.

    // We can add a fallback here for robustness. If a session is active after a
    // short delay, we manually redirect.
    if (session) {
      const timer = setTimeout(() => {
        router.replace("/(app)/dashboard"); // Or your main dashboard route
      }, 500); // A small delay to feel natural

      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [session, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.text}>
        Finalizing your verification, one moment...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#141a1f",
  },
  text: {
    color: "white",
    marginTop: 20,
    fontSize: 18,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
