// context/AuthContext.tsx
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { authService } from "../lib/authService";
import { getUserProfile, supabase } from "../lib/supabase"; // Assuming supabase is exported from here
import { AuthState } from "../types"; // Make sure UserProfile is exported from types

// 1. ADD ONBOARDING STATUS TO THE CONTEXT TYPE
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
  // 2. ADD ONBOARDING STATE
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    initializeAuth();
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userProfile = await getUserProfile(session.user.id);
        // 3. CHECK ONBOARDING STATUS WHEN AUTH STATE CHANGES
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
    try {
      const session = await authService.getCurrentSession();
      if (session?.user) {
        const userProfile = await getUserProfile(session.user.id);
        // 4. CHECK ONBOARDING STATUS ON INITIAL LOAD
        setHasCompletedOnboarding(
          session.user.user_metadata?.has_completed_onboarding === true
        );
        setAuthState({ user: userProfile, session, loading: false });
      } else {
        setAuthState({ user: null, session: null, loading: false });
      }
    } catch (error) {
      console.error("Error initializing auth:", error);
      setAuthState({ user: null, session: null, loading: false });
    }
  };

  // 5. IMPLEMENT THE FUNCTION TO UPDATE ONBOARDING STATUS
  const updateOnboardingStatus = async () => {
    if (!authState.user) return;
    const { data, error } = await supabase.auth.updateUser({
      data: { has_completed_onboarding: true },
    });
    if (data.user) {
      setHasCompletedOnboarding(true);
      // Optionally update local user state if needed
      if (authState.user) {
        const updatedUserProfile = await getUserProfile(authState.user.id);
        setAuthState((prev) => ({
          ...prev,
          user: updatedUserProfile,
        }));
      }
    }
    if (error)
      console.error("Error updating onboarding status:", error.message);
  };

  const signIn = async (email: string, password: string) => {
    // Your existing signIn function is fine
    const result = await authService.signIn({ email, password });
    if (result.success && result.user) {
      const userProfile = await getUserProfile(result.user.id);
      setHasCompletedOnboarding(
        (result.user as any).user_metadata?.has_completed_onboarding === true
      );
      // Fetch the current session after successful sign-in
      const session = await authService.getCurrentSession();
      setAuthState({
        user: userProfile,
        session: session ?? null,
        loading: false,
      });
    }
    return { success: result.success, message: result.message };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    // 6. MODIFY SIGNUP TO INCLUDE METADATA
    const result = await authService.signUp({
      email,
      password,
      full_name: fullName,
      options: { data: { has_completed_onboarding: false } },
    });
    return { success: result.success, message: result.message };
  };

  const signOut = async () => {
    await authService.signOut();
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
