# VIS INSPECTION APP - COMPREHENSIVE AUDIT REPORT

## Voice Recognition & AI Vision Issues

**Date:** November 10, 2025
**App:** VISION Mobile (Android/iOS)
**Status:** CRITICAL - Voice & AI Features Non-Functional

---

## EXECUTIVE SUMMARY

The VIS Inspection mobile app has **TWO CRITICAL ISSUES** preventing voice recognition and AI vision from working:

1. **App is running in Expo Go instead of a Development Build** - Voice recognition CANNOT work in Expo Go
2. **MCP Backend authentication is failing** - The AI vision service cannot connect to the backend

---

## CRITICAL ISSUES FOUND

### 1. 🔴 CRITICAL: Expo Go Incompatibility

**Problem:** The app is trying to use `expo-speech-recognition` which requires native code that Expo Go doesn't support.

**Evidence:**

- Package installed: `expo-speech-recognition@0.2.25`
- Plugin configured in `app.json`: `"plugins": ["expo-speech-recognition"]`
- VoiceService.js imports: `ExpoSpeechRecognitionModule` (native module)
- **Error:** Native modules cannot run in Expo Go

**Impact:**

- Voice commands completely non-functional
- Speech recognition fails silently
- No microphone access for voice control

**Fix Required:**

```bash
# Option 1: Local Development Build
npx expo prebuild --clean
npx expo run:android

# Option 2: EAS Build Service
eas build --profile development --platform android
# Then install the generated APK on device
```

---

### 2. 🔴 CRITICAL: MCP Backend Authentication Failure

**Problem:** The MCP backend server is rejecting all requests with "Invalid JWT" error.

**Evidence:**

```javascript
// AIVisionService.js is sending:
headers: {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
}

// Backend response:
{"code":401,"message":"Invalid JWT"}
```

**Impact:**

- AI vision analysis completely non-functional
- Cannot analyze camera frames
- No real-time defect detection
- Fallback to OpenAI not implemented

**Fix Required:**
The Supabase Edge Function at `/functions/v1/mcp-server` needs to:

1. Accept the anon key for authentication
2. Or use a different authentication method
3. Or provide a service key for the mobile app

---

### 3. 🟡 WARNING: Missing Error Handling

**Problem:** Services fail silently without user feedback.

**Evidence in VoiceService.js:**

- Line 72-78: Permission denied handled but no UI feedback
- Line 104-110: Voice recognition errors logged but not displayed

**Evidence in AIVisionService.js:**

- Line 84-96: API failures return generic error but no retry logic
- No fallback to direct OpenAI API when MCP fails

---

## CONFIGURATION AUDIT

### ✅ CORRECTLY CONFIGURED

1. **Android Permissions (AndroidManifest.xml)**

   - ✅ RECORD_AUDIO
   - ✅ CAMERA
   - ✅ ACCESS_FINE_LOCATION
   - ✅ INTERNET
   - ✅ Google speech service query

2. **iOS Permissions (app.json)**

   - ✅ NSCameraUsageDescription
   - ✅ NSMicrophoneUsageDescription
   - ✅ NSSpeechRecognitionUsageDescription
   - ✅ NSLocationWhenInUseUsageDescription

3. **Dependencies Installed**

   - ✅ All required packages present
   - ✅ Versions compatible

4. **Environment Variables**
   - ✅ All API keys defined in .env
   - ✅ Proper EXPO*PUBLIC* prefix

---

## MISSING COMPONENTS

### 1. Development Build

- **Missing:** Native Android/iOS builds
- **Required for:** expo-speech-recognition to function

### 2. Backend Authentication

- **Missing:** Proper JWT validation on MCP server
- **Required for:** AI vision analysis to work

### 3. Error Recovery

- **Missing:** Fallback mechanisms when services fail
- **Required for:** Reliability

---

## STEP-BY-STEP FIX INSTRUCTIONS

### IMMEDIATE FIXES (Do These First!)

#### Fix 1: Create Development Build

```bash
# Step 1: Clean and prebuild
cd C:\Projects\visinspection-mobile-app
npx expo prebuild --clean

# Step 2: Run on Android device/emulator
npx expo run:android

# OR use EAS Build (if you have EAS account)
eas build --profile development --platform android
```

#### Fix 2: Test MCP Backend

First, verify the backend is accessible:

```bash
# Test with correct headers
curl -X POST "https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server/call-tool" \
  -H "Content-Type: application/json" \
  -H "apikey: [YOUR_ANON_KEY]" \
  -H "Authorization: Bearer [YOUR_SERVICE_KEY]" \
  -d '{"name":"test","arguments":{}}'
```

If this fails, the backend needs to be fixed to:

1. Accept the anon key OR
2. Provide a service role key for the mobile app

#### Fix 3: Add Fallback to OpenAI

In `AIVisionService.js`, add after line 85:

```javascript
} catch (error) {
  console.error('MCP failed, trying OpenAI directly...');
  // Fallback to direct OpenAI API
  return this.analyzeWithOpenAI(imageUri, context);
}
```

### TESTING PROCEDURE

1. **Build & Install:**

   - Run development build
   - Install on physical Android device
   - Open with development client (NOT Expo Go)

2. **Test Voice:**

   - Grant microphone permission when prompted
   - Say "start" to begin inspection
   - Check console for voice recognition events

3. **Test AI Vision:**
   - Point camera at construction area
   - Wait 4 seconds for analysis
   - Check for narration/overlay

---

## PRIORITY ORDER OF FIXES

1. **🔴 IMMEDIATE:** Build development client (not Expo Go)
2. **🔴 IMMEDIATE:** Fix MCP backend authentication
3. **🟡 HIGH:** Add error handling and user feedback
4. **🟡 HIGH:** Implement OpenAI fallback
5. **🟢 MEDIUM:** Add retry logic for failed requests
6. **🟢 MEDIUM:** Add offline mode detection

---

## ROOT CAUSE ANALYSIS

The app was developed with native dependencies (expo-speech-recognition) but is being tested in Expo Go, which doesn't support native modules. Additionally, the MCP backend Edge Function has authentication misconfigured, rejecting valid Supabase anon keys.

**Why it worked before (if it did):**

- Possibly tested with a development build previously
- Backend authentication may have changed
- Could have been using a different auth token

**Why it's failing now:**

1. Running in Expo Go instead of dev build
2. Backend rejecting authentication
3. No fallback mechanisms

---

## VERIFICATION COMMANDS

Run these to verify fixes:

```bash
# Check if running in dev client
npx expo config --type introspect | grep developmentClient

# Test voice module
node -e "const sr = require('expo-speech-recognition'); console.log('Module loaded');"

# Test MCP connectivity
curl [MCP_URL] -H "Authorization: Bearer [TOKEN]"
```

---

## CONTACT FOR HELP

If the MCP backend cannot be fixed, consider:

1. Using OpenAI API directly (you have the key)
2. Deploying a simple Express server as proxy
3. Using Firebase Functions instead

**The app structure is solid, but it MUST run in a development build, not Expo Go!**

---

## FILES REQUIRING CHANGES

1. **No code changes needed** - Just build configuration
2. **Backend fix needed** at Supabase Edge Function
3. _Optional:_ Add error handling in VoiceService.js and AIVisionService.js

---

**Generated:** November 10, 2025
**Auditor:** Claude Code Assistant
