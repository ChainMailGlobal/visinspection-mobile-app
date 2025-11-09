/**
 * Environment configuration
 * Store sensitive keys in .env file (not committed to git)
 */

// OpenAI API Key for GPT-4 Vision
export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'your-openai-api-key-here';

// Supabase Configuration
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here';
