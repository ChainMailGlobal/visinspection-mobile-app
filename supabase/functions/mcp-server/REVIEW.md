# mcp-server Function Review

**Status:** ✅ Code Received  
**Date:** January 2025  
**Priority:** 🔴 **CRITICAL** - Authentication Issues Blocking All Features

---

## 🔍 FUNCTION OVERVIEW

**Purpose:** MCP Server providing 17 tools for construction inspection and analysis

**Endpoints:**

- `POST /call-tool` - Execute MCP tools
- `GET /health` - Health check
- `GET /list-tools` - List available tools

**Used By:**

- `services/McpClient.js` - `analyzeLiveInspection()`, `health()`
- `services/AIVisionService.js` - `analyzeFrame()`, `analyzePlan()`, `identifyMaterial()`

**Tools Provided:** 17 tools including:

- `analyze_live_inspection` (CRITICAL - used by mobile app)
- `analyze_photo`
- `capture_violation`
- `get_design_analysis`
- And 13 more...

---

## 🔴 CRITICAL ISSUES

### 1. **NO AUTHENTICATION** ⚠️⚠️⚠️

**Problem:** Function accepts requests WITHOUT any authentication check

**Current Code:**

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // NO AUTHENTICATION CHECK HERE!
  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // ... continues without checking auth
```

**Impact:**

- **ANYONE can call this function** - major security risk
- Frontend sends `SUPABASE_ANON_KEY` but backend doesn't check it
- This is why mobile app gets 401 errors - backend rejects anon key OR doesn't validate it properly
- **BLOCKS ALL AI VISION FEATURES**

**Fix Required:**

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ADD AUTHENTICATION CHECK
  const apiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Accept anon key OR service key
  const isValidKey =
    apiKey === SUPABASE_ANON_KEY ||
    apiKey === SUPABASE_SERVICE_KEY ||
    authHeader === `Bearer ${SUPABASE_ANON_KEY}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`;

  if (!isValidKey) {
    return new Response(
      JSON.stringify({
        error: 'Invalid authentication',
        code: 'AUTH_FAILED'
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Continue with request...
```

---

### 2. **Missing Environment Variable Validation**

**Problem:** No check if required env vars exist before use

**Current:**

```typescript
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
// Used later without checking if they exist
```

**Fix:**

```typescript
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Validate on startup
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY not set");
}
if (!GOOGLE_AI_API_KEY) {
  console.error("GOOGLE_AI_API_KEY not set");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing");
}
```

---

### 3. **No Request Validation**

**Problem:** No validation of request payload size or structure

**Fix:**

```typescript
// Validate payload size (max 10MB for images)
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;
const body = await req.text();
if (body.length > MAX_PAYLOAD_SIZE) {
  return new Response(JSON.stringify({ error: "Payload too large" }), {
    status: 413,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const payload = JSON.parse(body);
const { name, arguments: args } = payload;

// Validate required fields
if (!name) {
  return new Response(JSON.stringify({ error: "Tool name is required" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### 4. **No Rate Limiting**

**Problem:** Can be called unlimited times - expensive OpenAI/Gemini calls

**Fix:**

```typescript
// Simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const clientId =
  req.headers.get("x-client-id") ||
  req.headers.get("authorization")?.split(" ")[1] ||
  "anonymous";
const now = Date.now();
const limit = rateLimiter.get(clientId);

if (limit && limit.resetAt > now) {
  if (limit.count > 100) {
    // 100 requests per minute
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    });
  }
  limit.count++;
} else {
  rateLimiter.set(clientId, { count: 1, resetAt: now + 60000 });
}
```

---

### 5. **Poor Error Handling in OpenAI Calls**

**Problem:** No timeout, no retry, generic error messages

**Current:**

```typescript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  // No timeout, no error handling
});
```

**Fix:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({...}),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error('OpenAI API rate limit exceeded');
    } else if (response.status === 401) {
      throw new Error('OpenAI API authentication failed');
    }
    throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  // ... rest of code
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('OpenAI API request timed out');
  }
  throw error;
}
```

---

## 🟡 HIGH PRIORITY ISSUES

### 6. **analyze_live_inspection Response Format Mismatch**

**Problem:** Returns different format than frontend expects

**Backend Returns:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"violations\": [...], \"summary\": \"...\"}"
    }
  ]
}
```

**Frontend Expects (from McpClient.js):**

```json
{
  "overlays": [...],
  "narration": "..."
}
```

**Fix:** Update `analyzeLiveInspection` to return format matching frontend:

```typescript
// Convert violations to overlays format
const overlays = (analysisData.violations || []).map((v, idx) => ({
  id: v.id || `vio_${Date.now()}_${idx}`,
  text: v.issue,
  description: v.issue,
  severity: v.severity,
  code_reference: v.code,
  code: v.code,
  x: v.coordinates?.x || 0.1,
  y: v.coordinates?.y || 0.6 + idx * 0.1,
}));

return {
  content: [
    {
      type: "text",
      text: JSON.stringify(
        {
          overlays,
          narration: analysisData.summary || "No violations detected",
          violations: analysisData.violations || [],
        },
        null,
        2
      ),
    },
  ],
};
```

---

### 7. **No Request ID for Tracing**

**Problem:** Hard to trace requests in logs

**Fix:**

```typescript
const requestId = crypto.randomUUID();
console.log(`[${requestId}] Tool call: ${name}`, args);

// Include in response
return new Response(JSON.stringify({
  ...result,
  requestId
}), {...});
```

---

### 8. **Missing Input Sanitization**

**Problem:** User input not sanitized before sending to AI

**Fix:**

```typescript
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove HTML
    .slice(0, 10000) // Limit length
    .trim();
}
```

---

### 9. **Health Check Too Simple**

**Problem:** Only returns static status, doesn't check actual health

**Current:**

```typescript
if (url.pathname === '/health') {
  return new Response(JSON.stringify({
    status: 'ok',
    server: 'visinspection-mcp',
    version: '1.0.0'
  }), {...});
}
```

**Fix:**

```typescript
if (url.pathname === "/health") {
  const health = {
    status: "ok",
    server: "visinspection-mcp",
    version: "1.0.0",
    services: {
      openai: OPENAI_API_KEY ? "configured" : "missing",
      google_ai: GOOGLE_AI_API_KEY ? "configured" : "missing",
      supabase: SUPABASE_URL ? "configured" : "missing",
    },
    timestamp: new Date().toISOString(),
  };

  const allHealthy = Object.values(health.services).every(
    (s) => s === "configured"
  );

  return new Response(JSON.stringify(health), {
    status: allHealthy ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

## 🟢 MEDIUM PRIORITY ISSUES

### 10. **CORS Allows All Origins**

- Should restrict to specific domains in production

### 11. **No Request Deduplication**

- Same request can be processed multiple times

### 12. **Large Base64 Images in Memory**

- Should use Supabase Storage for large images

### 13. **No Caching**

- Same image analyzed multiple times

---

## 📊 SUMMARY

**Total Issues:** 13

- 🔴 Critical: 5
- 🟡 High Priority: 4
- 🟢 Medium Priority: 4

**Most Critical:** Authentication missing - this is why mobile app fails!

---

## ✅ FIXED VERSION

I'll create a fixed version with all critical issues resolved. Should I proceed?

---

**Generated:** January 2025  
**Reviewer:** AI Code Assistant
