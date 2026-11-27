# The Great Expedition — February–March 2027

An interactive expedition atlas and collective decision tool for four friends choosing a 10–15-day
expedition. Twenty researched expedition concepts sit on a 3D globe; each opens a three-slide
presentation (The Experience · The Journey · The Practical Reality), is scored with five identical
questions, and feeds blind, security- and budget-aware group results.

```
GitHub repository ──► GitHub Actions ──► GitHub Pages (static React app)
                                              │  POST text/plain JSON (no CORS preflight)
                                              ▼
                               Google Apps Script web app (auth, validation, locking, blind voting)
                                              │
                                              ▼
                       Existing Google spreadsheet: Responses · Results · History tabs
```

No other hosting, database, auth provider, form service, analytics or paid API is used.

## Quick start

```bash
npm install          # Node ≥ 22
npm run dev          # http://localhost:5173 — demo mode until an Apps Script URL is configured
```

**Demo mode.** With no backend URL configured, the site runs the *real* Apps Script source in the
browser (`backend/emulator`, data kept in `localStorage`) behind a permanent "Demo mode" banner.
Fictitious demo access codes are shown on the sign-in screen. Nothing is sent to Google.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run preview` | Development server / serve the production build |
| `npm run build` | Validate data → typecheck → static production build in `dist/` |
| `npm run validate [-- D07]` | Schema + semantic validation of destination data (CI blocks deployment on errors) |
| `npm test` | Unit tests (budget, statistics, validation) and backend tests (real `.gs` code in the emulator) |
| `npm run test:e2e` | Playwright end-to-end tests against the production build in demo mode |
| `npm run images -- D07` | Resolve, licence-check, download and optimise Wikimedia Commons photographs |
| `npm run credits` | Regenerate the image attribution and source registers |
| `npm run backend:registry` | Regenerate `backend/apps-script/Destinations.gs` from the data |
| `npm run backend:bundle` | Build the single paste-ready `backend/dist/ExpeditionBackend.gs` |
| `npm run codes` | Generate four high-entropy access codes + the hashed `PARTICIPANT_CREDENTIALS` value |

## Repository structure

```
AGENTS.md                    shared specification, ownership, methodologies (start here)
data/destinations/D01-…json  20 destination records (schema: src/types/destination.ts)
data/images/                 Commons manifests + resolved credits; photos in public/images/destinations/
data/questionnaire.json      the five questions (single definition)
data/configuration.json      public configuration (appsScriptUrl, budgets, participant names)
src/                         React + TypeScript app (globe, presentation, comparison, voting, results)
src/lib/budget.ts            budget methodology      src/lib/statistics.ts   ranking & consensus
backend/apps-script/         Google Apps Script backend (source of truth for the deployed script)
backend/emulator/            in-browser/Node emulator used for demo mode and backend tests
scripts/                     validation, images, credits, registry, access codes, screenshots
tests/                       unit/, backend/, e2e/
docs/                        research/, verification/, methodology/, deployment/, architecture/, image-credits/
reports/                     research completeness, QA and final delivery reports
private/  (git-ignored)      private novelty data — never committed
```

## Deployment

1. **Backend** — follow [`docs/deployment/apps-script.md`](docs/deployment/apps-script.md): paste the
   bundled script into the spreadsheet's Apps Script editor, run setup from the *Expedition admin*
   menu, set Script Properties (access-code hashes from `npm run codes`, `NOVELTY_DATA` from
   `private/NOVELTY_DATA.script-property.txt`), deploy as a web app (*Execute as: Me*, *Who has
   access: Anyone*) and copy the `/exec` URL.
2. **Frontend configuration** — put the `/exec` URL in `data/configuration.json → appsScriptUrl`
   (or the repository variable `VITE_APPS_SCRIPT_URL`). It is a public endpoint, not a secret.
3. **GitHub Pages** — Settings › Pages › Source: *GitHub Actions*. Every push to `main` runs
   `.github/workflows/deploy.yml` (validate → tests → build → deploy). Failed tests block deployment.
   The site works under the repository sub-path (relative asset paths + hash routing:
   `#/explore/D07`, `#/my-evaluations`, `#/group-results`).
4. **Spreadsheet privacy** — set the sheet's General access to *Restricted*. The web app runs as its
   owner and does not need link sharing.

Backend changes require *Manage deployments › Edit › New version* in Apps Script (same URL).
Evaluations stay in the spreadsheet across frontend deployments.

## Security and privacy model

- The website, its JavaScript, JSON data and photos are **public by design** (GitHub Pages). They
  contain no access codes, secrets, evaluations, comments or travel histories.
- Each participant has an individual high-entropy access code; only salted hashes live in Apps
  Script Script Properties. Sessions are HMAC-signed, expire (7 days by default) and are revoked on
  sign-out or code rotation. Identity is always taken from the verified session.
- Blind voting is enforced server-side: other participants' scores and comments are not sent to a
  browser until all four have evaluated that destination (configurable reveal policy).
- Writes run under a script lock with request-id idempotency; revisions replace the active row and
  are archived in History; user text is protected against spreadsheet formula injection.
- Collective novelty uses private travel histories and is served only to signed-in participants.

## Methodology

- Budget: [`docs/methodology/budget.md`](docs/methodology/budget.md) — flights always included; realistic scenario is the headline; contingency computed, never double counted; unknown ≠ 0.
- Security: [`docs/methodology/security.md`](docs/methodology/security.md) — route-specific official advice; eligible / conditional / excluded.
- Decisions: individual score = mean of five answers; collective score = mean of four individual
  scores; ranking excludes non-eligible security, > €2,500, material budget uncertainty and incomplete
  evaluations, then sorts by collective score → lowest individual score → mean enthusiasm → id.

## Status and limitations

See [`reports/final-delivery.md`](reports/final-delivery.md) for what was built, tested and verified,
and what still requires manual configuration. All prices are planning estimates or representative
fares unless labelled as observed quotations; all security assessments must be rechecked before
booking and shortly before departure.

Photographs: Wikimedia Commons contributors under the licences listed in
[`docs/image-credits/README.md`](docs/image-credits/README.md). Globe texture: NASA Blue Marble
(public domain, via three-globe). Borders: Natural Earth (public domain). Satellite tiles (optional,
loaded on demand): Sentinel-2 cloudless by EOX IT Services GmbH.
