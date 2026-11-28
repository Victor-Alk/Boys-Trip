# Final delivery report — The Great Expedition 2027

Date: 2026-11-27 (updated 2026-11-28) · Live site: https://victor-alk.github.io/Boys-Trip/ · Repository: https://github.com/Victor-Alk/Boys-Trip (public)

## Project status

| Item | Status |
|---|---|
| Destinations / principal slides | 20 / 60 (one reusable 3-slide component) |
| Licensed photographs | 179 (Wikimedia Commons; register in `docs/image-credits/README.md`) |
| Sources | 371 (register in `docs/research/source-register.md`) |
| Security (after verification) | 14 eligible · 3 conditional (Jordan, Algeria, Egypt) · 3 excluded (Iraq, Saudi Arabia, Ethiopia) |
| Budget (realistic, flights incl.) | 8 ≤ €2,000 · 10 at €2,001–2,500 · 2 > €2,500 (Saudi Arabia, Chile) |
| Rankable today | 11 (eligible, ≤ €2,500, no material budget uncertainty) |
| Website build | Passing (local and GitHub Actions) |
| Backend | Deployed as an Apps Script web app on the existing spreadsheet; **real sign-in and evaluation verified on the live site (2026-11-28)** |
| Deployment | GitHub Pages live via `.github/workflows/deploy.yml`, connected to the backend through the repository variable `VITE_APPS_SCRIPT_URL` (no longer in demo mode) |

## Agent execution report (agents actually spawned)

| Agent | Work | Outputs | Open issues |
|---|---|---|---|
| A00 (orchestrator) | Spec, schema, budget/statistics libraries, validator, image pipeline, frontend (globe, slides, table, voting, results), integration, deployment | `AGENTS.md`, `src/**`, `scripts/**`, workflows, README | Mobile slide-scroll fix incomplete (see below) |
| A01–A20 (one per destination) | Research, itinerary, budget, security, images, sources | `data/destinations/*`, `docs/research/*`, `data/images/*` | Many advisory pages unreadable (US 403, Smartraveller timeouts); prices are estimates |
| A21 (verification) | Re-checked all security calls with FCDO, France Diplomatie text, Netherlands, US data feed; budgets; seasonality; sources; images; portfolio review | `docs/verification/*`, `docs/research/portfolio-review.md`, `reports/research-completeness.md` | Smartraveller never reachable |
| A23 (backend) | Apps Script backend, emulator, API client, access-code script, registry | `backend/**`, `src/lib/api.ts`, `docs/deployment`, `docs/architecture/cross-origin.md` | Real Google deployment untested |
| Backend bundle session | Single paste-ready file + step-by-step guide | `backend/dist/*`, `docs/deployment/apps-script.md` | — |
| A24 (independent QA) | Red-team review, 80-route render sweep, blind-voting leak checks, mobile, WebGL, sub-path, screenshots | `reports/quality-assurance.md`, `docs/qa/screenshots/`, `tests/e2e/qa-*` | See QA section |

A22 (frontend) responsibilities were carried out by the orchestrator, not a separate agent.

## Technical report

Architecture: GitHub → GitHub Actions → GitHub Pages (React 19 + Vite 8 + TypeScript + Tailwind 4, react-globe.gl, MapLibre GL 6, Recharts, zod) → Google Apps Script web app (text/plain JSON POST, signed sessions, LockService, idempotency) → Google Sheets (Responses / Results / History).
Commands: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run validate`. Deployment and configuration: `README.md`, `docs/deployment/apps-script.md`.

## Quality assurance

- Unit + backend tests: **176 passed** (`npm test`); data validation 20/20; typecheck clean.
- E2E (Playwright, demo mode against the production build): core voting flow (save, revise, blind until 4/4, reveal) passes; A24's sweep rendered all 20 destinations × 3 slides + evaluation with 0 errors and 359 image loads; blind-voting leak checks pass under 8 reveal-policy combinations.
- Fixed after QA: float-safe tie-breaking (frontend + backend), registry drift test now always runs, demo-mode wording, skip-link routing, itinerary-map WebGL fallback, CI runs tests on `main`, participant switch no longer shows the previous person's answers.
- **Remaining:** on phones, "Next →" can leave the reader below the top of the next slide (A24-QA-06); the WebGL-fallback e2e test needs a narrower locator; revisions remain allowed after scores are revealed (by design — the brief allows revisions).
- Live integration (2026-11-28): anonymous `health`/`config` calls follow Google's redirect and return JSON with `Access-Control-Allow-Origin: *`; a cross-origin request from the live site reads the backend configuration; the user signed in with a real access code and saved an evaluation that the backend stored.
- Not tested: Safari/iOS, a full four-person session on the live site (blind reveal and ranking were verified in the emulator and e2e tests, not yet with real votes).

## Travel research highlights

Rankable now: Tunisia €1,457 · Laos €1,632 · Vietnam €1,775 · Senegal €1,822 · Sri Lanka €1,930 · India NE €1,934 · Yunnan €2,018 · South Africa €2,044 · Mexico (Oaxaca) €2,058 · Taiwan €2,307 · Japan €2,438 (within €100 of the cap). Philippines and Guatemala are eligible but carry material budget uncertainty; Chile exceeds €2,500. All security assessments must be rechecked before booking and before departure. Replacement ideas (not applied): Uzbekistan, Nepal, Cape Verde, Northern Argentina — `docs/research/portfolio-review.md`.

## User configuration checklist

Done: backend pasted and set up, access codes generated, web app deployed with access *Anyone*, site connected via `VITE_APPS_SCRIPT_URL`, first real evaluation saved. Remaining items below.

1. **Spreadsheet → Share → General access → Restricted** — confirm this is set: the spreadsheet ID is public in this repository.
2. ~~Paste the backend and run setup~~ — done (guide: `docs/deployment/apps-script.md`; re-paste `backend/dist/ExpeditionBackend.gs` after backend changes).
3. ~~Generate access codes~~ — done. Give each friend only their own code, privately.
4. Confirm the `NOVELTY_DATA` Script Property is set (from `private/NOVELTY_DATA.script-property.txt`); otherwise the Novelty column shows “Not available”.
5. ~~Deploy as web app and connect the site~~ — done: the `/exec` URL is set as the repository variable `VITE_APPS_SCRIPT_URL` (Settings › Secrets and variables › Actions › Variables); changing it requires re-running the deploy workflow.
6. ~~Test one real evaluation~~ — done. If `SHEET_NAMESPACE` is still set in Script Properties, delete it so votes go to the real `Responses` tab.
7. Decide departure airports and replace the CDG reference fares with real quotes.
