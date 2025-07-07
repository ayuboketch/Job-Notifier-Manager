// lib/authService.ts
import { AuthResponse, SignUpData } from '../types';
import { supabase } from './supabase';

class AuthService {
  // --- SIMPLIFIED AND FIXED ---
  // The database trigger now handles creating the user profile.
  async signUp({ email, password, full_name, options }: SignUpData): Promise<AuthResponse> {
    try {
      // We now pass the full_name in the options metadata,
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
      
      // We no longer need to manually insert into the 'users' table.
      // The trigger does it for us! The user object returned here is from auth.
      return {
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        user: {
          id: data.user.id,
          email: data.user.email ?? '',
          created_at: data.user.created_at ?? '', // Add fallback if undefined
          updated_at: data.user.updated_at ?? '', // Add fallback if undefined
          // Add other fields as required by your User type
          full_name: data.user.user_metadata?.full_name ?? ''
        },
      };

    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --- NO CHANGES NEEDED BELOW THIS LINE ---

  async signIn({ email, password }: { email: string, password: string }): Promise<AuthResponse> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError) {
        return {
          success: false,
          message: authError.message,
          error: authError.message,
        };
      }
      if (!authData.user) {
        return { success: false, message: 'Invalid email or password.' };
      }
      
      // Get user profile - This now correctly fetches the profile created by the trigger.
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      return { success: true, message: 'Welcome back!', user: userProfile };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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