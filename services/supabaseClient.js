/**
 * Singleton Supabase client with AsyncStorage for React Native
 * Prevents multiple client instances and handles auth persistence
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigValid } from '../config/env';

let supabaseInstance = null;

/**
 * Get or create the Supabase client instance
 * @returns {object} Supabase client
 * @throws {Error} If Supabase URL/key is invalid
 */
export const getSupabaseClient = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Validate configuration before creating client
  const config = isConfigValid();
  if (!config.supabase) {
    const error = new Error(
      'Supabase configuration is invalid. Please rebuild the app with valid credentials.'
    );
    console.error('[Supabase] Invalid configuration:', { SUPABASE_URL });
    throw error;
  }

  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    console.log('[Supabase] Client created successfully');
    return supabaseInstance;
  } catch (error) {
    console.error('[Supabase] Failed to create client:', error);
    throw new Error(`Failed to initialize Supabase: ${error.message}`);
  }
};

/**
 * Check if Supabase client can be safely initialized
 * @returns {boolean} True if safe to create client
 */
export const canInitializeSupabase = () => {
  const config = isConfigValid();
  return config.supabase;
};

// Export singleton instance
export default getSupabaseClient;
