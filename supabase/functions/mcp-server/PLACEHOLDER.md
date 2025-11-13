# mcp-server Function

**Status:** ⚠️ **CRITICAL - Authentication Issues**

## Purpose

MCP Server for AI vision analysis and tool invocation.

## Endpoints

- `POST /call-tool` - Main MCP tool invocation
- `GET /health` - Health check

## Known Issues

- Authentication not accepting SUPABASE_ANON_KEY
- Returns 401/403 errors
- Blocks all AI vision features

## Next Steps

1. Add `index.ts` (or `index.js`) file here with the function code
2. I will review and fix authentication issues
3. Add proper error handling and validation

---

**To add:** Copy the code from Supabase Dashboard → Edge Functions → mcp-server → View Source
