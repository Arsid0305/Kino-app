import { describe, expect, it } from 'vitest';
import { buildTasteProfileSummary } from '@/lib/tasteProfile';
import type { Movie, WatchedMovie } from '@/lib/movieTypes';

function watched(overrides: Partial<WatchedMovie>): WatchedMovie {
  return {
    id: overrides.id ?? 'm',
    title: overrides.title ?? 't',
    titleRu: overrides.titleRu ?? 'т',
    year: overrides.year ?? 2020,
    genre: overrides.genre ?? ['драма'],
    duration: overrides.duration ?? 120,
    mood: overrides.mood ?? ['задумчивое'],
    poster: undefined,
    description: '',
    director: overrides.director ?? '',
    forCompany: 'any',
    timeOfDay: ['evening'],
    format: 'medium',
    watchedAt: overrides.watchedAt ?? '2026-08-01T00:00:00Z',
    rating: overrides.rating ?? 8,
    ...overrides,
  };
}

describe('buildTasteProfileSummary', () => {
  it('пустая история → говорит об этом явно', () => {
    const out = buildTasteProfileSummary([], []);
    expect(out).toContain('История оценок пока пустая');
  });

  it('жанр с высокой оценкой весит больше низкой', () => {
    // Драма: 10/10 (+5), Комедия: 6/10 (+1). Драма должна быть выше.
    const list = [
      watched({ id: 'a', genre: ['драма'], rating: 10 }),
      watched({ id: 'b', genre: ['комедия'], rating: 6 }),
    ];
    const out = buildTasteProfileSummary(list, []);
    const genresLine = out.match(/Prefers genres: ([^.]+)\./)?.[1] ?? '';
    expect(genresLine.indexOf('драма')).toBeLessThan(genresLine.indexOf('комедия'));
  });

  it('один плохой фильм не заносит жанр в avoid — нужно ≥ 2 записей', () => {
    const list = [
      watched({ id: 'x', genre: ['хоррор'], rating: 3 }),
      watched({ id: 'y', genre: ['драма'], rating: 8 }),
    ];
    const out = buildTasteProfileSummary(list, []);
    expect(out).not.toMatch(/Avoid/);
  });

  it('два плохих фильма одного жанра → попадают в avoid', () => {
    const list = [
      watched({ id: 'x', genre: ['хоррор'], rating: 3 }),
      watched({ id: 'y', genre: ['хоррор'], rating: 2 }),
      watched({ id: 'z', genre: ['драма'], rating: 9 }),
    ];
    const out = buildTasteProfileSummary(list, []);
    expect(out).toMatch(/Avoid \(low ratings\): genres хоррор/);
  });

  it('последние watchedAt формируют секцию Recent taste', () => {
    const list = [
      watched({ id: 'old', genre: ['драма'], rating: 9, watchedAt: '2020-01-01T00:00:00Z' }),
      watched({ id: 'new1', genre: ['фантастика'], rating: 9, watchedAt: '2026-08-28T00:00:00Z' }),
      watched({ id: 'new2', genre: ['фантастика'], rating: 8, watchedAt: '2026-08-27T00:00:00Z' }),
    ];
    const out = buildTasteProfileSummary(list, []);
    expect(out).toMatch(/Recent taste .*фантастика/);
  });

  it('десятилетия считаются по году', () => {
    const list = [
      watched({ id: '1', year: 2011, rating: 8 }),
      watched({ id: '2', year: 2015, rating: 7 }),
      watched({ id: '3', year: 2022, rating: 6 }),
    ];
    const out = buildTasteProfileSummary(list, []);
    expect(out).toMatch(/Eras: 2010s/);
  });

  it('watchlist без просмотренных → hints не появляются, но watched считается', () => {
    const watchlist: Movie[] = [{
      id: 'w', title: 't', titleRu: 'т', year: 2024, genre: ['комедия'],
      duration: 100, mood: [], description: '', director: '', forCompany: 'any',
      timeOfDay: [], format: 'medium',
    }];
    const out = buildTasteProfileSummary([], watchlist);
    expect(out).toContain('Watchlist size=1');
  });
});
