# Diagnostics Tool Guide

**Created:** January 2025  
**Purpose:** Help identify why Live AI mode won't launch

---

## 🚀 **HOW TO USE**

### Access Diagnostics

1. **From Home Screen:**
   - Tap "Run Diagnostics" button in Quick Actions

2. **Or Navigate Directly:**
   - Add to navigation: `navigation.navigate('Diagnostics')`

---

## 🔍 **WHAT IT CHECKS**

The diagnostics tool automatically checks:

1. **Environment Variables** ✅
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - MCP_URL
   - OPENAI_API_KEY

2. **Supabase Connection** ✅
   - Can connect to database
   - Can query `projects` table

3. **MCP Backend Health** ✅
   - Backend is reachable
   - Returns 200 status

4. **MCP Authentication** ✅
   - API keys are valid
   - Headers are sent correctly

5. **Database Tables** ✅
   - `projects` exists
   - `inspection_sessions` exists
   - `inspection_violations` exists
   - `captured_violations` exists

6. **Camera Permissions** ⚠️
   - Note: Checked at runtime in Live AI mode

7. **Location Permissions** ⚠️
   - Note: Checked at runtime in Live AI mode

8. **Network Connectivity** ✅
   - Google (general internet)
   - Supabase (database)
   - MCP Backend (AI service)

---

## 📊 **UNDERSTANDING RESULTS**

### Status Colors:
- ✅ **Green (PASS):** Working correctly
- ❌ **Red (FAIL):** Critical issue - needs fixing
- ⚠️ **Yellow (WARN):** Warning - may cause issues
- 🔴 **Dark Red (ERROR):** Check failed due to error

### Common Issues:

#### 1. **MCP Backend Health: FAIL**
**Problem:** Backend not reachable or not deployed

**Solutions:**
- Check if backend is deployed: `supabase functions deploy mcp-server`
- Verify MCP_URL in environment variables
- Check network connection

#### 2. **MCP Authentication: FAIL**
**Problem:** API keys invalid or not sent

**Solutions:**
- Verify SUPABASE_ANON_KEY is set correctly
- Check that McpClient.js sends auth headers (should be fixed)
- Ensure backend accepts anon key (should be fixed)

#### 3. **Environment Variables: FAIL**
**Problem:** Missing or invalid API keys

**Solutions:**
- Check `.env` file or EAS secrets
- Verify all keys are set (not `@secret:` placeholders)
- Rebuild app if using EAS secrets

#### 4. **Database Tables: FAIL**
**Problem:** Tables don't exist in Supabase

**Solutions:**
- Run database migrations
- Create tables manually in Supabase dashboard
- Check table names match (should be `projects`, not `building_projects`)

---

## 🔧 **FIXING ISSUES**

### If MCP Backend Health Fails:

1. **Check Backend Deployment:**
   ```bash
   supabase functions list
   ```

2. **Deploy if Missing:**
   ```bash
   supabase functions deploy mcp-server
   ```

3. **Check Backend Logs:**
   ```bash
   supabase functions logs mcp-server
   ```

### If Authentication Fails:

1. **Verify API Key:**
   - Check `config/env.js` or environment variables
   - Ensure key matches Supabase dashboard

2. **Check Headers:**
   - Verify `services/McpClient.js` sends headers (should be fixed)
   - Check backend accepts anon key (should be fixed)

### If Environment Variables Fail:

1. **Check .env File:**
   ```bash
   cat .env
   ```

2. **Or Check EAS Secrets:**
   ```bash
   eas secret:list
   ```

3. **Set Missing Variables:**
   ```bash
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-key
   ```

---

## 📱 **SHARING RESULTS**

Tap the **Share** button (top right) to:
- Share diagnostics report via text/email
- Copy to clipboard
- Send to support

---

## 🎯 **QUICK FIXES**

### Most Common Fixes:

1. **"MCP Backend is unreachable"**
   → Deploy backend: `supabase functions deploy mcp-server`

2. **"Authentication failed"**
   → Check API keys match Supabase dashboard

3. **"Missing environment variables"**
   → Set in `.env` or EAS secrets, then rebuild

4. **"Database tables missing"**
   → Create tables in Supabase dashboard

---

## ✅ **EXPECTED RESULTS**

When everything works:
- ✅ All checks should be GREEN (PASS)
- ✅ No critical issues shown
- ✅ MCP Backend Health: 200
- ✅ MCP Authentication: Successful

---

**Run diagnostics first, then fix the issues it identifies!**

