/**
 * Environment configuration
 * Sanitizes EAS @secret: placeholders and provides fallbacks
 */

/**
 * Sanitize environment variable to handle EAS secret placeholders
 * @param {string} value - Raw env value
 * @param {string} fallback - Fallback value if invalid
 * @returns {string} Valid value or fallback
 */
const fromEnv = (value, fallback) => {
  // Treat missing, @secret: placeholders, or empty strings as invalid
  if (!value || value.startsWith('@secret:') || value.trim() === '') {
    console.warn(`[ENV] Using fallback for invalid/placeholder value: ${value || 'undefined'}`);
    return fallback;
  }
  return value;
};

// AI API Keys
export const OPENAI_API_KEY = fromEnv(
  process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  'your-openai-api-key-here'
);

export const GOOGLE_AI_API_KEY = fromEnv(
  process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY,
  'your-google-ai-key-here'
);

// Supabase Configuration
export const SUPABASE_URL = fromEnv(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  'https://fnnwjnkttgnprwguwfnd.supabase.co'
);

export const SUPABASE_ANON_KEY = fromEnv(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubndqbmt0dGducHJ3Z3V3Zm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzkzNzgsImV4cCI6MjA3NDMxNTM3OH0.tE2baj7JXgsosYWOjyxlgRpVi13a_JlpkW4GIFRHjwY'
);

// MCP Backend URL (Mode-based AI: Gemini Flash for live scanning, GPT-4o for detailed reports)
export const MCP_URL = fromEnv(
  process.env.EXPO_PUBLIC_MCP_URL,
  'https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server'
);

// Validate critical URLs
export const isConfigValid = () => {
  const isSupabaseValid = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('@secret:');
  const isMcpValid = MCP_URL.startsWith('https://') && !MCP_URL.includes('@secret:');

  return {
    supabase: isSupabaseValid,
    mcp: isMcpValid,
    all: isSupabaseValid && isMcpValid,
  };
};
