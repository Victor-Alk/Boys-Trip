import { useRef } from 'react';
import type { Question } from '../../lib/data';

/** A 1–10 scale as a proper radio group: explicit choice required, no default, arrow-key navigation. */
export function ScaleQuestion({ index, question, value, onChange }: { index: number; question: Question; value: number | undefined; onChange: (v: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = `q-${question.id}-label`;
  const focusAt = (v: number) => refs.current[v - 1]?.focus();
  return (
    <fieldset>
      <legend id={labelId} className="text-[0.95rem] leading-snug">
        <span className="num mr-2 font-display text-lg font-semibold text-bronze-600">{index}</span>
        <span className="eyebrow mr-2 text-slate-500">{question.label}</span>
        <span className="mt-0.5 block font-medium">{question.text}</span>
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-3 grid grid-cols-10 gap-1"
        onKeyDown={(e) => {
          const cur = value ?? 0;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            const v = Math.min(10, cur + 1 || 1);
            onChange(v);
            focusAt(v);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            const v = Math.max(1, cur - 1 || 1);
            onChange(v);
            focusAt(v);
          }
        }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
          const selected = value === v;
          return (
            <button
              key={v}
              ref={(el) => {
                refs.current[v - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${v}${v === 1 ? ` — ${question.minLabel}` : v === 10 ? ` — ${question.maxLabel}` : ''}`}
              tabIndex={selected || (value === undefined && v === 1) ? 0 : -1}
              onClick={() => onChange(v)}
              className={`num h-10 rounded-sm border text-sm font-semibold transition-colors sm:h-11 ${
                selected
                  ? 'border-midnight-900 bg-midnight-900 text-ivory shadow-inner'
                  : 'border-slate-ink/18 bg-white/70 text-slate-ink hover:border-bronze-600 hover:bg-sand-100'
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-4 text-[0.7rem] leading-tight text-slate-500">
        <span>1 = {question.minLabel}</span>
        <span className="text-right">10 = {question.maxLabel}</span>
      </div>
    </fieldset>
  );
}
