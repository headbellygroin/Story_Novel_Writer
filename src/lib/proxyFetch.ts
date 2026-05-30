import { resolveUrl, getResolvedComfyEndpoint } from './endpointResolver';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;
const COMFYUI_PROXY_URL = `${SUPABASE_URL}/functions/v1/comfyui-proxy`;

const proxyHeaders = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// Private/local network targets must be called directly from the browser
// because Supabase edge functions cannot reach Tailscale IPs or localhost.
function isLocalTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    // Tailscale CGNAT range: 100.64.0.0/10 (100.64.x.x - 100.127.x.x)
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)) return true;
    // Standard private ranges
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return true;
    // Windows hostname (not a domain with dots) likely on LAN
    if (!hostname.includes('.')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function aiProxyFetch(
  targetUrl: string,
  body: Record<string, unknown>,
  stream = false,
  signal?: AbortSignal
): Promise<Response> {
  // Resolve localhost to remote Tailscale IP if we're not on the AI machine
  const resolved = await resolveUrl(targetUrl);

  if (isLocalTarget(resolved)) {
    return fetch(resolved, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  }
  return fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify({ target_url: resolved, method: 'POST', body, stream }),
    signal,
  });
}

export async function aiProxyGet(targetUrl: string): Promise<Response> {
  const resolved = await resolveUrl(targetUrl);

  if (isLocalTarget(resolved)) {
    return fetch(resolved, { method: 'GET' });
  }
  return fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify({ target_url: resolved, method: 'GET' }),
  });
}

export async function comfyProxyGet(endpoint: string, path: string): Promise<Response> {
  const resolved = await resolveUrl(endpoint);

  if (isLocalTarget(resolved)) {
    const normalizedBase = resolved.replace(/\/$/, '');
    return fetch(`${normalizedBase}${path}`, { method: 'GET' });
  }
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(resolved)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  });
}

export async function comfyProxyPost(endpoint: string, path: string, body: unknown): Promise<Response> {
  const resolved = await resolveUrl(endpoint);

  if (isLocalTarget(resolved)) {
    const normalizedBase = resolved.replace(/\/$/, '');
    return fetch(`${normalizedBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(resolved)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(body),
  });
}

export async function comfyProxyUpload(endpoint: string, path: string, formData: FormData): Promise<Response> {
  const resolved = await resolveUrl(endpoint);

  if (isLocalTarget(resolved)) {
    const normalizedBase = resolved.replace(/\/$/, '');
    return fetch(`${normalizedBase}${path}`, {
      method: 'POST',
      body: formData,
    });
  }
  const url = `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(resolved)}&path=${encodeURIComponent(path)}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: formData,
  });
}

export function comfyProxyMediaUrl(endpoint: string, path: string): string {
  if (isLocalTarget(endpoint)) {
    const normalizedBase = endpoint.replace(/\/$/, '');
    return `${normalizedBase}${path}`;
  }
  return `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}&path=${encodeURIComponent(path)}`;
}

/**
 * Rewrites a stored ComfyUI image URL to be accessible from the current network context.
 * Stored URLs may contain 127.0.0.1 / localhost origins that don't work remotely.
 * We extract the path and rebuild against the resolved endpoint.
 */
export function proxyImageUrl(storedUrl: string, comfyEndpoint: string): string {
  if (!storedUrl) return storedUrl;

  if (storedUrl.includes('supabase.co')) return storedUrl;
  if (storedUrl.includes('/functions/v1/comfyui-proxy')) return storedUrl;

  // Use the resolved endpoint (switches to Tailscale IP if we're remote)
  const resolvedEndpoint = getResolvedComfyEndpoint(comfyEndpoint);

  // Extract the /view?... path from any ComfyUI URL (stored with any origin)
  const viewMatch = storedUrl.match(/\/view\?.+$/);
  if (viewMatch) {
    const path = viewMatch[0];
    if (isLocalTarget(resolvedEndpoint)) {
      const normalizedBase = resolvedEndpoint.replace(/\/$/, '');
      return `${normalizedBase}${path}`;
    }
    return `${COMFYUI_PROXY_URL}?endpoint=${encodeURIComponent(resolvedEndpoint)}&path=${encodeURIComponent(path)}`;
  }

  // If it's a full URL with a local/private origin but no /view path, try rebasing
  try {
    const parsed = new URL(storedUrl);
    if (isLocalTarget(storedUrl)) {
      const normalizedBase = resolvedEndpoint.replace(/\/$/, '');
      return `${normalizedBase}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // not a valid URL, return as-is
  }

  return storedUrl;
}
