// app/_layout.tsx
import { Redirect, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Keep the splash screen visible until we are ready to render
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading, hasCompletedOnboarding } = useAuth();

  useEffect(() => {
    // When the auth state is done loading, hide the splash screen.
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // If we are still loading the auth state, render nothing.
  // The native splash screen will be visible.
  if (loading) {
    return null;
  }

  // --- This is the core logic for your user flows ---

  // Flow 1 & 2 (No Session): User is NOT logged in.
  // We let them stay on the screens in the root directory (index.tsx)
  // and the (auth) group. No redirect is needed.
  if (!user) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
      </Stack>
    );
  }

  // Flow 1 & 2 (After Login, Before Onboarding): User IS logged in
  // but HAS NOT completed onboarding. Redirect to the onboarding screen.
  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Flow 3 (Returning User): User IS logged in and HAS completed
  // onboarding. Redirect to the main app dashboard.
  return <Redirect href="/(app)/dashboard" />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
