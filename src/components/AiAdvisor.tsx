import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Check, Clock, EyeOff, Loader2, Send, Sparkles, Star, Trash2, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { FilterState, Movie, WatchedMovie, MOOD_OPTIONS } from '@/lib/movieTypes';

const moodLabel = (m: string) => {
  const key = m.toLowerCase().trim();
  const opt = MOOD_OPTIONS.find(o => o.value.toLowerCase() === key || o.label.toLowerCase() === key);
  return opt ? opt.label : m;
};
import { buildFilterSummary, buildTasteProfileSummary, toMovieContext } from '@/lib/tasteProfile';
import { loadChatMessages, saveChatMessage, StoredChatMessage } from '@/lib/chatStore';
import { getMovieDedupKey } from '@/lib/movieIdentity';

type AdvisorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions: Movie[];
  createdAt?: string;
};

interface AiAdvisorProps {
  session: Session | null;
  watchedMovies: WatchedMovie[];
  watchlistMovies: Movie[];
  dismissedMovies: Movie[];
  filters: FilterState;
  onAddToWatchlist: (movie: Movie) => void;
  onRateMovie: (movie: Movie) => void;
  onDismissMovie: (movie: Movie) => void;
}

interface ChatResponse {
  message?: string;
  suggestions?: Movie[];
  error?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const MAX_MOVIES_IN_CONTEXT = 30;

type Provider = 'claude' | 'gpt4o' | 'gemini' | 'deepseek';

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'claude',   label: 'Claude' },
  { id: 'gpt4o',    label: 'GPT'    },
  { id: 'gemini',   label: 'Gemini' },
  { id: 'deepseek', label: 'DS'     },
];

const ProviderIcon = ({ id }: { id: Provider }) => {
  switch (id) {
    case 'claude':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
            stroke="#E8784D" strokeWidth="2.2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="2.5" fill="#E8784D"/>
        </svg>
      );
    case 'gpt4o':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#10A37F">
          <path d="M20.7 8.5a5.5 5.5 0 00-3.9-3.3A5.5 5.5 0 0012 2a5.5 5.5 0 00-4.8 2.8 5.5 5.5 0 00-3.9 3.3A5.5 5.5 0 004 12a5.5 5.5 0 00.7 3.5 5.5 5.5 0 003.9 3.3A5.5 5.5 0 0012 22a5.5 5.5 0 004.8-2.8 5.5 5.5 0 003.9-3.3A5.5 5.5 0 0020 12a5.5 5.5 0 00-.3-3.5zm-8.7 9a3.7 3.7 0 01-2-.6l5.9-3.4v2a3.7 3.7 0 01-3.9 2zm-6.5-3.4a3.7 3.7 0 01-.4-2.5l5.9 3.4-3 1.7a3.7 3.7 0 01-2.5-2.6zM4.7 8.6a3.7 3.7 0 012-.9v6.8l-3-1.7a3.7 3.7 0 011-5.2zm13.5 6.8l-5.9-3.4 3-1.7 2.9 1.7v2a3.7 3.7 0 010 1.4zm.4-4.5L12.7 7.5l3-1.7a3.7 3.7 0 012.4 3.2l.5-.1zm-9.9-4.5l2-1.1a3.7 3.7 0 012 .6L7.4 9.5l-3-1.7a3.7 3.7 0 013.3-1.4z"/>
        </svg>
      );
    case 'gemini':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#4285F4">
          <path d="M12 2C10.5 6.5 6.5 10.5 2 12c4.5 1.5 8.5 5.5 10 10 1.5-4.5 5.5-8.5 10-10-4.5-1.5-8.5-5.5-10-10z"/>
        </svg>
      );
    case 'deepseek':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#4D6AFF">
          <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm0 2c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7z"/>
          <path d="M8 12c0 .6.1 1.2.3 1.7L12 8l3.7 5.7c.2-.5.3-1.1.3-1.7 0-2.2-1.8-4-4-4s-4 1.8-4 4z"/>
        </svg>
      );
  }
};

async function getAccessToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token) return sessionData.session.access_token;
  throw new Error('Требуется авторизация. Пожалуйста, войдите в аккаунт.');
}

function normalizeSuggestions(movies: Movie[] | undefined): Movie[] {
  return (movies ?? []).map((movie, index) => ({
    ...movie,
    id: movie.id || `chat:${crypto.randomUUID()}:${index}`,
    title: movie.title || movie.titleRu || 'Без названия',
    titleRu: movie.titleRu || movie.title || 'Без названия',
    genre: movie.genre ?? [],
    mood: movie.mood ?? [],
    timeOfDay: movie.timeOfDay ?? ['evening'],
    format: movie.format ?? 'medium',
    forCompany: movie.forCompany ?? 'any',
    description: movie.description ?? '',
    director: movie.director ?? '',
    duration: Number(movie.duration ?? 0),
    year: Number(movie.year ?? 0),
    source: 'ai-chat',
  }));
}

function fromStoredMessage(message: StoredChatMessage): AdvisorMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    suggestions: normalizeSuggestions(message.suggestions),
    createdAt: message.createdAt,
  };
}

export const AiAdvisor = ({
  session,
  watchedMovies,
  watchlistMovies,
  dismissedMovies,
  filters,
  onAddToWatchlist,
  onRateMovie,
  onDismissMovie,
}: AiAdvisorProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [provider, setProvider] = useState<Provider>(() => {
    const saved = localStorage.getItem('kino-ai-provider');
    // Дефолт держим на живом провайдере: Anthropic-организация закрыта, и чат
    // на чистом браузере падал бы с «ANTHROPIC_API_KEY не настроен». Claude
    // остаётся в списке — выбор сохраняется и заработает, если доступ вернётся.
    return (PROVIDERS.some(p => p.id === saved) ? saved : 'gpt4o') as Provider;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSetProvider = (p: Provider) => {
    setProvider(p);
    localStorage.setItem('kino-ai-provider', p);
  };

  const cloudHistoryEnabled = Boolean(session && !session.user.is_anonymous);

  const clearChat = async () => {
    setMessages([]);
    if (cloudHistoryEnabled) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase.from('chat_messages').delete().eq('user_id', userData.user.id);
        }
      } catch (e) {
        console.error('Не удалось очистить чат:', e);
      }
    }
  };

  const watchedKeys = useMemo(
    () => new Set(watchedMovies.map(movie => getMovieDedupKey(movie))),
    [watchedMovies]
  );
  const watchlistKeys = useMemo(
    () => new Set(watchlistMovies.map(movie => getMovieDedupKey(movie))),
    [watchlistMovies]
  );
  const dismissedKeys = useMemo(
    () => new Set(dismissedMovies.map(movie => getMovieDedupKey(movie))),
    [dismissedMovies]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    setHistoryLoaded(false);
    if (!cloudHistoryEnabled) setMessages([]);
  }, [cloudHistoryEnabled, session?.user.id]);

  useEffect(() => {
    if (!open || !cloudHistoryEnabled || historyLoaded) return;
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const storedMessages = await loadChatMessages();
        if (cancelled) return;
        setMessages(storedMessages.map(fromStoredMessage));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
      } finally {
        if (!cancelled) { setHistoryLoading(false); setHistoryLoaded(true); }
      }
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [open, cloudHistoryEnabled, historyLoaded]);

  const persistMessage = async (message: AdvisorMessage) => {
    if (!cloudHistoryEnabled) return;
    await saveChatMessage(message.role, message.content, message.suggestions);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: AdvisorMessage = {
      id: `local-user:${crypto.randomUUID()}`,
      role: 'user',
      content: text,
      suggestions: [],
    };
    const nextConversation = [...messages, userMessage];
    setMessages(nextConversation);
    setInput('');
    setLoading(true);

    try {
      const accessToken = await getAccessToken();
      await persistMessage(userMessage).catch(e => console.error('Не удалось сохранить сообщение пользователя:', e));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider,
          messages: nextConversation.map(m => ({ role: m.role, content: m.content })),
          filters: buildFilterSummary(filters),
          tasteProfile: buildTasteProfileSummary(watchedMovies, watchlistMovies),
          watchedMovies: watchedMovies.slice(0, MAX_MOVIES_IN_CONTEXT).map(toMovieContext),
          watchlistMovies: watchlistMovies.slice(0, MAX_MOVIES_IN_CONTEXT).map(toMovieContext),
          dismissedMovies: dismissedMovies.slice(0, MAX_MOVIES_IN_CONTEXT).map(toMovieContext),
        }),
      });

      const payload = await resp.json().catch(() => ({ error: 'Ошибка сервера' } as ChatResponse));
      if (!resp.ok) throw new Error(payload.error || 'Ошибка чата');

      const assistantMessage: AdvisorMessage = {
        id: `local-assistant:${crypto.randomUUID()}`,
        role: 'assistant',
        content: payload.message?.trim() || 'Не удалось получить ответ.',
        suggestions: normalizeSuggestions(payload.suggestions),
      };
      setMessages(prev => [...prev, assistantMessage]);
      await persistMessage(assistantMessage).catch(e => console.error('Не удалось сохранить сообщение ассистента:', e));
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `local-error:${crypto.randomUUID()}`,
        role: 'assistant',
        content: `❌ ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        suggestions: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg cinema-glow flex items-center justify-center"
      >
        <Bot className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto flex flex-col bg-card border border-border rounded-t-2xl shadow-2xl overflow-hidden" style={{ top: 'calc(var(--header-h, 72px))' }}
          >
            {/* Header */}
            <div className="border-b border-border bg-secondary/50 shrink-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-display text-lg text-foreground">Кино AI</span>
                </div>
                <div className="flex items-center gap-3">
                  {messages.length > 0 && (
                    <button
                      onClick={() => void clearChat()}
                      className="text-destructive hover:text-destructive/70 transition-colors"
                      title="Очистить чат"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Provider tabs */}
              <div className="px-3 pb-2.5">
                <div className="flex bg-secondary rounded-xl p-1">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSetProvider(p.id)}
                      className={`flex flex-1 items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        provider === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      <ProviderIcon id={p.id} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {historyLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}

              {!historyLoading && messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-primary/40" />
                  <p>Спроси, что посмотреть.</p>
                  <p className="text-xs mt-1">Я отвечаю только про фильмы, сериалы и похожий видеоконтент.</p>
                </div>
              )}

              {messages.map(message => (
                <div key={message.id} className={`space-y-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary text-foreground rounded-bl-md'
                    }`}>
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>

                  {message.role === 'assistant' && message.suggestions.length > 0 && (
                    <div className="space-y-3">
                      {message.suggestions.map(movie => {
                        const key = getMovieDedupKey(movie);
                        const inWatched = watchedKeys.has(key);
                        const inWatchlist = watchlistKeys.has(key);
                        const inDismissed = dismissedKeys.has(key);

                        return (
                          <div key={key} className="bg-card border border-border rounded-2xl overflow-hidden cinema-glow">
                            <div className="p-4 space-y-2.5">
                              <div>
                                <h3 className="font-display text-xl text-foreground leading-tight">{movie.titleRu}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {movie.title}
                                  {movie.year > 0 ? ` · ${movie.year}` : ''}
                                  {' · '}{movie.type === 'series' ? 'Сериал' : movie.type === 'miniseries' ? 'Минисериал' : 'Фильм'}
                                </p>
                              </div>

                              {movie.description && (
                                <p className="text-sm text-secondary-foreground leading-relaxed line-clamp-3">{movie.description}</p>
                              )}

                              {movie.reasonToWatch && (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Почему вам подойдёт</p>
                                  <p className="mt-1 text-xs text-secondary-foreground leading-relaxed">{movie.reasonToWatch}</p>
                                </div>
                              )}

                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                {movie.duration > 0 && (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {movie.duration} мин</span>
                                )}
                                {movie.director && (
                                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {movie.director}</span>
                                )}
                                {movie.kpRating && movie.kpRating > 0 && (
                                  <span className="flex items-center gap-1 text-primary"><Star className="w-3 h-3 fill-primary" /> КП {movie.kpRating}</span>
                                )}
                              </div>

                              {(movie.genre.length > 0 || movie.mood.length > 0) && (
                                <div className="flex flex-wrap gap-1">
                                  {movie.genre.map(g => (
                                    <span key={g} className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md bg-secondary text-secondary-foreground">{g}</span>
                                  ))}
                                  {movie.mood.map(m => (
                                    <span key={m} className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md bg-primary/10 text-primary">{moodLabel(m)}</span>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-3 pt-1">
                                <a
                                  href={`https://yandex.ru/search/?text=${encodeURIComponent((movie.kpQuery || movie.titleRu) + ' фильм ' + (movie.year || ''))}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-3 rounded-xl border border-border text-muted-foreground text-sm font-medium"
                                >Яндекс</a>
                                <button
                                  onClick={() => onAddToWatchlist(movie)}
                                  disabled={inWatchlist}
                                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                                    inWatchlist
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'border-border text-foreground bg-transparent hover:bg-secondary'
                                  }`}
                                >
                                  <Star className={`w-4 h-4 ${inWatchlist ? 'fill-primary-foreground' : ''}`} />
                                  Смотрю!
                                </button>
                                <button
                                  onClick={() => onRateMovie(movie)}
                                  className={`px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-center transition-colors ${
                                    inWatched
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-border text-foreground bg-transparent hover:bg-secondary'
                                  }`}
                                >
                                  <Star className={`w-4 h-4 ${inWatched ? 'fill-primary-foreground' : ''}`} />
                                </button>
                                <button
                                  onClick={() => onDismissMovie(movie)}
                                  disabled={inDismissed}
                                  className={`px-4 py-3 rounded-xl border text-sm flex items-center justify-center transition-colors ${
                                    inDismissed
                                      ? 'border-destructive/30 bg-destructive/10 text-destructive cursor-default'
                                      : 'border-border text-muted-foreground bg-transparent hover:bg-secondary'
                                  }`}
                                >
                                  <EyeOff className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-secondary/30 shrink-0">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
                  }}
                  placeholder="Например: короткие серии на несколько дней"
                  className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
