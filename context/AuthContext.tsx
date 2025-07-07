// context/AuthContext.tsx
import Linking from "expo-linking";
//import { Linking } from "expo-linking";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { authService } from "../lib/authService";
import { getUserProfile, supabase } from "../lib/supabase";
import { AuthState } from "../types";

// --- NO CHANGES TO INTERFACES ---
interface AuthContextType extends AuthState {
  hasCompletedOnboarding: boolean;
  updateOnboardingStatus: () => Promise<void>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  resetPassword: (
    email: string
  ) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // This is the single source of truth for auth state changes. Perfect.
    initializeAuth();
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event, session);
      if (session?.user) {
        const userProfile = await getUserProfile(session.user.id);
        setHasCompletedOnboarding(
          session.user.user_metadata?.has_completed_onboarding === true
        );
        setAuthState({ user: userProfile, session, loading: false });
      } else {
        setHasCompletedOnboarding(false);
        setAuthState({ user: null, session: null, loading: false });
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    // This initial load logic is correct.
    const session = await authService.getCurrentSession();
    if (session?.user) {
      const userProfile = await getUserProfile(session.user.id);
      setHasCompletedOnboarding(
        session.user.user_metadata?.has_completed_onboarding === true
      );
      setAuthState({ user: userProfile, session, loading: false });
    } else {
      setAuthState({ user: null, session: null, loading: false });
    }
  };

  const updateOnboardingStatus = async () => {
    // Your onboarding logic is correct.
    if (!authState.user) return;
    const { data, error } = await supabase.auth.updateUser({
      data: { has_completed_onboarding: true },
    });
    if (error)
      console.error("Error updating onboarding status:", error.message);
    if (data.user) {
      setHasCompletedOnboarding(true);
    }
  };

  // --- SIMPLIFIED signIn ---
  // We let onAuthStateChange handle the state update.
  const signIn = async (email: string, password: string) => {
    const result = await authService.signIn({ email, password });
    return { success: result.success, message: result.message };
  };

  // --- NO CHANGES NEEDED for signUp ---
  // This correctly creates the deep link and passes data to the service.
  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = Linking.createURL("/(auth)/verify");
    const result = await authService.signUp({
      email,
      password,
      full_name: fullName,
      options: {
        emailRedirectTo: redirectUrl,
        data: { has_completed_onboarding: false },
      },
    });
    return { success: result.success, message: result.message };
  };

  const signOut = async () => {
    await authService.signOut();
    // onAuthStateChange will clear the state. We can clear it here too
    // for an instant UI update.
    setAuthState({ user: null, session: null, loading: false });
    setHasCompletedOnboarding(false);
  };

  const resetPassword = async (email: string) => {
    return authService.resetPassword(email);
  };

  const value: AuthContextType = {
    ...authState,
    hasCompletedOnboarding,
    updateOnboardingStatus,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
