/**
 * Environment configuration
 * Store sensitive keys in .env file (not committed to git)
 */

// AI API Keys
export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || 'your-openai-api-key-here';
export const GOOGLE_AI_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY || 'your-google-ai-key-here';

// Supabase Configuration
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fnnwjnkttgnprwguwfnd.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubndqbmt0dGducHJ3Z3V3Zm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzkzNzgsImV4cCI6MjA3NDMxNTM3OH0.tE2baj7JXgsosYWOjyxlgRpVi13a_JlpkW4GIFRHjwY';

// MCP Backend URL (Mode-based AI: Gemini Flash for live scanning, GPT-4o for detailed reports)
export const MCP_URL = process.env.EXPO_PUBLIC_MCP_URL || 'https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server';
