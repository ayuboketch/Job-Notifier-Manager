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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setUser(profile as UserProfile);
        // READ FROM AUTH METADATA, NOT USERS TABLE
        setHasCompletedOnboarding(
          session.user.user_metadata?.["has_completed_onboarding "] === true
        );
      } else {
        setUser(null);
        setHasCompletedOnboarding(false);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

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
      // If there's a user but no session, it means email confirmation is needed. This is a success.
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
  };

  const updateOnboardingStatus = async () => {
    if (!user) {
      console.warn("🚫 No user found. Skipping onboarding update.");
      return;
    }

    console.log("🟢 Starting onboarding completion: updating local state...");
    setHasCompletedOnboarding(true); // Immediate UI update

    const updateWithRetry = async (retryCount = 0) => {
      console.log(
        `🔄 Attempt ${retryCount + 1}: sending onboarding status to Supabase...`
      );

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("⏱️ Timeout after 3s")), 3000)
        );

        const updatePromise = supabase.auth.updateUser({
          data: { has_completed_onboarding: true },
        });

        const result = (await Promise.race([
          updatePromise,
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof supabase.auth.updateUser>>;

        if (result.error) {
          console.error("❌ Supabase returned an error:", result.error.message);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
