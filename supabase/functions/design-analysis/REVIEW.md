# design-analysis Function Review

**Status:** ✅ Code Received  
**Date:** January 2025

---

## 🔍 FUNCTION OVERVIEW

**Purpose:** Analyze renovation design intent from natural language and return feasibility analysis

**Endpoint:** `POST /analyze-design`

**Used By:** Unknown (not found in frontend code - may be used by web app or future feature)

---

## ✅ STRENGTHS

1. **Well-structured code** - Clear separation of concerns
2. **Comprehensive analysis** - Covers compliance, permits, costs, timeline
3. **Good error handling** - Try-catch blocks in place
4. **CORS support** - Proper CORS headers for web access
5. **Detailed logging** - Good console.log statements for debugging

---

## 🔴 CRITICAL ISSUES

### 1. **Missing Authentication** ⚠️

**Problem:** No authentication check - anyone can call this function

**Current Code:**

```typescript
serve(async (req) => {
  // No auth check!
  const { userInput, context } = await req.json();
```

**Fix Required:**

```typescript
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  // ADD AUTHENTICATION CHECK
  const apiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const isValidKey =
    apiKey === SUPABASE_ANON_KEY ||
    apiKey === SUPABASE_SERVICE_KEY ||
    authHeader === `Bearer ${SUPABASE_ANON_KEY}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`;

  if (!isValidKey) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  // Continue with request...
```

---

### 2. **Missing Request Validation**

**Problem:** No validation of payload size or structure

**Fix Required:**

```typescript
// Validate payload size (max 1MB for text input)
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
const body = await req.text();
if (body.length > MAX_PAYLOAD_SIZE) {
  return new Response(JSON.stringify({ error: "Payload too large" }), {
    status: 413,
    headers: { "Content-Type": "application/json" },
  });
}

const payload = JSON.parse(body);
const { userInput, context } = payload;

// Validate userInput
if (!userInput || typeof userInput !== "string") {
  return new Response(
    JSON.stringify({ error: "userInput must be a non-empty string" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

if (userInput.length > 5000) {
  return new Response(
    JSON.stringify({ error: "userInput too long (max 5000 characters)" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
```

---

### 3. **Missing Environment Variable Validation**

**Problem:** No check if required env vars exist

**Fix Required:**

```typescript
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Validate environment variables
if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}
if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL environment variable is required");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
}
```

---

### 4. **No Rate Limiting**

**Problem:** Can be called unlimited times, expensive OpenAI calls

**Fix Required:**

```typescript
// Simple in-memory rate limiter (use Redis in production)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const clientId =
  req.headers.get("x-client-id") ||
  req.headers.get("authorization")?.split(" ")[1] ||
  "anonymous";
const now = Date.now();
const limit = rateLimiter.get(clientId);

if (limit && limit.resetAt > now) {
  if (limit.count > 10) {
    // 10 requests per minute
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
  limit.count++;
} else {
  rateLimiter.set(clientId, { count: 1, resetAt: now + 60000 });
}
```

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **OpenAI API Error Handling**

**Problem:** Generic error messages, no retry logic

**Current:**

```typescript
if (!data.choices || data.choices.length === 0) {
  throw new Error(`OpenAI API error: ${JSON.stringify(data)}`);
}
```

**Fix:**

```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error("OpenAI API error:", response.status, errorData);

  if (response.status === 429) {
    throw new Error("OpenAI API rate limit exceeded. Please try again later.");
  } else if (response.status === 401) {
    throw new Error("OpenAI API authentication failed. Check API key.");
  } else if (response.status >= 500) {
    throw new Error(
      "OpenAI API service temporarily unavailable. Please try again."
    );
  }
  throw new Error(
    `OpenAI API error: ${errorData.error?.message || "Unknown error"}`
  );
}

const data = await response.json();

if (!data.choices || data.choices.length === 0) {
  throw new Error(`OpenAI API returned no choices: ${JSON.stringify(data)}`);
}
```

---

### 6. **No Timeout on OpenAI Request**

**Problem:** OpenAI request can hang indefinitely

**Fix:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
  // ... rest of code
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('OpenAI API request timed out. Please try again.');
  }
  throw error;
}
```

---

### 7. **Database RPC Error Handling**

**Problem:** Errors are logged but not properly handled

**Current:**

```typescript
if (error) {
  console.error('Compliance check error:', error);
  return { checks: [], ... }; // Returns empty but continues
}
```

**Fix:**

```typescript
if (error) {
  console.error("Compliance check error:", error);
  // Return partial result but log the issue
  return {
    checks: [],
    passedCount: 0,
    failedCount: 0,
    warningCount: 0,
    overallStatus: "unknown", // Changed from 'warnings'
    error: "Compliance check service unavailable",
  };
}
```

---

## 🟢 MEDIUM PRIORITY ISSUES

### 8. **No Request ID for Tracing**

**Problem:** Hard to trace requests in logs

**Fix:**

```typescript
const requestId = crypto.randomUUID();
console.log(`[${requestId}] Analyzing design:`, userInput);

// Include in response
return new Response(JSON.stringify({
  success: true,
  requestId,
  analysis
}), {...});
```

---

### 9. **CORS Origin Should Be Restricted**

**Problem:** Allows all origins (`*`)

**Fix:**

```typescript
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || ["*"];
const origin = req.headers.get("origin");

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin || "")
    ? origin
    : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

---

### 10. **Missing Input Sanitization**

**Problem:** No sanitization of user input before sending to OpenAI

**Fix:**

```typescript
function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  return input
    .replace(/[<>]/g, "") // Remove HTML tags
    .slice(0, 5000) // Limit length
    .trim();
}

const sanitizedInput = sanitizeInput(userInput);
```

---

## 📊 SUMMARY

**Total Issues:** 10

- 🔴 Critical: 4
- 🟡 High Priority: 3
- 🟢 Medium Priority: 3

**Estimated Impact:**

- Adding authentication: Prevents unauthorized access
- Adding validation: Prevents crashes and errors
- Adding rate limiting: Prevents abuse and cost overruns
- Improving error handling: Better user experience

---

## ✅ RECOMMENDED FIXES ORDER

1. **Add authentication** (Critical)
2. **Add request validation** (Critical)
3. **Add environment variable checks** (Critical)
4. **Add rate limiting** (High)
5. **Improve OpenAI error handling** (High)
6. **Add timeout to OpenAI requests** (High)
7. **Add request ID for tracing** (Medium)
8. **Restrict CORS origins** (Medium)
9. **Add input sanitization** (Medium)

---

**Next Steps:**

1. Review this analysis
2. Apply fixes in priority order
3. Test each fix
4. Deploy to staging
5. Monitor for issues

---

**Generated:** January 2025  
**Reviewer:** AI Code Assistant
