import { Movie } from './movieTypes';

type MovieIdentity = Partial<Pick<Movie, 'title' | 'titleRu' | 'year' | 'type'>>;

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getMovieIdentityKey(movie: MovieIdentity): string {
  const title = normalizeText(movie.titleRu || movie.title);
  const year = Number.isFinite(movie.year) && movie.year && movie.year > 0 ? String(movie.year) : 'unknown';
  const type = movie.type ?? 'unknown';

  if (!title) return `unknown-title::${year}::${type}`;
  return `${title}::${year}::${type}`;
}

export function getMovieDedupKey(movie: MovieIdentity & { id: string }): string {
  const identity = getMovieIdentityKey(movie);
  return identity.startsWith('unknown-title::') ? `id::${movie.id}` : identity;
}

// Ключ без типа: тот же фильм, но записанный как film вместо series, даёт другой
// getMovieIdentityKey — и уезжает в базу второй копией.
function getTypelessKey(movie: MovieIdentity): string {
  const title = normalizeText(movie.titleRu || movie.title);
  if (!title) return '';
  const year = Number.isFinite(movie.year) && movie.year && movie.year > 0 ? String(movie.year) : 'unknown';
  return `${title}::${year}`;
}

/**
 * Подгоняет тип импортируемых фильмов под тип уже сохранённых.
 *
 * Импорт из файла указывает тип по своему усмотрению, и если он разошёлся с тем,
 * что лежит в библиотеке, фильм не находит себя при дедупликации и добавляется
 * заново. Так после импорта на 200 строк появилось 58 дублей вида
 * «Корона (film)» + «Корона (series)».
 *
 * Название и год считаем достаточными для опознания: два разных произведения с
 * одинаковым названием и годом выпуска — случай куда более редкий, чем расхождение
 * в типе у одного и того же.
 */
export function reconcileImportedTypes<T extends MovieIdentity>(
  incoming: T[],
  known: MovieIdentity[],
): T[] {
  const typeByKey = new Map<string, MovieIdentity['type']>();

  for (const movie of known) {
    const key = getTypelessKey(movie);
    if (!key || !movie.type) continue;
    if (!typeByKey.has(key)) typeByKey.set(key, movie.type);
  }

  if (typeByKey.size === 0) return incoming;

  return incoming.map(movie => {
    const key = getTypelessKey(movie);
    const knownType = key ? typeByKey.get(key) : undefined;
    return knownType && knownType !== movie.type ? { ...movie, type: knownType } : movie;
  });
}

export function buildStableMovieId(prefix: string, movie: MovieIdentity, externalId?: string | number | null): string {
  const identity = getMovieIdentityKey(movie);
  const normalizedExternalId = typeof externalId === 'string' ? externalId.trim() : externalId;

  if (normalizedExternalId === undefined || normalizedExternalId === null || normalizedExternalId === '') {
    return `${prefix}:${identity}`;
  }

  return `${prefix}:${identity}:${normalizedExternalId}`;
}

export function mergeUniqueMovies<T extends MovieIdentity & { id: string }>(...collections: T[][]): T[] {
  const merged: T[] = [];
  const seen = new Set<string>();

  for (const collection of collections) {
    for (const movie of collection) {
      const key = getMovieDedupKey(movie);
      // Тип в ключе не учитываем: одна и та же «Корона» с type film и series —
      // это один сериал, записанный дважды, а не два разных произведения.
      // Иначе такая пара выживает слияние и уезжает в облако двумя строками.
      const typelessKey = getTypelessKey(movie);
      if (typelessKey && seen.has(typelessKey)) continue;
      if (typelessKey) seen.add(typelessKey);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(movie);
    }
  }

  return merged;
}
