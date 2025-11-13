// services/McpClient.js
import { MCP_URL, SUPABASE_ANON_KEY, isConfigValid } from '../config/env';

const BASE = MCP_URL;

// Validate MCP URL on module load
const config = isConfigValid();
if (!config.mcp) {
  console.error('[McpClient] Invalid MCP_URL configuration:', BASE);
}

/**
 * Calls the MCP server using the official /call-tool protocol.
 */
export async function analyzeLiveInspection({
  projectId,
  projectName,
  frame_b64,
  inspectionType,
  sessionId,
  frameNumber,
}) {
  if (!BASE || !config.mcp) {
    throw new Error("MCP service URL not configured. Please set EXPO_PUBLIC_MCP_URL.");
  }

  const url = `${BASE}/call-tool`;

  const imageUrl = frame_b64?.startsWith('data:')
    ? frame_b64
    : `data:image/jpeg;base64,${frame_b64}`;

  const payload = {
    name: 'analyze_live_inspection',
    arguments: {
      imageUrl,
      projectId: projectId || 'unknown',
      projectName: projectName || 'Unknown',
      inspectionType: inspectionType || 'building',
      sessionId: sessionId || projectId || `session_${Date.now()}`,
      frameNumber: typeof frameNumber === 'number' ? frameNumber : Date.now(),
      timestamp: Date.now(),
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');

      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication failed. Please check your credentials.');
      } else if (res.status >= 500) {
        throw new Error('AI service is temporarily unavailable. Please try again.');
      } else {
        throw new Error(`Service error (${res.status}): ${text || 'Unknown error'}`);
      }
    }

    const data = await res.json();
    const rawContent = data?.content?.[0]?.text;

    if (!rawContent) {
      throw new Error('Invalid MCP response format (missing content).');
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      console.error('[McpClient] Failed to parse MCP content:', rawContent);
      throw new Error('Invalid MCP response payload.');
    }

    let overlays = Array.isArray(parsed.overlays) ? parsed.overlays : [];
    if (!overlays.length && Array.isArray(parsed.violations)) {
      overlays = parsed.violations.map((v, idx) => ({
        id: v.id || `${Date.now()}_${idx}`,
        text: v.description || v.text || 'Violation',
        severity: v.severity || 'major',
        code: v.code_reference || v.code || v.codeReference || 'Code Unknown',
        x: typeof v.x === 'number' ? v.x : 0.08,
        y: typeof v.y === 'number' ? v.y : 0.70,
      }));
    }

    const narration = parsed.narration || parsed.message || '';
    return { overlays, narration };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
      throw new Error('Network connection failed. Please check your internet connection.');
    }
    throw error;
  }
}

export async function health() {
  // Use sanitized MCP_URL constant instead of raw env var
  if (!BASE || !config.mcp) {
    console.warn('[McpClient] Cannot check health - invalid MCP_URL:', BASE);
    return 0;
  }

  const url = `${BASE}/health`;
  try {
    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    return r.status;
  } catch (error) {
    console.error('[McpClient] Health check failed:', error.message);
    return 0;
  }
}
