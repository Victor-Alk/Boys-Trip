/**
 * Authentication state. Selecting a name is NOT authentication: private actions need the
 * participant's access code, verified server-side, which returns a signed session token.
 * Only the session token (with its expiry) is kept in localStorage — never the access code.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, createApiClient, createDemoClient, type ApiClient, type Session } from '../lib/api';
import { APPS_SCRIPT_URL } from '../lib/data';
import type { ParticipantId } from '../lib/statistics';

const SESSION_KEY = 'ge-session-v1';
const SELECTED_KEY = 'ge-selected-participant';

interface SessionState {
  client: ApiClient;
  mode: 'live' | 'demo';
  session: Session | null;
  selectedParticipant: ParticipantId | null;
  setSelectedParticipant: (p: ParticipantId | null) => void;
  signIn: (p: ParticipantId, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Called by data hooks when the server reports an expired/invalid session. */
  invalidate: (reason?: string) => void;
  notice: string | null;
  clearNotice: () => void;
  signInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
}

const Ctx = createContext<SessionState | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.expiresAt || Date.parse(s.expiresAt) <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useMemo<ApiClient>(() => (APPS_SCRIPT_URL ? createApiClient({ url: APPS_SCRIPT_URL }) : createDemoClient()), []);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [selectedParticipant, setSelected] = useState<ParticipantId | null>(
    () => (localStorage.getItem(SELECTED_KEY) as ParticipantId | null) ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  const setSelectedParticipant = useCallback((p: ParticipantId | null) => {
    setSelected(p);
    if (p) localStorage.setItem(SELECTED_KEY, p);
    else localStorage.removeItem(SELECTED_KEY);
  }, []);

  const invalidate = useCallback((reason?: string) => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setNotice(reason ?? 'Your session has expired. Please sign in again — your unsent answers are kept on this device.');
  }, []);

  // Expire the session client-side at its expiry time.
  useEffect(() => {
    if (!session) return;
    const ms = Date.parse(session.expiresAt) - Date.now();
    if (ms <= 0) {
      invalidate();
      return;
    }
    const t = window.setTimeout(() => invalidate(), Math.min(ms, 2 ** 31 - 1));
    return () => window.clearTimeout(t);
  }, [session, invalidate]);

  const signIn = useCallback(
    async (p: ParticipantId, code: string) => {
      const s = await client.login(p, code.trim());
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      setSession(s);
      setSelectedParticipant(s.participant.id);
      setNotice(null);
      setSignInOpen(false);
    },
    [client, setSelectedParticipant],
  );

  const signOut = useCallback(async () => {
    const token = session?.token;
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    if (token) {
      try {
        await client.logout(token);
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
      }
    }
  }, [client, session]);

  const value: SessionState = {
    client,
    mode: client.mode,
    session,
    selectedParticipant,
    setSelectedParticipant,
    signIn,
    signOut,
    invalidate,
    notice,
    clearNotice: () => setNotice(null),
    signInOpen,
    openSignIn: () => setSignInOpen(true),
    closeSignIn: () => setSignInOpen(false),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
