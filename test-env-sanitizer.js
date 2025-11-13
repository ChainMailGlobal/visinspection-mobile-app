/**
 * Test the env sanitizer to ensure it handles @secret: placeholders correctly
 */

// Simulate environment variables with placeholders
process.env.EXPO_PUBLIC_SUPABASE_URL = '@secret:EXPO_PUBLIC_SUPABASE_URL';
process.env.EXPO_PUBLIC_MCP_URL = '@secret:EXPO_PUBLIC_MCP_URL';

// Import the env config
const env = require('./config/env');

console.log('\n=== Testing Environment Sanitizer ===\n');

console.log('Test 1: Placeholder Detection');
console.log('Input:', '@secret:EXPO_PUBLIC_SUPABASE_URL');
console.log('Output:', env.SUPABASE_URL);
console.log('✅ Should use fallback URL:', env.SUPABASE_URL.startsWith('https://'));

console.log('\nTest 2: Config Validation');
const config = env.isConfigValid();
console.log('Validation result:', config);
console.log('✅ Should detect valid config:', config.all);

console.log('\nTest 3: Supabase Client Creation');
try {
  const getSupabaseClient = require('./services/supabaseClient').default;
  const client = getSupabaseClient();
  console.log('✅ Client created successfully');
  console.log('Client has auth:', !!client.auth);
  console.log('Client has functions:', !!client.functions);
} catch (error) {
  console.log('❌ Client creation failed:', error.message);
}

console.log('\n=== Test Complete ===\n');
