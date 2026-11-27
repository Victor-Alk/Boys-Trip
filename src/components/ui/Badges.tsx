import type { SecurityStatus } from '../../types/destination';
import { BUDGET_STATUS_LABEL, budgetTier, type BudgetStatus } from '../../lib/budget';
import { SECURITY_DESCRIPTION, SECURITY_LABEL } from '../../lib/labels';
import type { NoveltyEntry } from '../../lib/api';

/** Security status: colour + shape + text (never colour alone). */
export function SecurityBadge({ status, size = 'sm', dark = false }: { status: SecurityStatus; size?: 'sm' | 'md'; dark?: boolean }) {
  const cls =
    status === 'eligible'
      ? dark ? 'border-emerald-300/50 text-emerald-200' : 'border-green-ok/40 bg-green-bg text-green-ok'
      : status === 'conditional'
        ? dark ? 'border-amber-300/60 text-amber-200' : 'border-amber-warn/40 bg-amber-bg text-amber-warn'
        : dark ? 'border-red-300/60 text-red-200' : 'border-red-warn/40 bg-red-bg text-red-warn';
  return (
    <span className={`chip ${cls} ${size === 'md' ? 'px-2 py-1 text-xs' : ''}`} title={SECURITY_DESCRIPTION[status]}>
      <SecurityGlyph status={status} />
      {SECURITY_LABEL[status]}
    </span>
  );
}

export function SecurityGlyph({ status, className = '' }: { status: SecurityStatus; className?: string }) {
  if (status === 'eligible')
    return (
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} aria-hidden>
        <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.18" />
        <path d="M3.2 6.2l1.8 1.8 3.8-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  if (status === 'conditional')
    return (
      <svg viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} aria-hidden>
        <path d="M6 1l5 5-5 5-5-5z" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1" />
        <path d="M6 3.6v3M6 8.2v.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 12 12" className={`h-3 w-3 ${className}`} aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="currentColor" opacity="0.18" />
      <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function BudgetBadge({ status, dark = false }: { status: BudgetStatus; dark?: boolean }) {
  const tier = budgetTier(status);
  const cls =
    tier === 'preferred'
      ? dark ? 'border-sand-400/50 text-sand-200' : 'border-forest-700/30 bg-forest-100 text-forest-800'
      : tier === 'exceptional'
        ? dark ? 'border-amber-300/60 text-amber-200' : 'border-amber-warn/40 bg-amber-bg text-amber-warn'
        : dark ? 'border-red-300/60 text-red-200' : 'border-red-warn/40 bg-red-bg text-red-warn';
  const mark = tier === 'preferred' ? '€' : tier === 'exceptional' ? '€+' : '€!';
  return (
    <span className={`chip ${cls}`}>
      <span className="font-bold" aria-hidden>
        {mark}
      </span>
      {BUDGET_STATUS_LABEL[status]}
    </span>
  );
}

export function NoveltyBadge({ entry, signedIn, compact = false }: { entry: NoveltyEntry | undefined; signedIn: boolean; compact?: boolean }) {
  if (!signedIn) return <span className="text-xs text-slate-500" title="Novelty uses private travel histories — sign in to see it">Sign in to see</span>;
  if (!entry) return <span className="text-xs text-slate-500">Not available</span>;
  const newCount = 4 - entry.visitedCount;
  if (entry.newToAll)
    return (
      <span className="chip border-bronze-600/40 bg-sand-100 text-bronze-700" title="New to all four, based on provided travel histories.">
        ✦ {compact ? '4/4 new' : 'New to all four'}
      </span>
    );
  return (
    <span className="chip border-slate-500/30 bg-white/60 text-slate-600" title={entry.note || undefined}>
      {newCount}/4 new
    </span>
  );
}
