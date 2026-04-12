import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  image_base64: string;
  entity_type: string;
  entity_name: string;
  vision_endpoint: string;
  vision_api_key?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      image_base64,
      entity_type,
      entity_name,
      vision_endpoint,
      vision_api_key,
    }: AnalyzeRequest = await req.json();

    if (!image_base64 || !vision_endpoint) {
      return new Response(
        JSON.stringify({
          error: "image_base64 and vision_endpoint are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const entityLabel =
      entity_type === "characters"
        ? "character"
        : entity_type === "places"
          ? "place/location"
          : entity_type === "things"
            ? "object/item"
            : "technology/system";

    const systemPrompt = `You are a visual analyst for a novel-writing application. Describe what you see in this image as it relates to a fictional ${entityLabel}${entity_name ? ` named "${entity_name}"` : ""}. Focus on:
- Physical appearance, distinctive features, and visual details
- Colors, textures, materials, and lighting
- Mood, atmosphere, and emotional tone
- Any notable symbols, markings, or distinguishing characteristics
Write a rich, detailed description that a writer could use to maintain visual consistency. Be specific and vivid. Write in present tense, 2-3 paragraphs.`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (vision_api_key) {
      headers["Authorization"] = `Bearer ${vision_api_key}`;
    }

    const dataUri = image_base64.startsWith("data:")
      ? image_base64
      : `data:image/jpeg;base64,${image_base64}`;

    const requestBody = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: { url: dataUri, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    };

    const response = await fetch(vision_endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({
          error: `Vision API error: ${response.status}`,
          details: errText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    const description =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      data.text ||
      data.content ||
      "";

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
