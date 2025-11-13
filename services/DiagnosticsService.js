/**
 * DiagnosticsService - Comprehensive app diagnostics
 * Checks all critical systems and reports issues
 */

import { MCP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY, isConfigValid } from '../config/env';
import getSupabaseClient from './supabaseClient';
import { health } from './McpClient';

class DiagnosticsService {
  constructor() {
    this.results = [];
  }

  /**
   * Run all diagnostics
   */
  async runAllDiagnostics() {
    this.results = [];
    
    const diagnostics = [
      { name: 'Environment Variables', fn: this.checkEnvironmentVariables.bind(this) },
      { name: 'Supabase Connection', fn: this.checkSupabaseConnection.bind(this) },
      { name: 'MCP Backend Health', fn: this.checkMCPBackend.bind(this) },
      { name: 'MCP Authentication', fn: this.checkMCPAuthentication.bind(this) },
      { name: 'Database Tables', fn: this.checkDatabaseTables.bind(this) },
      { name: 'Camera Permissions', fn: this.checkCameraPermissions.bind(this) },
      { name: 'Location Permissions', fn: this.checkLocationPermissions.bind(this) },
      { name: 'Network Connectivity', fn: this.checkNetworkConnectivity.bind(this) },
    ];

    for (const diagnostic of diagnostics) {
      try {
        const result = await diagnostic.fn();
        this.results.push({
          name: diagnostic.name,
          status: result.status,
          message: result.message,
          details: result.details || {},
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.results.push({
          name: diagnostic.name,
          status: 'error',
          message: `Diagnostic failed: ${error.message}`,
          details: { error: error.toString() },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return this.getSummary();
  }

  /**
   * Check environment variables
   */
  async checkEnvironmentVariables() {
    const config = isConfigValid();
    const issues = [];

    if (!SUPABASE_URL || SUPABASE_URL.includes('@secret:')) {
      issues.push('SUPABASE_URL is missing or invalid');
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('@secret:')) {
      issues.push('SUPABASE_ANON_KEY is missing or invalid');
    }
    if (!MCP_URL || MCP_URL.includes('@secret:')) {
      issues.push('MCP_URL is missing or invalid');
    }
    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('@secret:') || OPENAI_API_KEY === 'your-openai-api-key-here') {
      issues.push('OPENAI_API_KEY is missing or invalid');
    }

    return {
      status: issues.length === 0 ? 'pass' : 'fail',
      message: issues.length === 0 
        ? 'All environment variables configured' 
        : `Missing: ${issues.join(', ')}`,
      details: {
        supabaseUrl: SUPABASE_URL ? '✓ Set' : '✗ Missing',
        supabaseKey: SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
        mcpUrl: MCP_URL ? '✓ Set' : '✗ Missing',
        openaiKey: OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here' ? '✓ Set' : '✗ Missing',
        configValid: config,
      },
    };
  }

  /**
   * Check Supabase connection
   */
  async checkSupabaseConnection() {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('projects').select('count').limit(1);
      
      if (error) {
        return {
          status: 'fail',
          message: `Supabase connection failed: ${error.message}`,
          details: { error: error.message, code: error.code },
        };
      }

      return {
        status: 'pass',
        message: 'Supabase connection successful',
        details: { connected: true },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Supabase check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Check MCP backend health
   */
  async checkMCPBackend() {
    try {
      const status = await health();
      
      if (status === 200) {
        return {
          status: 'pass',
          message: 'MCP backend is healthy',
          details: { statusCode: status },
        };
      } else if (status === 401) {
        return {
          status: 'fail',
          message: 'MCP backend returned 401 (Authentication failed)',
          details: { statusCode: status, issue: 'Check authentication headers' },
        };
      } else if (status === 0) {
        return {
          status: 'fail',
          message: 'MCP backend is unreachable',
          details: { statusCode: status, issue: 'Network error or backend not deployed' },
        };
      } else {
        return {
          status: 'fail',
          message: `MCP backend returned ${status}`,
          details: { statusCode: status },
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `MCP health check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Check MCP authentication
   */
  async checkMCPAuthentication() {
    try {
      // Try health endpoint first (simpler check)
      const healthResponse = await fetch(`${MCP_URL}/health`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (healthResponse.ok) {
        return {
          status: 'pass',
          message: 'MCP authentication successful',
          details: { statusCode: healthResponse.status, method: 'health endpoint' },
        };
      }

      // If health endpoint doesn't exist, try call-tool with a valid tool
      const response = await fetch(`${MCP_URL}/call-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: 'list_projects',
          arguments: {},
        }),
      });

      const responseText = await response.text().catch(() => '');
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { raw: responseText.substring(0, 100) };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          status: 'fail',
          message: 'MCP authentication failed - check API keys',
          details: {
            statusCode: response.status,
            hasApiKey: !!SUPABASE_ANON_KEY,
            apiKeyLength: SUPABASE_ANON_KEY?.length || 0,
            error: responseData.error || responseData.message || 'Authentication failed',
          },
        };
      } else if (response.ok) {
        return {
          status: 'pass',
          message: 'MCP authentication successful',
          details: { statusCode: response.status, method: 'call-tool' },
        };
      } else if (response.status === 400) {
        // 400 might mean bad request format, not necessarily auth failure
        return {
          status: 'warn',
          message: `MCP returned 400 - request format issue (auth may be OK)`,
          details: { 
            statusCode: response.status,
            error: responseData.error || responseData.message || 'Bad request',
            note: 'Authentication headers are present, but request format may be incorrect',
          },
        };
      } else {
        return {
          status: 'warn',
          message: `MCP returned ${response.status}`,
          details: { 
            statusCode: response.status,
            error: responseData.error || responseData.message || 'Unknown error',
          },
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `MCP auth check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Check database tables exist
   */
  async checkDatabaseTables() {
    const requiredTables = ['projects', 'inspection_sessions', 'inspection_violations', 'captured_violations'];
    const results = {};

    try {
      const supabase = getSupabaseClient();
      
      for (const table of requiredTables) {
        try {
          const { error } = await supabase.from(table).select('count').limit(1);
          results[table] = error ? `✗ ${error.message}` : '✓ Exists';
        } catch (err) {
          results[table] = `✗ Error: ${err.message}`;
        }
      }

      const missing = Object.entries(results).filter(([_, status]) => !status.includes('✓'));
      
      return {
        status: missing.length === 0 ? 'pass' : 'fail',
        message: missing.length === 0 
          ? 'All required tables exist' 
          : `Missing tables: ${missing.map(([table]) => table).join(', ')}`,
        details: results,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Database check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Check camera permissions
   */
  async checkCameraPermissions() {
    try {
      const { Camera } = require('expo-camera');

      // Can't use hooks in regular functions, so use the async API
      const { status } = await Camera.requestCameraPermissionsAsync();

      return {
        status: status === 'granted' ? 'pass' : 'warn',
        message: status === 'granted'
          ? 'Camera permission granted'
          : 'Camera permission check requires device (check in Live AI mode)',
        details: {
          status,
          note: 'Permission status checked at runtime in LiveInspectionScreen',
        },
      };
    } catch (error) {
      return {
        status: 'warn',
        message: 'Camera permission check requires device (check in Live AI mode)',
        details: { error: error.message, note: 'Permission checked at runtime' },
      };
    }
  }

  /**
   * Check location permissions
   */
  async checkLocationPermissions() {
    try {
      // Note: Can't use hooks here, so we'll return a note
      return {
        status: 'warn',
        message: 'Location permission check requires device (check in Live AI mode)',
        details: { note: 'Permission status checked at runtime in LiveInspectionScreen' },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Location check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    try {
      const results = {};
      
      // 1. Check general internet connectivity (Google)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const start = Date.now();
        const response = await fetch('https://www.google.com', { 
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const duration = Date.now() - start;
        results['Google'] = response.ok 
          ? `✓ Connected (${duration}ms)` 
          : `✗ Failed (${response.status})`;
      } catch (err) {
        const errorMsg = err.name === 'AbortError' 
          ? 'Timeout (5s)' 
          : err.message || 'Network error';
        results['Google'] = `✗ Error: ${errorMsg}`;
      }

      // 2. Check Supabase - use REST endpoint that actually exists
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const start = Date.now();
        // Use REST v1 endpoint which always exists
        const supabaseRestUrl = `${SUPABASE_URL}/rest/v1/`;
        const response = await fetch(supabaseRestUrl, { 
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const duration = Date.now() - start;
        // 200, 401, 403 all mean the server is reachable
        results['Supabase'] = (response.status < 500)
          ? `✓ Connected (${duration}ms, ${response.status})`
          : `✗ Failed (${response.status})`;
      } catch (err) {
        const errorMsg = err.name === 'AbortError' 
          ? 'Timeout (5s)' 
          : err.message || 'Network error';
        results['Supabase'] = `✗ Error: ${errorMsg}`;
      }

      // 3. Check MCP Backend - use health endpoint we already know works
      // Since we already verified MCP health in checkMCPBackend(), 
      // we can use that result or check the health endpoint here
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const start = Date.now();
        const response = await fetch(`${MCP_URL}/health`, { 
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const duration = Date.now() - start;
        results['MCP Backend'] = response.ok 
          ? `✓ Connected (${duration}ms)` 
          : `✗ Failed (${response.status})`;
      } catch (err) {
        const errorMsg = err.name === 'AbortError' 
          ? 'Timeout (5s)' 
          : err.message || 'Network error';
        results['MCP Backend'] = `✗ Error: ${errorMsg}`;
      }

      const failed = Object.entries(results).filter(([_, status]) => status.includes('✗'));
      
      return {
        status: failed.length === 0 ? 'pass' : 'fail',
        message: failed.length === 0 
          ? 'All network connections working' 
          : `Failed: ${failed.map(([name]) => name).join(', ')}`,
        details: results,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Network check failed: ${error.message}`,
        details: { error: error.toString() },
      };
    }
  }

  /**
   * Get summary of all diagnostics
   */
  getSummary() {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;
    const errors = this.results.filter(r => r.status === 'error').length;

    const criticalIssues = this.results.filter(r => 
      r.status === 'fail' && 
      (r.name.includes('MCP') || r.name.includes('Authentication') || r.name.includes('Environment'))
    );

    return {
      summary: {
        total: this.results.length,
        passed,
        failed,
        warnings,
        errors,
      },
      criticalIssues: criticalIssues.map(r => ({
        name: r.name,
        message: r.message,
      })),
      allResults: this.results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get formatted report (with error handling)
   */
  getFormattedReport() {
    try {
      if (!this.results || this.results.length === 0) {
        return 'No diagnostics results available. Please run diagnostics first.';
      }

      const summary = this.getSummary();
      if (!summary || !summary.summary) {
        return 'Invalid diagnostics summary. Please run diagnostics again.';
      }

      let report = `\n`;
      try {
        report += `╔═══════════════════════════════════════════════════════════╗\n`;
        report += `║         VISION APP DIAGNOSTICS REPORT                     ║\n`;
        report += `╚═══════════════════════════════════════════════════════════╝\n\n`;
        
        const timestamp = summary.timestamp ? new Date(summary.timestamp).toLocaleString() : new Date().toLocaleString();
        report += `Generated: ${timestamp}\n\n`;
        
        report += `📊 SUMMARY:\n`;
        report += `   ✅ Passed: ${summary.summary.passed || 0}\n`;
        report += `   ❌ Failed: ${summary.summary.failed || 0}\n`;
        report += `   ⚠️  Warnings: ${summary.summary.warnings || 0}\n`;
        report += `   🔴 Errors: ${summary.summary.errors || 0}\n`;
        report += `   📋 Total Checks: ${summary.summary.total || 0}\n\n`;

        if (summary.criticalIssues && summary.criticalIssues.length > 0) {
          report += `🔴 CRITICAL ISSUES (Must Fix):\n`;
          report += `   ${'─'.repeat(60)}\n`;
          summary.criticalIssues.forEach((issue, index) => {
            if (issue && issue.name && issue.message) {
              report += `   ${index + 1}. ${String(issue.name)}\n`;
              report += `      ${String(issue.message)}\n\n`;
            }
          });
        }

        report += `📋 DETAILED RESULTS:\n`;
        report += `   ${'─'.repeat(60)}\n`;
        
        if (this.results && Array.isArray(this.results)) {
          this.results.forEach((result, index) => {
            try {
              if (!result || !result.name) return;
              
              const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : result.status === 'warn' ? '⚠️' : '🔴';
              report += `\n${index + 1}. ${icon} ${String(result.name)}\n`;
              report += `   Status: ${String(result.status || 'unknown').toUpperCase()}\n`;
              report += `   Message: ${String(result.message || 'No message')}\n`;
              
              if (result.details && typeof result.details === 'object' && Object.keys(result.details).length > 0) {
                report += `   Details:\n`;
                Object.entries(result.details).forEach(([key, value]) => {
                  try {
                    report += `      • ${String(key)}: ${String(value)}\n`;
                  } catch (detailError) {
                    report += `      • ${String(key)}: [Error formatting value]\n`;
                  }
                });
              }
            } catch (resultError) {
              report += `\n${index + 1}. ⚠️ Error formatting result: ${resultError.message}\n`;
            }
          });
        }

        report += `\n${'─'.repeat(60)}\n`;
        report += `HOW TO FIX ISSUES:\n\n`;
        
        // Add fix suggestions based on common issues (with safe checks)
        try {
          const hasEnvIssues = this.results.some(r => r && r.name === 'Environment Variables' && r.status === 'fail');
          const hasMCPIssues = this.results.some(r => r && r.name && r.name.includes('MCP') && r.status === 'fail');
          const hasAuthIssues = this.results.some(r => r && r.name && r.name.includes('Authentication') && r.status === 'fail');
          const hasTableIssues = this.results.some(r => r && r.name === 'Database Tables' && r.status === 'fail');
          
          if (hasEnvIssues) {
            report += `1. ENVIRONMENT VARIABLES:\n`;
            report += `   • Check your .env file or Expo config\n`;
            report += `   • Ensure SUPABASE_URL, SUPABASE_ANON_KEY, MCP_URL are set\n`;
            report += `   • For Expo: Use EAS Secrets or app.json extra config\n\n`;
          }
          
          if (hasMCPIssues || hasAuthIssues) {
            const mcpUrl = typeof MCP_URL !== 'undefined' ? String(MCP_URL) : '[MCP_URL not available]';
            report += `2. MCP BACKEND:\n`;
            report += `   • Verify backend is deployed: ${mcpUrl}\n`;
            report += `   • Check authentication headers (apikey, Authorization)\n`;
            report += `   • Ensure SUPABASE_ANON_KEY matches backend config\n\n`;
          }
          
          if (hasTableIssues) {
            report += `3. DATABASE TABLES:\n`;
            report += `   • Run migrations in Supabase dashboard\n`;
            report += `   • Required tables: projects, inspection_sessions, inspection_violations, captured_violations\n\n`;
          }
        } catch (fixError) {
          report += `[Error generating fix suggestions]\n\n`;
        }
        
        report += `For more help, share this report with your development team.\n`;
        report += `\n${'═'.repeat(60)}\n`;

        return report;
      } catch (formatError) {
        return `Error formatting report: ${formatError.message}\n\nRaw summary: ${JSON.stringify(summary, null, 2)}`;
      }
    } catch (error) {
      return `Error generating diagnostics report: ${error.message}\n\nPlease run diagnostics again.`;
    }
  }
}

export default new DiagnosticsService();

