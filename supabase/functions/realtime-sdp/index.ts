import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Require auth (verify_jwt = true in config.toml)
    const auth = req.headers.get("authorization");
    if (!auth) {
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

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
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

    const { offerSdp, ephemeralKey, model } = body;
    if (!offerSdp || !ephemeralKey) {
      return new Response(
        JSON.stringify({
          error: "Missing offerSdp or ephemeralKey",
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

    const realtimeModel = model || "gpt-4o-realtime-preview-2024-10-01";

    // Proxy the SDP exchange to OpenAI to avoid client-side CORS/network blocks
    const response = await fetch(
      `https://api.openai.com/v1/realtime?model=${encodeURIComponent(
        realtimeModel
      )}`,
      {
        method: "POST",
        body: offerSdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "[realtime-sdp] Upstream error:",
        response.status,
        text?.slice(0, 500)
      );
      return new Response(
        JSON.stringify({
          error: "SDP exchange failed",
          status: response.status,
          details: text,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        sdp: text,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("[realtime-sdp] Exception:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: msg,
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
