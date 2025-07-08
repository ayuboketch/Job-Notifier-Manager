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

  const fetchUserProfile = async (
    userId: string
  ): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error.message);
      return null;
    }
    return data as UserProfile;
  };

  useEffect(() => {
    const fetchAndSetSession = async () => {
      // 1. Get the initial session
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      // 2. If a session exists, fetch its profile
      if (initialSession?.user) {
        const profile = await fetchUserProfile(initialSession.user.id);
        setSession(initialSession);
        setUser(profile);
        setHasCompletedOnboarding(
          profile?.user_metadata?.has_completed_onboarding === true
        );
      }

      // 3. We are done loading
      setLoading(false);
    };

    fetchAndSetSession();

    // 4. Listen for future auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const profile = await fetchUserProfile(newSession.user.id);
        setUser(profile);
        setHasCompletedOnboarding(
          profile?.user_metadata?.has_completed_onboarding === true
        );
      } else {
        setUser(null);
        setHasCompletedOnboarding(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            has_completed_onboarding: false,
          },
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }
      return {
        success: true,
        message: "Please check your email to verify your account.",
      };
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
      return {
        success: false,
        message: e.message || "An unexpected error occurred.",
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateOnboardingStatus = async () => {
    if (!user) return;
    try {
      const { error: authUserError } = await supabase.auth.updateUser({
        data: { has_completed_onboarding: true },
      });
      if (authUserError) throw authUserError;

      // Also update our public table if we need to query it elsewhere
      const { error: profileError } = await supabase
        .from("users")
        .update({ has_completed_onboarding: true })
        .eq("id", user.id);
      if (profileError) throw profileError;

      // Update local state immediately to trigger redirect
      setHasCompletedOnboarding(true);
    } catch (error: any) {
      console.error("Error updating onboarding status:", error.message);
    }
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
