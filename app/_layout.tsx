// app/_layout.tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import "../global.css";

const InitialLayout = () => {
  const { session, hasCompletedOnboarding, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Wait until auth state is loaded

    const inAppGroup = segments[0] === '(app)';

    if (session) {
      if (hasCompletedOnboarding) {
        // Logged in & onboarded -> GO TO DASHBOARD
        if (!inAppGroup) {
          router.replace('/(app)/dashboard');
        }
      } else {
        // Logged in but NOT onboarded -> GO TO ONBOARDING
        router.replace('/onboarding');
      }
    } else {
      // Not logged in -> GO TO LOGIN/AUTH
      // If they are somehow in the app group, kick them out.
      if (inAppGroup) {
         router.replace('/(auth)/login');
      }
    }
  }, [session, hasCompletedOnboarding, loading]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141a1f'
  }
});