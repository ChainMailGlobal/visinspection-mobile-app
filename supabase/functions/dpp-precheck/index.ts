import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { imageUrl, projectType = "residential" } = await req.json();

    console.log("📋 DPP Pre-Check Analysis started", {
      projectType,
    });

    const dppRequirements = getDPPRequirements(projectType);
    const analysis = await analyzeWithDPP(
      imageUrl,
      projectType,
      dppRequirements
    );

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        dpp_requirements: dppRequirements,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("❌ DPP Pre-Check Error:", error);
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

function getDPPRequirements(projectType: string) {
  const requirements = {
    residential: {
      required_forms: [
        "Application for Building Permit (BP-1)",
        "Zoning Clearance",
        "Site Plan (2 copies)",
        "Floor Plans (2 copies)",
        "Foundation Plan",
        "Structural Calculations (PE stamped)",
      ],
      code_references: [
        {
          code: "IRC R302.2",
          description: "Fire-resistance rated assemblies",
          page: "R-47",
        },
        {
          code: "IRC R308.4",
          description: "Safety glazing",
          page: "R-51",
        },
        {
          code: "IRC R310.1",
          description: "Emergency escape and rescue",
          page: "R-52",
        },
        {
          code: "IRC R315",
          description: "Carbon monoxide alarms",
          page: "R-56",
        },
        {
          code: "IRC R314",
          description: "Smoke alarms",
          page: "R-55",
        },
      ],
    },
    commercial: {
      required_forms: [
        "Application for Building Permit (BP-1)",
        "Zoning Clearance",
        "Site Plan (2 copies)",
        "Architectural Plans (3 copies)",
        "Structural Plans (3 copies)",
        "MEP Plans (2 copies each)",
        "Fire Protection Plans",
        "Energy Compliance (IECC)",
      ],
      code_references: [
        {
          code: "IBC 1020",
          description: "Corridors",
          page: "239",
        },
        {
          code: "IBC 1005",
          description: "Means of egress sizing",
          page: "229",
        },
        {
          code: "IBC 704",
          description: "Fire-resistance rated construction",
          page: "151",
        },
        {
          code: "IBC 403",
          description: "High-rise buildings",
          page: "73",
        },
      ],
    },
  };

  return (
    requirements[projectType as keyof typeof requirements] ||
    requirements.residential
  );
}

async function analyzeWithDPP(
  imageUrl: string,
  projectType: string,
  dppReqs: any
) {
  const reqsString = JSON.stringify(dppReqs, null, 2);

  const prompt = `You are a Honolulu building code inspector analyzing construction plans.

PROJECT TYPE: ${projectType}

HONOLULU DPP REQUIREMENTS:
${reqsString}

Analyze the attached plan image and check against ALL DPP requirements and building codes.

Return JSON with:
{
  "compliant": boolean,
  "missing_items": ["List of missing DPP required items with page numbers"],
  "code_violations": [
    {
      "code": "IRC R302.2",
      "description": "Specific violation description",
      "dpp_section": "DPP BP-1 Section 4",
      "page_reference": "IRC Page R-47",
      "severity": "critical|high|warning",
      "recommendation": "How to fix"
    }
  ],
  "required_stamps": ["PE Structural", "Licensed Architect", etc],
  "estimated_review_time": "X-Y weeks",
  "additional_notes": "Other important items"
}

BE THOROUGH. Check EVERY requirement from the DPP checklist. Include page numbers from codes.`;

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
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const analysisText = data.choices[0].message.content;
  const jsonMatch = analysisText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return {
    error: "Could not parse analysis",
    raw: analysisText,
  };
}
