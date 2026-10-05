/**
 * Bounded secure HTTP fetch for candidate source pages.
 *
 * SECURITY: This module NEVER sends authentication headers, cookies, or
 * form payloads. It only fetches GET content from public HTTPS URLs that
 * pass the same SSRF guards used by evidence-integrity.
 *
 * Fetch limits (per call):
 *   - timeout       10 s
 *   - maxRedirects   5
 *   - responseSize 500 KB
 *   - content-type  text/html, application/json, application/ld+json
 *
 * Do NOT use this for browser automation, JS execution, or form submission.
 */

export const MAX_FETCH_SIZE = 512_000; // 500 KB bytes
export const FETCH_TIMEOUT_MS = 10_000; // 10 s
export const MAX_REDIRECTS = 5;

export type FetchResult =
  | { ok: true; url: string; finalUrl: string; text: string; contentType: string }
  | { ok: false; reason: string; finalUrl?: string; redirectCount?: number };

const ALLOWED_CONTENT_TYPE_PREFIXES = [
  'text/html',
  'application/json',
  'application/ld+json',
];

function isAllowedContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  return ALLOWED_CONTENT_TYPE_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(prefix));
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type ResolveHost = (hostname: string) => Promise<readonly string[]>;

const resolveHost: ResolveHost = async (hostname) => {
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  return (await lookup(unwrapped, { all: true, verbatim: true })).map((entry) => entry.address);
};

async function hasOnlyPublicAddresses(url: URL, resolver: ResolveHost): Promise<boolean> {
  if (isRejectedHostAddress(url.hostname)) return false;
  const addresses = await resolver(url.hostname);
  return addresses.length > 0 && addresses.every((address) => !isRejectedHostAddress(address));
}

async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FETCH_SIZE) return null;

  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FETCH_SIZE) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Fetch a candidate source page with strict security and size limits.
 * `urlValidator` is used per-redirect to revalidate the final URL.
 * Default uses the same publicHttpUrl validator as evidence-integrity.
 */
export async function fetchSourcePage(
  urlString: string,
  options?: {
    urlValidator?: (value: unknown) => URL | null;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    resolveHost?: ResolveHost;
    transientRetries?: number;
    retryDelayMs?: number;
  },
): Promise<FetchResult> {
  const validate = options?.urlValidator ?? publicHttpUrl;
  const request = options?.fetchImpl ?? (fetch as FetchLike);
  const resolver = options?.resolveHost ?? resolveHost;

  const parsed = validate(urlString);
  if (!parsed) {
    return { ok: false, reason: 'INVALID_OR_PRIVATE_URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'UNSUPPORTED_PROTOCOL' };
  }

  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const transientRetries = Math.max(0, Math.min(options?.transientRetries ?? 1, 2));
  const retryDelayMs = Math.max(0, Math.min(options?.retryDelayMs ?? 100, 500));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = parsed;
    const seen = new Set<string>();
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      if (!await hasOnlyPublicAddresses(currentUrl, resolver)) {
        return { ok: false, reason: redirectCount === 0 ? 'INVALID_OR_PRIVATE_URL' : 'REDIRECT_TO_PRIVATE' };
      }
      if (seen.has(currentUrl.toString())) return { ok: false, reason: 'REDIRECT_LOOP' };
      seen.add(currentUrl.toString());

      let response: Response;
      let attempt = 0;
      for (;;) {
        try {
          response = await request(currentUrl.toString(), {
            method: 'GET',
            headers: {
              'User-Agent': 'MagicScript/1.0 (research evidence; +https://magicscript.fr)',
              Accept: 'text/html, application/ld+json, application/json;q=0.9,*/*;q=0.8',
              'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7',
            },
            signal: controller.signal,
            redirect: 'manual',
            credentials: 'omit',
          });
        } catch (error) {
          if (attempt < transientRetries) { attempt += 1; if (retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt)); continue; }
          throw error;
        }
        if ((response.status === 429 || response.status === 503) && attempt < transientRetries) { attempt += 1; if (retryDelayMs) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt)); continue; }
        break;
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { ok: false, reason: 'INVALID_REDIRECT' };
        if (redirectCount >= MAX_REDIRECTS) return { ok: false, reason: 'TOO_MANY_REDIRECTS' };
        const nextUrl = validate(new URL(location, currentUrl).toString());
        if (!nextUrl) return { ok: false, reason: 'REDIRECT_TO_PRIVATE' };
        currentUrl = nextUrl;
        continue;
      }

      if (!response.ok) return response.status === 404 || response.status === 410 || response.status >= 500
        ? { ok: false, reason: `HTTP_STATUS_${response.status}`, finalUrl: currentUrl.toString(), redirectCount }
        : { ok: false, reason: `HTTP_STATUS_${response.status}` };
      const contentType = response.headers.get('content-type') ?? '';
      if (!isAllowedContentType(contentType)) {
        return { ok: false, reason: `UNSUPPORTED_CONTENT_TYPE: ${contentType.split(';')[0]?.trim() ?? 'unknown'}` };
      }
      const text = await readBoundedText(response);
      if (text === null) return { ok: false, reason: 'RESPONSE_TOO_LARGE' };

      return {
        ok: true,
        url: parsed.toString(),
        finalUrl: currentUrl.toString(),
        text,
        contentType: contentType.split(';')[0]?.trim() ?? 'unknown',
      };
    }
    return { ok: false, reason: 'TOO_MANY_REDIRECTS' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('abort') || message.includes('Abort')) {
      return { ok: false, reason: 'TIMEOUT' };
    }
    return { ok: false, reason: `FETCH_ERROR: ${message.slice(0, 200)}` };
  } finally {
    clearTimeout(timer);
  }
}
import { lookup } from 'node:dns/promises';

import { isRejectedHostAddress, publicHttpUrl } from './evidence-integrity';
