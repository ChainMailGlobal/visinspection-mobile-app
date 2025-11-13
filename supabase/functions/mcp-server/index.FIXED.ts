// VISinspection MCP Server - Supabase Edge Function
// FIXED VERSION with Authentication and Error Handling
// Deno runtime - provides all 17 MCP tools via HTTPS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Validate critical environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ CRITICAL: Supabase configuration missing");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiter (simple in-memory - use Redis in production)
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

// MCP Tool Definitions (same as original)
const MCP_TOOLS = [
  // ... (same tool definitions as original)
  // Copy from index.ts
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  // ============================================================================
  // AUTHENTICATION CHECK (ADDED - CRITICAL FIX)
  // ============================================================================
  const apiKey = req.headers.get("apikey");
  const authHeader = req.headers.get("authorization");

  const isValidKey =
    apiKey === SUPABASE_ANON_KEY ||
    apiKey === SUPABASE_SERVICE_ROLE_KEY ||
    authHeader === `Bearer ${SUPABASE_ANON_KEY}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isValidKey) {
    console.error("❌ Authentication failed:", {
      hasApiKey: !!apiKey,
      hasAuthHeader: !!authHeader,
      apiKeyMatch:
        apiKey === SUPABASE_ANON_KEY || apiKey === SUPABASE_SERVICE_ROLE_KEY,
    });

    return new Response(
      JSON.stringify({
        error: "Invalid authentication",
        code: "AUTH_FAILED",
        message: "Please check your API key and authorization headers",
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ============================================================================
  // RATE LIMITING (ADDED)
  // ============================================================================
  const clientId =
    req.headers.get("x-client-id") || apiKey?.substring(0, 20) || "anonymous";
  const now = Date.now();
  const limit = rateLimiter.get(clientId);

  if (limit && limit.resetAt > now) {
    if (limit.count > 100) {
      // 100 requests per minute
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          code: "RATE_LIMIT",
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }
    limit.count++;
  } else {
    rateLimiter.set(clientId, { count: 1, resetAt: now + 60000 });
  }

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Health check
    if (url.pathname === "/health" || url.pathname.endsWith("/health")) {
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // List tools
    if (url.pathname.includes("/list-tools")) {
      return new Response(
        JSON.stringify({
          tools: MCP_TOOLS,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Execute tool
    if (url.pathname.includes("/call-tool") && req.method === "POST") {
      // ============================================================================
      // REQUEST VALIDATION (ADDED)
      // ============================================================================
      const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
      const body = await req.text();

      if (body.length > MAX_PAYLOAD_SIZE) {
        return new Response(
          JSON.stringify({ error: "Payload too large (max 10MB)" }),
          {
            status: 413,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch (parseError) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      const { name, arguments: args } = payload;

      if (!name || typeof name !== "string") {
        return new Response(
          JSON.stringify({ error: "Tool name is required" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Request ID for tracing
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Tool call: ${name}`);

      let result;

      switch (name) {
        case "get_design_analysis":
          result = await getDesignAnalysis(args);
          break;
        case "create_project":
          result = await createProject(args, supabase);
          break;
        case "list_projects":
          result = await listProjects(args, supabase);
          break;
        case "get_project_details":
          result = await getProjectDetails(args, supabase);
          break;
        case "analyze_physical_plan":
          result = await analyzePhysicalPlan(args, supabase);
          break;
        case "analyze_photo":
          result = await analyzePhoto(args);
          break;
        case "get_building_codes":
          result = await getBuildingCodes(args, supabase);
          break;
        case "get_permit_requirements":
          result = await getPermitRequirements(args, supabase);
          break;
        case "check_code_compliance":
          result = await checkCodeCompliance(args, supabase);
          break;
        case "create_inspection_report":
          result = await createInspectionReport(args, supabase);
          break;
        case "get_inspection_projects":
          result = await getInspectionProjects(args, supabase);
          break;
        case "get_material_info":
          result = await getMaterialInfo(args);
          break;
        case "get_material_costs":
          result = await getMaterialCosts(args, supabase);
          break;
        case "get_labor_rates":
          result = await getLaborRates(args, supabase);
          break;
        case "search_installation_videos":
          result = await searchInstallationVideos(args);
          break;
        case "get_manufacturer_website":
          result = await getManufacturerWebsite(args);
          break;
        case "generate_lens_config":
          result = await generateLensConfig(args);
          break;
        case "analyze_live_inspection":
          result = await analyzeLiveInspection(args, supabase);
          break;
        case "capture_violation":
          result = await captureViolation(args, supabase);
          break;
        default:
          return new Response(
            JSON.stringify({
              error: `Unknown tool: ${name}`,
              availableTools: MCP_TOOLS.map((t) => t.name),
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
      }

      // Add request ID to response
      if (result && typeof result === "object") {
        result.requestId = requestId;
      }

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not found", {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("MCP Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        code: "INTERNAL_ERROR",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================
// (Copy all tool implementations from original index.ts)
// Note: Also need to add timeout and better error handling to OpenAI/Gemini calls

// Example fix for analyzeLiveInspection response format:
async function analyzeLiveInspection(args, supabase) {
  // ... existing code ...

  // FIX: Return format matching frontend expectations
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
}

// ... (rest of tool implementations with improved error handling)
