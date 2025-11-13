// services/McpClient.js
import { MCP_URL, isConfigValid } from '../config/env';

const BASE = MCP_URL;

// Validate MCP URL on module load
const config = isConfigValid();
if (!config.mcp) {
  console.error('[McpClient] Invalid MCP_URL configuration:', BASE);
}

export async function analyzeLiveInspection({ projectId, projectName, frame_b64, inspectionType }) {
  if (!BASE) {
    throw new Error("MCP service URL not configured. Please set EXPO_PUBLIC_MCP_URL.");
  }

  const url = `${BASE}/analyze_live_inspection`;

  try {
    // Implement proper timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, projectName, frame_b64, inspectionType }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      // Provide more helpful error messages
      if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication failed. Please check your credentials.");
      } else if (res.status >= 500) {
        throw new Error("AI service is temporarily unavailable. Please try again.");
      } else {
        throw new Error(`Service error (${res.status}): ${text || 'Unknown error'}`);
      }
    }

    const data = await res.json();

    // Normalize to working-repo shape:
    // Accept either `overlays` or `violations`, map to overlays.
    let overlays = Array.isArray(data.overlays) ? data.overlays : [];
    if (!overlays.length && Array.isArray(data.violations)) {
      overlays = data.violations.map(v => ({
        text: v.description || v.text || "Violation",
        severity: v.severity || "major",
        x: typeof v.x === "number" ? v.x : 0.08,
        y: typeof v.y === "number" ? v.y : 0.70,
        code_reference: v.codeReference || v.code_reference,
      }));
    }

    const narration = data.narration || data.message || "";
    return { overlays, narration };
  } catch (error) {
    // Handle timeout
    if (error.name === 'AbortError') {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    // Re-throw with more context if it's a network error
    if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
      throw new Error("Network connection failed. Please check your internet connection.");
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
    const r = await fetch(url);
    return r.status;
  } catch (error) {
    console.error('[McpClient] Health check failed:', error.message);
    return 0;
  }
}
