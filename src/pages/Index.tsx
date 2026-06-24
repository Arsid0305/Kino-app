import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import { Clapperboard, Clock, History, Sparkles, Star, Trash2, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { FilterSection } from '@/components/FilterSection';
import { MovieCard } from '@/components/MovieCard';
import { RatingModal } from '@/components/RatingModal';
import { WatchHistory } from '@/components/WatchHistory';
import { FileUpload } from '@/components/FileUpload';
import { AiAdvisor } from '@/components/AiAdvisor';
import { AuthPanel } from '@/components/AuthPanel';
import { ParseResult } from '@/lib/fileParser';
import {
  FilterState,
  Movie,
  WatchedMovie,
  TYPE_OPTIONS,
  TIME_OPTIONS,
  CONTEXT_OPTIONS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  COMPANY_OPTIONS,
} from '@/lib/movieTypes';
import { getRecommendation } from '@/lib/movieEngine';
import { MOVIE_DATABASE } from '@/lib/movieData';
import { getMovieDedupKey, mergeUniqueMovies } from '@/lib/movieIdentity';
import { localizeReason } from '@/lib/localizeReason';
import { supabase } from '@/integrations/supabase/client';
import {
  loadCloudLibrary,
  removeFromCloudLists,
  seedCloudLibrary,
  upsertDismissedMovie,
  upsertWatchedMovie,
  upsertWatchlistMovie,
  upsertWatchlistMovies,
} from '@/lib/supabaseMovieStore';
import { requestGlobalRecommendation } from '@/lib/globalRecommendation';

type Tab = 'recommend' | 'history';

const loadLocalArray = <T,>(key: string): T[] => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const Index = () => {
  const [tab, setTab] = useState<Tab>('recommend');
  const [filters, setFilters] = useState<FilterState>({
    type: null,
    timeOfDay: null,
    context: null,
    format: null,
    genre: null,
    mood: null,
    company: null,
  });
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [ratingMovie, setRatingMovie] = useState<Movie | null>(null);
  const [watched, setWatched] = useState<WatchedMovie[]>(() => loadLocalArray<WatchedMovie>('cinema-watched'));
  const [customMovies, setCustomMovies] = useState<Movie[]>(() => loadLocalArray<Movie>('cinema-custom-movies'));
  const [dismissedMovies, setDismissedMovies] = useState<Movie[]>(() => loadLocalArray<Movie>('cinema-dismissed-movies'));
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState('Локальный режим');
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const customMoviesRef = useRef(customMovies);
  customMoviesRef.current = customMovies;
  const dismissedMoviesRef = useRef(dismissedMovies);
  dismissedMoviesRef.current = dismissedMovies;

  useEffect(() => {
    let cancelled = false;

    const syncLibrary = async () => {
      if (!session) {
        setSyncStatus('Локальный режим');
        return;
      }

      setSyncStatus('Синхронизируем с облаком...');

      try {
        const cloudLibrary = await loadCloudLibrary();
        if (cancelled) return;

        const hasCloudData =
          cloudLibrary.watched.length > 0 ||
          cloudLibrary.watchlist.length > 0 ||
          cloudLibrary.dismissed.length > 0;
        if (hasCloudData) {
          const mergedWatched = mergeUniqueMovies(cloudLibrary.watched, watchedRef.current);
          const mergedWatchlist = mergeUniqueMovies(cloudLibrary.watchlist, customMoviesRef.current);
          const mergedDismissed = mergeUniqueMovies(cloudLibrary.dismissed, dismissedMoviesRef.current);
          if (cancelled) return;
          setWatched(mergedWatched);
          setCustomMovies(mergedWatchlist);
          setDismissedMovies(mergedDismissed);
          localStorage.setItem('cinema-watched', JSON.stringify(mergedWatched));
          localStorage.setItem('cinema-custom-movies', JSON.stringify(mergedWatchlist));
          localStorage.setItem('cinema-dismissed-movies', JSON.stringify(mergedDismissed));

          const localOnlyWatched = mergedWatched.filter(m => !cloudLibrary.watched.some(c => getMovieDedupKey(c) === getMovieDedupKey(m)));
          const localOnlyWatchlist = mergedWatchlist.filter(m => !cloudLibrary.watchlist.some(c => getMovieDedupKey(c) === getMovieDedupKey(m)));
          const localOnlyDismissed = mergedDismissed.filter(m => !cloudLibrary.dismissed.some(c => getMovieDedupKey(c) === getMovieDedupKey(m)));
          if (localOnlyWatched.length + localOnlyWatchlist.length + localOnlyDismissed.length > 0) {
            await seedCloudLibrary(localOnlyWatched, localOnlyWatchlist, localOnlyDismissed);
          }
          if (cancelled) return;
          setSyncStatus('Синхронизировано с Supabase');
          return;
        }

        await seedCloudLibrary(watchedRef.current, customMoviesRef.current, dismissedMoviesRef.current);
        if (cancelled) return;
        setSyncStatus('Локальная база загружена в Supabase');
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setSyncStatus('Ошибка синхронизации, работаем локально');
        toast.error(error instanceof Error ? error.message : 'Не удалось синхронизировать библиотеку');
      }
    };

    void syncLibrary();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const updateFilter = (key: keyof FilterState) => (value: string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleMoviesLoaded = async (result: ParseResult) => {
    let nextWatched = watched;
    let nextWatchlist = customMovies;

    if (result.watched.length > 0) {
      nextWatched = mergeUniqueMovies(watched, result.watched);
      setWatched(nextWatched);
      localStorage.setItem('cinema-watched', JSON.stringify(nextWatched));
    }

    if (result.toWatch.length > 0) {
      nextWatchlist = mergeUniqueMovies(customMovies, result.toWatch);
      setCustomMovies(nextWatchlist);
      localStorage.setItem('cinema-custom-movies', JSON.stringify(nextWatchlist));
    }

    if (session) {
      try {
        await Promise.all([
          result.watched.length > 0 ? Promise.all(result.watched.map(movie => upsertWatchedMovie(movie))) : Promise.resolve(),
          result.toWatch.length > 0 ? upsertWatchlistMovies(result.toWatch) : Promise.resolve(),
        ]);
        setSyncStatus('Импорт синхронизирован с Supabase');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Не удалось синхронизировать импорт');
      }
    }
  };

  const getMovie = useCallback(async () => {
    setLoadingRecommendation(true);

    try {
      if (session) {
        const aiMovies = await requestGlobalRecommendation(filters, watched, customMovies, dismissedMovies);
        setRecommendations(aiMovies);
        return;
      }

      const localMovie = getRecommendation(filters, watched, customMovies, dismissedMovies);
      setRecommendations(localMovie ? [localMovie] : []);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Не удалось получить рекомендацию');
      const fallbackMovie = getRecommendation(filters, watched, customMovies, dismissedMovies);
      setRecommendations(fallbackMovie ? [fallbackMovie] : []);
    } finally {
      setLoadingRecommendation(false);
    }
  }, [session, filters, watched, customMovies, dismissedMovies]);

  const handleRateMovie = async (movie: Movie, rating: number, notes: string) => {
    const entry: WatchedMovie = { ...movie, rating, notes, watchedAt: new Date().toISOString() };
    const entryKey = getMovieDedupKey(entry);
    const updatedWatched = [entry, ...watched.filter(m => getMovieDedupKey(m) !== entryKey)];
    const updatedDismissed = dismissedMovies.filter(m => getMovieDedupKey(m) !== entryKey);
    setWatched(updatedWatched);
    setDismissedMovies(updatedDismissed);
    localStorage.setItem('cinema-watched', JSON.stringify(updatedWatched));
    localStorage.setItem('cinema-dismissed-movies', JSON.stringify(updatedDismissed));
    if (session) {
      try { await upsertWatchedMovie(entry); setSyncStatus('Оценка сохранена в Supabase'); }
      catch (error) { console.error(error); toast.error(error instanceof Error ? error.message : 'Не удалось сохранить оценку в облако'); }
    }
  };

  const handleRate = async (rating: number, notes: string) => {
    if (!ratingMovie) return;

    const entry: WatchedMovie = {
      ...ratingMovie,
      rating,
      notes,
      watchedAt: new Date().toISOString(),
    };

    const entryKey = getMovieDedupKey(entry);
    const updatedWatched = [entry, ...watched.filter(movie => getMovieDedupKey(movie) !== entryKey)];
    const updatedWatchlist = customMovies.filter(movie => getMovieDedupKey(movie) !== entryKey);
    const updatedDismissed = dismissedMovies.filter(movie => getMovieDedupKey(movie) !== entryKey);

    setWatched(updatedWatched);
    setCustomMovies(updatedWatchlist);
    setDismissedMovies(updatedDismissed);
    localStorage.setItem('cinema-watched', JSON.stringify(updatedWatched));
    localStorage.setItem('cinema-custom-movies', JSON.stringify(updatedWatchlist));
    localStorage.setItem('cinema-dismissed-movies', JSON.stringify(updatedDismissed));
    setRatingMovie(null);
    setWatchlistPreview(null);

    if (session) {
      try {
        await upsertWatchedMovie(entry);
        setSyncStatus('Оценка сохранена в Supabase');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Не удалось сохранить оценку в облако');
      }
    }
  };

  const handleAddToWatchlist = async (movie: Movie) => {
    const movieKey = getMovieDedupKey(movie);
    const nextWatchlist = mergeUniqueMovies(
      [movie],
      customMovies.filter(item => getMovieDedupKey(item) !== movieKey)
    );
    const nextDismissed = dismissedMovies.filter(item => getMovieDedupKey(item) !== movieKey);

    setCustomMovies(nextWatchlist);
    setDismissedMovies(nextDismissed);
    localStorage.setItem('cinema-custom-movies', JSON.stringify(nextWatchlist));
    localStorage.setItem('cinema-dismissed-movies', JSON.stringify(nextDismissed));

    if (session) {
      try {
        await upsertWatchlistMovie({ ...movie, source: movie.source ?? 'ai-chat' });
        setSyncStatus('Список «Буду смотреть» синхронизирован с Supabase');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Не удалось сохранить список «Буду смотреть»');
      }
    }
  };

  const handleDismissMovie = async (movie: Movie) => {
    const movieKey = getMovieDedupKey(movie);
    const nextDismissed = mergeUniqueMovies(
      [movie],
      dismissedMovies.filter(item => getMovieDedupKey(item) !== movieKey)
    );
    const nextWatchlist = customMovies.filter(item => getMovieDedupKey(item) !== movieKey);

    setDismissedMovies(nextDismissed);
    setCustomMovies(nextWatchlist);
    localStorage.setItem('cinema-dismissed-movies', JSON.stringify(nextDismissed));
    localStorage.setItem('cinema-custom-movies', JSON.stringify(nextWatchlist));

    if (session) {
      try {
        await upsertDismissedMovie({ ...movie, source: movie.source ?? 'ai-chat' });
        setSyncStatus('Фильм исключен из будущих подборов');
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Не удалось сохранить отказ');
      }
    }
  };

  const handleRemoveFromWatchlist = async (movie: Movie) => {
    const movieKey = getMovieDedupKey(movie);
    const nextWatchlist = customMovies.filter(item => getMovieDedupKey(item) !== movieKey);
    setCustomMovies(nextWatchlist);
    localStorage.setItem('cinema-custom-movies', JSON.stringify(nextWatchlist));
    if (session) {
      try {
        await removeFromCloudLists(movieKey, ['watchlist']);
        setSyncStatus('Фильм удалён из "Буду смотреть"');
      } catch (error) {
        console.error(error);
        toast.error('Не удалось удалить из облака');
      }
    }
  };

  const handleRemoveFromDismissed = async (movie: Movie) => {
    const movieKey = getMovieDedupKey(movie);
    const nextDismissed = dismissedMovies.filter(item => getMovieDedupKey(item) !== movieKey);
    setDismissedMovies(nextDismissed);
    localStorage.setItem('cinema-dismissed-movies', JSON.stringify(nextDismissed));
    if (session) {
      try {
        await removeFromCloudLists(movieKey, ['dismissed']);
        setSyncStatus('Фильм удалён из исключённых');
      } catch (error) {
        console.error(error);
        toast.error('Не удалось удалить из облака');
      }
    }
  };

  const resetFilters = () => {
    setFilters({ type: null, timeOfDay: null, context: null, format: null, genre: null, mood: null, company: null });
  };

  const handleSendOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) { toast.error(error.message); throw error; }
    toast.success('Код отправлен на email');
  };

  const handleVerifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) { toast.error('Неверный код'); throw error; }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }

    setSyncStatus('Локальный режим');
    toast.success('Вы вышли из облачного аккаунта');
  };

  const [listModal, setListModal] = useState<'watchlist' | 'dismissed' | null>(null);
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [watchlistPreview, setWatchlistPreview] = useState<Movie | null>(null);
  const [historyPreview, setHistoryPreview] = useState<WatchedMovie | null>(null);
  const [historyRating, setHistoryRating] = useState(7);
  const [historyNotes, setHistoryNotes] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div ref={headerRef} className="sticky top-0 z-40 glass-surface border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-foreground tracking-wide">КИНО</h1>
              <p className="text-[10px] text-muted-foreground">Глобальный AI подбор</p>
            </div>
          </div>
          <div className="flex bg-secondary rounded-xl p-1">
            <button
              onClick={() => setTab('recommend')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === 'recommend' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              Подбор
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5 inline mr-1" />
              История
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-6">
        <AuthPanel
          session={session}
          syncStatus={syncStatus}
          onSendOtp={handleSendOtp}
          onVerifyOtp={handleVerifyOtp}
          onSignOut={handleSignOut}
        />

        <AnimatePresence mode="wait">
          {tab === 'recommend' ? (
            <motion.div
              key="recommend"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
                           <FilterSection title="Тип" options={TYPE_OPTIONS} selected={filters.type} onSelect={updateFilter('type')} cols={3} />
              <FilterSection title="Время дня" options={TIME_OPTIONS} selected={filters.timeOfDay} onSelect={updateFilter('timeOfDay')} cols={4} />
              <FilterSection title="Контекст" options={CONTEXT_OPTIONS} selected={filters.context} onSelect={updateFilter('context')} cols={3} />
              <FilterSection title="Формат" options={FORMAT_OPTIONS} selected={filters.format} onSelect={updateFilter('format')} cols={3} />
              <FilterSection title="Жанр" options={GENRE_OPTIONS} selected={filters.genre} onSelect={updateFilter('genre')} cols={3} />
              <FilterSection title="Настроение" options={MOOD_OPTIONS} selected={filters.mood} onSelect={updateFilter('mood')} cols={3} />
              <FilterSection title="Компания" options={COMPANY_OPTIONS} selected={filters.company} onSelect={updateFilter('company')} cols={3} />

              <AnimatePresence>
                {hasFilters && (
                  <motion.button
                    key="reset-filters"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={resetFilters}
                    className="w-full py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Сбросить все фильтры
                  </motion.button>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => void getMovie()}
                disabled={loadingRecommendation}
                className={`w-full py-4 rounded-2xl font-display text-xl tracking-wider transition-all ${
                  hasFilters || session
                    ? 'bg-primary text-primary-foreground cinema-glow'
                    : 'bg-secondary text-muted-foreground'
                } disabled:opacity-60`}
              >
                {loadingRecommendation ? 'ИЩУ ФИЛЬМ...' : 'ПОДОБРАТЬ ФИЛЬМ'}
              </motion.button>

              <AnimatePresence>
                {recommendations.map(movie => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onRate={m => {
                      void handleAddToWatchlist(m);
                      const remaining = recommendations.filter(r => r.id !== m.id);
                      setRecommendations(remaining);
                      if (remaining.length === 0) void getMovie();
                    }}
                    onSkip={() => {
                      void handleDismissMovie(movie);
                      const remaining = recommendations.filter(r => r.id !== movie.id);
                      setRecommendations(remaining);
                      if (remaining.length === 0) void getMovie();
                    }}
                  />
                ))}
              </AnimatePresence>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setListModal('watchlist')}
                  className="bg-secondary/60 border border-border rounded-xl py-2.5 px-2 text-center hover:border-primary/40 transition-colors"
                >
                  <div className="font-display text-xl text-primary">{customMovies.length}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Буду смотреть</div>
                </button>
                <button
                  onClick={() => setTab('history')}
                  className="bg-secondary/60 border border-border rounded-xl py-2.5 px-2 text-center hover:border-primary/40 transition-colors"
                >
                  <div className="font-display text-xl text-primary">{watched.length}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Просмотрено</div>
                </button>
                <button
                  onClick={() => setListModal('dismissed')}
                  className="bg-secondary/60 border border-border rounded-xl py-2.5 px-2 text-center hover:border-primary/40 transition-colors"
                >
                  <div className="font-display text-xl text-muted-foreground">{dismissedMovies.length}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Исключено</div>
                </button>
              </div>
              {!session && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Без подключения используется встроенная база из {MOVIE_DATABASE.length} фильмов.
                </p>
              )}

              <FileUpload onMoviesLoaded={result => void handleMoviesLoaded(result)} />
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WatchHistory
                watched={watched}
                rewatchKeys={new Set(customMovies.map(getMovieDedupKey))}
                onReRate={movie => {
                setHistoryPreview(movie);
                setHistoryRating(movie.rating ?? 7);
                setHistoryNotes((movie as { notes?: string }).notes ?? '');
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {ratingMovie && (
          <RatingModal
            movie={ratingMovie}
            onSubmit={(rating, notes) => void handleRate(rating, notes)}
            onClose={() => setRatingMovie(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] bg-background/95 backdrop-blur-sm overflow-y-auto"
          >
            <div className="max-w-md mx-auto p-4 flex flex-col gap-4 min-h-full">
              <div className="flex justify-end">
                <button onClick={() => setHistoryPreview(null)} style={{ touchAction: 'manipulation' }} className="text-muted-foreground p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3 cinema-glow">
                <div>
                  <h2 className="font-display text-2xl text-foreground leading-tight">{historyPreview.titleRu}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{historyPreview.title} · {historyPreview.year}</p>
                </div>
                {historyPreview.description && <p className="text-sm text-secondary-foreground leading-relaxed">{historyPreview.description}</p>}
                {historyPreview.reasonToWatch && localizeReason(historyPreview.reasonToWatch) && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Почему вам подойдёт</p>
                    <p className="mt-1 text-sm text-secondary-foreground leading-relaxed">{localizeReason(historyPreview.reasonToWatch)}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {historyPreview.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {historyPreview.duration} мин</span>}
                  {historyPreview.director && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {historyPreview.director}</span>}
                  {historyPreview.kpRating && historyPreview.kpRating > 0 && <span className="flex items-center gap-1 text-primary"><Star className="w-3.5 h-3.5 fill-primary" /> КП {historyPreview.kpRating}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {historyPreview.genre.map(g => (
                    <span key={g} className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md bg-secondary text-secondary-foreground">{g}</span>
                  ))}
                </div>
                <a
                  href={`https://yandex.ru/search/?text=${encodeURIComponent((historyPreview.titleRu) + ' фильм ' + historyPreview.year)}`}
                  target="_blank" rel="noreferrer"
                  className="block w-full py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium text-center"
                >
                  Яндекс
                </a>
              </div>

              {(() => {
                const isRewatch = customMovies.some(m => getMovieDedupKey(m) === getMovieDedupKey(historyPreview));
                return (
                  <button
                    onClick={() => {
                      if (isRewatch) {
                        void handleRemoveFromWatchlist(historyPreview);
                      } else {
                        void handleAddToWatchlist(historyPreview);
                      }
                    }}
                    style={{ touchAction: 'manipulation' }}
                    className={`w-full py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      isRewatch
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {isRewatch ? '★ Посмотреть повторно' : 'Посмотреть повторно'}
                  </button>
                );
              })()}

              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="font-display text-lg text-foreground">Ваша оценка</h3>
                <div className="space-y-2">
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <motion.button key={i} whileTap={{ scale: 1.2 }} onClick={() => setHistoryRating(i + 1)} className="p-0.5">
                        <Star className={`w-6 h-6 transition-colors ${i < historyRating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`} />
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-center text-2xl font-display text-primary">{historyRating}/10</p>
                </div>
                <textarea
                  value={historyNotes}
                  onChange={e => setHistoryNotes(e.target.value)}
                  placeholder="Заметка (необязательно)..."
                  className="w-full bg-secondary border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { void handleRateMovie(historyPreview, historyRating, historyNotes); setHistoryPreview(null); }}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm"
                >
                  Сохранить оценку
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {watchlistPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-background overflow-y-auto"
          >
            <div className="max-w-md mx-auto flex flex-col min-h-full">
              <div className="flex justify-end px-4 pt-4 pb-2 shrink-0">
                <button onClick={() => setWatchlistPreview(null)} style={{ touchAction: 'manipulation' }} className="text-muted-foreground p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 px-4 pb-6 flex flex-col gap-4">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 cinema-glow">
                  <div>
                    <h2 className="font-display text-2xl text-foreground leading-tight">{watchlistPreview.titleRu}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{watchlistPreview.title} · {watchlistPreview.year}</p>
                  </div>
                  {watchlistPreview.description && (
                    <p className="text-sm text-secondary-foreground leading-relaxed">{watchlistPreview.description}</p>
                  )}
                  {watchlistPreview.reasonToWatch && localizeReason(watchlistPreview.reasonToWatch) && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Почему вам подойдёт</p>
                      <p className="mt-1 text-sm text-secondary-foreground leading-relaxed">{localizeReason(watchlistPreview.reasonToWatch)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {watchlistPreview.duration > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {watchlistPreview.duration} мин</span>}
                    {watchlistPreview.director && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {watchlistPreview.director}</span>}
                    {watchlistPreview.kpRating && watchlistPreview.kpRating > 0 && <span className="flex items-center gap-1 text-primary"><Star className="w-3.5 h-3.5 fill-primary" /> КП {watchlistPreview.kpRating}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {watchlistPreview.genre.map(g => (
                      <span key={g} className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md bg-secondary text-secondary-foreground">{g}</span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href={`https://yandex.ru/search/?text=${encodeURIComponent(watchlistPreview.titleRu + ' фильм ' + watchlistPreview.year)}`}
                    target="_blank" rel="noreferrer"
                    className="flex-1 py-3 rounded-xl border border-primary/40 text-primary text-sm font-medium text-center"
                  >
                    Яндекс
                  </a>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => setRatingMovie(watchlistPreview)}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                  >
                    Оценить
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {listModal && (
          <motion.div
            key="list-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm"
            onClick={() => setListModal(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 max-w-md mx-auto flex flex-col bg-card border border-border rounded-t-2xl overflow-hidden"
              style={{ top: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="safe-top flex items-center justify-between px-4 pb-3 border-b border-border shrink-0">
                <h3 className="font-display text-lg text-foreground">
                  {listModal === 'watchlist' ? `Буду смотреть (${customMovies.length})` : `Исключено (${dismissedMovies.length})`}
                </h3>
                <button onClick={() => { setListModal(null); setWatchlistSearch(''); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {listModal === 'watchlist' && (
                <div className="px-3 pt-2 pb-1 shrink-0">
                  <input
                    type="text"
                    value={watchlistSearch}
                    onChange={e => setWatchlistSearch(e.target.value)}
                    placeholder="Поиск по названию..."
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
              <div className="overflow-y-auto p-3 space-y-2 flex-1">
                {(listModal === 'watchlist'
                  ? customMovies.filter(m => !watchlistSearch || m.titleRu.toLowerCase().includes(watchlistSearch.toLowerCase()) || m.title.toLowerCase().includes(watchlistSearch.toLowerCase()))
                  : dismissedMovies
                ).map(movie => (
                  <div key={getMovieDedupKey(movie)} className={`flex items-center gap-3 bg-secondary/50 rounded-xl p-3 border transition-colors ${
                    listModal === 'watchlist' && watched.some(w => getMovieDedupKey(w) === getMovieDedupKey(movie))
                      ? 'border-primary/40 shadow-[0_0_8px_0px] shadow-primary/20'
                      : 'border-border'
                  }`}>
                    <div className="w-10 h-10 rounded-lg bg-cinema-surface flex items-center justify-center shrink-0">
                      <span className="text-lg">🎬</span>
                    </div>
                    <button
                      onClick={() => { setWatchlistPreview(movie); }}
                      style={{ touchAction: 'manipulation' }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors">{movie.titleRu}</p>
                      <p className="text-xs text-muted-foreground">
                        {movie.year > 0 ? `${movie.year} · ` : ''}{movie.type === 'series' ? 'Сериал' : movie.type === 'miniseries' ? 'Минисериал' : 'Фильм'}
                      </p>
                    </button>
                    {listModal === 'watchlist' && (
                      <button
                        onClick={() => { setRatingMovie(movie); }}
                        style={{ touchAction: 'manipulation' }}
                        className="text-muted-foreground hover:text-primary transition-colors p-1 shrink-0"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void (listModal === 'watchlist' ? handleRemoveFromWatchlist(movie) : handleRemoveFromDismissed(movie))}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(listModal === 'watchlist'
                  ? customMovies.filter(m => !watchlistSearch || m.titleRu.toLowerCase().includes(watchlistSearch.toLowerCase()) || m.title.toLowerCase().includes(watchlistSearch.toLowerCase()))
                  : dismissedMovies).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {listModal === 'watchlist' && watchlistSearch ? 'Ничего не найдено' : 'Список пуст'}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AiAdvisor
        session={session}
        watchedMovies={watched}
        watchlistMovies={customMovies}
        dismissedMovies={dismissedMovies}
        filters={filters}
        onAddToWatchlist={movie => void handleAddToWatchlist(movie)}
        onRateMovie={movie => setRatingMovie(movie)}
        onDismissMovie={movie => void handleDismissMovie(movie)}
      />
    </div>
  );
};

export default Index;
