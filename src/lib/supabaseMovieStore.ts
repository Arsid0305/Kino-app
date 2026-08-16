import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Movie, WatchedMovie } from './movieTypes';
import { getMovieDedupKey } from './movieIdentity';

type UserMovieRow = Tables<'user_movies'>;
type UserMovieInsert = TablesInsert<'user_movies'>;
type CloudMovieListType = 'watched' | 'watchlist' | 'dismissed';

export interface CloudLibrary {
  watched: WatchedMovie[];
  watchlist: Movie[];
  dismissed: Movie[];
}

export function serializeMovie(movie: Movie | WatchedMovie) {
  return {
    id: movie.id,
    title: movie.title,
    titleRu: movie.titleRu,
    year: movie.year,
    genre: movie.genre,
    duration: movie.duration,
    mood: movie.mood,
    poster: movie.poster ?? null,
    description: movie.description,
    director: movie.director,
    forCompany: movie.forCompany,
    timeOfDay: movie.timeOfDay,
    format: movie.format,
    kpRating: movie.kpRating ?? null,
    country: movie.country ?? null,
    type: movie.type ?? 'film',
    predictedRating: movie.predictedRating ?? null,
    reasonToWatch: movie.reasonToWatch ?? null,
    kpQuery: movie.kpQuery ?? null,
    source: movie.source ?? null,
  };
}

export function hydrateMovie(row: UserMovieRow): Movie | WatchedMovie {
  const movie = row.movie_data as Record<string, unknown>;
  const baseMovie: Movie = {
    id: String(movie.id ?? row.movie_key),
    title: String(movie.title ?? movie.titleRu ?? 'Без названия'),
    titleRu: String(movie.titleRu ?? movie.title ?? 'Без названия'),
    year: Number(movie.year ?? 0),
    genre: Array.isArray(movie.genre) ? movie.genre.map(String) : [],
    duration: Number(movie.duration ?? 0),
    mood: Array.isArray(movie.mood) ? movie.mood.map(String) : [],
    poster: typeof movie.poster === 'string' ? movie.poster : undefined,
    description: typeof movie.description === 'string' ? movie.description : '',
    director: typeof movie.director === 'string' ? movie.director : '',
    forCompany: (movie.forCompany as Movie['forCompany']) ?? 'any',
    timeOfDay: Array.isArray(movie.timeOfDay)
      ? movie.timeOfDay as Movie['timeOfDay']
      : ['evening'],
    format: (movie.format as Movie['format']) ?? 'medium',
    kpRating: typeof movie.kpRating === 'number' ? movie.kpRating : undefined,
    country: typeof movie.country === 'string' ? movie.country : undefined,
    type: (movie.type as Movie['type']) ?? 'film',
    predictedRating: typeof movie.predictedRating === 'number' ? movie.predictedRating : undefined,
    reasonToWatch: typeof movie.reasonToWatch === 'string' ? movie.reasonToWatch : undefined,
    kpQuery: typeof movie.kpQuery === 'string' ? movie.kpQuery : undefined,
    source: (movie.source as Movie['source']) ?? undefined,
  };

  if (row.list_type === 'watched') {
    return {
      ...baseMovie,
      rating: row.rating ?? 0,
      notes: row.notes ?? undefined,
      watchedAt: row.watched_at ?? new Date(0).toISOString(),
    };
  }

  return baseMovie;
}

function toRow(movie: Movie | WatchedMovie, listType: CloudMovieListType): UserMovieInsert {
  return {
    movie_key: getMovieDedupKey(movie),
    list_type: listType,
    movie_data: serializeMovie(movie),
    rating: 'rating' in movie ? movie.rating : null,
    notes: 'notes' in movie ? movie.notes ?? null : null,
    watched_at: 'watchedAt' in movie ? (movie.watchedAt || null) : null,
    updated_at: new Date().toISOString(),
  };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw error ?? new Error('Нет активного пользователя Supabase');
  }

  return data.user.id;
}

// Массовые операции режем на пачки: один upsert на 200 строк упирается в лимит размера
// запроса, а delete со всеми ключами разом — в лимит длины URL у PostgREST.
const BATCH_SIZE = 100;

function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function removeFromCloudLists(
  movieKeys: string | string[],
  listTypes: CloudMovieListType[],
  knownUserId?: string,
) {
  const keys = Array.isArray(movieKeys) ? movieKeys : [movieKeys];
  if (listTypes.length === 0 || keys.length === 0) return;

  const userId = knownUserId ?? await getCurrentUserId();

  for (const batch of chunk(keys)) {
    const { error } = await supabase
      .from('user_movies')
      .delete()
      .eq('user_id', userId)
      .in('movie_key', batch)
      .in('list_type', listTypes);

    if (error) throw error;
  }
}

// Общий путь для массового импорта: userId берём один раз, строки пишем пачками.
// Раньше каждый фильм шёл отдельным upsertX(), а тот дважды звал supabase.auth.getUser() —
// на 200 фильмах это 400 конкурентов за Web Lock 'lock:sb-<ref>-auth-token', и браузер
// начинал ругаться «Lock was released because another request stole it».
async function upsertMoviesBatch(
  movies: (Movie | WatchedMovie)[],
  listType: CloudMovieListType,
  clearFrom: CloudMovieListType[],
) {
  if (movies.length === 0) return;

  const userId = await getCurrentUserId();

  for (const batch of chunk(movies)) {
    const payload = batch.map(movie => ({ ...toRow(movie, listType), user_id: userId }));
    const { error } = await supabase
      .from('user_movies')
      .upsert(payload, { onConflict: 'user_id,movie_key,list_type' });

    if (error) throw error;
  }

  await removeFromCloudLists(movies.map(getMovieDedupKey), clearFrom, userId);
}

// Читаем всю библиотеку постранично. Раньше стоял .limit(500) — библиотека
// на 1000+ записей молча обрезалась, и на устройстве без локального кеша
// часть фильмов просто не появлялась.
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

async function fetchAllUserMovieRows(): Promise<UserMovieRow[]> {
  const rows: UserMovieRow[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('user_movies')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('movie_key', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function loadCloudLibrary(): Promise<CloudLibrary> {
  const data = await fetchAllUserMovieRows();

  const watched: WatchedMovie[] = [];
  const watchlist: Movie[] = [];
  const dismissed: Movie[] = [];

  for (const row of data) {
    const movie = hydrateMovie(row);
    if (row.list_type === 'watched') watched.push(movie as WatchedMovie);
    else if (row.list_type === 'watchlist') watchlist.push(movie as Movie);
    else dismissed.push(movie as Movie);
  }

  return { watched, watchlist, dismissed };
}

export async function upsertWatchlistMovie(movie: Movie) {
  const userId = await getCurrentUserId();
  const payload = { ...toRow(movie, 'watchlist'), user_id: userId };
  const movieKey = getMovieDedupKey(movie);

  const { error } = await supabase
    .from('user_movies')
    .upsert(payload, { onConflict: 'user_id,movie_key,list_type' });

  if (error) throw error;

  await removeFromCloudLists(movieKey, ['dismissed']);
}

export async function upsertWatchlistMovies(movies: Movie[]) {
  await upsertMoviesBatch(movies, 'watchlist', ['dismissed']);
}

export async function upsertWatchedMovies(movies: WatchedMovie[]) {
  await upsertMoviesBatch(movies, 'watched', ['watchlist', 'dismissed']);
}

export async function upsertDismissedMovie(movie: Movie) {
  const userId = await getCurrentUserId();
  const payload = { ...toRow(movie, 'dismissed'), user_id: userId };
  const movieKey = getMovieDedupKey(movie);

  const { error } = await supabase
    .from('user_movies')
    .upsert(payload, { onConflict: 'user_id,movie_key,list_type' });

  if (error) throw error;

  await removeFromCloudLists(movieKey, ['watchlist']);
}

export async function upsertWatchedMovie(movie: WatchedMovie) {
  const userId = await getCurrentUserId();
  const payload = { ...toRow(movie, 'watched'), user_id: userId };
  const movieKey = getMovieDedupKey(movie);

  const { error } = await supabase
    .from('user_movies')
    .upsert(payload, { onConflict: 'user_id,movie_key,list_type' });

  if (error) throw error;

  await removeFromCloudLists(movieKey, ['watchlist', 'dismissed']);
}

export async function seedCloudLibrary(watched: WatchedMovie[], watchlist: Movie[], dismissed: Movie[] = []) {
  const userId = await getCurrentUserId();
  const payload = [
    ...watched.map(movie => ({ ...toRow(movie, 'watched'), user_id: userId })),
    ...watchlist.map(movie => ({ ...toRow(movie, 'watchlist'), user_id: userId })),
    ...dismissed.map(movie => ({ ...toRow(movie, 'dismissed'), user_id: userId })),
  ];

  if (payload.length === 0) return;

  for (const batch of chunk(payload)) {
    const { error } = await supabase
      .from('user_movies')
      .upsert(batch, { onConflict: 'user_id,movie_key,list_type' });

    if (error) throw error;
  }
}
