// lib/authService.ts
import { AuthResponse, SignUpData } from '../types';
import { supabase } from './supabase';

class AuthService {
  // The database trigger handles creating the user profile.
  async signUp({ email, password, full_name, options }: SignUpData): Promise<AuthResponse> {
    try {
      // We pass the full_name in the options metadata,
      // so our database trigger can use it.
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          ...options, // Pass existing options like emailRedirectTo
          data: {
            ...options?.data, // Pass existing metadata
            full_name: full_name, // Add full_name for the trigger
          },
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }
      if (!data.user) {
        return { success: false, message: 'Signup failed. Please try again.' };
      }
      
      // FIX: Return the user object directly from the auth response.
      // Do NOT try to build it manually. This is the key change.
      // The onAuthStateChange listener will fetch the full profile from the `users` table later.
      return {
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        user: {
          ...data.user,
          updated_at: data.user.updated_at ?? "",
        },
      };

    } catch (error) {
      console.error('Sign up error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      return { success: false, message, error: message };
    }
  }

  async signIn({ email, password }: { email: string, password: string }): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError) {
        return { success: false, message: authError.message };
      }
      if (!authData.user) {
        return { success: false, message: 'Invalid email or password.' };
      }
      
      // This is correct: after signing in, we fetch the full profile.
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      // If the profile doesn't exist for some reason, we can still succeed
      // but the `user` in the context might be minimal.
      if (!userProfile) {
         console.warn("User signed in, but no public profile found. The trigger might be missing.");
      }

      return { success: true, message: 'Welcome back!', user: userProfile || authData.user };

    } catch (error) {
      console.error('Sign in error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      return { success: false, message, error: message };
    }
  }

  async signOut(): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Signed out successfully' };
  }

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase());
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Password reset email sent. Please check your inbox.' };
  }

  async getCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();