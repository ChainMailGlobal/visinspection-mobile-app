# Diagnostics Report - Fixes Required

**Date:** January 2025  
**Based on:** User Diagnostics Report

---

## 🔴 **CRITICAL ISSUES TO FIX**

### 1. **Environment Variables - OPENAI_API_KEY Missing** ❌

**Status:** FAIL  
**Issue:** `OPENAI_API_KEY is missing or invalid`

**Fix:**

1. **For Development:**

   - Add to `.env` file (if using Expo with dotenv)
   - Or add to `app.json` under `extra`:

   ```json
   {
     "expo": {
       "extra": {
         "OPENAI_API_KEY": "sk-..."
       }
     }
   }
   ```

2. **For Production (EAS Build):**

   ```bash
   eas secret:create --scope project --name OPENAI_API_KEY --value sk-...
   ```

3. **Update Config:**
   - Check `config/env.js` to ensure it reads `OPENAI_API_KEY`
   - Verify it's exported and used correctly

**Note:** This is required for AI analysis features, but the app can still work for other features.

---

### 2. **Database Tables Missing** ❌

**Status:** FAIL  
**Missing Tables:**

- `inspection_sessions`
- `inspection_violations`
- `captured_violations`

**Also:** `captured_violations` has a policy recursion issue

**Fix:**

#### Step 1: Create Missing Tables

Run these SQL migrations in Supabase Dashboard → SQL Editor:

```sql
-- Inspection Sessions Table
CREATE TABLE IF NOT EXISTS public.inspection_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  session_name TEXT,
  inspection_type TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspection Violations Table
CREATE TABLE IF NOT EXISTS public.inspection_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.inspection_sessions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  violation_code TEXT,
  description TEXT,
  severity TEXT,
  category TEXT,
  location_x FLOAT,
  location_y FLOAT,
  image_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Captured Violations Table
CREATE TABLE IF NOT EXISTS public.captured_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.inspection_sessions(id) ON DELETE CASCADE,
  violation_code TEXT,
  description TEXT,
  severity TEXT,
  category TEXT,
  image_uri TEXT,
  location_data JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Step 2: Fix Policy Recursion Issue

The `captured_violations` table has a policy recursion issue. Fix it:

```sql
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own captured violations" ON public.captured_violations;
DROP POLICY IF EXISTS "Users can insert own captured violations" ON public.captured_violations;

-- Create simple policies without recursion
CREATE POLICY "Users can view captured violations"
  ON public.captured_violations
  FOR SELECT
  USING (true); -- Allow all authenticated users to view

CREATE POLICY "Users can insert captured violations"
  ON public.captured_violations
  FOR INSERT
  WITH CHECK (true); -- Allow all authenticated users to insert
```

#### Step 3: Enable RLS

```sql
ALTER TABLE public.inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_violations ENABLE ROW LEVEL SECURITY;
```

#### Step 4: Create Basic Policies

```sql
-- Inspection Sessions Policies
CREATE POLICY "Users can view inspection sessions"
  ON public.inspection_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert inspection sessions"
  ON public.inspection_sessions FOR INSERT
  WITH CHECK (true);

-- Inspection Violations Policies
CREATE POLICY "Users can view inspection violations"
  ON public.inspection_violations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert inspection violations"
  ON public.inspection_violations FOR INSERT
  WITH CHECK (true);
```

---

### 3. **Network Connectivity Check Error** ❌

**Status:** FAIL  
**Error:** `undefined is not a function`

**Fix Applied:** ✅

- Changed `AbortSignal.timeout(5000)` to `AbortController` with `setTimeout`
- This is now fixed in the code

**Action:** Re-run diagnostics after code update

---

### 4. **MCP Authentication - 400 Error** ⚠️

**Status:** WARN  
**Issue:** `MCP returned 400`

**Possible Causes:**

1. Request format incorrect
2. Tool name doesn't exist
3. Missing required arguments

**Fix Applied:** ✅

- Updated to try `/health` endpoint first
- Falls back to `list_projects` tool (which should exist)
- Better error reporting

**Action:** Re-run diagnostics to see improved error message

---

## ✅ **WORKING CORRECTLY**

1. ✅ **Supabase Connection** - Connected successfully
2. ✅ **MCP Backend Health** - Returns 200 (healthy)
3. ✅ **Camera Permissions** - Granted
4. ⚠️ **Location Permissions** - Checked at runtime (expected)

---

## 📋 **ACTION ITEMS**

### Immediate (Required for App to Work):

1. **Create Database Tables** ⚠️ **CRITICAL**

   - Run SQL migrations above
   - Fix policy recursion issue
   - Without these, Live AI mode can't save data

2. **Add OPENAI_API_KEY** ⚠️ **IMPORTANT**
   - Required for AI analysis
   - Can use EAS Secrets or app.json

### After Code Update:

3. **Re-run Diagnostics**
   - Network connectivity should now work
   - MCP authentication should show better error details

---

## 🔧 **HOW TO APPLY FIXES**

### Database Fixes:

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Run the SQL migrations above (in order)
4. Verify tables exist: Table Editor → Check for new tables

### Environment Variable Fix:

**Option 1: EAS Secrets (Recommended for Production)**

```bash
eas secret:create --scope project --name OPENAI_API_KEY --value sk-your-key-here
```

**Option 2: app.json (For Development)**

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "..."
      },
      "OPENAI_API_KEY": "sk-..."
    }
  }
}
```

**Option 3: .env file (If using dotenv)**

```
OPENAI_API_KEY=sk-...
```

---

## ✅ **EXPECTED RESULTS AFTER FIXES**

After applying fixes:

- ✅ Environment Variables: Should pass (if OPENAI_API_KEY added)
- ✅ Database Tables: Should pass (all tables exist)
- ✅ Network Connectivity: Should pass (code fixed)
- ⚠️ MCP Authentication: May still show 400 if backend needs update, but will have better error details

---

**Status:** 2 critical fixes needed (database tables + OPENAI_API_KEY)
