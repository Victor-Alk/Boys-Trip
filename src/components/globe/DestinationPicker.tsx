import { useId, useMemo, useRef, useState } from 'react';
import type { DestinationSummary } from '../../types/summary';
import { SecurityGlyph } from '../ui/Badges';

/** Searchable destination selector (combobox). Always available — doubles as the WebGL fallback. */
export function DestinationPicker({ destinations, selectedId, onSelect }: { destinations: DestinationSummary[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return destinations.filter((d) => {
      const hay = `${d.id} ${d.country} ${d.region} ${d.title}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q, destinations]);
  const selected = destinations.find((d) => d.id === selectedId);

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-sm">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Find a destination
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined}
        className="w-full rounded-sm border border-white/15 bg-midnight-950/75 px-3 py-2 text-sm text-ivory placeholder:text-ivory/45 backdrop-blur-sm focus:border-sand-400 focus:outline-none"
        placeholder={selected ? `${selected.country} — search another destination…` : 'Search 20 expeditions…'}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            choose(results[active].id);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="panel-scroll absolute inset-x-0 top-full mt-1 max-h-[55vh] overflow-y-auto rounded-sm border border-white/15 bg-midnight-900/97 py-1 shadow-2xl backdrop-blur">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-ivory/60">No destination matches “{q}”.</li>}
          {results.map((d, i) => (
            <li
              key={d.id}
              id={`${listId}-${d.id}`}
              role="option"
              aria-selected={d.id === selectedId}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(d.id);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? 'bg-white/10' : ''}`}
            >
              <span className="num w-6 text-xs text-sand-400">{d.id.slice(1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ivory">
                  {d.country} <span className="font-normal text-ivory/55">— {d.region}</span>
                </span>
                <span className="block truncate text-xs text-ivory/55">{d.title.split('—').pop()?.trim()}</span>
              </span>
              <SecurityGlyph status={d.securityStatus} className={d.securityStatus === 'eligible' ? 'text-emerald-300' : d.securityStatus === 'conditional' ? 'text-amber-300' : 'text-red-300'} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
