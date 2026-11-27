# Final delivery report — The Great Expedition 2027

Date: 2026-11-27 · Live site: https://victor-alk.github.io/Boys-Trip/ · Repository: https://github.com/Victor-Alk/Boys-Trip (public)

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
| Backend | Implemented and tested in the emulator; **not yet deployed to Google** |
| Deployment | GitHub Pages live via `.github/workflows/deploy.yml` (demo mode until the Apps Script URL is configured) |

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
- Not tested: the real Apps Script deployment and Google redirect/CORS behaviour, Safari/iOS, a real multi-user session on the live site.

## Travel research highlights

Rankable now: Tunisia €1,457 · Laos €1,632 · Vietnam €1,775 · Senegal €1,822 · Sri Lanka €1,930 · India NE €1,934 · Yunnan €2,018 · South Africa €2,044 · Mexico (Oaxaca) €2,058 · Taiwan €2,307 · Japan €2,438 (within €100 of the cap). Philippines and Guatemala are eligible but carry material budget uncertainty; Chile exceeds €2,500. All security assessments must be rechecked before booking and before departure. Replacement ideas (not applied): Uzbekistan, Nepal, Cape Verde, Northern Argentina — `docs/research/portfolio-review.md`.

## User configuration checklist

1. **Spreadsheet → Share → General access → Restricted** (it is currently editable by anyone with the link, and its ID is public in this repository).
2. Paste `backend/dist/ExpeditionBackend.gs` + `appsscript.json` into Extensions › Apps Script; run setup from the *Expedition admin* menu (guide: `docs/deployment/apps-script.md`).
3. `npm run codes` → paste `PARTICIPANT_CREDENTIALS` into Script Properties; give each friend their own code.
4. Paste `private/NOVELTY_DATA.script-property.txt` into the `NOVELTY_DATA` Script Property.
5. Deploy as web app (Execute as: Me · Who has access: Anyone) and send the `/exec` URL; it goes into `data/configuration.json → appsScriptUrl` and a push switches the site out of demo mode.
6. Test one real evaluation with `SHEET_NAMESPACE=TEST_`, then remove that property.
7. Decide departure airports and replace the CDG reference fares with real quotes.
