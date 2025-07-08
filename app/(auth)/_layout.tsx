// app/_layout.tsx
import { Redirect, SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../../context/AuthContext";

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

  // If we are still loading the auth state, don't render anything.
  // The splash screen will be visible.
  if (loading) {
    return null;
  }

  // Once loading is complete, we can safely redirect.

  if (!user) {
    // If the user is not signed in, they should be on the auth flow screens.
    // The entry point is index.tsx, which is what we want.
    // No redirect is needed here, the user is already where they should be.
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
      </Stack>
    );
  }

  if (!hasCompletedOnboarding) {
    // If the user is signed in but hasn't onboarded, redirect to onboarding.
    return <Redirect href="/onboarding" />;
  }

  // If the user is signed in and has onboarded, redirect to the dashboard.
  return <Redirect href="/(app)/dashboard" />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
