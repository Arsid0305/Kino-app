// Общая обвязка запроса для ai-chat и movie-recommendation: CORS-ответы,
// проверка JWT, лимит запросов. Раньше дословно копировалась в обе функции.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isOriginAllowed } from "./cors.ts";

const MAX_REQUESTS_PER_MINUTE = 10;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export function jsonResponse(origin: string | null, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

// Fail-closed: при ошибке БД лимит не снимается — платные LLM-вызовы под ним.
async function checkRateLimit(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_max_count: MAX_REQUESTS_PER_MINUTE,
    p_window_ms: 60000,
  });
  if (error) {
    console.error("Rate limit DB error:", error);
    return false;
  }
  return data as boolean;
}

// CORS-префлайт, метод, origin, JWT и лимит. Возвращает Response, если запрос
// дальше не идёт, иначе null. Ключ лимита — user.id: X-Forwarded-For задаёт клиент.
export async function guardRequest(req: Request): Promise<Response | null> {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(origin)) return jsonResponse(origin, 403, { error: "Источник запрещён" });
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  if (req.method !== "POST") return jsonResponse(origin, 405, { error: "Метод не разрешён" });
  if (!isOriginAllowed(origin)) return jsonResponse(origin, 403, { error: "Источник запрещён" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse(origin, 401, { error: "Требуется авторизация" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.slice("Bearer ".length);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return jsonResponse(origin, 401, { error: "Неверный токен доступа" });

  if (!await checkRateLimit(user.id)) {
    return jsonResponse(origin, 429, { error: "Слишком много запросов. Подождите минуту." });
  }
  return null;
}

// Первый JSON-объект из ответа модели: без markdown-обёртки, или первая
// сбалансированная пара {...}, если модель дописала пояснения.
export function extractFirstJson(text: string): Record<string, unknown> | null {
  const s = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(s) as Record<string, unknown>; } catch { /* дальше */ }
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") { if (start < 0) start = i; depth++; }
    else if (s[i] === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(s.slice(start, i + 1)) as Record<string, unknown>; } catch { /* следующая */ }
        start = -1;
      }
    }
  }
  return null;
}
