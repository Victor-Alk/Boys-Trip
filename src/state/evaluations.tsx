/**
 * Evaluation state for the signed-in participant: server-confirmed responses, local drafts,
 * pending (unconfirmed) submissions, completion counts, permitted results and novelty.
 *
 * Three clearly separated states:
 *   draft    — answers kept only on this device (localStorage), never counted
 *   pending  — sent or waiting to be (re)sent; keeps its requestId so retries are idempotent
 *   saved    — the backend confirmed storage in Google Sheets (EvaluationRecord)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ApiError,
  newRequestId,
  type Completion,
  type EvaluationRecord,
  type NoveltyEntry,
  type ResultsPayload,
  type SubmitResult,
} from '../lib/api';
import { questionnaire } from '../lib/data';
import type { Answers, QuestionKey } from '../lib/statistics';
import { useSession } from './session';

export interface Draft {
  answers: Partial<Answers>;
  comments: string;
  updatedAt: string;
}
interface Pending {
  requestId: string;
  payloadKey: string;
  lastError: string | null;
  retryable: boolean;
  attemptedAt: string | null;
}

export type SubmitState = 'idle' | 'sending' | 'saved' | 'failed';

interface EvaluationsState {
  ready: boolean;
  loading: boolean;
  loadError: string | null;
  responses: Map<string, EvaluationRecord>;
  completion: Completion | null;
  results: ResultsPayload | null;
  novelty: Record<string, NoveltyEntry> | null;
  drafts: Record<string, Draft>;
  pending: Record<string, Pending>;
  sending: Record<string, boolean>;
  refresh: () => Promise<void>;
  saveDraft: (destinationId: string, draft: Omit<Draft, 'updatedAt'>) => void;
  discardDraft: (destinationId: string) => void;
  submit: (destinationId: string, answers: Answers, comments: string, destinationVersion: string) => Promise<SubmitResult>;
}

const Ctx = createContext<EvaluationsState | null>(null);

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function isCompleteAnswers(a: Partial<Answers>): a is Answers {
  return (questionnaire.questions.map((q) => q.id) as QuestionKey[]).every(
    (k) => Number.isInteger(a[k]) && (a[k] as number) >= 1 && (a[k] as number) <= 10,
  );
}

export function EvaluationsProvider({ children }: { children: ReactNode }) {
  const { client, session, invalidate } = useSession();
  const pid = session?.participant.id ?? null;
  const draftKey = pid ? `ge-drafts-v1:${pid}` : null;
  const pendingKey = pid ? `ge-pending-v1:${pid}` : null;

  const [responses, setResponses] = useState<Map<string, EvaluationRecord>>(new Map());
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [novelty, setNovelty] = useState<Record<string, NoveltyEntry> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = session?.token ?? null;

  // Load per-participant local state when the participant changes.
  useEffect(() => {
    setDrafts(draftKey ? load(draftKey, {}) : {});
    setPending(pendingKey ? load(pendingKey, {}) : {});
    setResponses(new Map());
    setCompletion(null);
    setResults(null);
    setNovelty(null);
    setReady(false);
  }, [draftKey, pendingKey]);

  const persistDrafts = useCallback(
    (next: Record<string, Draft>) => {
      setDrafts(next);
      if (draftKey) localStorage.setItem(draftKey, JSON.stringify(next));
    },
    [draftKey],
  );
  const persistPending = useCallback(
    (next: Record<string, Pending>) => {
      setPending(next);
      if (pendingKey) localStorage.setItem(pendingKey, JSON.stringify(next));
    },
    [pendingKey],
  );

  const handleError = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError) {
        if (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED') invalidate();
        return e.message;
      }
      return (e as Error)?.message ?? 'Unknown error';
    },
    [invalidate],
  );

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [mine, comp, res, nov] = await Promise.all([
        client.myResponses(token),
        client.completion(token),
        client.results(token),
        client.novelty(token).catch(() => ({}) as Record<string, NoveltyEntry>),
      ]);
      if (tokenRef.current !== token) return;
      setResponses(new Map(mine.map((r) => [r.destinationId, r])));
      setCompletion(comp);
      setResults(res);
      setNovelty(nov);
      setReady(true);
    } catch (e) {
      setLoadError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [client, handleError]);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  const saveDraft = useCallback(
    (destinationId: string, d: Omit<Draft, 'updatedAt'>) => {
      persistDrafts({ ...load<Record<string, Draft>>(draftKey ?? '', drafts), [destinationId]: { ...d, updatedAt: new Date().toISOString() } });
    },
    [draftKey, drafts, persistDrafts],
  );
  const discardDraft = useCallback(
    (destinationId: string) => {
      const next = { ...drafts };
      delete next[destinationId];
      persistDrafts(next);
    },
    [drafts, persistDrafts],
  );

  const submit = useCallback(
    async (destinationId: string, answers: Answers, comments: string, destinationVersion: string): Promise<SubmitResult> => {
      const token = tokenRef.current;
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Please sign in before saving your evaluation.', false);
      const payloadKey = JSON.stringify({ answers, comments, destinationVersion });
      const prior = pending[destinationId];
      // Reuse the requestId only when retrying the identical payload (idempotent retry).
      const requestId = prior && prior.payloadKey === payloadKey ? prior.requestId : newRequestId();
      const pendingNow = { ...pending, [destinationId]: { requestId, payloadKey, lastError: null, retryable: true, attemptedAt: new Date().toISOString() } };
      persistPending(pendingNow);
      setSending((s) => ({ ...s, [destinationId]: true }));
      try {
        const result = await client.submit(
          token,
          { destinationId, answers, comments, questionnaireVersion: questionnaire.version, destinationVersion },
          requestId,
        );
        const afterPending = { ...pendingNow };
        delete afterPending[destinationId];
        persistPending(afterPending);
        const nextDrafts = { ...drafts };
        delete nextDrafts[destinationId];
        persistDrafts(nextDrafts);
        setResponses((m) => new Map(m).set(destinationId, result.response));
        void refresh();
        return result;
      } catch (e) {
        const msg = handleError(e);
        const retryable = e instanceof ApiError ? e.retryable || e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED' : true;
        persistPending({ ...pendingNow, [destinationId]: { requestId, payloadKey, lastError: msg, retryable, attemptedAt: new Date().toISOString() } });
        // Keep the answers as a local draft so nothing is lost.
        persistDrafts({ ...drafts, [destinationId]: { answers, comments, updatedAt: new Date().toISOString() } });
        throw e;
      } finally {
        setSending((s) => ({ ...s, [destinationId]: false }));
      }
    },
    [client, drafts, pending, persistDrafts, persistPending, handleError, refresh],
  );

  const value = useMemo<EvaluationsState>(
    () => ({ ready, loading, loadError, responses, completion, results, novelty, drafts, pending, sending, refresh, saveDraft, discardDraft, submit }),
    [ready, loading, loadError, responses, completion, results, novelty, drafts, pending, sending, refresh, saveDraft, discardDraft, submit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEvaluations(): EvaluationsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEvaluations outside EvaluationsProvider');
  return v;
}
