import { useEffect, useMemo, useRef, useState } from 'react';
import type { Destination } from '../../types/destination';
import { questionnaire, summaries, participantName } from '../../lib/data';
import { individualScore, QUESTION_KEYS, type Answers, type QuestionKey } from '../../lib/statistics';
import { ApiError, type EvaluationRecord } from '../../lib/api';
import { useSession } from '../../state/session';
import { isCompleteAnswers, useEvaluations } from '../../state/evaluations';
import { navigate } from '../../lib/router';
import { ScaleQuestion } from './ScaleQuestion';
import { splitTitle } from '../presentation/SlideExperience';

export function EvaluationPanel({ destination: d, onBack }: { destination: Destination; onBack: () => void }) {
  const { session, openSignIn, mode } = useSession();
  const { responses, drafts, pending, sending, saveDraft, submit, ready, loadError } = useEvaluations();
  const existing = responses.get(d.id);
  const draft = drafts[d.id];
  const pend = pending[d.id];
  const [answers, setAnswers] = useState<Partial<Answers>>(() => draft?.answers ?? existing?.answers ?? {});
  const [comments, setComments] = useState(() => draft?.comments ?? existing?.comments ?? '');
  const [confirmation, setConfirmation] = useState<EvaluationRecord | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(pend?.lastError ? { message: pend.lastError, retryable: pend.retryable } : null);
  const [touched, setTouched] = useState(false);
  const initialised = useRef(false);

  // Once the server copy arrives (after sign-in), prefill if the user has not started editing.
  useEffect(() => {
    if (initialised.current || touched) return;
    const src = draft ?? existing;
    if (src) {
      setAnswers(src.answers);
      setComments(src.comments ?? '');
      initialised.current = true;
    }
  }, [draft, existing, touched]);

  // Autosave a local draft while editing (signed-in participants only — drafts are per person).
  useEffect(() => {
    if (!touched || !session) return;
    const t = window.setTimeout(() => saveDraft(d.id, { answers, comments }), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, comments, touched, session, d.id]);

  const answered = QUESTION_KEYS.filter((k) => typeof answers[k] === 'number').length;
  const complete = isCompleteAnswers(answers);
  const isSending = !!sending[d.id];
  const unchanged = !!existing && complete && QUESTION_KEYS.every((k) => existing.answers[k] === answers[k]) && (existing.comments ?? '') === comments;
  const { main } = splitTitle(d.title);

  const onSubmit = async () => {
    if (!complete) return;
    if (!session) {
      openSignIn();
      return;
    }
    setError(null);
    try {
      const res = await submit(d.id, answers, comments.slice(0, questionnaire.commentMaxLength), d.version);
      setConfirmation(res.response);
      setTouched(false);
    } catch (e) {
      setError({
        message: e instanceof ApiError ? friendlyError(e) : 'The evaluation could not be sent. Your answers are kept on this device.',
        retryable: e instanceof ApiError ? e.retryable || e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED' : true,
      });
    }
  };

  if (confirmation) return <Confirmation record={confirmation} destination={d} onEdit={() => setConfirmation(null)} />;

  let status: { label: string; tone: string };
  if (isSending) status = { label: 'Sending to the group spreadsheet…', tone: 'text-slate-600' };
  else if (pend) status = { label: 'Pending — not yet confirmed by the server', tone: 'text-amber-warn' };
  else if (touched || draft) status = { label: session ? 'Local draft — saved on this device only, not yet submitted' : 'Not saved — sign in to keep a draft and submit', tone: 'text-slate-600' };
  else if (existing) status = { label: `Saved in Google Sheets · revision ${existing.revisionNumber} · ${new Date(existing.updatedAt).toLocaleString('en-GB')}`, tone: 'text-green-ok' };
  else status = { label: 'Not started', tone: 'text-slate-500' };

  return (
    <article className="px-5 py-6 lg:px-8">
      <button type="button" onClick={onBack} className="text-xs font-semibold text-bronze-700 hover:underline">
        ← Back to the practical reality
      </button>
      <p className="eyebrow mt-4 text-bronze-600">Evaluate this expedition</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight">
        {d.country} — {main}
      </h1>

      <div className="mt-5 rounded-sm border border-slate-ink/12 bg-white/55 p-4">
        <p className="text-sm font-semibold">Who is evaluating this expedition?</p>
        {session ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-midnight-900 font-display text-sm font-semibold text-ivory">{session.participant.name.charAt(0)}</span>
            <span className="font-semibold">{session.participant.name}</span>
            <span className="text-slate-500">· signed in</span>
            <button type="button" className="ml-auto text-xs text-slate-500 underline" onClick={openSignIn}>
              Not you? Change participant
            </button>
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">Sign in with your personal access code to save an evaluation. You can start answering now.</span>
            <button type="button" className="btn-primary py-1.5" onClick={openSignIn}>
              Sign in
            </button>
          </div>
        )}
        {mode === 'demo' && <p className="mt-2 text-xs text-amber-warn">Demo mode: evaluations are stored only in this browser, not in Google Sheets.</p>}
        {session && !ready && !loadError && <p className="mt-2 text-xs text-slate-500">Loading your saved evaluations…</p>}
        {loadError && <p className="mt-2 text-xs text-red-warn">Could not load your saved evaluations: {loadError}</p>}
        {existing && !confirmation && (
          <p className="mt-2 text-xs text-slate-600">
            You already evaluated this expedition (revision {existing.revisionNumber}, {new Date(existing.updatedAt).toLocaleDateString('en-GB')}). Saving again replaces your active evaluation; the previous version is archived in the history, never counted twice.
          </p>
        )}
      </div>

      <div className="sticky top-0 z-10 -mx-5 mt-5 flex items-center gap-3 border-b border-slate-ink/10 bg-paper/95 px-5 py-2 backdrop-blur lg:-mx-8 lg:px-8">
        <span className="num text-xs font-semibold">{answered}/5 answered</span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-sand-200">
          <span className="block h-full bg-bronze-600 transition-[width]" style={{ width: `${(answered / 5) * 100}%` }} />
        </span>
        <span className={`text-xs ${status.tone}`} aria-live="polite">
          {status.label}
        </span>
      </div>

      <ol className="mt-4 space-y-6">
        {questionnaire.questions.map((q, i) => (
          <li key={q.id}>
            <ScaleQuestion
              index={i + 1}
              question={q}
              value={answers[q.id as QuestionKey]}
              onChange={(v) => {
                setTouched(true);
                setAnswers((a) => ({ ...a, [q.id]: v }));
              }}
            />
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <label htmlFor={`comments-${d.id}`} className="text-sm font-semibold">
          Additional comments <span className="font-normal text-slate-500">(optional — not a scored question)</span>
        </label>
        <textarea
          id={`comments-${d.id}`}
          className="input mt-1.5 min-h-28"
          maxLength={questionnaire.commentMaxLength}
          value={comments}
          placeholder="Reservations, enthusiasm, conditions, ideas…"
          onChange={(e) => {
            setTouched(true);
            setComments(e.target.value);
          }}
        />
        <p className="mt-1 flex justify-between text-[0.7rem] text-slate-500">
          <span>Visible to the other three only after all four have evaluated this destination (blind voting).</span>
          <span className="num">
            {comments.length}/{questionnaire.commentMaxLength}
          </span>
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-5 rounded-sm border-l-4 border-red-warn bg-red-bg/70 px-4 py-3 text-sm">
          <p className="font-semibold text-red-warn">Not saved.</p>
          <p className="mt-0.5">{error.message}</p>
          <p className="mt-1 text-xs text-slate-600">Your answers are kept on this device{error.retryable ? '; retrying is safe — it cannot create a duplicate.' : '.'}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-bronze px-6 py-3 text-base" disabled={!complete || isSending || (unchanged && !pend)} onClick={() => void onSubmit()}>
          {isSending ? 'Saving…' : !session ? 'Sign in to save my evaluation' : error?.retryable || pend ? 'Retry — save my evaluation' : 'Save my evaluation'}
        </button>
        {!complete && <span className="text-xs text-slate-500">Answer all five questions to save.</span>}
        {unchanged && !pend && <span className="text-xs text-slate-500">No changes since your saved evaluation.</span>}
      </div>
    </article>
  );
}

function friendlyError(e: ApiError): string {
  switch (e.code) {
    case 'NETWORK':
      return 'No connection to the backend. Check your internet connection and retry.';
    case 'TIMEOUT':
      return 'The backend took too long to answer. It may still have saved your evaluation — retrying is safe.';
    case 'SESSION_EXPIRED':
    case 'UNAUTHENTICATED':
      return 'Your session has expired. Sign in again, then retry.';
    case 'LOCK_TIMEOUT':
      return 'Another evaluation was being saved at the same moment. Retry in a few seconds.';
    case 'VALIDATION_FAILED':
      return `The server rejected the evaluation: ${e.message}`;
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a minute and retry.';
    default:
      return e.message || 'The backend reported an error.';
  }
}

function Confirmation({ record, destination: d, onEdit }: { record: EvaluationRecord; destination: Destination; onEdit: () => void }) {
  const { responses } = useEvaluations();
  const done = responses.size;
  const nextUnevaluated = useMemo(() => {
    const idx = summaries.findIndex((s) => s.id === d.id);
    for (let k = 1; k <= summaries.length; k++) {
      const s = summaries[(idx + k) % summaries.length];
      if (!responses.has(s.id)) return s;
    }
    return null;
  }, [responses, d.id]);
  return (
    <article className="px-5 py-10 lg:px-8" aria-live="polite">
      <p className="eyebrow text-green-ok">✓ Saved on the server</p>
      <h1 className="mt-2 text-3xl font-semibold">Evaluation recorded for {d.country}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Stored by the backend for {participantName(record.participantId)} at {new Date(record.updatedAt).toLocaleString('en-GB')} · revision {record.revisionNumber}.
      </p>
      <div className="mt-6 grid grid-cols-5 gap-2">
        {questionnaire.questions.map((q) => (
          <div key={q.id} className="rounded-sm border border-slate-ink/12 bg-white/60 p-3 text-center">
            <p className="num font-display text-3xl font-semibold">{record.answers[q.id as QuestionKey]}</p>
            <p className="mt-1 text-[0.65rem] leading-tight text-slate-500">{q.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm">
        Your overall average: <span className="num font-display text-2xl font-semibold">{individualScore(record.answers).toFixed(2)}</span> / 10
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Progress: <span className="num font-semibold text-slate-ink">{done}</span> of {summaries.length} destinations evaluated.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => navigate({ page: 'explore' })}>
          Back to the globe
        </button>
        {nextUnevaluated && (
          <button type="button" className="btn-bronze" onClick={() => navigate({ page: 'explore', destinationId: nextUnevaluated.id })}>
            Explore another destination: {nextUnevaluated.country} →
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onEdit}>
          Edit this evaluation
        </button>
      </div>
    </article>
  );
}
