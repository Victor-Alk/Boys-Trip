import { lazy, Suspense, useEffect } from 'react';
import { useRoute } from './lib/router';
import { Header } from './components/layout/Header';
import { SignInDialog } from './components/layout/SignInDialog';
import { ExplorePage } from './pages/Explore';
import { useSession } from './state/session';
import { summaries } from './lib/data';

const MyEvaluationsPage = lazy(() => import('./pages/MyEvaluations'));
const GroupResultsPage = lazy(() => import('./pages/GroupResults'));

export function App() {
  const route = useRoute();
  const { mode, notice, clearNotice, openSignIn } = useSession();

  useEffect(() => {
    const s = summaries.find((x) => x.id === route.destinationId);
    document.title = s && route.page === 'explore' ? `${s.country} — The Great Expedition 2027` : route.page === 'my-evaluations' ? 'My evaluations — The Great Expedition 2027' : route.page === 'group-results' ? 'Group results — The Great Expedition 2027' : 'The Great Expedition — February–March 2027';
  }, [route.page, route.destinationId]);

  return (
    <>
      <a
        href="#main-content"
        onClick={(e) => {
          // Hash routing: following "#main-content" would navigate away; move focus instead.
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-ivory focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      {mode === 'demo' && (
        <div role="status" className="border-b border-amber-warn/30 bg-amber-bg px-4 py-1.5 text-center text-xs text-amber-warn">
          <strong>Demo mode</strong> — no Apps Script backend is configured, so evaluations are stored only in this browser and nothing is saved to Google Sheets.
        </div>
      )}
      {notice && (
        <div role="alert" className="flex items-center justify-center gap-3 border-b border-amber-warn/30 bg-amber-bg px-4 py-2 text-sm text-slate-ink">
          <span>{notice}</span>
          <button type="button" className="btn-primary py-1 text-xs" onClick={() => { clearNotice(); openSignIn(); }}>
            Sign in
          </button>
          <button type="button" className="text-xs underline" onClick={clearNotice}>
            Dismiss
          </button>
        </div>
      )}
      <div id="main-content" tabIndex={-1} className="outline-none">
        {route.page === 'explore' && <ExplorePage />}
        <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Loading…</p>}>
          {route.page === 'my-evaluations' && <MyEvaluationsPage />}
          {route.page === 'group-results' && <GroupResultsPage />}
        </Suspense>
      </div>
      <SignInDialog />
    </>
  );
}
