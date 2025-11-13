/**
 * DESIGN ANALYSIS EDGE FUNCTION
 *
 * Supabase Edge Function for analyzing renovation design intent.
 * Processes natural language input and returns feasibility analysis.
 *
 * Usage:
 *   POST /analyze-design
 *   Body: {
 *     "userInput": "I want to extend bathroom 5 feet and add soaking tub",
 *     "context": {
 *       "existingRoomDimensions": { "length": 8, "width": 6, "unit": "feet" },
 *       "location": "Honolulu, HI"
 *     }
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import would be from npm in production, using inline for edge function
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { userInput, context } = await req.json();

    if (!userInput) {
      return new Response(
        JSON.stringify({
          error: "userInput is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Analyzing design:", userInput);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Parse design intent using OpenAI
    const intent = await parseDesignIntent(userInput, context);
    console.log("Parsed intent:", intent);

    // Step 2: Check code compliance
    const compliance = await checkCompliance(supabase, intent, context);
    console.log("Compliance check:", compliance);

    // Step 3: Get permit requirements
    const permits = await getPermitRequirements(supabase, intent);
    console.log("Permits:", permits);

    // Step 4: Identify professional requirements
    const professionals = getProfessionalRequirements(intent);
    console.log("Professionals:", professionals);

    // Step 5: Analyze structural concerns
    const structuralConcerns = analyzeStructuralConcerns(intent);
    console.log("Structural concerns:", structuralConcerns);

    // Step 6: Estimate costs
    const estimatedCost = estimateCosts(
      intent,
      permits,
      professionals,
      context
    );
    console.log("Estimated cost:", estimatedCost);

    // Step 7: Calculate timeline
    const timeline = calculateTimeline(intent, permits, professionals);
    console.log("Timeline:", timeline);

    // Step 8: Generate recommendations
    const recommendations = generateRecommendations(
      intent,
      compliance,
      permits,
      professionals,
      structuralConcerns,
      estimatedCost
    );

    // Step 9: Determine overall feasibility
    const overallFeasibility = determineOverallFeasibility(
      compliance,
      structuralConcerns,
      estimatedCost
    );

    const analysis = {
      intent,
      compliance,
      permits,
      professionals,
      structuralConcerns,
      estimatedCost,
      timeline,
      recommendations,
      overallFeasibility,
      confidence: intent.confidence,
    };

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Design analysis error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function parseDesignIntent(userInput, context) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert construction project analyst. Extract structured renovation intent from natural language descriptions. Always consider building codes and permit requirements.",
        },
        {
          role: "user",
          content: `Extract renovation design intent from: "${userInput}"\n\nContext: ${JSON.stringify(
            context || {}
          )}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_design_intent",
            description: "Extract structured renovation design intent",
            parameters: {
              type: "object",
              properties: {
                roomType: {
                  type: "string",
                  enum: [
                    "bathroom",
                    "kitchen",
                    "bedroom",
                    "living_room",
                    "garage",
                    "exterior",
                    "other",
                  ],
                },
                structuralChanges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "extension",
                          "reduction",
                          "door_addition",
                          "window_addition",
                          "wall_removal",
                          "wall_addition",
                        ],
                      },
                      dimension: {
                        type: "number",
                      },
                      unit: {
                        type: "string",
                        enum: ["feet", "meters", "inches"],
                      },
                      direction: {
                        type: "string",
                        enum: ["north", "south", "east", "west", "unspecified"],
                      },
                      description: {
                        type: "string",
                      },
                    },
                    required: ["type", "description"],
                  },
                },
                fixtures: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "bathtub",
                          "shower",
                          "toilet",
                          "sink",
                          "vanity",
                          "cabinet",
                          "appliance",
                        ],
                      },
                      subtype: {
                        type: "string",
                      },
                      action: {
                        type: "string",
                        enum: ["add", "remove", "replace", "relocate"],
                      },
                    },
                    required: ["type", "action"],
                  },
                },
                materials: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: {
                        type: "string",
                        enum: [
                          "flooring",
                          "wall",
                          "ceiling",
                          "countertop",
                          "backsplash",
                        ],
                      },
                      material: {
                        type: "string",
                      },
                      action: {
                        type: "string",
                        enum: ["install", "replace", "refinish"],
                      },
                    },
                  },
                },
                estimatedImpact: {
                  type: "string",
                  enum: ["cosmetic", "moderate", "major", "structural"],
                },
                permitRequired: {
                  type: "boolean",
                },
              },
              required: [
                "roomType",
                "structuralChanges",
                "fixtures",
                "materials",
                "estimatedImpact",
                "permitRequired",
              ],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: {
          name: "extract_design_intent",
        },
      },
      temperature: 0.3,
    }),
  });

  const data = await response.json();

  // Log OpenAI response for debugging
  console.log("OpenAI response:", JSON.stringify(data, null, 2));

  if (!data.choices || data.choices.length === 0) {
    throw new Error(`OpenAI API error: ${JSON.stringify(data)}`);
  }

  const toolCall = data.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || !toolCall.function) {
    throw new Error(
      `No tool call in response: ${JSON.stringify(data.choices[0]?.message)}`
    );
  }

  const intent = JSON.parse(toolCall.function.arguments);

  // Calculate confidence
  intent.confidence = calculateConfidence(intent, userInput);

  return intent;
}

function calculateConfidence(intent, originalInput) {
  let score = 0.5;
  if (intent.structuralChanges.length > 0) score += 0.1;
  if (intent.structuralChanges.some((c) => c.dimension !== undefined))
    score += 0.15;
  if (intent.fixtures.length > 0) score += 0.1;
  if (intent.materials.length > 0) score += 0.1;
  if (originalInput.split(" ").length > 10) score += 0.05;
  return Math.min(score, 1.0);
}

async function checkCompliance(supabase, intent, context) {
  const measurements = {};
  if (context?.existingRoomDimensions) {
    measurements.floor_area =
      context.existingRoomDimensions.length *
      context.existingRoomDimensions.width;
    const extension = intent.structuralChanges.find(
      (c) => c.type === "extension"
    );
    if (extension?.dimension) {
      measurements.floor_area +=
        extension.dimension * context.existingRoomDimensions.width;
    }
  }

  const { data: checks, error } = await supabase.rpc("check_code_compliance", {
    p_room_type: intent.roomType,
    p_measurements: measurements,
  });

  if (error) {
    console.error("Compliance check error:", error);
    return {
      checks: [],
      passedCount: 0,
      failedCount: 0,
      warningCount: 0,
      overallStatus: "warnings",
    };
  }

  const codeChecks = (checks || []).map((c) => ({
    requirementKey: c.requirement_key,
    codeSection: c.code_section,
    description: c.description,
    requiredValue: c.required_value,
    actualValue: c.actual_value,
    compliant: c.compliant,
    severity: c.severity,
  }));

  const passedCount = codeChecks.filter((c) => c.compliant).length;
  const failedCount = codeChecks.filter(
    (c) => !c.compliant && c.severity === "error"
  ).length;
  const warningCount = codeChecks.filter(
    (c) => !c.compliant && c.severity === "warning"
  ).length;

  return {
    checks: codeChecks,
    passedCount,
    failedCount,
    warningCount,
    overallStatus:
      failedCount > 0
        ? "violations"
        : warningCount > 0
        ? "warnings"
        : "compliant",
  };
}

async function getPermitRequirements(supabase, intent) {
  const workTypes = {};
  intent.structuralChanges.forEach((change) => {
    workTypes[change.type] = true;
  });

  if (
    intent.fixtures.some((f) =>
      ["bathtub", "shower", "toilet", "sink"].includes(f.type)
    )
  ) {
    workTypes.plumbing = true;
  }

  if (intent.structuralChanges.length > 0 || intent.fixtures.length > 0) {
    workTypes.electrical = true;
  }

  const { data: permits, error } = await supabase.rpc(
    "get_permit_requirements",
    {
      p_room_type: intent.roomType,
      p_work_types: workTypes,
    }
  );

  if (error) {
    console.error("Permit requirements error:", error);
    return [];
  }

  return (permits || []).map((p) => ({
    permitCode: p.permit_code,
    permitName: p.permit_name,
    workType: p.work_type,
    baseFee: parseFloat(p.base_fee_usd),
    totalEstimatedFee: parseFloat(p.total_estimated_fee_usd),
    processingDays: p.processing_days,
    requiredDocuments: p.required_documents || [],
    inspectorTypes: p.inspector_types || [],
  }));
}

function getProfessionalRequirements(intent) {
  const professionals = [];

  const hasStructuralWork = intent.structuralChanges.some((c) =>
    ["wall_removal", "extension", "door_addition", "window_addition"].includes(
      c.type
    )
  );

  if (hasStructuralWork) {
    professionals.push({
      professionalType: "Structural Engineer",
      licenseType: "Hawaii PE - Structural",
      reason: "Structural modifications require licensed engineer review",
      estimatedCost: 1500,
    });
  }

  const hasLargeExtension = intent.structuralChanges.some(
    (c) => c.type === "extension" && c.dimension && c.dimension > 10
  );
  if (hasLargeExtension) {
    professionals.push({
      professionalType: "Architect",
      licenseType: "Hawaii Licensed Architect",
      reason: "Large additions require architect-stamped plans",
      estimatedCost: 3000,
    });
  }

  return professionals;
}

function analyzeStructuralConcerns(intent) {
  const concerns = [];

  const wallRemoval = intent.structuralChanges.find(
    (c) => c.type === "wall_removal"
  );
  if (wallRemoval) {
    concerns.push({
      type: "load_bearing",
      severity: "critical",
      description: "Wall removal may involve load-bearing structure",
      recommendation:
        "Structural engineer must verify and design proper support",
    });
  }

  const extension = intent.structuralChanges.find(
    (c) => c.type === "extension"
  );
  if (extension) {
    concerns.push({
      type: "foundation",
      severity: "critical",
      description: "Extension requires foundation work",
      recommendation: "Foundation must match or connect to existing",
    });
    if (extension.dimension > 8) {
      concerns.push({
        type: "span",
        severity: "moderate",
        description: "Large span may require engineered joists",
        recommendation: "Consult structural engineer for span calculations",
      });
    }
  }

  return concerns;
}

function estimateCosts(intent, permits, professionals, context) {
  const permitFees = permits.reduce((sum, p) => sum + p.totalEstimatedFee, 0);
  const professionalFees = professionals.reduce(
    (sum, p) => sum + p.estimatedCost,
    0
  );

  let constructionLow = 0;
  let constructionMid = 0;
  let constructionHigh = 0;

  const extension = intent.structuralChanges.find(
    (c) => c.type === "extension"
  );
  if (extension?.dimension && context?.existingRoomDimensions) {
    const sqft = extension.dimension * context.existingRoomDimensions.width;
    constructionLow += sqft * 200;
    constructionMid += sqft * 300;
    constructionHigh += sqft * 400;
  }

  const fixtureCosts = {
    bathtub: { low: 500, mid: 1500, high: 5000 },
    shower: { low: 800, mid: 2000, high: 6000 },
    toilet: { low: 200, mid: 400, high: 1200 },
    sink: { low: 150, mid: 400, high: 1500 },
    vanity: { low: 300, mid: 800, high: 3000 },
  };

  intent.fixtures.forEach((fixture) => {
    const costs = fixtureCosts[fixture.type];
    if (costs) {
      constructionLow += costs.low;
      constructionMid += costs.mid;
      constructionHigh += costs.high;
    }
  });

  return {
    permitFees,
    professionalFees,
    constructionEstimate: {
      low: constructionLow,
      mid: constructionMid,
      high: constructionHigh,
    },
    totalEstimate: {
      low: constructionLow + permitFees + professionalFees,
      mid: constructionMid + permitFees + professionalFees,
      high: constructionHigh + permitFees + professionalFees,
    },
  };
}

function calculateTimeline(intent, permits, professionals) {
  const permitProcessing = Math.max(...permits.map((p) => p.processingDays), 0);
  const designPhase = professionals.length > 0 ? 14 : 7;
  let constructionPhase = 0;

  if (intent.structuralChanges.some((c) => c.type === "extension")) {
    constructionPhase = 60;
  } else if (intent.estimatedImpact === "major") {
    constructionPhase = 30;
  } else {
    constructionPhase = 14;
  }

  return {
    permitProcessing,
    designPhase,
    constructionPhase,
    totalDays: permitProcessing + designPhase + constructionPhase,
  };
}

function generateRecommendations(
  intent,
  compliance,
  permits,
  professionals,
  structuralConcerns,
  estimatedCost
) {
  const recommendations = [];

  if (compliance.failedCount > 0) {
    recommendations.push({
      type: "requirement",
      category: "code",
      title: "Code Violations Detected",
      description: `${compliance.failedCount} code requirement(s) not met`,
      priority: "high",
    });
  }

  if (permits.length > 0) {
    recommendations.push({
      type: "requirement",
      category: "permit",
      title: `${permits.length} Permit(s) Required`,
      description: `Total fees: $${estimatedCost.permitFees.toFixed(2)}`,
      priority: "high",
    });
  }

  if (professionals.length > 0) {
    recommendations.push({
      type: "requirement",
      category: "structural",
      title: "Professional Services Required",
      description: professionals.map((p) => p.professionalType).join(", "),
      priority: "high",
    });
  }

  structuralConcerns.forEach((concern) => {
    if (concern.severity === "critical") {
      recommendations.push({
        type: "warning",
        category: "structural",
        title: concern.description,
        description: concern.recommendation,
        priority: "high",
      });
    }
  });

  return recommendations;
}

function determineOverallFeasibility(
  compliance,
  structuralConcerns,
  estimatedCost
) {
  if (compliance.failedCount > 3) {
    return "not_feasible";
  }
  if (
    structuralConcerns.some((c) => c.severity === "critical") ||
    compliance.warningCount > 0
  ) {
    return "feasible_with_conditions";
  }
  return "feasible";
}
