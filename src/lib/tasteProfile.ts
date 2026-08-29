import { FilterState, Movie, WatchedMovie } from './movieTypes';

// Профиль вкуса — сжатая строка, которую LLM читает как «контекст, не инструкция».
// Держим в пределах ~700 символов: длиннее модель хуже усваивает и тратит токены.

const POSITIVE_LIMIT = 5;
const NEGATIVE_LIMIT = 3;
const FAVORITE_LIMIT = 8;
const RECENT_WINDOW = 30;
const DIRECTOR_LIMIT = 4;
const WATCHLIST_HINT_LIMIT = 4;

// Вес отдельной оценки в сумму по атрибуту (жанр / настроение / режиссёр):
// оценка 5/10 = 0, каждый балл выше или ниже отклоняет в плюс/минус.
// Так 10/10 весит в 5 раз больше 6/10, а 3/10 уходит в стойкий минус.
const centerRating = (rating: number) => rating - 5;

type WeightedEntry = { key: string; label: string; sum: number; count: number };

function accumulate(
  movies: WatchedMovie[],
  pick: (movie: WatchedMovie) => (string | undefined | null)[],
): WeightedEntry[] {
  const map = new Map<string, WeightedEntry>();
  for (const movie of movies) {
    const weight = centerRating(movie.rating);
    for (const raw of pick(movie)) {
      const label = (raw ?? '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const entry = map.get(key) ?? { key, label, sum: 0, count: 0 };
      entry.sum += weight;
      entry.count += 1;
      map.set(key, entry);
    }
  }
  return [...map.values()];
}

function topPositive(entries: WeightedEntry[], limit: number): string[] {
  return entries
    .filter(e => e.sum > 0)
    .sort((a, b) => b.sum - a.sum)
    .slice(0, limit)
    .map(e => e.label);
}

// Негатив: не «поставил единожды тройку», а «стабильно не заходит» — иначе
// один плохой фильм жанра выкинет весь жанр из рекомендаций.
function topNegative(entries: WeightedEntry[], limit: number): string[] {
  return entries
    .filter(e => e.sum < 0 && e.count >= 2)
    .sort((a, b) => a.sum - b.sum)
    .slice(0, limit)
    .map(e => e.label);
}

function topByCount(values: (string | undefined | null)[], limit: number): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const raw of values) {
    const label = (raw ?? '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = counts.get(key) ?? { label, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(e => e.label);
}

function decadeLabel(year: number): string | null {
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

export function buildFilterSummary(filters: FilterState): string[] {
  return [
    filters.type ? `type=${filters.type}` : null,
    filters.timeOfDay ? `timeOfDay=${filters.timeOfDay}` : null,
    filters.context ? `context=${filters.context}` : null,
    filters.format ? `format=${filters.format}` : null,
    filters.genre ? `genre=${filters.genre}` : null,
    filters.mood ? `mood=${filters.mood}` : null,
    filters.company ? `company=${filters.company}` : null,
  ].filter((value): value is string => Boolean(value));
}

export function buildTasteProfileSummary(watched: WatchedMovie[], watchlist: Movie[]): string {
  if (watched.length === 0) {
    return `История оценок пока пустая. Watchlist size=${watchlist.length}.`;
  }

  const rated = watched.filter(movie => typeof movie.rating === 'number');

  const favorites = [...rated]
    .filter(movie => movie.rating >= 8)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, FAVORITE_LIMIT)
    .map(movie => `${movie.titleRu} (${movie.rating}/10)`);

  const averageRating = rated.length > 0
    ? (rated.reduce((sum, movie) => sum + movie.rating, 0) / rated.length).toFixed(1)
    : 'n/a';

  const genreEntries = accumulate(rated, m => m.genre ?? []);
  const moodEntries = accumulate(rated, m => m.mood ?? []);
  const directorEntries = accumulate(rated, m => [m.director]);

  const preferredGenres = topPositive(genreEntries, POSITIVE_LIMIT);
  const preferredMoods = topPositive(moodEntries, POSITIVE_LIMIT);
  const preferredDirectors = topPositive(directorEntries, DIRECTOR_LIMIT);
  const avoidGenres = topNegative(genreEntries, NEGATIVE_LIMIT);
  const avoidDirectors = topNegative(directorEntries, NEGATIVE_LIMIT);

  // Свежие вкусы — последние N просмотренных, чтобы модель видела тренд,
  // а не только исторический топ.
  const recent = [...rated]
    .filter(m => m.watchedAt)
    .sort((a, b) => (b.watchedAt ?? '').localeCompare(a.watchedAt ?? ''))
    .slice(0, RECENT_WINDOW);
  const recentGenres = topPositive(accumulate(recent, m => m.genre ?? []), POSITIVE_LIMIT);
  const recentMoods = topPositive(accumulate(recent, m => m.mood ?? []), POSITIVE_LIMIT);

  const decades = topByCount(rated.map(m => decadeLabel(m.year)), 3);

  const watchlistGenres = topByCount(
    watchlist.flatMap(m => m.genre ?? []),
    WATCHLIST_HINT_LIMIT,
  );

  return [
    `Watched=${watched.length}, watchlist=${watchlist.length}, avgRating=${averageRating}.`,
    favorites.length > 0 ? `Favorites: ${favorites.join(', ')}.` : null,
    preferredGenres.length > 0 ? `Prefers genres: ${preferredGenres.join(', ')}.` : null,
    preferredMoods.length > 0 ? `Prefers moods: ${preferredMoods.join(', ')}.` : null,
    preferredDirectors.length > 0 ? `Recurring directors: ${preferredDirectors.join(', ')}.` : null,
    recentGenres.length > 0 ? `Recent taste (last ${recent.length}): genres ${recentGenres.join(', ')}${recentMoods.length > 0 ? `; moods ${recentMoods.join(', ')}` : ''}.` : null,
    decades.length > 0 ? `Eras: ${decades.join(', ')}.` : null,
    avoidGenres.length > 0 || avoidDirectors.length > 0
      ? `Avoid (low ratings): ${[
          avoidGenres.length > 0 ? `genres ${avoidGenres.join(', ')}` : null,
          avoidDirectors.length > 0 ? `directors ${avoidDirectors.join(', ')}` : null,
        ].filter(Boolean).join('; ')}.`
      : null,
    watchlistGenres.length > 0 ? `Watchlist hints: ${watchlistGenres.join(', ')}.` : null,
  ].filter(Boolean).join(' ');
}

export function toMovieContext(movie: Movie | WatchedMovie) {
  return {
    title: movie.title,
    titleRu: movie.titleRu,
    year: movie.year,
    type: movie.type ?? 'film',
    genre: movie.genre,
    mood: movie.mood,
    duration: movie.duration,
    kpRating: movie.kpRating ?? null,
    predictedRating: movie.predictedRating ?? null,
    director: movie.director || null,
    reasonToWatch: movie.reasonToWatch ?? null,
    userRating: 'rating' in movie ? movie.rating : null,
    notes: 'notes' in movie ? movie.notes ?? null : null,
  };
}
