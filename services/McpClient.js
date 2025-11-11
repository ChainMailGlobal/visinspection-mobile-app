// services/McpClient.js
const BASE = process.env.EXPO_PUBLIC_MCP_URL;
if (!BASE) console.warn("EXPO_PUBLIC_MCP_URL is not set");

export async function analyzeLiveInspection({ projectId, projectName, frame_b64 }) {
  const url = `${BASE}/analyze_live_inspection`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, projectName, frame_b64 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MCP ${res.status}: ${text}`);
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
}

export async function health() {
  const url = `${process.env.EXPO_PUBLIC_MCP_URL}/health`;
  try { const r = await fetch(url); return r.status; } catch { return 0; }
}
