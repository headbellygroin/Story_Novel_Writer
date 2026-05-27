import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetBase = url.searchParams.get("endpoint");

    if (!targetBase) {
      return new Response(
        JSON.stringify({ error: "endpoint query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedBase = targetBase.replace(/\/$/, "");
    const pathParam = url.searchParams.get("path") || "/";

    const targetUrl = `${normalizedBase}${pathParam}`;

    if (req.method === "GET") {
      const response = await fetch(targetUrl, {
        method: "GET",
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream error: ${response.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (contentType.includes("image") || contentType.includes("audio") || contentType.includes("video")) {
        const blob = await response.blob();
        return new Response(blob, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Content-Disposition": response.headers.get("Content-Disposition") || "",
          },
        });
      }

      const data = await response.text();
      return new Response(data, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": contentType || "application/json" },
      });
    }

    if (req.method === "POST") {
      const contentType = req.headers.get("Content-Type") || "";
      let fetchOptions: RequestInit;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        fetchOptions = {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(30000),
        };
      } else {
        const body = await req.text();
        fetchOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(30000),
        };
      }

      const response = await fetch(targetUrl, fetchOptions);

      if (!response.ok) {
        const errText = await response.text();
        return new Response(
          JSON.stringify({ error: `Upstream error: ${response.status}`, details: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.text();
      return new Response(data, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": response.headers.get("Content-Type") || "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not supported` }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
