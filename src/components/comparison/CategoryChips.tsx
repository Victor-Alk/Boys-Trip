import { TRIP_CATEGORIES } from '../../lib/categories';

interface Props {
  selected: string[];
  mode: 'any' | 'all';
  onChange: (selected: string[], mode: 'any' | 'all') => void;
  dark?: boolean;
  matching?: number;
}

/** "What kind of trip?" — multi-select trip categories; matching destinations stay lit on the globe and in the table. */
export function CategoryChips({ selected, mode, onChange, dark = false, matching }: Props) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id], mode);
  return (
    <div className={dark ? 'text-ivory' : ''} role="group" aria-label="Trip categories">
      <div className="flex items-center gap-2">
        <span className={`eyebrow text-[0.6rem] ${dark ? 'text-sand-400' : 'text-bronze-600'}`}>What kind of trip?</span>
        {selected.length > 1 && (
          <span className="flex overflow-hidden rounded-sm border text-[0.65rem] font-semibold" style={{ borderColor: dark ? 'rgb(244 238 226 / 0.25)' : 'rgb(38 48 58 / 0.2)' }}>
            {(['any', 'all'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => onChange(selected, m)}
                className={`px-1.5 py-0.5 ${mode === m ? (dark ? 'bg-ivory text-midnight-900' : 'bg-midnight-900 text-ivory') : dark ? 'text-ivory/70' : 'text-slate-600'}`}
              >
                {m === 'any' ? 'Any' : 'All'}
              </button>
            ))}
          </span>
        )}
        {selected.length > 0 && (
          <>
            {typeof matching === 'number' && <span className={`num text-[0.65rem] ${dark ? 'text-ivory/60' : 'text-slate-500'}`}>{matching} match</span>}
            <button type="button" className={`text-[0.65rem] underline ${dark ? 'text-ivory/70' : 'text-bronze-700'}`} onClick={() => onChange([], mode)}>
              Clear
            </button>
          </>
        )}
      </div>
      <ul className={`mt-1.5 flex gap-1.5 overflow-x-auto pb-1 ${dark ? 'max-w-[min(100%,40rem)] [scrollbar-width:none]' : 'sm:flex-wrap sm:overflow-visible'}`} data-noswipe>
        {TRIP_CATEGORIES.map((c) => {
          const on = selected.includes(c.id);
          return (
            <li key={c.id} className="flex-none">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  on
                    ? dark
                      ? 'border-sand-400 bg-sand-400 text-midnight-900'
                      : 'border-midnight-900 bg-midnight-900 text-ivory'
                    : dark
                      ? 'border-ivory/25 bg-midnight-950/60 text-ivory/85 backdrop-blur-sm hover:border-ivory/60'
                      : 'border-slate-ink/20 bg-white/60 text-slate-ink hover:border-slate-ink/50'
                }`}
              >
                <span aria-hidden className="mr-1">
                  {c.icon}
                </span>
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
