import { supabase } from './supabase';

interface EndpointConfig {
  localApi: string;
  remoteApi: string;
  localComfy: string;
  remoteComfy: string;
  visionApi: string;
  isRemote: boolean;
}

let cachedConfig: EndpointConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000;
let resolvePromise: Promise<EndpointConfig> | null = null;

async function probe(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function isLocalAddress(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function doResolve(): Promise<EndpointConfig> {
  const { data } = await supabase
    .from('generation_settings')
    .select('api_endpoint, comfyui_endpoint, vision_api_endpoint, remote_api_endpoint, remote_comfyui_endpoint')
    .limit(1)
    .maybeSingle();

  const localApi = data?.api_endpoint || 'http://localhost:1234/v1/chat/completions';
  const remoteApi = data?.remote_api_endpoint || '';
  const localComfy = data?.comfyui_endpoint || 'http://127.0.0.1:8188';
  const remoteComfy = data?.remote_comfyui_endpoint || '';
  const visionApi = data?.vision_api_endpoint || '';

  // If main endpoint isn't local, no need to detect
  if (!isLocalAddress(localApi)) {
    return { localApi, remoteApi, localComfy, remoteComfy, visionApi, isRemote: false };
  }

  // Check if local is reachable
  const localBase = localApi.replace(/\/v1\/.*$/, '');
  const localOk = await probe(`${localBase}/v1/models`);

  if (localOk) {
    return { localApi, remoteApi, localComfy, remoteComfy, visionApi, isRemote: false };
  }

  // Local failed -- we're remote
  return { localApi, remoteApi, localComfy, remoteComfy, visionApi, isRemote: true };
}

export async function getEndpointConfig(): Promise<EndpointConfig> {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  if (!resolvePromise) {
    resolvePromise = doResolve().then((cfg) => {
      cachedConfig = cfg;
      cacheTimestamp = Date.now();
      resolvePromise = null;
      return cfg;
    });
  }

  return resolvePromise;
}

/**
 * Given a target URL (which might be localhost), returns the correct URL
 * based on whether we're local or remote.
 */
export async function resolveUrl(targetUrl: string): Promise<string> {
  if (!isLocalAddress(targetUrl)) return targetUrl;

  const config = await getEndpointConfig();
  if (!config.isRemote) return targetUrl;

  // We're remote - swap localhost for the remote equivalent
  if (config.remoteApi && targetUrl.includes('1234')) {
    const localBase = config.localApi.replace(/\/v1\/.*$/, '');
    const remoteBase = config.remoteApi.replace(/\/v1\/.*$/, '');
    return targetUrl.replace(localBase, remoteBase);
  }

  if (config.remoteComfy && (targetUrl.includes('8188') || targetUrl.includes('comfy'))) {
    const localBase = config.localComfy.replace(/\/$/, '');
    const remoteBase = config.remoteComfy.replace(/\/$/, '');
    return targetUrl.replace(localBase, remoteBase);
  }

  return targetUrl;
}

/**
 * Synchronous check - returns the cached remote ComfyUI endpoint for image URLs.
 * Falls back to the provided endpoint if no cache available yet.
 */
export function getResolvedComfyEndpoint(fallback: string): string {
  if (!cachedConfig || !cachedConfig.isRemote) return fallback;
  return cachedConfig.remoteComfy || fallback;
}

export function clearEndpointCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
  resolvePromise = null;
}
