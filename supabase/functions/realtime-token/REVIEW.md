# realtime-token Function Review

**Status:** ✅ Code Received  
**Date:** January 2025  
**Priority:** 🔴 **CRITICAL** - ERROR_BAD_REQUEST Issue

---

## 🔍 FUNCTION OVERVIEW

**Purpose:** Create OpenAI Realtime API sessions for voice-controlled inspection

**Endpoint:** `POST /invoke` (via Supabase functions.invoke)

**Used By:** Unknown (likely web app or future mobile feature)

---

## 🔴 CRITICAL ISSUE: ERROR_BAD_REQUEST

### **Root Cause: Missing `parameters` Field in Tools**

**Problem:** `start_recording` and `stop_recording` tools are missing the `parameters` field, which OpenAI requires for all function tools.

**Current Code (BROKEN):**

```typescript
tools: [
  {
    type: "function",
    name: "start_recording",
    description: "Start video recording of the inspection"
    // ❌ Missing parameters field!
  },
  {
    type: "function",
    name: "stop_recording",
    description: "Stop the current video recording"
    // ❌ Missing parameters field!
  },
```

**Fixed Code:**

```typescript
tools: [
  {
    type: "function",
    name: "start_recording",
    description: "Start video recording of the inspection",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    type: "function",
    name: "stop_recording",
    description: "Stop the current video recording",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
```

---

## 🔴 OTHER CRITICAL ISSUES

### 1. **Model Name May Be Invalid**

**Problem:** Model `gpt-4o-realtime-preview-2024-12-17` might not exist or be available

**Current:**

```typescript
model: "gpt-4o-realtime-preview-2024-12-17";
```

**Fix:**

```typescript
// Try stable version first
model: "gpt-4o-realtime-preview-2024-10-01";

// OR check available models:
// curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_KEY"
```

---

### 2. **Missing Request Validation**

**Problem:** No validation of required fields

**Fix:**

```typescript
const { projectId, inspectionType, projectName, comments } = await req.json();

// Validate required fields
if (!projectId || typeof projectId !== "string") {
  return new Response(
    JSON.stringify({
      error: "projectId is required and must be a string",
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

if (!inspectionType || typeof inspectionType !== "string") {
  return new Response(
    JSON.stringify({
      error: "inspectionType is required and must be a string",
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

const validInspectionTypes = [
  "building",
  "electrical",
  "plumbing",
  "hvac",
  "fire",
];
if (!validInspectionTypes.includes(inspectionType.toLowerCase())) {
  return new Response(
    JSON.stringify({
      error: `inspectionType must be one of: ${validInspectionTypes.join(
        ", "
      )}`,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
```

---

### 3. **Instructions May Be Too Long**

**Problem:** Instructions can exceed OpenAI's limits with long code references

**Fix:**

```typescript
// Limit instructions length
const MAX_INSTRUCTIONS_LENGTH = 4000;
let instructions = `You are a ${inspectionType.toUpperCase()} code inspector...`;

if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
  instructions = instructions.slice(0, MAX_INSTRUCTIONS_LENGTH - 100) + "...";
  console.warn(
    "Instructions truncated to",
    MAX_INSTRUCTIONS_LENGTH,
    "characters"
  );
}
```

---

### 4. **No Error Details in Response**

**Problem:** OpenAI error details not fully captured

**Current:**

```typescript
const errorText = await response.text();
console.error("OpenAI API error:", response.status, errorText);
```

**Fix:**

```typescript
let errorDetails;
try {
  errorDetails = await response.json();
} catch {
  errorDetails = { message: await response.text() };
}

console.error("OpenAI API error:", {
  status: response.status,
  statusText: response.statusText,
  error: errorDetails,
});

return new Response(
  JSON.stringify({
    error: "Failed to create realtime session",
    status: response.status,
    details: errorDetails,
    requestId: crypto.randomUUID(),
  }),
  {
    status: response.status >= 500 ? 502 : response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  }
);
```

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **Database Query May Fail Silently**

**Problem:** If project query fails, function continues with empty rules

**Current:**

```typescript
const { data: project } = await supabase.from('projects')...
// No error handling if query fails
```

**Fix:**

```typescript
const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("code_pack_id, work_description, jurisdictions(name), scopes(name)")
  .eq("id", projectId)
  .single();

if (projectError) {
  console.error("Project query error:", projectError);
  // Continue without project data, but log the error
}
```

---

### 6. **No Timeout on OpenAI Request**

**Problem:** Request can hang indefinitely

**Fix:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    // ... headers
    body: JSON.stringify({...}),
    signal: controller.signal
  });

  clearTimeout(timeoutId);
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

## 📊 SUMMARY

**Total Issues:** 6

- 🔴 Critical: 4 (including ERROR_BAD_REQUEST fix)
- 🟡 High Priority: 2

**Most Critical:** Missing `parameters` field in tools - this is causing ERROR_BAD_REQUEST!

---

## ✅ FIXED VERSION

The function has been updated with:

1. ✅ Added `parameters` field to `start_recording` and `stop_recording` tools
2. ✅ Updated model name to stable version
3. ⚠️ Still needs: Request validation, error handling improvements

---

**Generated:** January 2025  
**Reviewer:** AI Code Assistant
