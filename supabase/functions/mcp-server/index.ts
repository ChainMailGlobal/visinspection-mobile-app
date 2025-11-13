// VISinspection MCP Server - Supabase Edge Function
// FIXED VERSION with Authentication, Rate Limiting, and Error Handling
// Deno runtime - provides all 17 MCP tools via HTTPS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Validate critical environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ CRITICAL: Supabase configuration missing');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Rate limiter (simple in-memory - use Redis in production)
const rateLimiter = new Map();

// MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'get_design_analysis',
    description: 'Analyze renovation design intent and return feasibility analysis with permits, code compliance, costs, timeline',
    inputSchema: {
      type: 'object',
      properties: {
        userInput: {
          type: 'string',
          description: 'Natural language design description (e.g., "extend bathroom 5 feet and add soaking tub")'
        },
        roomDimensions: {
          type: 'object',
          properties: {
            length: { type: 'number' },
            width: { type: 'number' },
            unit: {
              type: 'string',
              enum: ['feet', 'meters']
            }
          }
        },
        location: {
          type: 'string',
          description: 'Location (e.g., "Honolulu, HI")'
        }
      },
      required: ['userInput']
    }
  },
  {
    name: 'create_project',
    description: 'Create a new building project with auto-GPS capture',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string' },
        address: { type: 'string' },
        projectType: {
          type: 'string',
          enum: ['residential', 'commercial', 'industrial', 'mixed_use']
        },
        userId: { type: 'string' },
        autoGPS: { type: 'boolean', default: true }
      },
      required: ['projectName', 'address', 'projectType']
    }
  },
  {
    name: 'list_projects',
    description: 'List building projects',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'get_project_details',
    description: 'Get detailed information about a specific project including plans, entities, and inspection reports',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' }
      },
      required: ['projectId']
    }
  },
  {
    name: 'analyze_physical_plan',
    description: 'Analyze physical paper building plans - perform take-offs, extract dimensions',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        photoUrl: { type: 'string' },
        analysisType: {
          type: 'string',
          enum: ['takeoff', 'dimension_extraction', 'material_count', 'specification_read', 'room_layout', 'full_analysis']
        },
        planType: { type: 'string' },
        scaleInfo: { type: 'string' }
      },
      required: ['projectId', 'photoUrl', 'analysisType']
    }
  },
  {
    name: 'analyze_photo',
    description: 'AI photo analysis for defects and code compliance',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        analysisType: {
          type: 'string',
          enum: ['defect_detection', 'code_compliance', 'material_identification', 'general']
        }
      },
      required: ['imageUrl', 'analysisType']
    }
  },
  {
    name: 'get_building_codes',
    description: 'Get Honolulu building code requirements',
    inputSchema: {
      type: 'object',
      properties: {
        roomType: { type: 'string' },
        codeType: {
          type: 'string',
          enum: ['IRC', 'IBC', 'NEC', 'IPC']
        }
      },
      required: ['roomType']
    }
  },
  {
    name: 'get_permit_requirements',
    description: 'Get permit requirements for specific room type and work types',
    inputSchema: {
      type: 'object',
      properties: {
        roomType: {
          type: 'string',
          enum: ['bathroom', 'kitchen', 'bedroom', 'living_room', 'garage', 'exterior']
        },
        workTypes: { type: 'object' }
      },
      required: ['roomType', 'workTypes']
    }
  },
  {
    name: 'check_code_compliance',
    description: 'Check building code compliance for specific room measurements',
    inputSchema: {
      type: 'object',
      properties: {
        roomType: {
          type: 'string',
          enum: ['bathroom', 'kitchen', 'bedroom', 'living_room']
        },
        measurements: { type: 'object' }
      },
      required: ['roomType', 'measurements']
    }
  },
  {
    name: 'create_inspection_report',
    description: 'Create a new inspection report with findings from the field',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        findingType: {
          type: 'string',
          enum: ['defect', 'compliance', 'quality', 'safety', 'progress', 'observation']
        },
        severity: {
          type: 'string',
          enum: ['info', 'low', 'medium', 'high', 'critical']
        },
        description: { type: 'string' },
        location: { type: 'object' },
        photoUrl: { type: 'string' },
        inspectorName: { type: 'string' }
      },
      required: ['projectId', 'findingType', 'severity', 'description', 'inspectorName']
    }
  },
  {
    name: 'get_inspection_projects',
    description: 'Get recent inspection projects and violations',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'get_material_info',
    description: 'Get material specs, MSDS, pricing, installation info',
    inputSchema: {
      type: 'object',
      properties: {
        materialName: { type: 'string' },
        manufacturer: { type: 'string' }
      },
      required: ['materialName']
    }
  },
  {
    name: 'get_material_costs',
    description: 'Get material pricing information',
    inputSchema: {
      type: 'object',
      properties: {
        materialType: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', default: 10 }
      }
    }
  },
  {
    name: 'get_labor_rates',
    description: 'Get labor rates by trade',
    inputSchema: {
      type: 'object',
      properties: {
        trade: {
          type: 'string',
          enum: ['plumber', 'electrician', 'carpenter', 'general_labor', 'tile_setter', 'painter']
        }
      }
    }
  },
  {
    name: 'search_installation_videos',
    description: 'Search YouTube for installation how-to videos',
    inputSchema: {
      type: 'object',
      properties: {
        material: { type: 'string' },
        task: { type: 'string' },
        limit: { type: 'number', default: 5 }
      },
      required: ['material', 'task']
    }
  },
  {
    name: 'get_manufacturer_website',
    description: 'Fetch manufacturer product information from their website',
    inputSchema: {
      type: 'object',
      properties: {
        manufacturer: { type: 'string' },
        productName: { type: 'string' }
      },
      required: ['manufacturer', 'productName']
    }
  },
  {
    name: 'generate_lens_config',
    description: 'Generate Lens Studio scene configuration for AR overlays',
    inputSchema: {
      type: 'object',
      properties: {
        overlayType: {
          type: 'string',
          enum: ['violation', 'design_analysis', 'code_requirement', 'permit_info']
        },
        data: { type: 'object' }
      },
      required: ['overlayType', 'data']
    }
  },
  {
    name: 'analyze_live_inspection',
    description: 'Real-time AI analysis for live EYESIGHT mode - optimized for speed, returns violations with AR coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'Base64 or URL of current camera frame'
        },
        sessionId: {
          type: 'string',
          description: 'Live inspection session ID'
        },
        frameNumber: {
          type: 'number',
          description: 'Frame sequence number'
        },
        timestamp: {
          type: 'number',
          description: 'Unix timestamp'
        }
      },
      required: ['imageUrl', 'sessionId']
    }
  },
  {
    name: 'capture_violation',
    description: 'Capture a violation during live inspection with photo, generate PDF report, and email to user',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'Base64 or URL of violation photo'
        },
        sessionId: {
          type: 'string',
          description: 'Live inspection session ID'
        },
        violation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            code: { type: 'string' },
            issue: { type: 'string' },
            severity: { type: 'string' },
            category: { type: 'string' },
            coordinates: { type: 'object' },
            confidence: { type: 'number' }
          }
        },
        userEmail: {
          type: 'string',
          description: 'Email address for PDF delivery (demo accounts)'
        },
        projectId: {
          type: 'string',
          description: 'Optional project ID'
        },
        location: {
          type: 'string',
          description: 'Optional GPS location'
        }
      },
      required: ['imageUrl', 'sessionId', 'violation']
    }
  }
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  // ============================================================================
  // AUTHENTICATION CHECK (CRITICAL FIX)
  // ============================================================================
  const apiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization');

  const isValidKey =
    apiKey === SUPABASE_ANON_KEY ||
    apiKey === SUPABASE_SERVICE_ROLE_KEY ||
    authHeader === `Bearer ${SUPABASE_ANON_KEY}` ||
    authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  if (!isValidKey) {
    console.error('❌ Authentication failed:', {
      hasApiKey: !!apiKey,
      hasAuthHeader: !!authHeader
    });

    return new Response(JSON.stringify({
      error: 'Invalid authentication',
      code: 'AUTH_FAILED',
      message: 'Please check your API key and authorization headers'
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  const clientId = req.headers.get('x-client-id') || apiKey?.substring(0, 20) || 'anonymous';
  const now = Date.now();
  const limit = rateLimiter.get(clientId);

  if (limit && limit.resetAt > now) {
    if (limit.count > 100) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
        retryAfter: 60
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }
    limit.count++;
  } else {
    rateLimiter.set(clientId, {
      count: 1,
      resetAt: now + 60000
    });
  }

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Health check
    if (url.pathname === '/health' || url.pathname.endsWith('/health')) {
      const health = {
        status: 'ok',
        server: 'visinspection-mcp',
        version: '1.0.0',
        services: {
          openai: OPENAI_API_KEY ? 'configured' : 'missing',
          google_ai: GOOGLE_AI_API_KEY ? 'configured' : 'missing',
          supabase: SUPABASE_URL ? 'configured' : 'missing'
        },
        timestamp: new Date().toISOString()
      };

      const allHealthy = Object.values(health.services).every((s) => s === 'configured');

      return new Response(JSON.stringify(health), {
        status: allHealthy ? 200 : 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // List tools
    if (url.pathname.includes('/list-tools')) {
      return new Response(JSON.stringify({
        tools: MCP_TOOLS
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Execute tool
    if (url.pathname.includes('/call-tool') && req.method === 'POST') {
      // ============================================================================
      // REQUEST VALIDATION
      // ============================================================================
      const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
      const body = await req.text();

      if (body.length > MAX_PAYLOAD_SIZE) {
        return new Response(JSON.stringify({
          error: 'Payload too large (max 10MB)'
        }), {
          status: 413,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch (parseError) {
        return new Response(JSON.stringify({
          error: 'Invalid JSON payload'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      const { name, arguments: args } = payload;

      if (!name || typeof name !== 'string') {
        return new Response(JSON.stringify({
          error: 'Tool name is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Request ID for tracing
      const requestId = crypto.randomUUID();
      console.log(`[${requestId}] Tool call: ${name}`);

      let result;

      switch (name) {
        case 'get_design_analysis':
          result = await getDesignAnalysis(args);
          break;
        case 'create_project':
          result = await createProject(args, supabase);
          break;
        case 'list_projects':
          result = await listProjects(args, supabase);
          break;
        case 'get_project_details':
          result = await getProjectDetails(args, supabase);
          break;
        case 'analyze_physical_plan':
          result = await analyzePhysicalPlan(args, supabase);
          break;
        case 'analyze_photo':
          result = await analyzePhoto(args);
          break;
        case 'get_building_codes':
          result = await getBuildingCodes(args, supabase);
          break;
        case 'get_permit_requirements':
          result = await getPermitRequirements(args, supabase);
          break;
        case 'check_code_compliance':
          result = await checkCodeCompliance(args, supabase);
          break;
        case 'create_inspection_report':
          result = await createInspectionReport(args, supabase);
          break;
        case 'get_inspection_projects':
          result = await getInspectionProjects(args, supabase);
          break;
        case 'get_material_info':
          result = await getMaterialInfo(args);
          break;
        case 'get_material_costs':
          result = await getMaterialCosts(args, supabase);
          break;
        case 'get_labor_rates':
          result = await getLaborRates(args, supabase);
          break;
        case 'search_installation_videos':
          result = await searchInstallationVideos(args);
          break;
        case 'get_manufacturer_website':
          result = await getManufacturerWebsite(args);
          break;
        case 'generate_lens_config':
          result = await generateLensConfig(args);
          break;
        case 'analyze_live_inspection':
          result = await analyzeLiveInspection(args, supabase);
          break;
        case 'capture_violation':
          result = await captureViolation(args, supabase);
          break;
        default:
          return new Response(JSON.stringify({
            error: `Unknown tool: ${name}`,
            availableTools: MCP_TOOLS.map((t) => t.name)
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
      }

      // Add request ID to response
      if (result && typeof result === 'object') {
        result.requestId = requestId;
      }

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('MCP Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

async function createProject(args, supabase) {
  // Auto-geocode if enabled
  let coordinates = args.coordinates;
  if ((args.autoGPS === undefined || args.autoGPS) && !coordinates && args.address) {
    try {
      const geoResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: `Geocode this address and return ONLY JSON: "${args.address}". Format: {"latitude": 21.3099, "longitude": -157.8581}`
          }],
          temperature: 0
        })
      });

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        const content = geoData.choices[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        if (parsed.latitude && parsed.longitude) {
          coordinates = parsed;
        }
      }
    } catch (e) {
      console.warn('Auto-GPS failed:', e);
    }
  }

  const { data, error } = await supabase.from('projects').insert({
    name: args.projectName,
    address: args.address,
    project_type: args.projectType,
    description: args.description,
    user_id: args.userId, // Changed from owner_id to user_id to match frontend
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        ...data,
        auto_gps_used: !!coordinates && !args.coordinates
      }, null, 2)
    }]
  };
}

async function analyzePhysicalPlan(args, supabase) {
  const prompts = {
    takeoff: 'Perform construction take-off: count materials, measure linear footage, calculate square footage',
    dimension_extraction: 'Extract all dimensions: read callouts, room sizes, door/window dimensions',
    material_count: 'Count materials: fixtures, doors, windows, outlets, structural elements',
    specification_read: 'Read specifications: extract notes, material specs, code references',
    room_layout: 'Analyze room layout: identify rooms, dimensions, spatial relationships',
    full_analysis: 'Comprehensive analysis: dimensions, materials, specs, layout, code compliance'
  };

  const prompt = `Analyze this ${args.planType || 'building'} plan.

${prompts[args.analysisType] || prompts.full_analysis}
${args.scaleInfo ? `\nScale: ${args.scaleInfo}` : ''}
${args.focusArea ? `\nFocus: ${args.focusArea}` : ''}

Return JSON:
{
  "plan_type": "...",
  "scale": "...",
  "rooms": [{"name": "...", "dimensions": "...", "area_sqft": 0}],
  "dimensions": [{"item": "...", "measurement": "...", "unit": "..."}],
  "materials": [{"material": "...", "quantity": 0, "unit": "..."}],
  "takeoff_summary": {"total_wall_length_ft": 0, "door_count": 0},
  "confidence": 0-100
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: args.photoUrl } }
        ]
      }],
      max_tokens: 4000
    })
  });

  const data = await response.json();
  const analysisText = data.choices[0]?.message?.content || '{}';
  let analysisData;

  try {
    analysisData = JSON.parse(analysisText);
  } catch {
    analysisData = { raw_analysis: analysisText };
  }

  // Save to database
  await supabase.from('building_plans').insert({
    project_id: args.projectId,
    file_name: `Physical Plan - ${args.analysisType}`,
    file_type: 'image',
    file_url: args.photoUrl,
    upload_method: 'spectacles',
    processing_status: 'completed',
    extracted_rooms: analysisData.rooms || [],
    extracted_materials: analysisData.materials || [],
    extracted_dimensions: analysisData.dimensions || []
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        analysis: analysisData
      }, null, 2)
    }]
  };
}

async function analyzePhoto(args) {
  const prompts = {
    defect_detection: 'Analyze for defects, code violations, quality issues. List problems with severity (critical/high/medium/low). Reference Honolulu codes.',
    code_compliance: 'Check building code compliance per Honolulu jurisdiction (IRC 2018, IBC 2018, NEC 2020, IPC 2018). Cite specific code sections.',
    material_identification: 'Identify all building materials. List types, quantities, quality, code compliance.',
    general: 'Detailed construction analysis. Describe what you see, identify issues, reference applicable codes.'
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompts[args.analysisType] || prompts.general },
          { type: 'image_url', image_url: { url: args.imageUrl } }
        ]
      }]
    })
  });

  const data = await response.json();
  const analysis = data.choices[0]?.message?.content || 'No analysis';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        analysisType: args.analysisType,
        analysis
      }, null, 2)
    }]
  };
}

async function getMaterialInfo(args) {
  const searchQuery = args.manufacturer ? `${args.manufacturer} ${args.materialName}` : args.materialName;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Find info about: "${searchQuery}"\n\nProvide:\n1. Specs\n2. MSDS URL\n3. Honolulu code requirements\n4. Pricing\n5. Distributors in Hawaii\n\nFormat as JSON.`
      }]
    })
  });

  const data = await response.json();
  const info = data.choices[0]?.message?.content || 'No info found';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        materialName: args.materialName,
        info
      }, null, 2)
    }]
  };
}

async function searchInstallationVideos(args) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Find top ${args.limit || 5} YouTube videos for: "${args.task} ${args.material}"\n\nReturn JSON array with: title, url, channel, duration, description.`
      }]
    })
  });

  const data = await response.json();
  const videos = data.choices[0]?.message?.content || '[]';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        material: args.material,
        task: args.task,
        videos
      }, null, 2)
    }]
  };
}

async function listProjects(args, supabase) {
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(args.limit || 10);
  if (args.userId) {
    query = query.eq('user_id', args.userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getBuildingCodes(args, supabase) {
  const { data, error } = await supabase.from('code_requirements').select('*').eq('room_type', args.roomType.toLowerCase()).limit(10);
  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getDesignAnalysis(args) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-design`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userInput: args.userInput,
      context: {
        existingRoomDimensions: args.roomDimensions,
        location: args.location || 'Honolulu, HI'
      }
    })
  });

  const data = await response.json();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getPermitRequirements(args, supabase) {
  const { data, error } = await supabase.rpc('get_permit_requirements', {
    p_room_type: args.roomType,
    p_work_types: args.workTypes
  });

  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function checkCodeCompliance(args, supabase) {
  const { data, error } = await supabase.rpc('check_code_compliance', {
    p_room_type: args.roomType,
    p_measurements: args.measurements
  });

  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function createInspectionReport(args, supabase) {
  const { data, error } = await supabase.from('inspection_reports').insert({
    project_id: args.projectId,
    finding_type: args.findingType,
    severity: args.severity,
    description: args.description,
    location: args.location?.room,
    photo_urls: args.photoUrl ? [args.photoUrl] : [],
    inspector_name: args.inspectorName,
    gps_location: args.location?.coordinates ? `POINT(${args.location.coordinates.longitude} ${args.location.coordinates.latitude})` : null,
    status: 'open'
  }).select().single();

  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getInspectionProjects(args, supabase) {
  const { data, error } = await supabase.from('inspection_reports').select('*').order('created_at', { ascending: false }).limit(args.limit || 10);
  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getProjectDetails(args, supabase) {
  // Get project info
  const { data: project, error: projectError } = await supabase.from('projects').select('*').eq('id', args.projectId).single();
  if (projectError) throw projectError;

  // Get inspection sessions
  const { data: sessions } = await supabase.from('inspection_sessions').select('*').eq('project_id', args.projectId).order('created_at', { ascending: false });

  // Get violations
  const { data: violations } = await supabase.from('inspection_violations').select('*').eq('project_id', args.projectId).order('created_at', { ascending: false });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        project,
        sessions: sessions || [],
        violations: violations || []
      }, null, 2)
    }]
  };
}

async function getMaterialCosts(args, supabase) {
  let query = supabase.from('material_pricing').select('*').order('created_at', { ascending: false }).limit(args.limit || 10);
  if (args.materialType) {
    query = query.eq('material_type', args.materialType);
  }
  if (args.search) {
    query = query.ilike('material_name', `%${args.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getLaborRates(args, supabase) {
  let query = supabase.from('labor_rates').select('*').order('trade_name');
  if (args.trade) {
    query = query.eq('trade_name', args.trade);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data, null, 2)
    }]
  };
}

async function getManufacturerWebsite(args) {
  const prompt = `Find the official website and product page for: "${args.manufacturer} ${args.productName}"

Please provide:
1. Manufacturer website URL
2. Product page URL
3. Key product specifications
4. Available colors/finishes
5. Warranty information
6. Where to buy (distributors)
7. Technical documents available (installation guides, spec sheets)

Format as JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 1500
    })
  });

  const data = await response.json();
  const websiteInfo = data.choices[0]?.message?.content || 'No information found';

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        manufacturer: args.manufacturer,
        productName: args.productName,
        websiteInfo
      }, null, 2)
    }]
  };
}

async function generateLensConfig(args) {
  const config = {
    overlayType: args.overlayType,
    sceneConfig: {
      arRoot: {
        name: 'AR_Root',
        position: [0, 0, -1]
      },
      overlays: []
    },
    data: args.data
  };

  // Generate overlay configuration based on type
  switch (args.overlayType) {
    case 'violation':
      config.sceneConfig.overlays = (args.data.violations || []).map((v, i) => ({
        type: 'text',
        name: `violation_${i}`,
        text: v.message,
        position: [0, 0.3 - i * 0.08, -1],
        color: v.severity === 'critical' ? [1, 0, 0, 1] : v.severity === 'high' ? [1, 0.5, 0, 1] : [1, 1, 0, 1],
        size: 18
      }));
      break;
    case 'design_analysis':
      config.sceneConfig.overlays = [{
        type: 'text',
        name: 'feasibility',
        text: `Feasibility: ${args.data.overallFeasibility}`,
        position: [0, 0.3, -1],
        color: args.data.overallFeasibility === 'feasible' ? [0, 1, 0, 1] : [1, 0, 0, 1],
        size: 20
      }];
      break;
    case 'code_requirement':
      config.sceneConfig.overlays = (args.data.requirements || []).map((r, i) => ({
        type: 'text',
        name: `requirement_${i}`,
        text: `${r.code_section}: ${r.description}`,
        position: [0, 0.3 - i * 0.08, -1],
        color: r.compliant ? [0, 1, 0, 1] : [1, 0, 0, 1],
        size: 16
      }));
      break;
    case 'permit_info':
      config.sceneConfig.overlays = (args.data.permits || []).map((p, i) => ({
        type: 'text',
        name: `permit_${i}`,
        text: `${p.permitName}: $${p.totalEstimatedFee}`,
        position: [0, 0.3 - i * 0.08, -1],
        color: [1, 0.65, 0, 1],
        size: 16
      }));
      break;
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(config, null, 2)
    }]
  };
}

// MODE-BASED AI: Use Gemini Flash for speed (live EYESIGHT mode)
async function analyzeLiveInspection(args, supabase) {
  const prompt = `You are analyzing a construction site in REAL-TIME. Be FAST and CONCISE.

ANALYZE THIS IMAGE FOR:
1. Building code violations (cite Honolulu codes: IRC 2018, IBC 2018, NEC 2020, IPC 2018)
2. Safety hazards (OSHA violations)
3. Structural defects
4. Quality issues

Return ONLY violations found. Format:
{
  "violations": [{
    "id": "unique_id",
    "code": "HBC 1808.3",
    "issue": "Brief description",
    "severity": "critical|high|medium|low",
    "category": "structural|electrical|plumbing|safety|quality",
    "coordinates": {"x": 0.0-1.0, "y": 0.0-1.0}
  }],
  "summary": "Quick summary",
  "frame_quality": "good|poor",
  "confidence": 0-100
}

If NO violations: return {"violations": [], "summary": "No violations detected"}

Be FAST. Maximum 1 second.`;

  // Use Gemini 1.5 Flash for speed (0.5-1s response time)
  const imageBase64 = args.imageUrl.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json();
  const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"violations": []}';
  let analysisData;

  try {
    analysisData = JSON.parse(analysisText);
  } catch {
    analysisData = {
      violations: [],
      summary: 'Analysis parsing error',
      frame_quality: 'poor',
      confidence: 0
    };
  }

  // Log session data for analytics
  await supabase.from('live_inspection_sessions').upsert({
    session_id: args.sessionId,
    frame_number: args.frameNumber || 0,
    timestamp: args.timestamp || Date.now(),
    violations_count: analysisData.violations?.length || 0,
    confidence: analysisData.confidence || 0
  });

  // Save individual violations
  if (analysisData.violations && analysisData.violations.length > 0) {
    const violationRecords = analysisData.violations.map((v) => ({
      session_id: args.sessionId,
      frame_number: args.frameNumber,
      violation_id: v.id,
      code: v.code,
      issue: v.issue,
      severity: v.severity,
      category: v.category,
      coordinates: v.coordinates
    }));

    await supabase.from('live_inspection_violations').insert(violationRecords);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        sessionId: args.sessionId,
        frameNumber: args.frameNumber,
        violations: analysisData.violations || [],
        summary: analysisData.summary || '',
        confidence: analysisData.confidence || 0,
        processingTime: Date.now() - (args.timestamp || 0)
      }, null, 2)
    }]
  };
}

// MODE-BASED AI: Use GPT-4o for accuracy (captured violations for reports)
async function captureViolation(args, supabase) {
  const timestamp = Date.now();
  const violationId = args.violation.id || `vio_${timestamp}`;

  // 1. Re-analyze with GPT-4o for detailed, accurate report
  const detailedPrompt = `You are a professional building inspector creating an official violation report.

ANALYZE THIS IMAGE IN DETAIL:
- Building code violations (cite exact Honolulu codes: IRC 2018, IBC 2018, NEC 2020, IPC 2018)
- Safety hazards (OSHA violations with section numbers)
- Structural defects with severity assessment
- Quality issues with remediation recommendations

Initial detection: ${args.violation.code} - ${args.violation.issue}

Provide DETAILED analysis with:
1. Exact code citations
2. Clear violation description
3. Severity justification
4. Remediation steps
5. Professional recommendations

Return JSON:
{
  "code": "Full code citation",
  "issue": "Detailed description",
  "severity": "critical|high|medium|low",
  "category": "structural|electrical|plumbing|safety|quality",
  "confidence": 0-100,
  "remediation": "Step-by-step fix",
  "professional_notes": "Additional context"
}`;

  let detailedViolation = args.violation; // Fallback to original if re-analysis fails

  try {
    const reanalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: detailedPrompt },
            { type: 'image_url', image_url: { url: args.imageUrl, detail: 'high' } }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    const reanalysisData = await reanalysisResponse.json();
    const detailedText = reanalysisData.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(detailedText);
      detailedViolation = { ...args.violation, ...parsed };
    } catch {
      console.log('GPT-4o re-analysis parsing failed, using original data');
    }
  } catch (error) {
    console.error('GPT-4o re-analysis failed:', error);
  }

  // 2. Upload photo to Supabase Storage
  let photoUrl = '';
  try {
    const base64Data = args.imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const fileName = `violations/${args.sessionId}/${violationId}.jpg`;

    const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('inspection-photos').getPublicUrl(fileName);
    photoUrl = publicUrl;
  } catch (error) {
    console.error('Photo upload failed:', error);
    photoUrl = 'error_uploading_photo';
  }

  // 3. Save captured violation to database
  const violationRecord = {
    id: violationId,
    session_id: args.sessionId,
    project_id: args.projectId || null,
    violation_code: detailedViolation.code,
    issue_description: detailedViolation.issue,
    severity: detailedViolation.severity,
    category: detailedViolation.category,
    confidence: detailedViolation.confidence || 0,
    coordinates: detailedViolation.coordinates || args.violation.coordinates,
    photo_url: photoUrl,
    location: args.location || null,
    captured_at: new Date(timestamp).toISOString(),
    status: 'captured'
  };

  const { error: dbError } = await supabase.from('captured_violations').insert(violationRecord);
  if (dbError) {
    console.error('Database insert failed:', dbError);
  }

  // 4. Generate PDF report (simple HTML-based)
  const reportHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #0066CC; border-bottom: 3px solid #0066CC; padding-bottom: 10px; }
    .header { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .violation-photo { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; }
    .severity { display: inline-block; padding: 5px 15px; border-radius: 4px; color: white; font-weight: bold; }
    .severity-critical { background: #DC143C; }
    .severity-high { background: #FF8C00; }
    .severity-medium { background: #FFD700; color: #333; }
    .severity-low { background: #0066CC; }
    .details { background: white; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .label { font-weight: bold; color: #666; margin-top: 15px; }
    .value { margin: 5px 0 15px 0; }
    .footer { text-align: center; color: #999; margin-top: 40px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>VISION - Violation Report</h1>
  <div class="header">
    <p><strong>Session ID:</strong> ${args.sessionId}</p>
    <p><strong>Captured:</strong> ${new Date(timestamp).toLocaleString()}</p>
    <p><strong>Location:</strong> ${args.location || 'Not specified'}</p>
  </div>
  <div class="details">
    <h2>Violation Details</h2>
    <div class="label">Severity:</div>
    <div class="value">
      <span class="severity severity-${args.violation.severity}">${args.violation.severity.toUpperCase()}</span>
    </div>
    <div class="label">Building Code Reference:</div>
    <div class="value">${args.violation.code}</div>
    <div class="label">Issue Description:</div>
    <div class="value">${args.violation.issue}</div>
    <div class="label">Category:</div>
    <div class="value">${args.violation.category}</div>
    <div class="label">AI Confidence:</div>
    <div class="value">${args.violation.confidence}%</div>
    <div class="label">Photo Evidence:</div>
    <img src="${photoUrl}" class="violation-photo" alt="Violation photo">
  </div>
  <div class="footer">
    <p>Generated by VISION v3.2 | visinspection.com</p>
    <p>This is an AI-generated report. Professional verification recommended.</p>
  </div>
</body>
</html>`;

  // 5. Email to user with smart routing
  let emailSent = false;
  const primaryEmail = args.userEmail || 'info@visinspection.com';
  const isDemoAccount = !args.userEmail || args.userEmail === 'info@visinspection.com';

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not set - skipping email');
    } else {
      const emailBody = {
        from: 'VISION <reports@visinspection.com>',
        to: primaryEmail,
        subject: `Violation Captured - ${args.violation.code} (${args.violation.severity.toUpperCase()})`,
        html: reportHtml
      };

      if (!isDemoAccount) {
        emailBody.bcc = 'info@visinspection.com';
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });

      const emailResult = await emailResponse.json();
      if (emailResponse.ok) {
        emailSent = true;
        console.log(`Email sent successfully to ${primaryEmail}`, emailResult);
      } else {
        console.error('Resend API error:', emailResult);
      }
    }
  } catch (emailError) {
    console.error('Email failed:', emailError);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        violationId: violationId,
        photoUrl: photoUrl,
        reportHtml: reportHtml,
        emailSent: emailSent,
        userEmail: args.userEmail || 'none',
        message: 'Violation captured successfully',
        downloadUrl: photoUrl
      }, null, 2)
    }]
  };
}
