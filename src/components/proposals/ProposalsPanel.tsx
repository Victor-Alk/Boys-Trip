import { useCallback, useEffect, useState } from 'react';
import { ApiError, newRequestId, type PromptRecord } from '../../lib/api';
import { useSession } from '../../state/session';
import { navigate } from '../../lib/router';
import { summaryById } from '../../lib/data';

const MIN = 10;
const MAX = 1500;

const STATUS: Record<PromptRecord['status'], { label: string; cls: string }> = {
  new: { label: 'Waiting to be researched', cls: 'border-slate-ink/20 bg-white/70 text-slate-600' },
  processing: { label: 'Being researched', cls: 'border-amber-warn/40 bg-amber-bg text-amber-warn' },
  done: { label: 'Added', cls: 'border-green-ok/40 bg-green-bg text-green-ok' },
  declined: { label: 'Not added', cls: 'border-red-warn/40 bg-red-bg text-red-warn' },
};

/**
 * "Propose a destination": participants describe an expedition in their own words. Each proposal is stored in
 * the Prompts tab of the group spreadsheet and researched into a full three-slide presentation, once.
 */
export function ProposalsPanel() {
  const { client, session, openSignIn, invalidate } = useSession();
  const [text, setText] = useState('');
  const [list, setList] = useState<PromptRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [requestId, setRequestId] = useState(newRequestId);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setList(await client.prompts(session.token));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'SESSION_EXPIRED' || e.code === 'UNAUTHENTICATED')) invalidate();
      else setList([]);
    }
  }, [client, session, invalidate]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!session) return openSignIn();
    const prompt = text.trim();
    if (prompt.length < MIN) return setMessage({ tone: 'error', text: `Describe it in at least ${MIN} characters.` });
    setBusy(true);
    setMessage(null);
    try {
      await client.submitPrompt(session.token, prompt, requestId);
      setText('');
      setRequestId(newRequestId());
      setMessage({ tone: 'ok', text: 'Sent. It will be researched into a full three-slide presentation and appear on the globe; its status shows below.' });
      await load();
    } catch (e) {
      // Keep the text and the same requestId so a retry can never create a duplicate.
      setMessage({ tone: 'error', text: e instanceof ApiError ? e.message : 'Could not send the proposal. Check your connection and retry.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="propose" className="rounded-sm border border-slate-ink/12 bg-paper p-5" aria-labelledby="propose-title">
      <p className="eyebrow text-bronze-600">Missing a destination?</p>
      <h2 id="propose-title" className="mt-1 text-2xl font-semibold">
        Propose an expedition
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Describe where you would like to go and why, in your own words. It will be researched with the same method as the other destinations (security, budget with flights, February vs March, itinerary, photos) and added as a new
        presentation everyone can evaluate. Proposals are visible to the whole group.
      </p>
      {session ? (
        <div className="mt-4">
          <label htmlFor="proposal-text" className="sr-only">
            Your proposal
          </label>
          <textarea
            id="proposal-text"
            className="input min-h-28"
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Kyrgyzstan in March: yurt camps, horse trekking around Song-Kul lake and Silk Road towns, within €2,000 each."
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-bronze" onClick={() => void submit()} disabled={busy || text.trim().length < MIN}>
              {busy ? 'Sending…' : 'Send proposal'}
            </button>
            <span className="num text-xs text-slate-500">
              {text.length}/{MAX}
            </span>
            {message && (
              <span role={message.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${message.tone === 'ok' ? 'text-green-ok' : 'text-red-warn'}`}>
                {message.text}
              </span>
            )}
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary mt-4" onClick={openSignIn}>
          Sign in to propose a destination
        </button>
      )}

      {session && list && list.length > 0 && (
        <ul className="mt-6 divide-y divide-slate-ink/8 border-t border-slate-ink/10">
          {list.map((p) => {
            const added = p.status === 'done' && p.destinationId && summaryById.has(p.destinationId as never);
            return (
              <li key={p.promptId} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0 max-w-3xl">
                  <p className="leading-relaxed">“{p.prompt}”</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.participantName} · {new Date(p.createdAt).toLocaleDateString('en-GB')}
                    {p.note && ` · ${p.note}`}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className={`chip ${STATUS[p.status].cls}`}>
                    {STATUS[p.status].label}
                    {p.status === 'done' && p.destinationId ? ` as ${p.destinationId}` : ''}
                  </span>
                  {added && (
                    <button type="button" className="text-xs font-semibold text-bronze-700 hover:underline" onClick={() => navigate({ page: 'explore', destinationId: p.destinationId })}>
                      Open →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
