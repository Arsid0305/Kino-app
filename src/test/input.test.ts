import { describe, it, expect } from 'vitest';
import {
  chatBody, recommendationBody, forbiddenSet, isForbidden, normalizeTitle, LIMITS,
} from '../../supabase/functions/_shared/input';

const msg = { role: 'user', content: 'привет' };

describe('chatBody', () => {
  it('[null] в списках фильмов не роняет запрос, элемент отбрасывается', () => {
    const r = chatBody.safeParse({ messages: [msg], watchedMovies: [null, { titleRu: 'Амели' }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.watchedMovies).toEqual([{ titleRu: 'Амели' }]);
  });
  it('неизвестный провайдер → gpt4o, неизвестный mode → chat', () => {
    const r = chatBody.parse({ messages: [msg], provider: 'evil', mode: 'x' });
    expect(r.provider).toBe('gpt4o');
    expect(r.mode).toBe('chat');
  });
  it('слишком длинное сообщение, пустой и раздутый диалог — ошибка', () => {
    expect(chatBody.safeParse({ messages: [{ role: 'user', content: 'a'.repeat(LIMITS.message + 1) }] }).success).toBe(false);
    expect(chatBody.safeParse({ messages: [] }).success).toBe(false);
    const big = Array.from({ length: 7 }, () => ({ role: 'user', content: 'a'.repeat(2000) }));
    expect(chatBody.safeParse({ messages: big }).success).toBe(false);
    expect(chatBody.safeParse(null).success).toBe(false);
  });
});

describe('recommendationBody: ограничения длины', () => {
  it('фильтры и запрещённые названия обрезаются', () => {
    const r = recommendationBody.parse({
      filters: Array.from({ length: 50 }, () => 'f'.repeat(500)),
      forbiddenTitles: [...Array.from({ length: 3000 }, (_, i) => `t${i}`), 42],
      tasteProfile: 'x'.repeat(5000),
    });
    expect(r.filters).toHaveLength(LIMITS.filters);
    expect(r.filters[0]).toHaveLength(LIMITS.filter);
    expect(r.forbiddenTitles).toHaveLength(LIMITS.forbiddenTitles);
    expect(r.tasteProfile).toHaveLength(LIMITS.tasteProfile);
  });
  it('длинное название фильма отбрасывается', () => {
    const r = recommendationBody.parse({ watchedMovies: [{ titleRu: 'a'.repeat(LIMITS.title + 1) }] });
    expect(r.watchedMovies[0].titleRu).toBeUndefined();
  });
  it('без forbiddenTitles — null, фильтр строится из списков', () => {
    const r = recommendationBody.parse({ watchedMovies: [{ titleRu: 'Амели' }] });
    expect(r.forbiddenTitles).toBeNull();
    expect(forbiddenSet(r).has('амели')).toBe(true);
  });
});

describe('фильтр уже просмотренного', () => {
  const set = new Set(['отпуск по обмену'].map(normalizeTitle));
  it('одинаковая нормализация: двойные пробелы и регистр в ответе модели', () => {
    expect(isForbidden({ titleRu: '  Отпуск  по   обмену ' }, set)).toBe(true);
    expect(isForbidden({ titleRu: 'Другой фильм' }, set)).toBe(false);
  });
  it('не-объект из ответа модели отбрасывается', () => {
    expect(isForbidden('строка', set)).toBe(true);
    expect(isForbidden(null, set)).toBe(true);
  });
});
