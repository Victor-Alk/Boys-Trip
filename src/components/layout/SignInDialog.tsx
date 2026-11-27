import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, DEMO_ACCESS_CODES } from '../../lib/api';
import { configuration } from '../../lib/data';
import type { ParticipantId } from '../../lib/statistics';
import { useSession } from '../../state/session';

export function SignInDialog() {
  const { signInOpen, closeSignIn, signIn, selectedParticipant, setSelectedParticipant, mode } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (signInOpen && !d.open) {
      d.showModal();
      setError(null);
      setCode('');
      setTimeout(() => (selectedParticipant ? codeRef.current?.focus() : undefined), 30);
    } else if (!signInOpen && d.open) d.close();
  }, [signInOpen, selectedParticipant]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedParticipant) {
      setError('Choose who is evaluating first.');
      return;
    }
    if (!code.trim()) {
      setError('Enter your personal access code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(selectedParticipant, code);
      setCode('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === 'INVALID_CREDENTIALS'
            ? 'That access code is not valid for this participant.'
            : err.code === 'RATE_LIMITED'
              ? 'Too many attempts. Wait 15 minutes and try again.'
              : err.message
          : 'Sign-in failed. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={closeSignIn}
      onCancel={closeSignIn}
      className="m-auto w-[min(92vw,30rem)] rounded-sm border border-slate-ink/15 bg-paper p-0 text-slate-ink shadow-2xl backdrop:bg-midnight-950/70"
      aria-labelledby="signin-title"
    >
      <form onSubmit={onSubmit} className="p-6">
        <p className="eyebrow text-bronze-600">Private evaluation</p>
        <h2 id="signin-title" className="mt-1 text-2xl font-semibold">
          Who is evaluating this expedition?
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Participant">
          {configuration.participants.map((p) => {
            const active = selectedParticipant === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelectedParticipant(p.id as ParticipantId);
                  setTimeout(() => codeRef.current?.focus(), 0);
                }}
                className={`flex items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors ${
                  active ? 'border-midnight-900 bg-midnight-900 text-ivory' : 'border-slate-ink/20 hover:border-slate-ink/50'
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full font-display text-base font-semibold ${active ? 'bg-sand-500 text-midnight-900' : 'bg-sand-200'}`}>
                  {p.name.charAt(0)}
                </span>
                <span className="font-medium">{p.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">Choosing a name is not enough — your personal access code proves it is you.</p>

        <label className="mt-5 block text-sm font-medium" htmlFor="access-code">
          Personal access code
        </label>
        <input
          ref={codeRef}
          id="access-code"
          type="password"
          autoComplete="current-password"
          spellCheck={false}
          className="input mt-1 font-mono tracking-wider"
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {mode === 'demo' && selectedParticipant && (
          <p className="mt-2 rounded-sm border border-amber-warn/30 bg-amber-bg px-2 py-1.5 text-xs text-amber-warn">
            Demo mode — fictitious code for {configuration.participants.find((p) => p.id === selectedParticipant)?.name}:{' '}
            <button type="button" className="font-mono font-semibold underline" onClick={() => setCode(DEMO_ACCESS_CODES[selectedParticipant])}>
              {DEMO_ACCESS_CODES[selectedParticipant]}
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-warn">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={closeSignIn}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </div>
        <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-500">
          Your code is checked by the group’s Google Apps Script backend and is never stored in this browser. A signed session
          (valid for up to 7 days on this device) is kept instead; “Sign out” ends your sessions everywhere.
        </p>
      </form>
    </dialog>
  );
}
