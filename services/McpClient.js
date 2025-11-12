// services/McpClient.js
const BASE = process.env.EXPO_PUBLIC_MCP_URL;
if (!BASE) console.warn("EXPO_PUBLIC_MCP_URL is not set");

export async function analyzeLiveInspection({ projectId, projectName, frame_b64, inspectionType }) {
  if (!BASE) {
    throw new Error("MCP service URL not configured. Please set EXPO_PUBLIC_MCP_URL.");
  }

  const url = `${BASE}/analyze_live_inspection`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, projectName, frame_b64, inspectionType }),
      timeout: 30000, // 30 second timeout
    });

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
    // Re-throw with more context if it's a network error
    if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
      throw new Error("Network connection failed. Please check your internet connection.");
    }
    throw error;
  }
}

export async function health() {
  const url = `${process.env.EXPO_PUBLIC_MCP_URL}/health`;
  try { const r = await fetch(url); return r.status; } catch { return 0; }
}
