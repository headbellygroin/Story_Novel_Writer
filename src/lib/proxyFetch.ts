const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;
const COMFYUI_PROXY_URL = `${SUPABASE_URL}/functions/v1/comfyui-proxy`;

const proxyHeaders = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export async function aiProxyFetch(
  targetUrl: string,
  body: Record<string, unknown>,
  stream = false
): Promise<Response> {
  return fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify({ target_url: targetUrl, method: 'POST', body, stream }),
  });
}

export async function aiProxyGet(targetUrl: string): Promise<Response> {
  return fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify({ target_url: targetUrl, method: 'GET' }),
  });
}

export function comfyProxyGet(endpoint: string, path: string): Promise<Response> {
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  });
}

export function comfyProxyPost(endpoint: string, path: string, body: unknown): Promise<Response> {
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(body),
  });
}

export function comfyProxyUpload(endpoint: string, path: string, formData: FormData): Promise<Response> {
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: formData,
  });
}

export function comfyProxyMediaUrl(endpoint: string, path: string): string {
  return `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
}

/**
 * Rewrites a stored ComfyUI image URL to route through the edge function proxy.
 * Old URLs may reference 127.0.0.1:8188, desktop-fbpj753:8188, etc.
 * This extracts the path (/view?...) and routes it through the current configured endpoint.
 */
export function proxyImageUrl(storedUrl: string, comfyEndpoint: string): string {
  if (!storedUrl) return storedUrl;

  // If it's already a Supabase storage URL or other non-ComfyUI URL, return as-is
  if (storedUrl.includes('supabase.co')) return storedUrl;

  // Detect ComfyUI URLs by the /view? pattern
  const viewMatch = storedUrl.match(/\/view\?.+$/);
  if (viewMatch) {
    const path = viewMatch[0];
    return `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(comfyEndpoint)}&path=${encodeURIComponent(path)}`;
  }

  // If already a proxy URL, return as-is
  if (storedUrl.includes('/functions/v1/comfyui-proxy')) return storedUrl;

  return storedUrl;
}
