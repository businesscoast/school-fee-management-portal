import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Mock sign-in. There is no backend: any email plus a password of at least four
 * characters creates a session, kept in localStorage ("remember me") or sessionStorage.
 */
export const SESSION_KEY = 'school-fee-intelligence:session';
export const DEMO_EMAIL = 'anita.mehra@sunrisepublic.school';

export interface SessionUser {
  name: string;
  email: string;
  role: string;
  signedInAt: string; // ISO datetime
}

export function readSession(): SessionUser | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SessionUser;
      if (parsed && typeof parsed.email === 'string' && typeof parsed.name === 'string') return parsed;
    } catch {
      // ignore a corrupt entry and keep looking
    }
  }
  return null;
}

export function writeSession(user: SessionUser | null, remember: boolean): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (user) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // storage unavailable; the session still lives in memory for this page
  }
}

/** "rahul.kumar@school.edu" → "Rahul Kumar"; the demo principal keeps her name. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (local.toLowerCase() === 'anita.mehra' || local.toLowerCase() === 'principal') return 'Anita Mehra';
  const words = local
    .split(/[._\-+]+/)
    .filter((w) => w && !/^\d+$/.test(w))
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  return words.join(' ') || 'Principal';
}

export interface SignInInput {
  email: string;
  password: string;
  remember: boolean;
}

export interface AuthApi {
  user: SessionUser | null;
  /** Returns an error message, or null when the session was created. */
  signIn: (input: SignInInput) => string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => readSession());

  const signIn = useCallback((input: SignInInput): string | null => {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (input.password.length < 4) return 'The password must be at least 4 characters.';
    const next: SessionUser = { name: nameFromEmail(email), email, role: 'Principal', signedInAt: new Date().toISOString() };
    writeSession(next, input.remember);
    setUser(next);
    return null;
  }, []);

  const signOut = useCallback(() => {
    writeSession(null, false);
    setUser(null);
  }, []);

  const api = useMemo<AuthApi>(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Sends signed-out visitors to the login page and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}
