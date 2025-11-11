// VIS Inspection App Diagnostic Test Script
// Run this with: node test-diagnostics.js

const fs = require('fs');
const path = require('path');

console.log('=================================');
console.log('VIS INSPECTION APP DIAGNOSTIC TEST');
console.log('=================================\n');

// 1. Check Environment Variables
console.log('1. CHECKING ENVIRONMENT VARIABLES:');
console.log('-----------------------------------');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').filter(line => line && !line.startsWith('#'));
  envVars.forEach(line => {
    const [key] = line.split('=');
    if (key) {
      console.log(`✓ ${key} is defined`);
    }
  });
} else {
  console.log('✗ .env file not found!');
}

// 2. Check Required Dependencies
console.log('\n2. CHECKING REQUIRED DEPENDENCIES:');
console.log('-----------------------------------');
const packageJson = require('./package.json');
const requiredDeps = [
  'expo',
  'expo-speech-recognition',
  'expo-speech',
  'expo-camera',
  'expo-location',
  'expo-file-system',
  '@supabase/supabase-js',
  'react-native',
  'react'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`✓ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`✗ ${dep}: NOT FOUND`);
  }
});

// 3. Check Native Module Requirements
console.log('\n3. CHECKING NATIVE MODULE REQUIREMENTS:');
console.log('----------------------------------------');
console.log('expo-speech-recognition requires a DEVELOPMENT BUILD');
console.log('It CANNOT run in Expo Go!');
console.log('');
console.log('To fix voice recognition:');
console.log('1. Run: npx expo prebuild');
console.log('2. Run: npx expo run:android');
console.log('   OR');
console.log('   Build with EAS: eas build --profile development --platform android');

// 4. Check Service Files
console.log('\n4. CHECKING SERVICE FILES:');
console.log('--------------------------');
const services = [
  'services/AIVisionService.js',
  'services/VoiceService.js',
  'services/BuildingCodeService.js',
  'services/MCPService.js'
];

services.forEach(service => {
  const servicePath = path.join(__dirname, service);
  if (fs.existsSync(servicePath)) {
    console.log(`✓ ${service} exists`);
  } else {
    console.log(`✗ ${service} NOT FOUND`);
  }
});

// 5. Check MCP Backend
console.log('\n5. CHECKING MCP BACKEND:');
console.log('------------------------');
console.log('MCP URL should be: https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server');
console.log('Note: The MCP backend appears to have authentication issues (Invalid JWT)');
console.log('This needs to be fixed on the backend side.');

// 6. Android Permissions
console.log('\n6. ANDROID PERMISSIONS STATUS:');
console.log('-------------------------------');
const androidManifestPath = path.join(__dirname, 'android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(androidManifestPath)) {
  const manifest = fs.readFileSync(androidManifestPath, 'utf8');
  const permissions = [
    'RECORD_AUDIO',
    'CAMERA',
    'ACCESS_FINE_LOCATION',
    'INTERNET'
  ];

  permissions.forEach(perm => {
    if (manifest.includes(`android.permission.${perm}`)) {
      console.log(`✓ ${perm} permission declared`);
    } else {
      console.log(`✗ ${perm} permission MISSING`);
    }
  });

  // Check for speech recognition service query
  if (manifest.includes('com.google.android.googlequicksearchbox')) {
    console.log('✓ Google speech service package query present');
  } else {
    console.log('✗ Google speech service package query MISSING');
  }
} else {
  console.log('✗ Android project not prebuilt. Run: npx expo prebuild');
}

// 7. Known Issues Summary
console.log('\n=================================');
console.log('IDENTIFIED ISSUES:');
console.log('=================================\n');

const issues = [];

// Check if running in Expo Go
if (!fs.existsSync(path.join(__dirname, 'android'))) {
  issues.push({
    severity: 'CRITICAL',
    issue: 'App not prebuilt for native features',
    fix: 'Run: npx expo prebuild && npx expo run:android'
  });
}

// Check MCP backend
issues.push({
  severity: 'CRITICAL',
  issue: 'MCP backend authentication failing (Invalid JWT)',
  fix: 'Backend needs to be fixed to accept the Supabase anon key properly'
});

// Voice recognition module
issues.push({
  severity: 'CRITICAL',
  issue: 'expo-speech-recognition requires development build',
  fix: 'Cannot use Expo Go. Must use: npx expo run:android or EAS build'
});

// Display issues
issues.forEach((issue, index) => {
  console.log(`${index + 1}. [${issue.severity}] ${issue.issue}`);
  console.log(`   FIX: ${issue.fix}\n`);
});

console.log('=================================');
console.log('RECOMMENDED ACTIONS:');
console.log('=================================\n');
console.log('1. Build a development client:');
console.log('   npx expo prebuild --clean');
console.log('   npx expo run:android');
console.log('');
console.log('2. Or use EAS Build for development:');
console.log('   eas build --profile development --platform android');
console.log('   Then install the APK on your device');
console.log('');
console.log('3. Fix MCP backend authentication to accept the Supabase keys');
console.log('');
console.log('4. Test voice commands after installing the dev build');
console.log('');
console.log('Note: The app CANNOT run voice recognition in Expo Go!');