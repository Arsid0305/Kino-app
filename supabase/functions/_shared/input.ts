// Проверка тела запроса для ai-chat и movie-recommendation.
// Всё, что уходит в промпт, ограничено по длине: иначе пользователь раздувает
// токены (деньги) и может подсунуть инструкции в собственный промпт.
// Импорт "npm:zod@3" резолвится в Deno; в vitest — алиас на пакет zod.
import { z } from "npm:zod@3";
import { ALL_PROVIDERS, type Provider } from "./llm.ts";

export const LIMITS = {
  title: 200,
  filter: 100,
  filters: 12,
  forbiddenTitles: 2000,
  tasteProfile: 2000,
  message: 2000,
  messages: 20,
  totalMessages: 12000,
} as const;

// Названия фильмов: лишнее отбрасываем, а не роняем запрос — клиент шлёт
// списки как есть, и один кривой элемент не должен давать 400.
const movieCtx = z.object({
  title: z.string().max(LIMITS.title).optional().catch(undefined),
  titleRu: z.string().max(LIMITS.title).optional().catch(undefined),
}).passthrough();

const movieList = z.array(z.unknown()).catch([]).transform(list =>
  list.flatMap(v => {
    const r = movieCtx.safeParse(v);
    return r.success ? [r.data] : [];
  })
);

const provider = z.string().transform(v =>
  (ALL_PROVIDERS as string[]).includes(v) ? v as Provider : "gpt4o" as Provider
).catch("gpt4o" as Provider);

const commonFields = {
  provider,
  filters: z.array(z.unknown()).catch([]).transform(list =>
    list.slice(0, LIMITS.filters).map(v => String(v).slice(0, LIMITS.filter))
  ),
  tasteProfile: z.string().catch("").transform(sanitizeTasteProfile),
  watchedMovies: movieList,
  watchlistMovies: movieList,
  dismissedMovies: movieList,
  forbiddenTitles: z.array(z.unknown()).optional().catch(undefined).transform(list =>
    list === undefined
      ? null
      : list.slice(0, LIMITS.forbiddenTitles)
          .filter((v): v is string => typeof v === "string")
          .map(v => v.slice(0, LIMITS.title))
  ),
};

export const recommendationBody = z.object(commonFields);

export const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(LIMITS.message),
});

export const chatBody = z.object({
  ...commonFields,
  mode: z.enum(["chat", "title_lookup"]).catch("chat"),
  messages: z.array(chatMessage).min(1).max(LIMITS.messages)
    .refine(list => list.reduce((s, m) => s + m.content.length, 0) <= LIMITS.totalMessages,
      "Диалог слишком длинный"),
});

export function sanitizeTasteProfile(raw: string): string {
  return raw
    // deno-lint-ignore no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // eslint-disable-line no-control-regex
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, LIMITS.tasteProfile);
}

// Одна нормализация для обеих сторон фильтра — и для списка запрещённых,
// и для названий из ответа модели. Раньше у ответа не схлопывались пробелы.
export const normalizeTitle = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function isForbidden(movie: unknown, forbidden: Set<string>): boolean {
  if (!movie || typeof movie !== "object") return true;
  const m = movie as Record<string, unknown>;
  const titleRu = typeof m.titleRu === "string" ? normalizeTitle(m.titleRu) : "";
  const title = typeof m.title === "string" ? normalizeTitle(m.title) : "";
  return (titleRu !== "" && forbidden.has(titleRu)) || (title !== "" && forbidden.has(title));
}

type MovieCtx = { title?: string; titleRu?: string };

export function forbiddenSet(body: {
  forbiddenTitles: string[] | null;
  watchedMovies: MovieCtx[];
  watchlistMovies: MovieCtx[];
  dismissedMovies: MovieCtx[];
}): Set<string> {
  const titles = body.forbiddenTitles
    ?? [...body.watchedMovies, ...body.watchlistMovies, ...body.dismissedMovies]
      .map(m => m.titleRu ?? m.title ?? "");
  return new Set(titles.map(normalizeTitle).filter(Boolean));
}
