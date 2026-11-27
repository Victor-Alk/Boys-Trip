# Quality assurance — independent red-team review (A24)

Date: 2026-11-27 · Reviewer: A24 (did not build any of the reviewed code) · Scope: AGENTS.md §11 definition of done,
voting/security, statistics, budget, presentation/UX, data spot checks, deployment.

Environment: macOS, Node 26.13 locally (CI pins Node 22), npm 11.20, Playwright 1.65.1 with headless Chromium
(WebGL through SwiftShader), production build served by `vite preview` on port 4174 in **demo mode** (the real
`backend/apps-script/*.gs` running in the browser emulator). The repository has no commit yet, so results refer to
the working tree at the times given. A21 was still editing `data/destinations/*.json` during the review; the
data-dependent checks were re-run at the end (§1.3).

**Verdict.** The voting core is solid: I could not get a single unrevealed score, partial aggregate or comment out of
any API action under any reveal policy, identity is always taken from the verified token, validation, idempotency,
revisions, lockout and session expiry behave as specified, and the 80-route presentation sweep is clean. The site is
**not ready to deploy as is**, mainly because the Apps Script destination registry is stale (the spreadsheet's
ranking would differ from the website's), the ranking tie-break is decided by floating-point noise, deploys are not
gated by the e2e suite, and the spreadsheet ID is public while the sheet is reportedly link-editable. Details and a
prioritised fix list below.

---

## 1. Tests executed

All counts below are from runs I executed; nothing is reported as passed that I did not run.

### 1.1 Commands and results

| # | Command | What it covers | Result |
|---|---|---|---|
| 1 | `npm test` (before my additions) | unit (budget, statistics, data) + backend (real `.gs` in the emulator) | 10 files, **163 passed** |
| 2 | `npx vitest run tests/backend` | backend only (doc claims 117) | 7 files, **117 passed** |
| 3 | `npm run validate` | schema + semantic validation of the 20 destinations | **20/20 OK** (warnings only) |
| 4 | `npm run typecheck` | `tsc --noEmit` incl. all tests | **pass** |
| 5 | `npx playwright test --project=desktop-chromium` (baseline, before my specs) | existing e2e (explore, voting) | **4 passed** |
| 6 | `npx vitest run tests/unit/qa-red-team.test.ts` | my unit red-team file (§5) | **11 passed, 2 skipped (FIXME)** |
| 7 | `QA_RUN_FIXME=1 npx vitest run tests/unit/qa-red-team.test.ts` | the two FIXME reproductions | **2 failed as expected** (A24-QA-01, A24-QA-02) |
| 8 | `npm test` (after my additions) | whole unit/backend suite | 11 files, **174 passed, 2 skipped** |
| 9 | `npx playwright test tests/e2e/qa-sweep.spec.ts` | 20 destinations × 3 slides + evaluation = **80 routes** | **passed** (0 page errors, 0 console errors, 0 same-origin HTTP failures, 0 broken photographs) |
| 10 | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-webgl-fallback.spec.ts` | Chromium with `--disable-webgl --disable-3d-apis` | 1 passed, **1 failed as expected** (A24-QA-05) |
| 11 | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-mobile.spec.ts` | 390 × 844, touch | 3 passed, **1 failed as expected** (A24-QA-06) |
| 12 | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-navigation.spec.ts` | markers, table, slides, keyboard, full screen, deep links | 3 passed, **1 failed as expected** (A24-QA-07) |
| 13 | `npx playwright test tests/e2e/qa-blind-voting.spec.ts` | blind voting in the browser under 5 policies, failure paths, session, lockout | **8 passed** |
| 14 | `npx playwright test tests/e2e/qa-subpath.spec.ts` | `dist/` served under `/BoysTrip/` | **passed** |
| 15 | `npx playwright test tests/e2e/qa-ranking.spec.ts` | 10/10 scores cannot lift ineligible destinations | **passed** |
| 16 | `QA_SCREENSHOTS=1 npx playwright test tests/e2e/qa-screenshots.spec.ts` | visual capture → `docs/qa/screenshots/` | 3 passed, 15 JPEGs (1.3 MB) |
| 17 | `npx playwright test --project=desktop-chromium` (final, fresh build, all specs) | everything above in one run | FINAL_E2E_RESULT |
| 18 | `npm ci --ignore-scripts` in a scratch copy of `package.json` + `package-lock.json` | lockfile installs cleanly | **pass** (191 packages); lockfile v3 contains the Linux x64 native packages CI needs (rolldown, lightningcss, tailwind oxide, esbuild, sharp) |
| 19 | grep of `dist/` (production build) | secrets / private data in the public bundle | see §2.1 |
| 20 | registry drift script (`build-backend-registry` logic vs `Destinations.gs`) | backend registry ≡ data | **material drift on 10 destinations at the end** (D07, D09, D13, D14–D20; version strings on all 20) (A24-QA-01) |
| 21 | 12 source URLs fetched | sources real, claims plausible | 12/12 reachable, 11 support, 1 partly (§2.5) |

### 1.2 What the new automated tests check (added by A24)

- `tests/e2e/qa-sweep.spec.ts` — visits all 80 routes by hash navigation; on each: right view, exactly 3 principal
  slides + Evaluate, every photograph decoded (lazy images forced eager), slide 2 map markers = stop count, slide 3
  budget/months/sources/evaluate present, evaluation view = the five questions of `data/questionnaire.json` in order,
  10 options each, nothing pre-selected; records page/console errors and HTTP failures.
- `tests/e2e/qa-blind-voting.spec.ts` — demo backend seeded in Node with the real `.gs` code; Victor browses 7 routes
  under `per-destination-complete`, `all-complete`, `admin-only`, `always + author-only`, `BLIND_VOTING_ENABLED=false`;
  DOM + browser storage must not contain other participants' comments; heat-map cells visible exactly as the policy
  allows; a rejected submission is never shown as saved and a later retry saves exactly one row; forged/expired
  sessions are refused; 5 wrong codes lock the name (right code refused afterwards) without locking others.
- `tests/e2e/qa-ranking.spec.ts` — every destination at 10/10 except Tunisia at 5/10: ineligible, conditional,
  > €2,500, material-uncertainty and incomplete destinations never appear in the ranking or as leader (computed from
  the current data, so it follows A21's changes).
- `tests/e2e/qa-navigation.spec.ts` — 20 markers with ids D01–D20; each marker opens its destination; each of the 20
  table rows selects its marker; Next/Previous, tabs, Evaluate, back, keyboard (arrows move slides but change the
  answer inside a 1–10 scale), previous/next destination, full screen; deep links + reload on every page; unknown
  routes (`D99`, `/9`, `#/nowhere`, lower-case id) fall back safely.
- `tests/e2e/qa-mobile.spec.ts` — 390 × 844 touch device: no horizontal overflow on Explore (cover, slides 1–3,
  evaluation, an excluded and an over-budget destination), My evaluations and Group results (signed out and signed in
  with revealed data); swipe left/right changes slide, a vertical drag does not. These run in the desktop project
  too, so CI actually executes them.
- `tests/e2e/qa-webgl-fallback.spec.ts` — WebGL disabled: fallback message, search, table, slides 1–3 and a complete
  evaluation still work.
- `tests/e2e/qa-subpath.spec.ts` — a minimal static server serves `dist/` under `/BoysTrip/`; no request escapes the
  sub-path, MapLibre worker and photographs load, deep links survive reloads, `/BoysTrip` redirects.
- `tests/unit/qa-red-team.test.ts` — every API action (health, config, me, myResponses, completion, results, novelty,
  submit) through the **demo client** for all four viewers under 8 policy combinations (incl. unrecognised values):
  no other participant's comment/answers unless revealed, no aggregate keys at all, superseded revisions never
  served; backend `computeAllStats_` ≡ frontend `computeStats` on 5 random data sets; same ranking order when both
  use the same eligibility inputs; two FIXME reproductions.
- Known defects are written as tests that are skipped by default (`test.fixme` / `it.skip` behind `QA_RUN_FIXME`), so
  CI stays green while the defects are open, and `QA_RUN_FIXME=1` demonstrates each one.

### 1.3 Final re-run of data-dependent checks

FINAL_DATA_RECHECK

---

## 2. Findings by area

### 2.1 Voting and security

| Check | Result | Evidence |
|---|---|---|
| Five identical questions everywhere | **Pass** | sweep: 20 evaluation views match `questionnaire.json`; backend `QUESTION_IDS`; sheet headers use the same keys |
| Explicit selection required | **Pass** | sweep: 0 checked radios on 20 forms; Save disabled until 5/5 |
| Out-of-range / non-integer rejected server-side | **Pass** | `Validation.gs:19-52` (`typeof number`, integer, 1–10, no extra keys); A23 tests + code review |
| Identity only from the session | **Pass** | forged token (participant id swapped) refused in the browser; payload `participantId` ≠ caller → FORBIDDEN |
| Cannot edit another participant's evaluation | **Pass** | A23 test `submit — identity`; no path writes a row for another id |
| Revisions do not duplicate; idempotent retries; concurrent submits | **Pass** (emulator) | A23 tests; my e2e retry after a rejected submit leaves exactly 1 Responses row |
| Failed submission never shown as saved | **Pass** | e2e: "Not saved." alert, "Pending — not yet confirmed", "⟳ Pending" tab, listed under "Not yet saved on the server", Evaluated (0) |
| Session expiry / tampering | **Pass** | e2e: tampered token → notice + signed out; client-side expiry → signed out |
| Lockout | **Pass** | e2e: 5 wrong codes → right code refused ("Too many attempts"); other participants unaffected |
| Blind voting — no leak through any action, any policy | **Pass** | unit sweep: 8 policies × 4 viewers × 8 actions; e2e: DOM + storage under 5 policies |
| Formula injection | **Pass** (emulator) | `Validation.gs:108-111` + text formats; A23 test; see A24-QA-15 for a round-trip edge case |
| Secrets/codes/comments not logged | **Pass** (emulator) | A23 log tests; code review: only `Code.gs:94` logs a truncated internal error message |
| No secrets / travel histories in repo or `dist/` | **Pass with one caveat** | `dist/` contains no novelty text, no `"hash"` entries, no access-code-like strings except the `XXXX-…` placeholder, no participant names outside configuration; `private/` is git-ignored and nothing from it appears elsewhere. The demo-only fixtures (`DEMO-…-2027` codes and the demo session secret) are in the bundle by design. **The spreadsheet ID is in the public bundle** (`dist/assets/Configuration-*.js`, emulator) and in AGENTS.md/docs — see A24-QA-03. |

### 2.2 Statistics

- Deterministic cases (8,8,8,8 → mean 8, SD 0; 10,10,10,2 → mean 8, min 2, SD ≈ 3.4641): **pass** in both
  implementations (A23/A00 tests, and my cross-check).
- Reservations from Q1, not averages: **pass** (backend `reservations` = frontend `q1Low` on 5 random data sets).
- Excluded destination at 10/10 can never lead; > €2,500 can never lead; incomplete excluded: **pass** (unit + my
  e2e with the real data).
- Results tab vs frontend: identical numbers (mean, median, min, max, SD, per-question means) — **pass**; identical
  ranking order **only if the registry is regenerated** — **fail with the committed registry** (A24-QA-01).
- Tie-break order: **fail** (A24-QA-02) — exact ties in collective score are broken by rounding noise in both
  implementations.

### 2.3 Budget

- Shared ÷ 4 vs individual, per-scenario quantities, contingency computed on local subtotal only (never a line),
  unknown excluded and listed (not 0), thresholds: **pass** (unit tests + my scan of all 20 budgets: no contingency-like
  budget line, no shared line with a per-person basis that is charged, unknown lines only in D02 with
  `materialUncertainty: true`).
- Flights included in every headline (slide 1, slide 3, table, globe tooltip, ranking): **pass**.
- Own-fare override: updates slide 1/3 totals and the table instantly, ranking keeps the reference fare: **pass**
  (existing e2e). Remarks: the override replaces the fare in all three scenarios and the separate baggage line is
  still added (a fare that already includes a bag is double-counted by the user, not the model) — A24-QA-17.
- Headlines with unknown lines are lower bounds but are displayed as plain totals; only a note under the table and
  "uncertain costs" in the comparison table say so (A24-QA-17).

### 2.4 Presentation and UX

- 80-route sweep: **pass** (see §1.1 #9).
- Exactly 3 principal slides: **pass** on all 20.
- Navigation (buttons, tabs, keyboard, swipe, full screen, previous/next destination): **pass**.
- Globe: 20 markers, D01–D20; every marker opens its destination; every table row selects its marker: **pass**.
- WebGL failure: globe fallback, search, table, slides and voting **pass**; itinerary map **fails** silently with an
  uncaught error (A24-QA-05).
- Mobile 390 × 844: no horizontal overflow on Explore, My evaluations, Group results: **pass**; slide change on a phone
  keeps the old scroll offset (A24-QA-06).
- Deep links + refresh and sub-path: **pass**. Skip link breaks hash routing (A24-QA-07).

### 2.5 Data and research spot checks

- Operational itineraries 10–15 days with matching day counts: **pass** (12–15 days; validator enforces it).
- February and March assessed separately: **pass** — every destination has distinct February/March ratings or
  summaries and distinct climate blocks (no copy-paste found).
- Excluded destinations (D02 Iraq, D06 Saudi Arabia, D15 Ethiopia) are informational, with a red "Excluded —
  informational concept only" banner on every slide: **pass**. D20 Chile (> €2,500) keeps an operational itinerary but
  carries an "Outside the €2,500 maximum" banner and cannot be ranked.
- Sources: 371 sources (350 unique URLs). I fetched 12 across 11 destinations (UK FCDO ×4, France Diplomatie ×3, JMA,
  Wikipedia, vietnam.travel, a news site, a rental blog): **12/12 reachable; 11 support the recorded claim; 1 partly**
  (D04 S05 links the France Diplomatie "dernières minutes" page, the security zones are on its "Sécurité" sub-page).
  D01 S08 (driving permit) is a car-rental company blog, not an official source.
- Images vs captions: 20 sampled credits (2 per destination for 10 destinations) — Commons file names match the
  captions (e.g. "Ziggurat of Ur Site in Nasiriyah" → Ziggurat of Ur; "Tham Kong Lo" → Kong Lor Cave); the sweep
  confirmed every referenced photograph exists and decodes. Licences are CC BY/BY-SA/CC0/PD only.
- Novelty not in public data: **pass** (no novelty notes, `visitedBy` values or travel-history text in the repository
  outside `private/`, nor in `dist/`). `tests/backend/results.test.ts:255` uses an invented note ("Victor went in
  2019") as a fixture — fictitious, but better replaced by a neutral string.
- Scope note: D19 is titled and routed as Oaxaca only (Chiapas removed for security, stated in `portfolioNote`),
  while AGENTS.md §2 still lists "Mexico — Oaxaca & Chiapas".

### 2.6 Deployment

- `deploy.yml`: Pages permissions (`pages: write`, `id-token: write`), concurrency group, Node 22, `npm ci`, validate →
  unit/backend tests → typecheck + build → upload → deploy: **correct**; failing *unit/backend* tests block the
  deploy. **Playwright e2e is not part of the deploy**, and `test.yml` ignores pushes to `main`
  (`branches-ignore: [main]`), so a direct push to `main` deploys without e2e (A24-QA-04).
- `test.yml` runs only `--project=desktop-chromium`; the config's mobile project is never run in CI, and the original
  `@mobile` overflow test in `explore.spec.ts` therefore runs at 1440 px (my mobile spec sets the viewport itself).
- No CI check that `backend/apps-script/Destinations.gs` is regenerated from the data (A24-QA-01).
- `npm ci` with the committed lockfile: **pass** (scratch copy, macOS). Not verified on Linux.
- README: accurate on architecture, scripts, demo mode, sub-path and hash routing. Inaccurate/incomplete:
  "Satellite tiles (optional, loaded on demand)" — the itinerary map loads EOX satellite tiles by default
  (`ItineraryMap.tsx:61`); "Failed tests block deployment" holds for unit/backend tests only; it links
  `reports/final-delivery.md`, which did not exist at the time of review.

---

## 3. Issues found

Severity: **Critical** = wrong decision or private data exposed; **High** = must fix before the group votes;
**Medium** = fix before go-live if possible; **Low** = polish.

| ID | Sev. | Issue | Where | Reproduction | Impact | Suggested fix (owner) |
|---|---|---|---|---|---|---|
| A24-QA-01 | **High** | Backend destination registry is stale: D14–D20 still `pending: true`; D07 and D09 totals, D13 security (now eligible) and material uncertainty differ, and all 20 `version` strings are out of date (material drift on 10 destinations at the end of the review). The generated `backend/dist/ExpeditionBackend.gs` is equally stale. | `backend/apps-script/Destinations.gs:16,18,22,23-29`; `backend/dist/ExpeditionBackend.gs:352-358` | `QA_RUN_FIXME=1 npx vitest run tests/unit/qa-red-team.test.ts -t QA-01` → drift `[D07, D09, D13, D14 … D20]` | The spreadsheet's Results tab (`ranking_eligible`, `ranking_position`) would exclude Japan, Senegal, South Africa, Mexico ("research pending") while the website ranks them → two different "winners". Demo mode uses the same stale file (no visible effect there, ranking is computed client-side). | Run `npm run backend:registry && npm run backend:bundle` after the last data change; add a CI step that regenerates the registry into a temp file and fails on any diff (A23 / A00). |
| A24-QA-02 | **High** | Exact ties in collective score are decided by floating-point noise, not by the documented tie-breakers. | `src/lib/statistics.ts:123`; `backend/apps-script/Results.gs:90` | `QA_RUN_FIXME=1 npx vitest run tests/unit/qa-red-team.test.ts -t QA-02`: A = 1.6, 3.6, 4.4, 4.4 and B = 4.4, 3.6, 1.6, 4.4 (both 70 points, collective 3.5, lowest 1.6); B has the higher mean Q1 and must win; both implementations rank A first (3.5000000000000004 > 3.5). | With integer answers, equal totals are common (any two destinations with the same sum of 20 answers); the winner can flip on rounding. | Compare on exact integers (sum of the 20 answers) or with a tolerance (`Math.abs(a-b) > 1e-9`) in both places; keep the unit test (A00 for statistics.ts, A23 for Results.gs). |
| A24-QA-03 | **High** (process) | The spreadsheet ID is public (AGENTS.md, docs, `Configuration.gs`, and the production bundle `dist/assets/Configuration-*.js`), and the deployment guide states the sheet "currently appears to be shared as Anyone with the link can edit". | `docs/deployment/apps-script.md:78`; `backend/apps-script/Configuration.gs:25` | grep `dist/` for the ID | Anyone who reads the public site/repo can open and edit the raw votes, bypassing blind voting, validation and history. | Set General access to *Restricted* **before** the repository or Pages site is published; consider reading `SPREADSHEET_ID` only from Script Properties and dropping the constant from public files (A23 / owner). |
| A24-QA-04 | **Medium** | Deploys are not gated by the e2e suite: `deploy.yml` runs no Playwright, `test.yml` skips `main`. | `.github/workflows/test.yml:6`; `.github/workflows/deploy.yml` | read the workflows | A regression in the browser (e.g. blind-voting UI, routing) can reach GitHub Pages on a direct push to `main`. | Run `npx playwright install --with-deps chromium && npx playwright test --project=desktop-chromium` in the deploy build job (or make deploy `needs` a test job that also runs on `main`) (A00). |
| A24-QA-05 | **Medium** | Without WebGL (MapLibre 6 needs WebGL2) the itinerary map throws "WebGL2 is required to display this map" from an async `setTimeout` callback: uncaught page error, empty beige box, a "Plain map" toggle that does nothing, no explanation. | `src/components/itinerary/ItineraryMap.tsx:73-87` | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-webgl-fallback.spec.ts`; screenshot `docs/qa/screenshots/desktop-15-no-webgl-fallback-slide2.jpg` | Older or locked-down devices see a broken map on every slide 2 (stop list and timeline still work). | Wrap `new MLMap` in try/catch (or check `canvas.getContext('webgl2')` first) and render a static stop list / "map unavailable" message, as the globe does (A22). |
| A24-QA-06 | **Medium** | On phones a slide change keeps the window scroll offset: pressing "Next →" at the bottom of slide 1 lands 3,238 px into slide 2 (Jordan). | `src/components/presentation/PresentationPanel.tsx:56-58` (scrolls only the inner `.panel-scroll`, which does not scroll below `lg`) | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-mobile.spec.ts -g "START of the next slide"` | Core presentation flow on mobile is disorienting; readers start every slide in the middle. | Below `lg`, `document.getElementById('presentation')?.scrollIntoView({ block: 'start' })` on slide/destination change (A22). |
| A24-QA-07 | **Medium** | "Skip to content" (`href="#main-content"`) replaces the route hash; `parseHash` maps it to the Explore cover. | `src/App.tsx:23`; `src/lib/router.ts:16-26` | `QA_RUN_FIXME=1 npx playwright test tests/e2e/qa-navigation.spec.ts -g "Skip"` → URL becomes `#main-content`, Group results replaced by the globe | Keyboard/screen-reader users are thrown out of the page they are on. | Make it a button that focuses `#main-content` (`tabIndex=-1`) without touching the hash (A22). |
| A24-QA-08 | **Medium** (design) | After a destination is revealed, any participant can still revise their evaluation, with the others' scores in view; the website does not flag post-reveal revisions. | `Responses.gs` `handleSubmit_` (no reveal check); UI | sign in after a 4/4 reveal and edit | Strategic re-scoring (e.g. lowering a rival favourite) can change the winner after reveal; only the History tab shows it. | Decide as a group: lock revisions after reveal, or show "revised after reveal" in Group results; or use `all-complete` (A00 decision, A23/A22). |
| A24-QA-09 | **Medium** (design) | The spreadsheet owner is (likely) also a participant and can read raw Responses before reveal. | `docs/deployment/apps-script.md:86-88` | — | Blind voting is not enforceable against the owner. | Documented; consider a non-voting owner or `all-complete` policy (owner decision). |
| A24-QA-10 | **Low** | Other participants' comments are never displayed anywhere in the UI, although the backend reveals them (`COMMENTS_VISIBILITY=after-reveal`) and the form promises "Visible to the other three only after all four have evaluated". The promise is also hard-coded regardless of policy. | `src/components/voting/EvaluationPanel.tsx:159`; `src/pages/GroupResults.tsx` (no use of `comments`) | grep | Comments are effectively spreadsheet-only; the text misleads. | Show revealed comments per destination in Group results, and derive the hint from `config.revealPolicy`/`commentsVisibility` (A22). |
| A24-QA-11 | **Low** | Concurrent submissions for two destinations can corrupt local pending/draft state (stale `pending`/`drafts` closures). | `src/state/evaluations.tsx:178-205` | code review, not reproduced: submit D01, switch to D02 and submit before D01 answers | A saved evaluation can reappear as "pending" (retry is idempotent, so no duplicate), or a fresh draft can be dropped. | Use functional state updates / read-modify-write from localStorage inside the callbacks (A22). |
| A24-QA-12 | **Low** | Unsent drafts and pending answers stay in `localStorage` after sign-out (`ge-drafts-v1:<id>`, `ge-pending-v1:<id>`). | `src/state/evaluations.tsx:76-116`; `src/state/session.tsx:93-104` | sign in, answer, sign out, inspect storage | On a shared device the next person can read someone's unsent scores (minor blind-voting leak). In demo mode the whole emulated spreadsheet is in `localStorage` by design. | Offer "sign out and clear this device" (A22). |
| A24-QA-13 | **Low** | `explore.spec.ts`'s `@mobile` test runs at 1440 px in the CI project; the mobile project is never run in CI. | `tests/e2e/explore.spec.ts:38`; `playwright.config.ts:41-42`; `test.yml:32` | read config | False confidence in mobile coverage. | Set the viewport in that test (done in `qa-mobile.spec.ts`) or run the mobile project in CI (A24 / A00). |
| A24-QA-14 | **Low** | Sign-in dialog details: placeholder shows 5 groups (codes have 6: 24 characters); "valid for up to 7 days" is hard-coded though `SESSION_EXPIRY_HOURS` is configurable; signing out signs out every device. | `src/components/layout/SignInDialog.tsx:106,133` | view dialog | Minor confusion. | Use `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`; derive the duration from `config.sessionHours` (A22). |
| A24-QA-15 | **Low** | Formula-injection round trip: a comment that itself starts with `'=` (or `'+`, `'-` …) is stored as `''=…`; if real Sheets strips the quote prefix on write, `unsanitizeFromSheet_` then removes the user's own apostrophe. | `backend/apps-script/Validation.gs:9,114-117` | reasoning only; real Sheets behaviour untested | Cosmetic change of rare comments. | Store a marker-free value in a text-formatted cell, or record that sanitising happened (A23). |
| A24-QA-16 | **Low** | Itinerary map requests EOX satellite tiles by default on every slide 2 (third-party requests, IP disclosed to EOX); README says satellite tiles are optional and loaded on demand. | `src/components/itinerary/ItineraryMap.tsx:61`; `README.md:114` | open any slide 2 | Privacy/offline expectation mismatch. | Default to the plain map, or correct the README (A22 / A00). |
| A24-QA-17 | **Low** | Budget display: totals with unknown lines (D02) are shown as plain figures; a personal fare that includes baggage is added to the separate baggage line. | `src/components/budget/BudgetBreakdown.tsx` | open `#/explore/D02/3` | Slight understatement for D02 (excluded anyway). | Show "≥ €2,466 + unknown" next to the headline when `unknownLines.length > 0`; mention baggage next to the fare input (A22). |
| A24-QA-20 | **Medium** | In demo mode the evaluation form says "Saved in Google Sheets · revision 1", "Sending to the group spreadsheet…" and "✓ Saved on the server", directly under the notice "Demo mode: evaluations are stored only in this browser, not in Google Sheets". | `src/components/voting/EvaluationPanel.tsx:72,75,218` | `docs/qa/screenshots/mobile-12-evaluation-form.jpg` | If the site is ever published without `appsScriptUrl` (or the variable is missing in CI), each friend is told their vote is in Google Sheets while it exists only in their own browser — votes silently never aggregate. | Use `mode === 'demo' ? 'Saved in this browser (demo)' : 'Saved in Google Sheets'`; consider failing the production build when no Apps Script URL is configured (A22 / A00). |
| A24-QA-18 | **Info** | `GlobeView.tsx:142` builds marker HTML with unescaped `d.country`/labels (repository data only); no CSP (and demo mode needs `new Function`). | `src/components/globe/GlobeView.tsx:142` | code review | Only exploitable if repository data is compromised; a session token in `localStorage` would then be readable. | Escape like `ItineraryMap.escapeHtml` (A22). |
| A24-QA-19 | **Info** | Backend registry rounds totals to cents while the website compares unrounded totals with €2,500 (a total of €2,500.004 would be eligible in the sheet only). | `scripts/build-backend-registry.ts:97`; `src/lib/statistics.ts:132` | — | Theoretical. | Compare on the same rounded value in both (A23 / A00). |

No Critical issue was found: no private data, code, secret or unrevealed score reached a browser in any test.

---

## 4. What could NOT be tested

- **Real Google Apps Script deployment**: the `script.google.com` → 302 → `script.googleusercontent.com` flow and its
  CORS headers, real LockService/CacheService under real concurrency, quotas, cold starts, Sheets' handling of
  leading apostrophes in text-formatted cells, the permission screens. Everything backend-related was tested in the
  emulator only. The live integration must stay described as **untested** until §10 of
  `docs/deployment/apps-script.md` is done.
- **Safari / iOS / WebKit, Firefox, Android Chrome on a device**: only Chromium (desktop and mobile emulation) was run.
  Swipe was tested with CDP touch events, not a real touchscreen. In-app browsers untested.
- **Real GitHub Pages**: the workflows were reviewed, not executed; the sub-path behaviour was tested with a local
  static server; `npm ci` was run on macOS only (the lockfile contains the Linux binaries).
- **Real network conditions** for the live client (timeouts, 5xx, HTML responses) beyond A23's unit tests.
- **Accessibility audit** beyond keyboard navigation (no screen reader, no automated contrast audit).
- **Research correctness** beyond 12 URL spot checks and caption/file-name matching (A21 owns verification).

---

## 5. Prioritised fix list

1. **A24-QA-03** — restrict the spreadsheet (*Restricted*) before anything is published (owner, minutes).
2. **A24-QA-01** — regenerate `Destinations.gs` + bundle after A21's last change; add a CI drift check (A23/A00).
3. **A24-QA-02** — exact-integer / tolerant comparison of collective scores in `statistics.ts` and `Results.gs`.
4. **A24-QA-04** — run Playwright in the deploy job (or gate deploy on a test job that runs on `main`).
5. **A24-QA-20** — never say "Saved in Google Sheets" in demo mode; ideally refuse to build/deploy production without an Apps Script URL.
6. **A24-QA-08** — group decision on post-reveal revisions (lock, flag, or `all-complete`).
7. **A24-QA-06**, **A24-QA-05**, **A24-QA-07** — mobile scroll on slide change, map WebGL fallback, skip link (A22).
8. **A24-QA-10** — show revealed comments (or drop the promise) and policy-aware hint text.
9. Low items A24-QA-11 … A24-QA-17, then the informational ones.

When a fix lands, remove the matching `test.fixme(!process.env.QA_RUN_FIXME, …)` / `fixme(…)` guard so the test
becomes a permanent regression test.

---

## 6. Screenshots (`docs/qa/screenshots/`, JPEG, 15 files, ≈ 1.3 MB)

Captured with `QA_SCREENSHOTS=1 npx playwright test tests/e2e/qa-screenshots.spec.ts --project=desktop-chromium`
(demo backend seeded with **fictitious** scores). Desktop 1440 × 900: explore cover, slide 1/2/3 (Jordan), evaluation
form, My evaluations, Group results (top and ranking), no-WebGL fallback. Mobile 390 × 844: globe, slide 1, slide 3
budget, evaluation form, My evaluations, Group results. SCREENSHOT_NOTE
