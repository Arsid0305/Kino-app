import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_MOVIES = 80;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

// Admin client for rate limiting — uses service role key, persists across cold starts
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function getAllowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(o => o.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return true;
  if (!origin) return false;
  return allowed.includes(origin);
}

function getCorsHeaders(origin: string | null) {
  const allowed = getAllowedOrigins();
  const allowOrigin = allowed.length === 0 ? "*"
    : origin && allowed.includes(origin) ? origin : allowed[0];
  return { "Access-Control-Allow-Origin": allowOrigin, "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS };
}

function jsonResponse(origin: string | null, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

async function checkRateLimit(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_max_count: MAX_REQUESTS_PER_MINUTE,
    p_window_ms: 60000,
  });
  if (error) {
    console.error("Rate limit DB error:", error);
    return true; // fail open — avoid blocking legit requests on transient DB errors
  }
  return data as boolean;
}

function isMovieContext(value: unknown): boolean {
  return Boolean(value) && typeof value === "object";
}

type MovieCtx = { titleRu?: string; title?: string };

function titlesOf(arr: unknown[]): string {
  return (arr as MovieCtx[]).map(m => m.titleRu ?? m.title ?? "").filter(Boolean).join(", ");
}

serve(async req => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(origin)) return jsonResponse(origin, 403, { error: "Источник запрещён" });
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  try {
    if (req.method !== "POST") return jsonResponse(origin, 405, { error: "Метод не разрешён" });
    if (!isOriginAllowed(origin)) return jsonResponse(origin, 403, { error: "Источник запрещён" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse(origin, 401, { error: "Требуется авторизация" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(origin, 401, { error: "Неверный токен доступа" });

    const rateLimitKey = `${user.id}:${getClientIp(req)}`;
    if (!await checkRateLimit(rateLimitKey)) return jsonResponse(origin, 429, { error: "Слишком много запросов. Подождите минуту." });

    const body = await req.json().catch(() => null) as {
      filters?: unknown;
      tasteProfile?: unknown;
      watchedMovies?: unknown;
      watchlistMovies?: unknown;
      dismissedMovies?: unknown;
    } | null;

    if (!body || typeof body !== "object") return jsonResponse(origin, 400, { error: "Некорректное тело запроса" });

    const filters = Array.isArray(body.filters) ? body.filters.map(String).slice(0, 12) : [];
    const tasteProfile = typeof body.tasteProfile === "string" ? body.tasteProfile.slice(0, 6000) : "";
    const watchedMovies = Array.isArray(body.watchedMovies)
      ? body.watchedMovies.filter(isMovieContext).slice(0, MAX_MOVIES) : [];
    const watchlistMovies = Array.isArray(body.watchlistMovies)
      ? body.watchlistMovies.filter(isMovieContext).slice(0, MAX_MOVIES) : [];
    const dismissedMovies = Array.isArray(body.dismissedMovies)
      ? body.dismissedMovies.filter(isMovieContext).slice(0, MAX_MOVIES) : [];

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY не настроен");
    const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") ?? DEFAULT_DEEPSEEK_MODEL;

    const watchedTitles = titlesOf(watchedMovies.slice(0, 40));
    const watchlistTitles = titlesOf(watchlistMovies.slice(0, 40));
    const dismissedTitles = titlesOf(dismissedMovies.slice(0, 40));

    const forbiddenTitleSet = new Set<string>(
      [
        ...(watchedMovies as MovieCtx[]),
        ...(watchlistMovies as MovieCtx[]),
        ...(dismissedMovies as MovieCtx[]),
      ]
        .map(m => (m.titleRu ?? m.title ?? "").toLowerCase().trim())
        .filter(Boolean)
    );

    const callForTwo = async (): Promise<Record<string, unknown>[]> => {
      const forbidden = [watchedTitles, watchlistTitles, dismissedTitles]
        .filter(Boolean).join(", ");

      const msgBody = JSON.stringify({
        model: DEEPSEEK_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Ты — кинорекомендательная система. Отвечаешь ТОЛЬКО валидным JSON без markdown, без пояснений. ВСЕ строковые поля (titleRu, description, reasonToWatch, genres, mood, country, director) — строго на русском языке. Никогда не используй английский в текстовых полях.",
          },
          {
            role: "user",
            content: `Порекомендуй РОВНО 3 фильма или сериала, похожих по духу и стилю. Все три строго отсутствуют в списке ЗАПРЕЦЁННЫХ.\n\nЗАПРЕЦЁННЫЕ (абсолютный запрет): ${forbidden || "нет"}\n\nФильтры: ${filters.length > 0 ? filters.join(", ") : "без ограничений"}\nВкусовой профиль: ${tasteProfile || "пуст"}\n\nВерни ТОЛЬКО JSON-объект с массивом из 3 элементов:\n{"recommendations":[{"title":"...","titleRu":"...","year":2020,"type":"film","genre":["жанр"],"duration":100,"director":"...","description":"Синопсис","reasonToWatch":"Почему подходит","mood":["настроение"],"timeOfDay":["evening"],"format":"medium","forCompany":"any","kpRating":7.5,"country":"США","predictedRating":8.0},{"title":"...","titleRu":"...","year":2018,"type":"film","genre":["жанр"],"duration":95,"director":"...","description":"Синопсис","reasonToWatch":"Почему подходит","mood":["настроение"],"timeOfDay":["evening"],"format":"medium","forCompany":"any","kpRating":7.2,"country":"Франция","predictedRating":7.8},{"title":"...","titleRu":"...","year":2016,"type":"film","genre":["жанр"],"duration":110,"director":"...","description":"Синопсис","reasonToWatch":"Почему подходит","mood":["настроение"],"timeOfDay":["evening"],"format":"medium","forCompany":"any","kpRating":7.0,"country":"Великобритания","predictedRating":7.5}]}`,
          },
        ],
        stream: false,
        max_tokens: 1600,
        temperature: 1.2,
      });

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
          body: msgBody,
        });

        if (!res.ok) {
          if (res.status === 429) throw new Error("DeepSeek 429");
          if (attempt === 2) throw new Error(`DeepSeek ${res.status}`);
          continue;
        }

        const d = await res.json() as { choices?: { message?: { content?: string } }[] };
        const raw = d.choices?.[0]?.message?.content?.trim() ?? "";
        const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        try {
          const parsed = JSON.parse(clean) as Record<string, unknown>;
          const arr = Array.isArray(parsed.recommendations) ? parsed.recommendations as Record<string, unknown>[]
            : Array.isArray(parsed) ? parsed as Record<string, unknown>[]
            : [parsed];
          return arr;
        } catch {
          if (attempt === 2) throw new Error(`Ошибка разбора JSON: ${clean.slice(0, 100)}`);
        }
      }
      throw new Error("Все попытки запроса исчерпаны");
    };

    const rawResults = await callForTwo();
    const picked = rawResults.filter(movie => {
      const titleRu = typeof movie.titleRu === "string" ? movie.titleRu.toLowerCase().trim() : "";
      const title = typeof movie.title === "string" ? movie.title.toLowerCase().trim() : "";
      const allowed = !forbiddenTitleSet.has(titleRu) && !forbiddenTitleSet.has(title);
      if (!allowed) console.log(`ОтфильтроваCо (запрещено): ${movie.titleRu ?? movie.title}`);
      return allowed;
    }).slice(0, 2);

    if (picked.length === 0) return jsonResponse(origin, 500, { error: "Не удалось получить рекомендации" });

    return jsonResponse(origin, 200, { recommendations: picked });

  } catch (error) {
    console.error("Ошибка movie-recommendation:", error);
    return jsonResponse(origin, 500, { error: error instanceof Error ? error.message : "Неизвестная ошибка" });
  }
});
