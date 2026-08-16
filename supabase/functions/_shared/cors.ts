// CORS helpers для Edge Functions — общий модуль для ai-chat и movie-recommendation.
// Fallback whitelist используется если secret ALLOWED_ORIGINS не задан (защита от
// ротации секретов, при которой пустой список ранее приводил к '*' — CSRF-риск).

const FALLBACK_ORIGINS = [
  "https://kino-app.vercel.app",
];
const LOCALHOST_RE = /^http:\/\/localhost(?::\d+)?$/;

export const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, " +
  "x-supabase-client-platform, x-supabase-client-platform-version, " +
  "x-supabase-client-runtime, x-supabase-client-runtime-version";

export function getAllowedOrigins(): string[] {
  const fromSecret = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",").map(o => o.trim()).filter(Boolean);
  return fromSecret.length > 0 ? fromSecret : FALLBACK_ORIGINS;
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin) || LOCALHOST_RE.test(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const allowOrigin = origin && (allowed.includes(origin) || LOCALHOST_RE.test(origin))
    ? origin
    : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
  };
}
