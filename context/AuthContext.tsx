// context/AuthContext.tsx
import { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

export interface UserProfile extends User {
  full_name: string | null;
  has_completed_onboarding: boolean;
  user_metadata: {
    has_completed_onboarding?: boolean;
    full_name?: string;
  };
}

interface AuthContextType {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  hasCompletedOnboarding: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  updateOnboardingStatus: () => Promise<void>;
  refreshSession: () => Promise<void>; // Add this method
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Error getting initial session:", error);
        setSession(null);
        setUser(null);
        setHasCompletedOnboarding(false);
        setLoading(false);
        return;
      }

      setSession(session);
      if (session?.user) {
        handleUserSession(session);
      } else {
        setUser(null);
        setHasCompletedOnboarding(false);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.id);

      // Handle sign out or invalid session
      if (event === "SIGNED_OUT" || !session) {
        setSession(null);
        setUser(null);
        setHasCompletedOnboarding(false);
        setLoading(false);
        return;
      }

      // Handle token refresh failures
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      setSession(session);
      await handleUserSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleUserSession = async (session: Session) => {
    try {
      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        // If profile doesn't exist, create basic user object
        setUser(session.user as UserProfile);
      } else {
        setUser(profile as UserProfile);
      }

      // FIX: Remove the extra space in the key name
      setHasCompletedOnboarding(
        session.user.user_metadata?.["has_completed_onboarding"] === true
      );
    } catch (error) {
      console.error("Error handling user session:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Failed to refresh session:", error);
        // Force sign out on refresh failure
        await signOut();
        throw error;
      }
      return session;
    } catch (error) {
      console.error("Session refresh failed:", error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            has_completed_onboarding: false,
          },
        },
      });

      if (error) return { success: false, message: error.message };

      if (data.user && !data.session) {
        return {
          success: true,
          message: "Please check your email to verify your account.",
        };
      }
      return { success: true, message: "Account created successfully!" };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || "An unexpected error occurred.",
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) return { success: false, message: error.message };
      return { success: true, message: "Signed in successfully!" };
    } catch (e: any) {
      return { success: false, message: "An unexpected error occurred." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setHasCompletedOnboarding(false);
  };

  const updateOnboardingStatus = async () => {
    if (!user) {
      console.warn("🚫 No user found. Skipping onboarding update.");
      return;
    }

    console.log("🟢 Starting onboarding completion: updating local state...");
    setHasCompletedOnboarding(true);

    const updateWithRetry = async (retryCount = 0) => {
      console.log(
        `🔄 Attempt ${retryCount + 1}: sending onboarding status to Supabase...`
      );

      try {
        const { error } = await supabase.auth.updateUser({
          data: { has_completed_onboarding: true },
        });

        if (error) {
          console.error("❌ Supabase returned an error:", error.message);
          if (retryCount < 2) {
            console.log(`🔁 Retrying... (${retryCount + 1}/2)`);
            setTimeout(() => updateWithRetry(retryCount + 1), 1000);
          }
        } else {
          console.log("✅ Supabase onboarding metadata updated successfully.");
        }
      } catch (error: any) {
        console.error("🔥 Background update error:", error.message || error);
        if (retryCount < 2) {
          console.log(`🔁 Retrying after error... (${retryCount + 1}/2)`);
          setTimeout(() => updateWithRetry(retryCount + 1), 1000);
        }
      }
    };

    updateWithRetry();
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    hasCompletedOnboarding,
    signIn,
    signUp,
    signOut,
    updateOnboardingStatus,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
