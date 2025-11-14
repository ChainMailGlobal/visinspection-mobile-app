# DEBUG PLAN: Live AI Crash Fix

## Problem
- Component crashes immediately on mount
- ErrorBoundary catches it, showing "Something Went Wrong"
- Expected flow never executes:
  1. Permission check → Permission screen
  2. Inspection type picker modal
  3. Camera view
  4. Real-time AI scanning
  5. Violation capture

## Root Cause Analysis Needed

### Step 1: Add Comprehensive Error Logging
- Wrap entire component in try-catch
- Log error with full stack trace
- Log at each stage: mount, permissions, render
- Capture which line fails

### Step 2: Check Critical Dependencies
- Verify all imports are available
- Check VoiceService, AIVisionService, health() function
- Verify Camera and Location modules are loaded
- Check if MaterialIcons is available

### Step 3: Permission Hook Safety
- Camera.useCameraPermissions() might throw
- Location.useForegroundPermissions() might throw
- Need defensive handling

### Step 4: State Initialization
- Check if useState hooks are working
- Verify refs are initialized
- Check if route.params is undefined

### Step 5: Render Safety
- Modal might crash if showTypePicker is undefined
- Camera component might crash if ref is wrong
- Styles might be missing

## Implementation Steps

1. **Add Error Logger Service**
   - Create DebugLogger that captures errors
   - Logs to console AND stores in state for display
   - Shows error details in dev mode

2. **Wrap Component in Error Handler**
   - Try-catch around entire render
   - Fallback UI if error occurs
   - Show error message instead of crashing

3. **Add Null Checks**
   - Check all services before use
   - Verify imports are loaded
   - Check route.params exists

4. **Add Stage Logging**
   - Log: "Component mounting"
   - Log: "Checking permissions"
   - Log: "Rendering permission screen" or "Rendering camera"
   - Log: "Modal state: X"

5. **Test Each Stage**
   - Test with permissions granted
   - Test with permissions denied
   - Test with no projectId
   - Test with projectId

## Expected Outcome
- Component loads without crashing
- Error messages show what failed (if anything)
- User sees permission screen → picker → camera
- Real-time AI works

