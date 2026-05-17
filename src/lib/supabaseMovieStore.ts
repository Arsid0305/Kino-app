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
    title: String(movie.title ?? movie.titleRu ?? 'Untitled'),
    titleRu: String(movie.titleRu ?? movie.title ?? 'Untitled'),
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

export async function removeFromCloudLists(movieKey: string, listTypes: CloudMovieListType[]) {
  if (listTypes.length === 0) return;

  const { error } = await supabase
    .from('user_movies')
    .delete()
    .eq('movie_key', movieKey)
    .in('list_type', listTypes);

  if (error) throw error;
}

export async function loadCloudLibrary(): Promise<CloudLibrary> {
  const { data, error } = await supabase
    .from('user_movies')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const watched: WatchedMovie[] = [];
  const watchlist: Movie[] = [];
  const dismissed: Movie[] = [];

  for (const row of data ?? []) {
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
  if (movies.length === 0) return;

  await Promise.all(movies.map(movie => upsertWatchlistMovie(movie)));
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

  const { error } = await supabase
    .from('user_movies')
    .upsert(payload, { onConflict: 'user_id,movie_key,list_type' });

  if (error) throw error;
}
