# ERROR_BAD_REQUEST Diagnostic Guide

**Error:** `ERROR_BAD_REQUEST`  
**Request ID:** `82d682d7-0498-4a15-b1f3-7a27cdbd402a`

---

## 🔍 WHAT THIS ERROR MEANS

**ERROR_BAD_REQUEST** means the request sent to the API is malformed or missing required parameters. This is typically from:

1. **OpenAI Realtime API** - Invalid session creation request
2. **Supabase Edge Function** - Invalid request format
3. **Missing required fields** - Required parameters not provided

---

## 🎯 MOST LIKELY CAUSES

### 1. **Invalid Model Name** (Most Common)

**Problem:** The model name in `realtime-token` might be incorrect or deprecated

**Current Code:**

```typescript
model: "gpt-4o-realtime-preview-2024-12-17";
```

**Possible Issues:**

- Model name might have changed
- Model might not be available in your OpenAI account
- Model might require different API version

**Fix:**

```typescript
// Try these model names:
model: "gpt-4o-realtime-preview-2024-10-01"; // Older version
// OR
model: "gpt-4o-realtime-preview"; // Without date
// OR check OpenAI dashboard for available models
```

---

### 2. **Missing Required Parameters**

**Problem:** Request body missing required fields

**Check if these are provided:**

- `projectId` - Required
- `inspectionType` - Required
- `projectName` - Optional but might be required
- `comments` - Optional

**Fix:**

```typescript
// In frontend, ensure all required fields are sent:
const response = await fetch(`${SUPABASE_URL}/functions/v1/realtime-token`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId: "required-project-id",
    inspectionType: "building", // or 'electrical', 'plumbing', etc.
    projectName: "Project Name", // Optional but recommended
    comments: "", // Optional
  }),
});
```

---

### 3. **Invalid Tools Array**

**Problem:** OpenAI might reject the tools definition

**Current Code:**

```typescript
tools: [
  {
    type: "function",
    name: "start_recording",
    description: "Start video recording of the inspection",
    // Missing parameters field!
  },
  // ...
];
```

**Fix:**

```typescript
tools: [
  {
    type: "function",
    name: "start_recording",
    description: "Start video recording of the inspection",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "stop_recording",
    description: "Stop the current video recording",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  // ... rest of tools
];
```

---

### 4. **Instructions Too Long**

**Problem:** Instructions might exceed OpenAI's limit

**Current:** Instructions can be very long with code references

**Fix:**

```typescript
// Limit instructions to ~4000 characters
const instructions =
  `You are a ${inspectionType.toUpperCase()} code inspector...`.slice(0, 4000);
```

---

### 5. **Invalid Modalities**

**Problem:** Modalities array might be invalid

**Current:**

```typescript
modalities: ["audio", "text"];
```

**Fix:**

```typescript
// Try just one modality first
modalities: ["text"]; // Remove audio if causing issues
// OR
modalities: ["audio"]; // Just audio
```

---

## 🔧 DEBUGGING STEPS

### Step 1: Check Request Payload

Add logging to see what's being sent:

```typescript
// In realtime-token function
console.log(
  "Request body:",
  JSON.stringify(
    {
      projectId,
      inspectionType,
      projectName,
      comments,
    },
    null,
    2
  )
);

console.log("Instructions length:", instructions.length);
console.log("Tools count:", tools.length);
```

### Step 2: Check OpenAI API Response

The error details should show what OpenAI rejected:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error("OpenAI API error:", response.status, errorText);
  // This will show the actual error from OpenAI
}
```

### Step 3: Validate Model Name

Check if model is available:

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY" | grep realtime
```

---

## 🛠️ QUICK FIXES TO TRY

### Fix 1: Update Model Name

```typescript
// Change from:
model: "gpt-4o-realtime-preview-2024-12-17";

// To:
model: "gpt-4o-realtime-preview-2024-10-01";
```

### Fix 2: Add Parameters to All Tools

```typescript
// Every tool needs parameters field, even if empty
{
  type: "function",
  name: "start_recording",
  description: "...",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
}
```

### Fix 3: Simplify Instructions

```typescript
// Reduce instructions length
const instructions =
  `You are a ${inspectionType} inspector. Check for code violations.`.slice(
    0,
    2000
  );
```

### Fix 4: Validate Input

```typescript
// Add validation
if (!projectId || !inspectionType) {
  return new Response(
    JSON.stringify({
      error: "projectId and inspectionType are required",
    }),
    { status: 400 }
  );
}
```

---

## 📋 CHECKLIST

- [ ] Model name is correct and available
- [ ] All required parameters are provided
- [ ] Tools array has proper structure (parameters field)
- [ ] Instructions are not too long
- [ ] Modalities are valid
- [ ] OpenAI API key is valid
- [ ] Request body is valid JSON
- [ ] Authorization header is present

---

## 🧪 TEST COMMAND

Test the function directly:

```bash
curl -X POST "https://fnnwjnkttgnprwguwfnd.supabase.co/functions/v1/realtime-token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectId": "test-project-id",
    "inspectionType": "building",
    "projectName": "Test Project"
  }'
```

---

## 💡 MOST LIKELY FIX

Based on the error format (`ERROR_BAD_REQUEST` with `isRetryable: false`), this is **most likely**:

1. **Invalid model name** - Try `gpt-4o-realtime-preview-2024-10-01`
2. **Missing parameters in tools** - Add `parameters` field to all tools
3. **Missing required fields** - Ensure `projectId` and `inspectionType` are provided

---

**Next Steps:**

1. Check the console logs for the actual OpenAI error message
2. Try updating the model name
3. Add parameters to all tools
4. Test with simplified request

---

**Generated:** January 2025  
**Reviewer:** AI Code Assistant
