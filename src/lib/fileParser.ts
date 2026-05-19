import { Movie, WatchedMovie } from './movieTypes';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { buildStableMovieId } from './movieIdentity';

// Zod schema for validating uploaded movie data
const UploadedMovieSchema = z.object({
  title: z.string().max(300).optional(),
  titleRu: z.string().max(300).optional(),
  name: z.string().max(300).optional(),
  year: z.preprocess(v => Number(v), z.number().int().min(1800).max(2200)).optional(),
  genre: z.union([
    z.array(z.string().max(50)),
    z.string().max(200),
  ]).optional(),
  duration: z.preprocess(v => Number(v), z.number().int().min(0).max(1000)).optional(),
  mood: z.union([
    z.array(z.string().max(50)),
    z.string().max(200),
  ]).optional(),
  description: z.string().max(2000).optional(),
  director: z.string().max(200).optional(),
  forCompany: z.enum(['solo', 'pair', 'group', 'any']).optional(),
  timeOfDay: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),
  format: z.enum(['short', 'medium', 'long']).optional(),
  kpRating: z.preprocess(v => Number(v), z.number().min(0).max(10)).optional(),
  predictedRating: z.preprocess(v => Number(v), z.number().min(0).max(10)).optional(),
  type: z.enum(['film', 'series']).optional(),
  country: z.string().max(100).optional(),
}).passthrough();

/**
 * Parse uploaded file (CSV, JSON or XLSX) into Movie/WatchedMovie objects.
 * Supports the user's Фильмография.xlsx format with sheets:
 *   "Просмотрено" (watched), "Буду смотреть" (to watch), "Каталог" (all)
 */

export interface ParseResult {
  watched: WatchedMovie[];
  toWatch: Movie[];
}

export function parseMovieFile(content: string | ArrayBuffer, filename: string): ParseResult {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') return parseJSON(typeof content === 'string' ? content : new TextDecoder().decode(content));
  if (ext === 'csv') return parseCSV(typeof content === 'string' ? content : new TextDecoder().decode(content));
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer);
  throw new Error('Поддерживаются файлы .json, .csv и .xlsx');
}

// ===== Excel =====
function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const watched: WatchedMovie[] = [];
  const toWatch: Movie[] = [];

  // Try sheet names
  const watchedSheet = workbook.Sheets['Просмотрено'] || workbook.Sheets['Sheet2'];
  const toWatchSheet = workbook.Sheets['Буду смотреть'] || workbook.Sheets['Sheet3'];
  const catalogSheet = workbook.Sheets['Каталог'] || workbook.Sheets['Sheet5'];

  if (watchedSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(watchedSheet);
    for (const row of rows) {
      const movie = excelRowToMovie(row);
      if (!movie) continue;
      const rating = parseFloat(row['Моя оценка']);
      if (rating && !isNaN(rating)) {
        watched.push({ ...movie, rating, watchedAt: new Date(0).toISOString() });
      }
    }
  }

  if (toWatchSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(toWatchSheet);
    for (const row of rows) {
      const movie = excelRowToMovie(row);
      if (!movie) continue;
      const predicted = parseFloat(row['Ожидаемая моя оценка']);
      if (predicted && !isNaN(predicted)) {
        movie.predictedRating = predicted;
      }
      movie.reasonToWatch = row['Причина добавления'] || undefined;
      toWatch.push(movie);
    }
  }

  // Fallback: if no named sheets, try catalog
  if (watched.length === 0 && toWatch.length === 0 && catalogSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(catalogSheet);
    for (const row of rows) {
      const movie = excelRowToMovie(row);
      if (!movie) continue;
      const rating = parseFloat(row['Моя оценка']);
      if (rating && !isNaN(rating)) {
        watched.push({ ...movie, rating, watchedAt: new Date(0).toISOString() });
      } else {
        const predicted = parseFloat(row['Ожидаемая моя оценка']);
        if (predicted) movie.predictedRating = predicted;
        toWatch.push(movie);
      }
    }
  }

  // If still nothing, try first sheet
  if (watched.length === 0 && toWatch.length === 0) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[1]] || workbook.Sheets[workbook.SheetNames[0]];
    if (firstSheet) {
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
      for (const row of rows) {
        const movie = excelRowToMovie(row);
        if (!movie) continue;
        const rating = parseFloat(row['Моя оценка']);
        if (rating && !isNaN(rating)) {
          watched.push({ ...movie, rating, watchedAt: new Date(0).toISOString() });
        } else {
          toWatch.push(movie);
        }
      }
    }
  }

  return { watched, toWatch };
}

function normalizeExcelRow(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    result[key.replace(/\s*\(необязательно\)/gi, '').trim()] = row[key];
  }
  return result;
}

function excelRowToMovie(rawRow: Record<string, any>): (Movie & { predictedRating?: number; reasonToWatch?: string }) | null {
  const row = normalizeExcelRow(rawRow);
  const title = row['Название'] || row['название'] || '';
  const titleOrig = row['Оригинальное название'] || row['оригинальное название'] || '';
  if (!title && !titleOrig) return null;

  const duration = parseInt(row['Продолжительность, мин'] || row['Продолжительность'] || '0') || 0;
  const genreStr = (row['Жанр'] || row['жанр'] || '') as string;
  const genres = genreStr.split(',').map(s => s.trim()).filter(Boolean);

  const kpRating = parseFloat(row['Рейтинг Кинопоиска'] || row['рейтинг'] || '0') || 0;
  const year = parseInt(row['Год производства'] || row['Год'] || row['год'] || '0') || 0;
  const country = (row['Страна'] || row['страна'] || '') as string;
  const type = (row['Тип'] || '') as string;

  let format: 'short' | 'medium' | 'long' = 'medium';
  if (duration > 0) {
    format = duration < 90 ? 'short' : duration > 120 ? 'long' : 'medium';
  }

  // Map genres to mood heuristics
  const mood = genresToMood(genres);
  const timeOfDay = genresToTimeOfDay(genres);

  return {
    id: buildStableMovieId(
      'kp',
      {
        title: titleOrig || title,
        titleRu: title,
        year,
        type: type === 'TV_SERIES' ? 'series' : type === 'MINI_SERIES' ? 'miniseries' : 'film',
      },
      row['ID Кинопоиска'] || null,
    ),
    title: titleOrig || title,
    titleRu: title,
    year,
    genre: genres,
    duration,
    mood,
    description: (row['Описание'] || row['Слоган'] || '') as string,
    director: '',
    forCompany: 'any',
    timeOfDay,
    format,
    kpRating,
    country,
    type: type === 'TV_SERIES' ? 'series' : type === 'MINI_SERIES' ? 'miniseries' : 'film',
  };
}

function genresToMood(genres: string[]): string[] {
  const moods: string[] = [];
  const g = genres.map(s => s.toLowerCase());
  if (g.some(x => ['комедия'].includes(x))) moods.push('happy');
  if (g.some(x => ['драма', 'биография', 'история'].includes(x))) moods.push('thoughtful');
  if (g.some(x => ['триллер', 'боевик', 'криминал'].includes(x))) moods.push('excited');
  if (g.some(x => ['мелодрама'].includes(x))) moods.push('calm', 'nostalgic');
  if (g.some(x => ['ужасы'].includes(x))) moods.push('excited');
  if (g.some(x => ['фэнтези', 'фантастика'].includes(x))) moods.push('excited');
  if (g.some(x => ['военный'].includes(x))) moods.push('thoughtful');
  if (g.some(x => ['детектив'].includes(x))) moods.push('excited');
  if (g.some(x => ['музыка'].includes(x))) moods.push('calm');
  if (moods.length === 0) moods.push('calm');
  return [...new Set(moods)];
}

function genresToTimeOfDay(genres: string[]): ('morning' | 'afternoon' | 'evening' | 'night')[] {
  const g = genres.map(s => s.toLowerCase());
  if (g.some(x => ['ужасы', 'триллер'].includes(x))) return ['evening', 'night'];
  if (g.some(x => ['комедия'].includes(x))) return ['afternoon', 'evening'];
  if (g.some(x => ['драма', 'мелодрама'].includes(x))) return ['evening', 'night'];
  if (g.some(x => ['боевик', 'приключения'].includes(x))) return ['afternoon', 'evening'];
  return ['afternoon', 'evening'];
}

// ===== JSON =====
function parseJSON(content: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Файл содержит некорректный JSON');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('JSON должен содержать объект или массив');
  }
  const arr: unknown[] = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>).movies ?? (data as Record<string, unknown>).films ?? []) as unknown[];

  if (!Array.isArray(arr)) throw new Error('Не найден массив фильмов в JSON');

  const movies = arr
    .slice(0, 5000) // hard cap
    .map((item, idx) => {
      try {
        const validated = UploadedMovieSchema.parse(item);
        return normalizeSimpleMovie(validated);
      } catch {
        console.warn(`Строка ${idx + 1} пропущена: некорректные данные`);
        return null;
      }
    })
    .filter((m): m is Movie => m !== null);

  return { watched: [], toWatch: movies };
}

// ===== CSV =====
function parseCSV(content: string): ParseResult {
  const lines = content.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV файл пуст');

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const movies: Movie[] = [];

  const rowsToProcess = lines.slice(1, 5001); // hard cap 5000 rows
  for (let i = 0; i < rowsToProcess.length; i++) {
    const values = parseCSVLine(rowsToProcess[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = values[idx]?.trim() ?? ''; });
    try {
      const validated = UploadedMovieSchema.parse(obj);
      const movie = normalizeSimpleMovie(validated);
      if (movie) movies.push(movie);
    } catch {
      console.warn(`CSV строка ${i + 2} пропущена: некорректные данные`);
    }
  }

  return { watched: [], toWatch: movies };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }
    if (char === ',' && !inQuotes) { result.push(current); current = ''; i++; continue; }
    current += char; i++;
  }
  result.push(current);
  return result;
}

function splitField(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function normalizeSimpleMovie(raw: Record<string, any>): Movie | null {
  const title = raw.title || raw.name || '';
  const titleRu = raw.titleRu || raw.title_ru || raw['название'] || raw['titleru'] || title;
  if (!titleRu && !title) return null;

  const duration = Number(raw.duration || raw['длительность'] || raw.runtime || 100);
  let format: 'short' | 'medium' | 'long' = 'medium';
  if (raw.format) format = raw.format;
  else format = duration < 90 ? 'short' : duration > 120 ? 'long' : 'medium';

  return {
    id: buildStableMovieId(
      'upload',
      {
        title: title || titleRu,
        titleRu: titleRu || title,
        year: Number(raw.year || raw['год'] || 2020),
        type: raw.type === 'series' ? 'series' : 'film',
      },
    ),
    title: title || titleRu,
    titleRu: titleRu || title,
    year: Number(raw.year || raw['год'] || 2020),
    genre: splitField(raw.genre || raw['жанр']),
    duration,
    mood: splitField(raw.mood || raw['настроение'] || 'calm'),
    description: raw.description || raw['описание'] || '',
    director: raw.director || raw['режиссёр'] || raw['режиссер'] || '',
    forCompany: (raw.forCompany || raw.company || raw['компания'] || 'any') as Movie['forCompany'],
    timeOfDay: splitField(raw.timeOfDay || raw.time_of_day || raw['время'] || 'evening') as Movie['timeOfDay'],
    format,
    type: raw.type === 'series' ? 'series' : 'film',
  };
}
