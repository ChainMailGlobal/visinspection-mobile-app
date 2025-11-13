import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const { projectId, inspectionType, projectName, comments } =
      await req.json();

    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Missing authorization header",
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
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

    // Get OPENAI_API_KEY
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "API key not configured",
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

    // Fetch project and code pack rules for AI context
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: project } = await supabase
      .from("projects")
      .select(
        "code_pack_id, work_description, jurisdictions(name), scopes(name)"
      )
      .eq("id", projectId)
      .single();

    let codePackRules = [];
    if (project?.code_pack_id) {
      const { data: rules } = await supabase
        .from("rules")
        .select("*")
        .eq("code_pack_id", project.code_pack_id);
      codePackRules = rules || [];
      console.log(`Loaded ${codePackRules.length} building code rules for AI`);
    }

    // Build code reference
    const codeReference = codePackRules
      .map(
        (rule) =>
          `${rule.rule_id}: ${rule.title}\nCitation: ${rule.citation}\n${
            rule.description || ""
          }\nPass Condition: ${rule.pass_condition}`
      )
      .join("\n\n");

    const workContext = project?.work_description
      ? `\n\nWORK CONTEXT: "${project.work_description}"\nPay special attention to this scope.`
      : "";

    // Build comprehensive instructions for OpenAI
    const instructions = `You are a ${inspectionType.toUpperCase()} code inspector for Honolulu construction sites.

${inspectionType.toUpperCase()} INSPECTION${workContext}
Codes: 2021 IBC/IRC, 2020 NEC, 2018 IPC/IMC, HI Building Code, Honolulu DPP

${codeReference ? `Rules:\n${codeReference}\n` : ""}

**HOMEOWNER GREETING (Say this when connection established):**

"Hello! I'm your AI code inspector. Point your camera at any exposed work - I'll scan for violations across ALL trades: electrical, plumbing, framing, HVAC, and fire safety. Move slowly and let me see the work clearly."

**YOUR ROLE:**

- PROACTIVELY GUIDE: Tell user what you're checking ("I'm scanning the electrical outlets now...")
- FLAG VIOLATIONS: Call flag_violation() immediately when you spot issues
- CAPTURE PHOTOS: When violation found, say "I found a violation. Hold your camera steady on [specific area]" then call take_photo()
- COMPLETE SCAN: After checking visible work thoroughly, call scan_complete() with summary
- ALWAYS CITE CODES: Every observation needs exact code reference (e.g., "IRC R602.3.1", "NEC 210.52")

**WORKFLOW:**

1. Greet user and ask them to pan camera slowly
2. As you analyze frames, narrate what you're checking
3. When violation detected → flag_violation() → guide camera positioning → take_photo()
4. Continue until all visible work checked
5. Call scan_complete(summary: "I checked [areas]. Found [X] violations.")

**CRITICAL RULES:**

- NO SPECULATION: Only comment on what you clearly see
- BE CONVERSATIONAL: Talk like a helpful inspector, not a robot
- SAFETY FIRST: Prioritize critical violations (electrical hazards, structural issues)
- Format: "Issue/Observation. [CODE]. Remediation."
- Example: "Missing GFCI outlet. NEC 210.52(C) requires within 6ft of sink. Install GFCI."

TOOLS AVAILABLE:
- take_photo: Capture violation photo after guiding user
- flag_violation: Mark code violations with severity and reference
- scan_complete: Signal inspection complete with summary`;

    // Request ephemeral token from OpenAI
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-10-01", // Updated to stable version
          voice: "alloy",
          instructions: instructions,
          modalities: ["audio", "text"],
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
            {
              type: "function",
              name: "take_photo",
              description: "Capture a photo during inspection",
              parameters: {
                type: "object",
                properties: {
                  note: {
                    type: "string",
                    description: "Optional note about the photo",
                  },
                },
              },
            },
            {
              type: "function",
              name: "flag_violation",
              description: "Flag a code violation",
              parameters: {
                type: "object",
                properties: {
                  severity: {
                    type: "string",
                    enum: ["critical", "warning", "info"],
                    description: "Severity of the violation",
                  },
                  description: {
                    type: "string",
                    description: "Description of the violation",
                  },
                  codeReference: {
                    type: "string",
                    description: "Specific code section reference",
                  },
                },
                required: ["severity", "description"],
              },
            },
            {
              type: "function",
              name: "scan_complete",
              description:
                "Signal that the inspection scan is complete and ask if user is ready to end session. Use this after you've thoroughly checked the visible work and flagged any violations.",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Brief summary of what was inspected",
                  },
                },
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to get ephemeral token",
          details: errorText,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const data = await response.json();
    console.log("Ephemeral session created for", inspectionType, "inspection");
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in realtime-token:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
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
