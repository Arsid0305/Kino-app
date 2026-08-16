import { describe, expect, it } from 'vitest';
import { buildStableMovieId, mergeUniqueMovies, reconcileImportedTypes } from '@/lib/movieIdentity';

describe('movieIdentity helpers', () => {
  it('builds deterministic ids for the same movie payload', () => {
    const first = buildStableMovieId('upload', {
      titleRu: 'Интерстеллар',
      year: 2014,
      type: 'film',
    });
    const second = buildStableMovieId('upload', {
      titleRu: 'Интерстеллар',
      year: 2014,
      type: 'film',
    });

    expect(first).toBe(second);
  });

  it('removes duplicates by movie identity instead of random ids', () => {
    const merged = mergeUniqueMovies(
      [
        { id: 'a', title: 'Interstellar', titleRu: 'Интерстеллар', year: 2014, type: 'film' as const },
      ],
      [
        { id: 'b', title: 'Interstellar', titleRu: 'Интерстеллар', year: 2014, type: 'film' as const },
        { id: 'c', title: 'Arrival', titleRu: 'Прибытие', year: 2016, type: 'film' as const },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged.map(movie => movie.id)).toEqual(['a', 'c']);
  });

  it('treats the same title differing only by type as one movie', () => {
    const merged = mergeUniqueMovies(
      [
        { id: 'a', title: 'The Crown', titleRu: 'Корона', year: 2016, type: 'film' as const },
      ],
      [
        { id: 'b', title: 'The Crown', titleRu: 'Корона', year: 2016, type: 'series' as const },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('a');
  });

  it('keeps movies apart when the year differs', () => {
    const merged = mergeUniqueMovies(
      [
        { id: 'a', titleRu: 'Малхолланд Драйв', year: 2001, type: 'film' as const },
        { id: 'b', titleRu: 'Малхолланд Драйв', year: 1999, type: 'film' as const },
      ],
    );

    expect(merged).toHaveLength(2);
  });

  it('adopts the stored type for imported movies', () => {
    const imported = reconcileImportedTypes(
      [
        { titleRu: 'Корона', year: 2016, type: 'series' as const },
        { titleRu: 'Прибытие', year: 2016, type: 'film' as const },
      ],
      [
        { titleRu: 'Корона', year: 2016, type: 'film' as const },
      ],
    );

    expect(imported[0].type).toBe('film');
    expect(imported[1].type).toBe('film');
  });

  it('leaves the imported type alone when nothing is stored yet', () => {
    const imported = reconcileImportedTypes(
      [{ titleRu: 'Гангстерленд', year: 2025, type: 'series' as const }],
      [],
    );

    expect(imported[0].type).toBe('series');
  });
});
