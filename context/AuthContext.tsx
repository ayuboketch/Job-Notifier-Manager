// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthResponse, AuthState, User } from "../types";

interface AuthContextType extends AuthState {
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error);
        }

        if (mounted) {
          setSession(session);
          if (session?.user) {
            console.log("Initial session found for user:", session.user.email);
            setUser(mapSupabaseUser(session.user));
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Exception getting initial session:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);

      if (mounted) {
        setSession(session);

        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
        } else {
          setUser(null);
        }

        setLoading(false);

        // Handle specific auth events
        if (event === "SIGNED_IN" && session?.user) {
          console.log("User signed in successfully:", session.user.email);
        }

        if (event === "SIGNED_OUT") {
          console.log("User signed out");
          setHasCompletedOnboarding(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Helper function to map Supabase user to our User type
  const mapSupabaseUser = (supabaseUser: any): User => ({
    id: supabaseUser.id,
    email: supabaseUser.email,
    full_name:
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.fullName ||
      supabaseUser.user_metadata?.name,
    avatar_url: supabaseUser.user_metadata?.avatar_url,
    created_at: supabaseUser.created_at,
    updated_at: supabaseUser.updated_at,
  });

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthResponse> => {
    try {
      console.log("Attempting to sign up user:", email);

      // Validate inputs
      if (!email || !password) {
        return {
          success: false,
          message: "Email and password are required",
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            full_name: fullName,
            fullName: fullName, // Backup field name
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
      }

      if (data.user) {
        console.log(
          "User created:",
          data.user.email,
          "Session:",
          !!data.session
        );

        // Check if user needs email confirmation
        if (!data.session) {
          console.log("User created, awaiting email confirmation");
          return {
            success: true,
            message: "Please check your email to confirm your account",
            user: mapSupabaseUser(data.user),
          };
        } else {
          console.log("User created and signed in immediately");
          return {
            success: true,
            message: "Account created successfully",
            user: mapSupabaseUser(data.user),
          };
        }
      }

      return {
        success: false,
        message: "Signup failed - no user returned",
      };
    } catch (error: any) {
      console.error("Signup exception:", error);
      return {
        success: false,
        message: error.message || "An unexpected error occurred",
        error: error.message,
      };
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    try {
      console.log("Attempting to sign in user:", email);

      // Validate inputs
      if (!email || !password) {
        return {
          success: false,
          message: "Email and password are required",
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return {
          success: false,
          message: error.message,
          error: error.message,
        };
      }

      if (data.user && data.session) {
        console.log("User signed in successfully:", data.user.email);
        return {
          success: true,
          message: "Signed in successfully",
          user: mapSupabaseUser(data.user),
        };
      }

      return {
        success: false,
        message: "Sign in failed - no user returned",
      };
    } catch (error: any) {
      console.error("Sign in exception:", error);
      return {
        success: false,
        message: error.message || "An unexpected error occurred",
        error: error.message,
      };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log("Attempting to sign out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
      } else {
        console.log("User signed out successfully");
        setHasCompletedOnboarding(false);
      }
    } catch (error) {
      console.error("Sign out exception:", error);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
