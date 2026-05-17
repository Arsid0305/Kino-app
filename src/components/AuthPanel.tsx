import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Cloud, LogOut, Mail } from 'lucide-react';

interface AuthPanelProps {
  session: Session | null;
  syncStatus: string;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, token: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthPanel = ({ session, syncStatus, onSendOtp, onVerifyOtp, onSignOut }: AuthPanelProps) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await onSendOtp(email.trim());
      setStep('code');
    } catch {
      // toast shown by caller
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (code.length < 6) return;
    setSubmitting(true);
    try {
      await onVerifyOtp(email.trim(), code.trim());
      setStep('email');
      setEmail('');
      setCode('');
    } catch {
      // toast shown by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-secondary/40 border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Cloud className="w-4 h-4 text-primary" />
          <span className="font-medium">
            {session ? 'Облачная синхронизация включена' : 'Войдите, чтобы синхронизировать базу'}
          </span>
        </div>
        {session && (
          <button
            onClick={onSignOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        )}
      </div>

      {session ? (
        <div className="space-y-1">
          <p className="text-sm text-secondary-foreground">{session.user.email ?? 'anonymous'}</p>
          <p className="text-xs text-muted-foreground">{syncStatus}</p>
        </div>
      ) : step === 'email' ? (
        <>
          <p className="text-xs text-muted-foreground">
            История оценок и watchlist будут храниться в Supabase и подтягиваться на любом устройстве после входа.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSend(); }}
                placeholder="you@example.com"
                type="email"
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={submitting || !email.trim()}
              className="px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {submitting ? '...' : 'Войти'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Пришлём код подтверждения на email.</p>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Введите 6-значный код из письма на <span className="text-foreground">{email}</span>
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') void handleVerify(); }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary tracking-widest text-center"
            />
            <button
              onClick={() => void handleVerify()}
              disabled={submitting || code.length < 6}
              className="px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {submitting ? '...' : 'OK'}
            </button>
          </div>
          <button
            onClick={() => { setStep('email'); setCode(''); }}
            className="text-[11px] text-muted-foreground underline"
          >
            Изменить email
          </button>
        </>
      )}
    </div>
  );
};
