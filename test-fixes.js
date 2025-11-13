/**
 * Verify all crash fixes are in place
 */

const fs = require('fs');

console.log('\n=== Verifying Crash Fixes ===\n');

const checks = [
  {
    name: 'env.js has sanitizer',
    file: 'config/env.js',
    mustInclude: 'fromEnv',
    reason: 'Prevents @secret: placeholders from reaching createClient',
  },
  {
    name: 'env.js has validator',
    file: 'config/env.js',
    mustInclude: 'isConfigValid',
    reason: 'Validates URLs before use',
  },
  {
    name: 'supabaseClient.js exists',
    file: 'services/supabaseClient.js',
    mustInclude: 'AsyncStorage',
    reason: 'Singleton client with auth persistence',
  },
  {
    name: 'LiveInspectionScreen uses singleton',
    file: 'screens/LiveInspectionScreen.js',
    mustInclude: 'getSupabaseClient',
    mustNotInclude: 'createClient',
    reason: 'No direct createClient calls',
  },
  {
    name: 'McpClient validates URL',
    file: 'services/McpClient.js',
    mustInclude: 'isConfigValid',
    reason: 'Validates MCP_URL before use',
  },
  {
    name: 'McpClient has timeout',
    file: 'services/McpClient.js',
    mustInclude: 'AbortController',
    reason: 'Proper timeout implementation',
  },
  {
    name: 'LiveInspectionScreen has error handler',
    file: 'screens/LiveInspectionScreen.js',
    mustInclude: '.catch((error)',
    reason: 'Unhandled promise fix',
  },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  try {
    const content = fs.readFileSync(check.file, 'utf8');
    const hasRequired = check.mustInclude ? content.includes(check.mustInclude) : true;
    const lacksExcluded = check.mustNotInclude ? !content.includes(check.mustNotInclude) : true;

    if (hasRequired && lacksExcluded) {
      console.log(`✅ ${check.name}`);
      console.log(`   → ${check.reason}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}`);
      console.log(`   → Missing: ${check.mustInclude || check.mustNotInclude}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${check.name}`);
    console.log(`   → File not found: ${check.file}`);
    failed++;
  }
  console.log('');
});

console.log(`\n=== Results: ${passed}/${checks.length} checks passed ===\n`);

if (failed === 0) {
  console.log('🎉 All fixes verified! Ready to build.\n');
} else {
  console.log(`⚠️  ${failed} issue(s) found. Please review.\n`);
}
