# Backend Edge Functions Inventory

**Date:** January 2025  
**Total Functions:** 5  
**Project:** `fnnwjnkttgnprwguwfnd`

---

## 📋 FUNCTIONS LIST

### ✅ Known Functions (2/5)

#### 1. **mcp-server**

- **Status:** ⚠️ **CRITICAL ISSUES**
- **URL:** `/functions/v1/mcp-server`
- **Used By:**
  - `services/McpClient.js`
  - `services/AIVisionService.js`
- **Endpoints:**
  - `POST /call-tool`
  - `GET /health`
- **Issues:**
  - Authentication not accepting anon key
  - Returns 401/403 errors
  - **Priority:** 🔴 **HIGHEST**

#### 2. **dpp-precheck**

- **Status:** ✅ **CODE RECEIVED - REVIEWED**
- **URL:** `/functions/v1/dpp-precheck`
- **Used By:**
  - `services/DppPrecheckService.js`
- **Purpose:** Honolulu DPP building code pre-check
- **Issues:**
  - 🔴 Missing authentication
  - 🔴 Missing request validation
  - 🔴 Missing environment variable checks
  - 🟡 Poor error handling
  - See `supabase/functions/dpp-precheck/REVIEW.md` for full review

---

### ✅ Known Functions (3/5)

#### 3. **design-analysis**

- **Status:** ✅ **CODE RECEIVED - REVIEWED**
- **URL:** `/functions/v1/design-analysis`
- **Used By:** Unknown (not in mobile app - may be web app)
- **Purpose:** Analyze renovation design intent from natural language
- **Issues:**
  - 🔴 Missing authentication
  - 🔴 Missing request validation
  - 🔴 Missing rate limiting
  - See `supabase/functions/design-analysis/REVIEW.md` for full review

### ✅ Known Functions (5/5)

#### 4. **realtime-token**

- **Status:** ✅ **CODE RECEIVED - REVIEWED & FIXED**
- **URL:** `/functions/v1/realtime-token`
- **Used By:** Unknown (likely web app or future feature)
- **Purpose:** Create OpenAI Realtime API sessions for voice inspection
- **Issues:**
  - 🔴 **FIXED:** Missing `parameters` field in tools (causing ERROR_BAD_REQUEST)
  - 🔴 Model name updated to stable version
  - 🟡 Missing request validation
  - See `supabase/functions/realtime-token/REVIEW.md` for full review

#### 5. **realtime-sdp**

- **Status:** ✅ **CODE RECEIVED - REVIEWED**
- **URL:** `/functions/v1/realtime-sdp`
- **Used By:** Unknown (works with realtime-token)
- **Purpose:** Handle SDP exchange for WebRTC connection to OpenAI Realtime API
- **Issues:**
  - ✅ Has authentication check
  - 🟡 Missing request validation
  - 🟡 No timeout on OpenAI request
  - See `supabase/functions/realtime-sdp/REVIEW.md` for full review

---

## 🔍 HOW TO IDENTIFY ALL FUNCTIONS

### Method 1: Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select project: `fnnwjnkttgnprwguwfnd`
3. Navigate to **Edge Functions**
4. List all 5 function names here

### Method 2: Supabase CLI

```bash
supabase functions list
```

This will show all deployed functions.

---

## 📝 REVIEW CHECKLIST FOR EACH FUNCTION

For each of the 5 functions, review:

### Authentication

- [ ] Accepts `SUPABASE_ANON_KEY` in headers
- [ ] Validates authentication properly
- [ ] Returns proper 401/403 errors
- [ ] No security vulnerabilities

### Request Validation

- [ ] Validates payload size
- [ ] Validates required fields
- [ ] Handles malformed requests
- [ ] Returns proper 400 errors

### Error Handling

- [ ] Consistent error response format
- [ ] Proper HTTP status codes
- [ ] Error messages are user-friendly
- [ ] Logs errors for debugging

### Performance

- [ ] Response time is acceptable
- [ ] No memory leaks
- [ ] Proper timeout handling
- [ ] Rate limiting implemented

### Documentation

- [ ] Function purpose is clear
- [ ] Request/response format documented
- [ ] Error codes documented
- [ ] Examples provided

---

## 🎯 PRIORITY ORDER FOR REVIEW

1. **🔴 mcp-server** - CRITICAL (authentication broken, blocks AI features)
2. **🟡 dpp-precheck** - HIGH (used in app)
3. **🟢 Function 3** - MEDIUM (needs identification)
4. **🟢 Function 4** - MEDIUM (needs identification)
5. **🟢 Function 5** - MEDIUM (needs identification)

---

## 📊 FUNCTION USAGE MAP

```
Frontend Code → Edge Functions
├── McpClient.js → mcp-server
├── AIVisionService.js → mcp-server
└── DppPrecheckService.js → dpp-precheck

Unknown:
├── [Service/Component] → [Function 3]
├── [Service/Component] → [Function 4]
└── [Service/Component] → [Function 5]
```

---

## 🔧 NEXT STEPS

1. **Identify all 5 functions:**

   - List function names
   - Document their purposes
   - Map which frontend code uses them

2. **Review mcp-server first:**

   - Fix authentication (highest priority)
   - Test all endpoints
   - Verify error handling

3. **Review remaining functions:**

   - Check authentication
   - Verify request/response formats
   - Test error scenarios

4. **Create comprehensive documentation:**
   - API documentation for each function
   - Request/response examples
   - Error code reference
   - Testing guide

---

## 💡 SUGGESTED FUNCTION NAMES

Based on app features, the other 3 functions might be:

- `report-generator` - PDF report generation
- `material-identifier` - Material identification service
- `code-lookup` - Building code lookup service
- `image-processor` - Image processing/optimization
- `notification-service` - Push notifications
- `analytics` - Usage analytics

**Please confirm the actual function names!**

---

**Generated:** January 2025  
**Status:** Awaiting function names and purposes
