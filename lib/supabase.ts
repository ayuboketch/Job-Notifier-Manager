// lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { Database } from '../types'; // Assuming this path is correct after moving the folder


// Load variables using the standard process.env method for Expo
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Add a check to give a better error message if variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Check your .env file and ensure it has EXPO_PUBLIC_ prefixes.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper function to get user profile
export const handleAuthError = (error: any) => {
  console.error('Supabase auth error:', error);
  
  if (error.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  
  if (error.message?.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }
  
  if (error.message?.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  
  return error.message || 'An unexpected error occurred. Please try again.';
};
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
  
  return data;
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Helper function to handle auth errors
