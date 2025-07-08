// app/_layout.tsx
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Keep the splash screen visible until we are ready to render
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) {
      return; // Do nothing until auth state is confirmed
    }

    // Hide the splash screen once we have the auth state
    SplashScreen.hideAsync();

    const inAuthFlow = segments[0] === "(auth)";
    const onOnboardingScreen = segments[0] === "onboarding";

    if (user && hasCompletedOnboarding) {
      // User is logged in and onboarded, should be in the app.
      router.replace("/(app)/dashboard");
    } else if (user && !hasCompletedOnboarding) {
      // User is logged in but not onboarded, should be on the onboarding screen.
      if (!onOnboardingScreen) {
        router.replace("/onboarding");
      }
    } else if (!user) {
      // User is not logged in, should be in the auth flow.
      if (!inAuthFlow) {
        router.replace("/");
      }
    }
  }, [loading, user, hasCompletedOnboarding]);

  // This stable layout prevents errors and white screens.
  // The useEffect above handles all navigation.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
