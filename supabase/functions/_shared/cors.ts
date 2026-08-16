// CORS helpers для Edge Functions — общий модуль для ai-chat и movie-recommendation.
//
// Whitelist берётся из секрета ALLOWED_ORIGINS. Если секрет пропал (ротация,
// опечатка), используется FALLBACK_ORIGINS: реальные домены проекта в Vercel —
// иначе фронт получит 403 в момент, когда страховка должна была спасти.
//
// localhost разрешён только когда явно включён флаг ALLOW_LOCALHOST_CORS=1.
// Раньше он был разрешён всегда — то есть в проде тоже, и любое локально
// запущенное приложение могло звать production-функции (JWT оставался, но
// CORS-барьера не было).

const FALLBACK_ORIGINS = [
  "https://kino-arsid.vercel.app",
  "https://kino-app-arsid.vercel.app",
  "https://kino-app-git-main-arsid.vercel.app",
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

function isLocalhostAllowed(): boolean {
  return Deno.env.get("ALLOW_LOCALHOST_CORS") === "1";
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  return isLocalhostAllowed() && LOCALHOST_RE.test(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isOriginAllowed(origin) ? origin! : getAllowedOrigins()[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    // Vary: Origin — ответ зависит от заголовка запроса, иначе кэш может
    // отдать чужому origin наш Allow-Origin.
    "Vary": "Origin",
  };
}
