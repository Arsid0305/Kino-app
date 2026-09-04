import { supabase } from '@/integrations/supabase/client';
import { FilterState, Movie, WatchedMovie } from './movieTypes';
import { buildFilterSummary, buildTasteProfileSummary, toMovieContext } from './tasteProfile';
import { getMovieDedupKey, getTitleOnlyKey } from './movieIdentity';

const RECOMMENDATION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/movie-recommendation`;

function normalizeRecommendation(raw: Record<string, unknown>): Movie {
  const duration = Number(raw.duration ?? 110);
  const format = raw.format === 'short' || raw.format === 'long' ? raw.format : 'medium';
  const type = raw.type === 'series' ? 'series' : raw.type === 'miniseries' ? 'miniseries' : 'film';
  const forCompany = raw.forCompany === 'solo' || raw.forCompany === 'pair' || raw.forCompany === 'group'
    ? raw.forCompany : 'any';

  return {
    id: `ai-global:${String(raw.kpQuery ?? raw.titleRu ?? raw.title ?? crypto.randomUUID())}`,
    title: String(raw.title ?? raw.titleRu ?? 'Без названия'),
    titleRu: String(raw.titleRu ?? raw.title ?? 'Без названия'),
    year: Number(raw.year ?? new Date().getFullYear()),
    genre: Array.isArray(raw.genre) ? raw.genre.map(String) : Array.isArray(raw.genres) ? raw.genres.map(String) : [],
    duration,
    mood: Array.isArray(raw.mood) ? raw.mood.map(String) : ['thoughtful'],
    description: String(raw.description ?? ''),
    director: String(raw.director ?? ''),
    forCompany,
    timeOfDay: Array.isArray(raw.timeOfDay) ? raw.timeOfDay as Movie['timeOfDay'] : ['evening'],
    format,
    kpRating: typeof raw.kpRating === 'number' ? raw.kpRating : undefined,
    country: typeof raw.country === 'string' ? raw.country : undefined,
    type,
    predictedRating: typeof raw.predictedRating === 'number' ? raw.predictedRating : undefined,
    reasonToWatch: String(raw.reasonToWatch ?? ''),
    kpQuery: String(raw.kpQuery ?? raw.titleRu ?? raw.title ?? ''),
    source: 'ai-global',
  };
}

export type RecommendationProvider = 'claude' | 'gpt4o' | 'gemini' | 'deepseek';

export async function requestGlobalRecommendation(
  filters: FilterState,
  watched: WatchedMovie[],
  watchlist: Movie[],
  dismissed: Movie[] = [],
  provider: RecommendationProvider = 'gpt4o'
): Promise<Movie[]> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error('Нужно войти в облачный аккаунт, чтобы получить глобальную рекомендацию.');
  }

  const response = await fetch(RECOMMENDATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      provider,
      filters: buildFilterSummary(filters),
      tasteProfile: buildTasteProfileSummary(watched, watchlist),
      watchedMovies: watched.slice(0, 80).map(toMovieContext),
      watchlistMovies: watchlist.slice(0, 80).map(toMovieContext),
      dismissedMovies: dismissed.slice(0, 80).map(toMovieContext),
      // Полный чёрный список названий — нужен серверу для пост-фильтра.
      // Модели в промпт уходит только 80, но фильтровать ответ надо по ВСЕМ,
      // иначе повторно вылезет что-то из давно просмотренного вне окна.
      forbiddenTitles: [
        ...watched.map(getTitleOnlyKey),
        ...watchlist.map(getTitleOnlyKey),
        ...dismissed.map(getTitleOnlyKey),
      ].filter(Boolean),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка recommendation endpoint' }));
    throw new Error(error.error ?? `Ошибка ${response.status}`);
  }

  const payload = await response.json();

  // Handle both { recommendations: [] } and legacy { recommendation: {} }
  const rawRecs: Record<string, unknown>[] = Array.isArray(payload.recommendations)
    ? payload.recommendations
    : payload.recommendation
    ? [payload.recommendation as Record<string, unknown>]
    : [];

  const allMovies = rawRecs.map(normalizeRecommendation);

  // Клиентский пост-фильтр: по названию (без учёта года/типа) — модель часто
  // выдумывает не тот год и getMovieDedupKey эти дубликаты пропускает.
  // Ключ по dedup оставляем как второй барьер на случай, если названия
  // немного расходятся, а id/год/тип совпадают.
  const excludedKeys = new Set([
    ...watched.map(getMovieDedupKey),
    ...watchlist.map(getMovieDedupKey),
    ...dismissed.map(getMovieDedupKey),
  ]);
  const excludedTitles = new Set(
    [
      ...watched.map(getTitleOnlyKey),
      ...watchlist.map(getTitleOnlyKey),
      ...dismissed.map(getTitleOnlyKey),
    ].filter(Boolean)
  );

  return allMovies.filter(m =>
    !excludedKeys.has(getMovieDedupKey(m)) &&
    !excludedTitles.has(getTitleOnlyKey(m))
  );
}
