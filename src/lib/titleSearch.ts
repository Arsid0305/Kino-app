import { supabase } from '@/integrations/supabase/client';
import { Movie } from './movieTypes';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface TitleLookupResponse {
  message?: string;
  suggestions?: Record<string, unknown>[];
  error?: string;
}

function normalizeSuggestion(raw: Record<string, unknown>): Movie {
  return {
    id: `title-search:${crypto.randomUUID()}`,
    title: String(raw.title ?? raw.titleRu ?? 'Без названия'),
    titleRu: String(raw.titleRu ?? raw.title ?? 'Без названия'),
    year: Number(raw.year ?? 0),
    genre: Array.isArray(raw.genre) ? raw.genre.map(String) : [],
    duration: Number(raw.duration ?? 0),
    mood: Array.isArray(raw.mood) ? raw.mood.map(String) : [],
    description: String(raw.description ?? ''),
    director: String(raw.director ?? ''),
    forCompany: raw.forCompany === 'solo' || raw.forCompany === 'pair' || raw.forCompany === 'group' ? raw.forCompany : 'any',
    timeOfDay: Array.isArray(raw.timeOfDay) ? raw.timeOfDay as Movie['timeOfDay'] : ['evening'],
    format: raw.format === 'short' || raw.format === 'long' ? raw.format : 'medium',
    kpRating: typeof raw.kpRating === 'number' ? raw.kpRating : undefined,
    country: typeof raw.country === 'string' ? raw.country : undefined,
    type: raw.type === 'series' ? 'series' : raw.type === 'miniseries' ? 'miniseries' : 'film',
    kpQuery: String(raw.titleRu ?? raw.title ?? ''),
    source: 'ai-chat',
  };
}

export async function searchMovieByTitle(query: string): Promise<{ movie: Movie | null; message: string }> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Нужно войти в облачный аккаунт, чтобы искать фильмы.');

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      mode: 'title_lookup',
      messages: [{ role: 'user', content: query }],
    }),
  });

  const payload = await response.json().catch(() => ({ error: 'Ошибка сервера' } as TitleLookupResponse));
  if (!response.ok) throw new Error(payload.error ?? `Ошибка ${response.status}`);

  const rawSuggestion = Array.isArray(payload.suggestions) ? payload.suggestions[0] : null;
  const movie = rawSuggestion && typeof rawSuggestion === 'object' ? normalizeSuggestion(rawSuggestion) : null;

  return { movie, message: typeof payload.message === 'string' ? payload.message : '' };
}
