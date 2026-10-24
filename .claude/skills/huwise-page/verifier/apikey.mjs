// Optional data.gr.ch API key (a higher request limit than anonymous access).
// HUWISE_APIKEY is read from the environment only. The key is sent as `Authorization: Apikey <key>`, only to
// the data.gr.ch host, only for API paths (/api/explore/... and the v1 /api/datasets/..., /api/records/... the Widgets call), and never written to a report, log or URL.
export const PORTAL_HOST = 'data.gr.ch';
const API_PATH = /^\/api\//;

export const apiKey = (env = process.env) => (env.HUWISE_APIKEY ?? '').trim() || null;

// True for https://data.gr.ch/api/... and nothing else (other hosts, other paths, look-alike hosts).
export function isPortalApiUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === PORTAL_HOST && API_PATH.test(u.pathname);
  } catch { return false; }
}

// Request headers for a Node fetch: `headers` plus the key when it applies.
export function withApiKey(url, headers = {}, env = process.env) {
  const key = apiKey(env);
  return key && isPortalApiUrl(url) ? { ...headers, authorization: `Apikey ${key}` } : headers;
}

// Authenticated JSON GET shared by the verifier's Node callers. Resolves with the status and the parsed body
// (null when the answer is not JSON); callers decide what a non-200 status means.
export async function fetchJsonWithKey(url, env = process.env) {
  const res = await fetch(url, { headers: withApiKey(url, { accept: 'application/json' }, env) });
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { status: res.status, statusText: res.statusText, body };
}

// Playwright: add the header to matching browser requests of a page or context. The route fetches the request
// itself (route.fetch) and fulfils it, so the browser sends no cross-origin Authorization header of its own.
// Returns false when no key is set (nothing is routed, behaviour unchanged).
export async function routeApiKey(target, env = process.env) {
  if (!apiKey(env)) return false;
  await target.route(isPortalApiUrl, async route => {
    const request = route.request();
    const response = await route.fetch({ headers: withApiKey(request.url(), request.headers(), env) });
    await route.fulfill({ response });
  });
  return true;
}
