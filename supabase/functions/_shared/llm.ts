// Общий вызов LLM для edge functions: ID моделей, параметры, фолбэк.
// Параметры — по записи «Рекомендация по смене моделей» в AI_OS
// MEMORY/tasks/cross-repo-todo.md (живой прогон 2026-10-01).
// Модуль не трогает Deno напрямую: окружение передаётся аргументом,
// поэтому его можно гонять в vitest.

export type Provider = "claude" | "gpt4o" | "gemini" | "deepseek";
export const ALL_PROVIDERS: Provider[] = ["claude", "gpt4o", "gemini", "deepseek"];

export const DEFAULT_MODELS: Record<Provider, string> = {
  claude: "claude-sonnet-5-5",
  gpt4o: "gpt-6-luna",
  gemini: "gemini-3.6-flash",
  deepseek: "deepseek-v4-flash",
};

// Секрет Supabase с ключом и необязательный секрет с моделью.
const ENV: Record<Provider, { key: string; model: string }> = {
  claude: { key: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL" },
  gpt4o: { key: "OPENAI_API_KEY", model: "OPENAI_MODEL" },
  gemini: { key: "GOOGLE_API_KEY", model: "GEMINI_MODEL" },
  deepseek: { key: "DEEPSEEK_API_KEY", model: "DEEPSEEK_MODEL" },
};

// Порядок фолбэка — как в WB-Bot: выбранный провайдер (с одним повтором),
// затем остальные в этом порядке.
export const FALLBACK_ORDER: Provider[] = ["deepseek", "gpt4o", "gemini", "claude"];

// Лимит ответа общий: thinking/reasoning тратит его до текста.
export const MAX_TOKENS = 16000;
// Таймаут одной попытки по записи AI_OS — 300 с, но вся цепочка не должна
// пережить лимит времени edge function, поэтому есть общий бюджет.
export const ATTEMPT_TIMEOUT_MS = 300_000;
export const TOTAL_BUDGET_MS = 140_000;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Env = (name: string) => string | undefined;

export interface LlmRequest {
  system: string;
  messages: ChatMessage[];
  // Gemini и DeepSeek. OpenAI reasoning и Claude 5.5 temperature не принимают.
  temperature: number;
  json: boolean;
  // Gemini с поиском Google (ai-chat). Несовместим с JSON-mime у Gemini.
  geminiSearch?: boolean;
}

// Сообщение ошибки — только для логов. Клиенту его не отдавать.
export class LlmError extends Error {}

type FetchFn = typeof fetch;

async function post(fetchFn: FetchFn, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new LlmError(`${url.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function claudeText(d: {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
}): string {
  if (d.stop_reason === "refusal") throw new LlmError("Claude: refusal");
  if (d.stop_reason === "max_tokens") throw new LlmError("Claude: max_tokens");
  const text = (d.content ?? [])
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("")
    .trim();
  if (!text) throw new LlmError("Claude: пустой текст");
  return text;
}

export function openAIText(d: {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
}): string {
  const c = d.choices?.[0];
  if (c?.message?.refusal) throw new LlmError("OpenAI-compat: refusal");
  if (c?.finish_reason === "length") throw new LlmError("OpenAI-compat: finish_reason=length");
  const text = c?.message?.content?.trim() ?? "";
  if (!text) throw new LlmError("OpenAI-compat: пустой content");
  return text;
}

export async function callProvider(
  provider: Provider,
  req: LlmRequest,
  env: Env,
  timeoutMs = ATTEMPT_TIMEOUT_MS,
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const key = env(ENV[provider].key);
  if (!key) throw new LlmError(`${ENV[provider].key} не настроен`);
  const model = env(ENV[provider].model) || DEFAULT_MODELS[provider];

  switch (provider) {
    case "claude": {
      const d = await post(fetchFn, "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        { model, max_tokens: MAX_TOKENS, system: req.system, messages: req.messages },
        timeoutMs);
      return claudeText(d);
    }
    case "gpt4o":
    case "deepseek": {
      const openai = provider === "gpt4o";
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "system", content: req.system }, ...req.messages],
        ...(openai
          ? { max_completion_tokens: MAX_TOKENS }
          : { max_tokens: MAX_TOKENS, temperature: req.temperature }),
      };
      if (req.json) body.response_format = { type: "json_object" };
      const url = openai ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/chat/completions";
      const d = await post(fetchFn, url, { Authorization: `Bearer ${key}` }, body, timeoutMs);
      return openAIText(d);
    }
    case "gemini": {
      // Соседние сообщения одной роли Gemini не принимает — склеиваем.
      const contents: { role: string; parts: { text: string }[] }[] = [];
      for (const m of req.messages) {
        const role = m.role === "assistant" ? "model" : "user";
        const last = contents[contents.length - 1];
        if (last && last.role === role) last.parts[0].text += "\n" + m.content;
        else contents.push({ role, parts: [{ text: m.content }] });
      }
      const generationConfig: Record<string, unknown> = { maxOutputTokens: MAX_TOKENS, temperature: req.temperature };
      if (req.json && !req.geminiSearch) generationConfig.responseMimeType = "application/json";
      const d = await post(fetchFn,
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {},
        {
          system_instruction: { parts: [{ text: req.system }] },
          contents,
          ...(req.geminiSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig,
        },
        timeoutMs) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = (d.candidates?.[0]?.content?.parts ?? [])
        .filter(p => !p.thought).map(p => p.text ?? "").join("").trim();
      if (!text) throw new LlmError("Gemini: пустой ответ");
      return text;
    }
  }
}

// Выбранный провайдер — две попытки, затем остальные из FALLBACK_ORDER по одной.
// Провайдеры без ключа пропускаются без запроса. parse бросает — попытка неудачна.
export async function callWithFallback<T>(
  preferred: Provider,
  req: LlmRequest,
  env: Env,
  parse: (raw: string) => T,
  call: typeof callProvider = callProvider,
  now: () => number = Date.now,
): Promise<{ result: T; provider: Provider }> {
  const plan: Provider[] = [preferred, preferred, ...FALLBACK_ORDER.filter(p => p !== preferred)]
    .filter(p => Boolean(env(ENV[p].key)));
  if (plan.length === 0) throw new LlmError("Ни один ключ провайдера не настроен");

  const deadline = now() + TOTAL_BUDGET_MS;
  const errors: string[] = [];
  for (const provider of plan) {
    const left = deadline - now();
    if (left <= 0) break;
    try {
      const raw = await call(provider, req, env, Math.min(ATTEMPT_TIMEOUT_MS, left));
      return { result: parse(raw), provider };
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`LLM ${provider} не ответил:`, errors.at(-1)?.slice(0, 300));
    }
  }
  throw new LlmError(`Все провайдеры не ответили: ${errors.join(" | ").slice(0, 1000)}`);
}
