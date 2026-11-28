# Final delivery report — The Great Expedition 2027

Date: 2026-11-27 (updated 2026-11-28) · Live site: https://victor-alk.github.io/Boys-Trip/ · Repository: https://github.com/Victor-Alk/Boys-Trip (public)

## Project status

| Item | Status |
|---|---|
| Destinations / slides | 57 / 171: the 20 principal destinations (D01–D20) plus 37 later additions requested by the group (D21–D57), all rendered by one reusable 3-slide component |
| Licensed photographs | 711 (Wikimedia Commons; 11–16 per destination, each with a descriptive caption; register in `docs/image-credits/README.md`) |
| Sources | 1,046 (register in `docs/research/source-register.md`) |
| Security | 33 eligible · 17 conditional · 7 excluded (Iraq, Saudi Arabia, Ethiopia, Pakistan, Lebanon & Syria, Mali, Venezuela). Later additions were assessed by their research agents with the same method; only D01–D20 had A21's second verification pass |
| Budget (realistic, flights incl.) | 16 ≤ €2,000 · 25 at €2,001–2,500 · 16 > €2,500 |
| Rankable today | 19 (eligible, ≤ €2,500, no material budget uncertainty) |
| Website build | Passing (local and GitHub Actions) |
| Backend | Deployed as an Apps Script web app on the existing spreadsheet; real sign-in and evaluation verified on the live site (2026-11-28). **The live deployment predates D21–D57 and the proposals feature: votes on D21–D57 and proposals fail until `backend/dist/ExpeditionBackend.gs` is re-pasted (checklist below)** |
| Deployment | GitHub Pages live via `.github/workflows/deploy.yml`, connected to the backend through the repository variable `VITE_APPS_SCRIPT_URL` (no longer in demo mode) |

## Agent execution report (agents actually spawned)

| Agent | Work | Outputs | Open issues |
|---|---|---|---|
| A00 (orchestrator) | Spec, schema, budget/statistics libraries, validator, image pipeline, frontend (globe, slides, table, voting, results, trip categories, photo galleries, proposals, phone-friendly globe and route map), integration, deployment | `AGENTS.md`, `src/**`, `scripts/**`, workflows, README | — |
| A01–A20 (one per destination) | Research, itinerary, budget, security, images, sources | `data/destinations/*`, `docs/research/*`, `data/images/*` | Many advisory pages unreadable (US 403, Smartraveller timeouts); prices are estimates |
| A21 (verification) | Re-checked all security calls with FCDO, France Diplomatie text, Netherlands, US data feed; budgets; seasonality; sources; images; portfolio review | `docs/verification/*`, `docs/research/portfolio-review.md`, `reports/research-completeness.md` | Smartraveller never reachable |
| A23 (backend) | Apps Script backend, emulator, API client, access-code script, registry | `backend/**`, `src/lib/api.ts`, `docs/deployment`, `docs/architecture/cross-origin.md` | Real Google deployment untested |
| Backend bundle session | Single paste-ready file + step-by-step guide | `backend/dist/*`, `docs/deployment/apps-script.md` | — |
| Later-addition research agents (one per destination, D21–D57) | Same brief and schema as A01–A20; participant-requested destinations | `data/destinations/D21…D57`, `docs/research/*`, `data/images/*` | Same source gaps as A01–A20; no second verification pass |
| Photo-enrichment agents | Brought every principal destination to 12–16 photos with 1–2-sentence captions tied to the itinerary | `data/images/manifests/*`, destination image references | Most new photos matched to places by their Commons descriptions, not viewed |
| A24 (independent QA) | Red-team review, 80-route render sweep, blind-voting leak checks, mobile, WebGL, sub-path, screenshots | `reports/quality-assurance.md`, `docs/qa/screenshots/`, `tests/e2e/qa-*` | See QA section |

A22 (frontend) responsibilities were carried out by the orchestrator, not a separate agent.

## Technical report

Architecture: GitHub → GitHub Actions → GitHub Pages (React 19 + Vite 8 + TypeScript + Tailwind 4, react-globe.gl, MapLibre GL 6, Recharts, zod) → Google Apps Script web app (text/plain JSON POST, signed sessions, LockService, idempotency) → Google Sheets (Responses / Results / History).
Commands: `npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run validate`. Deployment and configuration: `README.md`, `docs/deployment/apps-script.md`.

## Quality assurance

- Unit + backend tests: **235 passed** (`npm test`); data validation 57/57; typecheck clean.
- E2E (Playwright, demo mode against the production build): core voting flow (save, revise, blind until 4/4, reveal) passes; A24's sweep renders every destination × 3 slides + evaluation (it now counts the destinations on disk instead of assuming 20) and passes in CI; blind-voting leak checks pass under 8 reveal-policy combinations.
- Fixed after QA: float-safe tie-breaking (frontend + backend), registry drift test now always runs, demo-mode wording, skip-link routing, itinerary-map WebGL fallback, CI runs tests on `main`, participant switch no longer shows the previous person's answers.
- Fixed later: the phone "Next →" scroll (A24-QA-06); e2e tests that assumed exactly 20 destinations or unique country names (now compared by id); phones get a marker preview card, a full-screen globe and route map, and a folding legend (checked at 375 px in the in-app browser; the globe animation itself was not watched because the browser pane was hidden).
- **Remaining:** revisions remain allowed after scores are revealed (by design — the brief allows revisions).
- Live integration (2026-11-28): anonymous `health`/`config` calls follow Google's redirect and return JSON with `Access-Control-Allow-Origin: *`; a cross-origin request from the live site reads the backend configuration; the user signed in with a real access code and saved an evaluation that the backend stored.
- Not tested: Safari/iOS, a full four-person session on the live site (blind reveal and ranking were verified in the emulator and e2e tests, not yet with real votes).

## Travel research highlights

Rankable now (19): Morocco €1,322 · Tunisia €1,457 · Spain €1,619 · Laos €1,632 · Vietnam €1,775 · Senegal €1,822 · Balkans €1,917 · Sri Lanka €1,930 · India NE €1,934 · Central Asia €1,993 · Yunnan €2,018 · South Africa (Cape) €2,044 · Mexico (Oaxaca) €2,058 · Taiwan €2,307 · Kazakhstan €2,310 · Northeast China €2,320 · South Africa (Northeast) €2,382 · Argentina (Northwest) €2,434 · Japan (Kyushu) €2,438.
Eligible but carrying material budget uncertainty: Philippines, Guatemala, Brazil, Peru. Eligible but above €2,500: Atacama, USA, Canada, Baja, Norway, Patagonia (Argentina), Hokkaido, Iceland, Namibia, Patagonia (Chile).
China (Yunnan, Northeast, West, Tibet) and Mongolia depend on French visa-free entry being extended beyond 31 Dec 2026. All security assessments must be rechecked before booking and before departure.

## User configuration checklist

Done: backend pasted and set up, access codes generated, web app deployed with access *Anyone*, site connected via `VITE_APPS_SCRIPT_URL`, first real evaluation saved. Remaining items below.

1. **Spreadsheet → Share → General access → Restricted** — confirm this is set: the spreadsheet ID is public in this repository.
2. ~~Paste the backend and run setup~~ — done (guide: `docs/deployment/apps-script.md`; re-paste `backend/dist/ExpeditionBackend.gs` after backend changes).
3. ~~Generate access codes~~ — done. Give each friend only their own code, privately.
4. **Re-paste `backend/dist/ExpeditionBackend.gs`** (it registers all 57 destinations and adds proposals), then Deploy › Manage deployments › edit › New version. Optionally add the `ADMIN_KEY_HASH` Script Property (`npm run admin-key` prints it) so proposals can be read and new destinations registered without another paste.
5. Update the `NOVELTY_DATA` Script Property: `npm run prompts -- novelty` once `ADMIN_KEY_HASH` is set, or paste `private/NOVELTY_DATA.script-property.txt` by hand (57 entries).
6. ~~Deploy as web app and connect the site~~ — done: the `/exec` URL is set as the repository variable `VITE_APPS_SCRIPT_URL` (Settings › Secrets and variables › Actions › Variables); changing it requires re-running the deploy workflow.
7. ~~Test one real evaluation~~ — done. If `SHEET_NAMESPACE` is still set in Script Properties, delete it so votes go to the real `Responses` tab.
8. Decide departure airports and replace the CDG reference fares with real quotes.
