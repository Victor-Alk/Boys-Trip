import { useRoute, navigate, type Page } from '../../lib/router';
import { useSession } from '../../state/session';
import { useEvaluations } from '../../state/evaluations';
import { formatEUR, PREFERRED_MAX_EUR, EXCEPTIONAL_MAX_EUR } from '../../lib/budget';
import { summaries } from '../../lib/data';

const NAV: { page: Page; label: string }[] = [
  { page: 'explore', label: 'Explore' },
  { page: 'my-evaluations', label: 'My evaluations' },
  { page: 'group-results', label: 'Group results' },
];

export function Header() {
  const route = useRoute();
  const { session, openSignIn, signOut, mode } = useSession();
  const { responses } = useEvaluations();
  const done = responses.size;
  const total = summaries.length || 20;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-midnight-900 text-ivory">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 lg:h-13 lg:flex-nowrap lg:py-0 lg:px-6">
        <a href="#/explore" className="group flex items-baseline gap-3" aria-label="The Great Expedition — home">
          <span className="whitespace-nowrap font-display text-lg font-semibold tracking-[0.12em] sm:text-xl">THE GREAT EXPEDITION</span>
          <span className="eyebrow hidden whitespace-nowrap text-sand-400 sm:inline">February — March 2027</span>
        </a>

        <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {NAV.map((n) => {
            const active = route.page === n.page;
            return (
              <button
                key={n.page}
                type="button"
                onClick={() => navigate({ page: n.page, destinationId: n.page === 'explore' ? route.destinationId : null })}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-ivory text-midnight-900' : 'text-ivory/75 hover:bg-white/8 hover:text-ivory'
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4 whitespace-nowrap text-xs">
          <div className="hidden items-center gap-3 whitespace-nowrap 2xl:flex" aria-label="Budget references">
            <span className="text-ivory/60">
              Preferred <span className="num font-semibold text-ivory">{formatEUR(PREFERRED_MAX_EUR)}</span>
            </span>
            <span className="text-ivory/60">
              Exceptional max <span className="num font-semibold text-sand-400">{formatEUR(EXCEPTIONAL_MAX_EUR)}</span>
            </span>
            <span className="hidden text-ivory/40 min-[1700px]:inline">per person, flights incl.</span>
          </div>

          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end sm:flex" title="Your saved evaluations">
                <span className="num text-ivory/80">
                  <span className="font-semibold text-ivory">{done}</span>/{total} evaluated
                </span>
                <span className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full bg-sand-500" style={{ width: `${(done / total) * 100}%` }} />
                </span>
              </div>
              <span className="flex items-center gap-2 rounded-sm border border-white/15 px-2 py-1">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-sand-500 font-display text-sm font-semibold text-midnight-900">
                  {session.participant.name.charAt(0)}
                </span>
                <span className="font-medium">{session.participant.name}</span>
              </span>
              <button type="button" className="text-ivory/60 underline-offset-2 hover:text-ivory hover:underline" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="btn-ghost-dark py-1.5" onClick={openSignIn}>
              Sign in to evaluate
            </button>
          )}
          {mode === 'demo' && <span className="chip border-amber-300/50 text-amber-200">Demo</span>}
        </div>
      </div>
    </header>
  );
}
