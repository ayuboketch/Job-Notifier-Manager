// lib/authService.ts
import { AuthResponse, SignInData, SignUpData, ValidationResult } from '../types';
import { supabase } from './supabase';

class AuthService {
  // Sign up with email and password
  async signUp({ email, password, full_name }: SignUpData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return {
          success: false,
          message: 'An account with this email already exists. Please try logging in instead.',
        };
      }

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
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
        return {
          success: false,
          message: 'Failed to create account. Please try again.',
        };
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.toLowerCase(),
          full_name: full_name || undefined,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't fail the signup if profile creation fails
      }

      return {
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        user: {
          id: authData.user.id,
          email: authData.user.email || email,
          full_name: full_name || undefined,
          avatar_url: undefined,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at || authData.user.created_at,
        },
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Sign in with email and password
  async signIn({ email, password }: SignInData): Promise<AuthResponse> {
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
        return {
          success: false,
          message: 'Invalid email or password.',
        };
      }

      // Get user profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      return {
        success: true,
        message: 'Welcome back!',
        user: userProfile || {
          id: authData.user.id,
          email: authData.user.email || email,
          full_name: null,
          avatar_url: null,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at || authData.user.created_at,
        },
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check if user exists
  async checkUserExists(email: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      return !!data;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  // Sign out
  async signOut(): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: true,
        message: 'Signed out successfully',
      };
    } catch (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        message: 'Failed to sign out',
      };
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase());
      
      if (error) {
        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.',
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: 'Failed to send reset email',
      };
    }
  }

  // Validate email format
  validateEmail(email: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    return {
      isValid,
      message: isValid ? '' : 'Please enter a valid email address',
    };
  }

  // Validate password strength
  validatePassword(password: string): ValidationResult {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (password.length < minLength) {
      return {
        isValid: false,
        message: `Password must be at least ${minLength} characters long`,
      };
    }
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return {
        isValid: false,
        message: 'Password must contain uppercase, lowercase, and numbers',
      };
    }
    
    return {
      isValid: true,
      message: '',
    };
  }

  // Get current session
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Listen to auth changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();