# Backend Code Location Guide

**Date:** January 2025  
**Backend Type:** Supabase Edge Functions (5 total)

---

## 🔍 WHERE IS THE BACKEND CODE?

The backend code is **NOT in this repository**. There are **5 Supabase Edge Functions** that need to be accessed through one of these methods:

### Option 1: Supabase Dashboard (Easiest)

1. Go to https://supabase.com/dashboard
2. Select your project: `fnnwjnkttgnprwguwfnd`
3. Navigate to **Edge Functions** in the left sidebar
4. You should see **5 functions** listed
5. Click on each function to view/edit the source code

### Option 2: Supabase CLI (Recommended for Development)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref fnnwjnkttgnprwguwfnd

# Pull all function code locally
supabase functions pull mcp-server
supabase functions pull dpp-precheck
supabase functions pull [function-3-name]
supabase functions pull [function-4-name]
supabase functions pull [function-5-name]

# This will create: supabase/functions/[function-name]/
```

### Option 3: Check if Backend Repo Exists

The backend might be in a separate repository. Check:

- Your GitHub/GitLab organizations
- Look for repos named: `visinspection-backend`, `mcp-server`, `supabase-functions`
- Check with your team members

---

## 📁 EXPECTED BACKEND STRUCTURE

If you pull all functions, it should look like:

```
supabase/
  functions/
    mcp-server/
      index.ts (or index.js)
      deno.json (if using Deno)
      README.md
    dpp-precheck/
      index.ts
      deno.json
    [function-3-name]/
      index.ts
    [function-4-name]/
      index.ts
    [function-5-name]/
      index.ts
```

---

## 🔧 ALL 5 EDGE FUNCTIONS TO REVIEW

Based on frontend code analysis, here are the functions we know about:

### 1. **mcp-server** (MCP Server)

**URL:** `https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server`

**Used By:**

- `services/McpClient.js` - `analyzeLiveInspection()`, `health()`
- `services/AIVisionService.js` - `analyzeFrame()`, `analyzePlan()`, `identifyMaterial()`

**Endpoints:**

- `POST /call-tool` - Main MCP tool invocation
- `GET /health` - Health check

**Request Format:**

```javascript
POST /call-tool
Headers:
  Content-Type: application/json
  apikey: SUPABASE_ANON_KEY
  Authorization: Bearer SUPABASE_ANON_KEY

Body:
{
  "name": "analyze_live_inspection" | "analyze_photo",
  "arguments": { ... }
}
```

**Status:** ⚠️ **CRITICAL** - Authentication issues reported

---

### 2. **dpp-precheck** (DPP Pre-Check)

**URL:** `https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/dpp-precheck`

**Used By:**

- `services/DppPrecheckService.js` - `runDppPrecheck()`

**Request Format:**

```javascript
POST /invoke
Body:
{
  "imageUrl": "...",
  "projectType": "residential"
}
```

**Purpose:** Honolulu DPP building code pre-check with citations

**Status:** ✅ Referenced in code

---

### 3. **[Function 3 Name]**

**Status:** ❓ **Unknown** - Please provide name and purpose

---

### 4. **[Function 4 Name]**

**Status:** ❓ **Unknown** - Please provide name and purpose

---

### 5. **[Function 5 Name]**

**Status:** ❓ **Unknown** - Please provide name and purpose

---

## 🔴 CRITICAL BACKEND ISSUES TO FIX

Once you access the backend code, fix these issues:

### 1. Authentication (Most Critical)

**Current Problem:** Backend rejects `SUPABASE_ANON_KEY`

**Fix Needed:**

```typescript
// supabase/functions/mcp-server/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const apiKey = req.headers.get("apikey");
  const authHeader = req.headers.get("authorization");

  // Get environment variables
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Accept anon key OR service key
  const isValidKey =
    apiKey === SUPABASE_ANON_KEY ||
    apiKey === SUPABASE_SERVICE_KEY ||
    authHeader === `Bearer ${SUPABASE_ANON_KEY}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`;

  if (!isValidKey) {
    return new Response(JSON.stringify({ error: "Invalid authentication" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Continue with request...
});
```

### 2. Request Validation

```typescript
// Validate payload size
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const body = await req.text();
if (body.length > MAX_PAYLOAD_SIZE) {
  return new Response(JSON.stringify({ error: "Payload too large" }), {
    status: 413,
  });
}

// Validate required fields
const payload = JSON.parse(body);
if (!payload.name || !payload.arguments) {
  return new Response(JSON.stringify({ error: "Invalid request format" }), {
    status: 400,
  });
}
```

### 3. Rate Limiting

```typescript
// Simple in-memory rate limiter (use Redis in production)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const clientId = req.headers.get("x-client-id") || "unknown";
const now = Date.now();
const limit = rateLimiter.get(clientId);

if (limit && limit.resetAt > now) {
  if (limit.count > 100) {
    // 100 requests per minute
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
    });
  }
  limit.count++;
} else {
  rateLimiter.set(clientId, { count: 1, resetAt: now + 60000 });
}
```

---

## 📝 HOW TO ACCESS BACKEND CODE

### Step-by-Step: Supabase Dashboard

1. **Login to Supabase:**

   - Go to https://supabase.com/dashboard
   - Sign in with your account

2. **Select Project:**

   - Find project: `fnnwjnkttgnprwguwfnd`
   - Or look for project name containing "visinspection" or "vision"

3. **Navigate to Edge Functions:**

   - Left sidebar → **Edge Functions**
   - You should see **5 functions** listed:
     - `mcp-server`
     - `dpp-precheck`
     - `[function-3]`
     - `[function-4]`
     - `[function-5]`

4. **View/Edit Code:**

   - Click on each function name
   - Click **Edit Function** or **View Source**
   - You'll see the TypeScript/JavaScript code for each

5. **Deploy Changes:**
   - Make your changes
   - Click **Deploy** or use CLI: `supabase functions deploy [function-name]`

### Step-by-Step: Supabase CLI

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Initialize (if starting fresh)
supabase init

# 4. Link to existing project
supabase link --project-ref fnnwjnkttgnprwguwfnd

# 5. Pull all functions
supabase functions pull mcp-server
supabase functions pull dpp-precheck
supabase functions pull [function-3-name]
supabase functions pull [function-4-name]
supabase functions pull [function-5-name]

# 6. Edit code in: supabase/functions/[function-name]/index.ts

# 7. Deploy changes
supabase functions deploy mcp-server
supabase functions deploy dpp-precheck
# ... deploy others as needed
```

---

## 🧪 TESTING BACKEND CHANGES

### Test Authentication Fix:

```bash
curl -X POST "https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/mcp-server/call-tool" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "name": "analyze_live_inspection",
    "arguments": {
      "imageUrl": "data:image/jpeg;base64,/9j/4AAQ...",
      "projectId": "test",
      "projectName": "Test Project"
    }
  }'
```

**Expected:** Should return 200 OK, not 401 Unauthorized

---

## 📚 ADDITIONAL RESOURCES

- **Supabase Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **Deno Runtime Docs:** https://deno.land/manual
- **MCP Protocol:** Check your MCP implementation docs

---

## ⚠️ IMPORTANT NOTES

1. **Backend code is separate** from this mobile app repository
2. **Changes require deployment** - edit → deploy → test
3. **Environment variables** are set in Supabase Dashboard → Settings → Edge Functions
4. **Logs** are available in Supabase Dashboard → Edge Functions → Logs

---

**Next Steps:**

1. Access backend code using one of the methods above
2. Review the authentication logic
3. Fix authentication to accept anon key
4. Deploy and test
5. Share backend code for full review if needed

---

**Generated:** January 2025  
**Reviewer:** AI Code Assistant
