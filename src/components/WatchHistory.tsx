import { useState } from 'react';
import { motion } from 'framer-motion';
import { WatchedMovie } from '@/lib/movieTypes';
import { getMovieDedupKey } from '@/lib/movieIdentity';
import { Star, Clock } from 'lucide-react';

interface WatchHistoryProps {
  watched: WatchedMovie[];
  onReRate: (movie: WatchedMovie) => void;
  rewatchKeys?: Set<string>;
}

export const WatchHistory = ({ watched, onReRate, rewatchKeys }: WatchHistoryProps) => {
  const [query, setQuery] = useState('');

  if (watched.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Пока нет просмотренных фильмов</p>
        <p className="text-xs mt-1">Получите рекомендацию и оцените!</p>
      </div>
    );
  }

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? watched.filter(m =>
        m.titleRu.toLowerCase().includes(trimmed) ||
        m.title.toLowerCase().includes(trimmed)
      )
    : watched;

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Поиск по названию..."
        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Ничего не найдено</p>
      ) : (
        filtered.map((movie, i) => (
          <motion.div
            key={movie.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.15) }}
            onClick={() => onReRate(movie)}
            style={{ touchAction: 'manipulation' }}
            className={`flex items-center gap-3 bg-secondary/50 rounded-xl p-3 border cursor-pointer transition-colors ${
              rewatchKeys?.has(getMovieDedupKey(movie))
                ? 'border-primary/40 shadow-[0_0_8px_0px] shadow-primary/20'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-cinema-surface flex items-center justify-center shrink-0">
              <span className="text-lg">🎬</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{movie.titleRu}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 fill-primary text-primary" /> {movie.rating}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> {movie.duration}м
                </span>
              </div>
            </div>
            {movie.notes && (
              <p className="text-[10px] text-muted-foreground max-w-[80px] truncate">{movie.notes}</p>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};
