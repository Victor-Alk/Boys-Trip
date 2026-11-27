# AGENTS.md — The Great Expedition 2027

Shared operating manual for every agent working in this repository. Read it before changing anything.

## 1. Objective

Help four experienced friends choose a 10–15-day expedition for **February or March 2027** by comparing 20
researched expedition concepts on an interactive globe, evaluating each with the same five questions, and
reading collective results that respect security and budget limits.

Architecture (non-negotiable): **GitHub repository → GitHub Pages (static React build) → Google Apps Script web
app → existing Google spreadsheet** (`1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg`). No other hosting, database,
auth provider, form service, analytics or paid map API.

## 2. Agents and file ownership

| Agent | Responsibility | Owns |
|---|---|---|
| A00 | Orchestration, architecture, integration, delivery | `AGENTS.md`, `src/types/**`, `src/lib/budget.ts`, `src/lib/validation.ts`, `src/lib/statistics.ts`, `scripts/**` (except A23's), `vite-plugins/**`, `.github/**`, `data/questionnaire.json`, `data/configuration.json`, `reports/final-delivery.md`, `private/**` |
| A01–A20 | One destination each (table below) | `data/destinations/DXX-*.json`, `docs/research/DXX-*.md`, `data/images/manifests/DXX.json`, generated `data/images/DXX.json` + `public/images/destinations/DXX/` |
| A21 | Cross-destination verification (security, seasonality, budget, sources, feasibility, images) | `docs/verification/**`, `reports/research-completeness.md`; may correct destination files only for verified factual errors, logging every change |
| A22 | Frontend, globe, presentation system, visual identity, responsive design | `src/**` except `src/types`, `src/lib/budget.ts`, `src/lib/validation.ts`; `index.html`; `public/globe`, `public/maps` |
| A23 | Apps Script backend, Sheets schema, auth, voting, statistics | `backend/**`, `src/lib/api.ts`, `docs/deployment/apps-script.md`, `docs/architecture/cross-origin.md`, `scripts/generate-access-codes.mjs`, `scripts/build-backend-registry.ts`, `scripts/bundle-backend.mjs`, `tests/backend/**` |
| A24 | Independent red-team review, automated tests, visual QA, deployment validation | `tests/e2e/**`, `reports/quality-assurance.md`, `docs/qa/**` |

| ID | Destination | Region / concept | Agent |
|---|---|---|---|
| D01 | Taiwan | Mountains, indigenous cultures, temples, hot springs, Pacific coast | A01 |
| D02 | Iraq | Mesopotamia, ancient civilisations, religious heritage | A02 |
| D03 | China — Yunnan | Ancient towns, mountains, minority cultures | A03 |
| D04 | India — Northeast | Remote communities, monasteries, forests, Himalayan foothills | A04 |
| D05 | Algeria | Roman heritage and a Saharan expedition | A05 |
| D06 | Saudi Arabia | Ancient Arabia, sandstone deserts, volcanic landscapes | A06 |
| D07 | Jordan | Archaeology, desert camping, Bedouin culture, canyons | A07 |
| D08 | Tunisia | Roman ruins, Amazigh villages, troglodyte architecture, oases | A08 |
| D09 | Egypt | Ancient civilisations, Western Desert, Siwa | A09 |
| D10 | Sri Lanka | Road trip, ancient kingdoms, wildlife, tea country | A10 |
| D11 | Laos | Karst, underground rivers, rural Buddhist culture | A11 |
| D12 | Vietnam | Northern mountains, minority cultures | A12 |
| D13 | Philippines | Palawan islands, marine landscapes, communities | A13 |
| D14 | Japan — Kyushu | Volcanoes, rural Japan, onsen, historic towns | A14 |
| D15 | Ethiopia | Ancient civilisations, religious heritage, highlands | A15 |
| D16 | Senegal | West African culture, historic towns, rivers, coast | A16 |
| D17 | South Africa | Cape wilderness, mountain camping, history | A17 |
| D18 | Guatemala | Maya civilisation, volcanoes, jungle, indigenous communities | A18 |
| D19 | Mexico — Oaxaca & Chiapas | Indigenous cultures, archaeology, mountains, jungle | A19 |
| D20 | Chile — Atacama | High deserts, Andean heritage, astronomy | A20 |

The portfolio stays at exactly these 20 destinations. Replacement proposals go in
`docs/research/portfolio-review.md`; nothing is substituted without the group's approval.

Rule: **never edit a file you do not own.** Report needed changes to A00 instead.

## 3. Data schema

- Authoritative schema: `src/types/destination.ts` (zod). Skeleton with comments:
  `docs/agent-briefs/destination-skeleton.jsonc`.
- Validation: `npm run validate` (all 20 required) or `npm run validate -- D07`. CI blocks deployment on errors.
- Derived values (budget totals, budget status) live in `src/lib/budget.ts` and are never stored in JSON.
- Images: chosen in `data/images/manifests/DXX.json`, resolved by `npm run images -- DXX` (licence and author
  read from the Wikimedia Commons API; NC/ND/unknown licences rejected).
- **Private data** (participant travel histories, collective novelty, access codes) never enters this repository.
  It lives in `private/` (git-ignored) and in Apps Script Script Properties, and is served only to authenticated
  participants.

## 4. Presentation structure (identical for all destinations)

1. **01 — The Experience** — *Why should we go there?* Hero + 2–3 photos, 80–120-word introduction, duration,
   best window, style, geography, culture, novelty (authenticated), 3–5 signature experiences, indicative total
   incl. flights, security status, "What makes this expedition exceptional?".
2. **02 — The Journey** — *What would we actually do?* Itinerary map (numbered stops, schematic connections),
   day-by-day timeline, transport, travel times, culture, adventure, accommodation, stop detail drawer.
3. **03 — The Practical Reality** — *Can we realistically do it?* Three budget scenarios, stacked breakdown vs
   €2,000 / €2,500, own-flight-price override, February vs March, driving, camping, difficulty, security,
   advantages, disadvantages, uncertainties, sources and verification date, then **Evaluate this expedition**.

One reusable component renders all 60 slides from data.

## 5. Budget methodology

See `src/lib/budget.ts` and `docs/methodology/budget.md`. Key rules: EUR; group of 4; two shared rooms;
`individual` vs `shared` lines; every category present (not-applicable = 0, unknown = null, never 0 for
unknown); contingency computed from the local subtotal (10–15%), never a line; flights included in every
headline; reference departure Paris CDG (illustrative), confidence labelled observed / representative /
estimate; realistic scenario = headline.

| Realistic total per person (flights incl.) | Status |
|---|---|
| < €1,000 | Very affordable |
| €1,000 – 1,499 | Affordable |
| €1,500 – 2,000 | Within preferred budget |
| €2,001 – 2,500 | Exceptional expenditure (justification required) |
| > €2,500 | Outside budget (not eligible for the final ranking) |

## 6. Security methodology

Official advice for the *route* (France Diplomatie, UK FCDO, Netherlands Worldwide, Smartraveller, US State
Department). **Excluded** = route needs areas under advice against all / all-but-essential travel, or exposure to
war, armed conflict, significant terrorism or kidnapping risk. **Conditional** = significant uncertainty,
conflicting advice, unresolved route restrictions. **Eligible** = no identified material conflict. Every
assessment records date, sources, regions, explanation and reassessment requirement. Conditional and excluded
destinations never enter the eligible ranking, whatever their scores. Recheck before booking and before departure.
Details: `docs/methodology/security.md`.

## 7. Voting

Exactly five questions, identical for every destination (`data/questionnaire.json`), integer 1–10, explicit
selection, optional comment. Individual score = mean of the five answers (unrounded). Collective score = mean of the
four individual scores (only when all four have evaluated). One active evaluation per `participant_id +
destination_id`; edits replace it and are archived in History. Blind voting is enforced server-side.

Ranking: exclude non-eligible security → exclude > €2,500 → exclude material budget uncertainty → exclude
incomplete → sort by collective score, then lowest individual score, then mean Q1, then destination id.
"Significant individual reservation" = any Q1 ≤ 4 (not a veto).

## 8. Visual identity

Premium expedition journal, not a SaaS dashboard. Palette: midnight blue `#0f1b2d`, forest green `#2f4a3a`,
sandstone `#c8a97e`, warm ivory `#f4eee2`, muted bronze `#9a7446`, slate `#5f6b75`. Red/amber reserved for security
and practical warnings. Display serif: Fraunces; interface sans: Archivo; tabular figures for numbers. Large
documentary photography, restrained motion, accessible contrast, nothing generic.

## 9. Technical architecture

React 19 + Vite (static build, relative base, hash routing `#/explore/D01`, `#/my-evaluations`,
`#/group-results`), TypeScript, Tailwind CSS 4, react-globe.gl (Three.js), MapLibre GL JS (bundled Natural Earth
data), Recharts, zod. Backend: Apps Script web app (`doPost`, `text/plain` JSON bodies to avoid CORS preflight,
token in the body, never in the URL). Tests: Vitest (unit + backend logic executed in Node with Apps Script
fakes), Playwright (e2e). Deployment: GitHub Actions → GitHub Pages. API contract: `docs/architecture/api-contract.md`.

## 10. Source standards

Real, checked sources only (official tourism, advisories, UNESCO, national parks, meteorological agencies,
immigration, transport operators, established operators, accommodation, rental companies). Record title, URL,
publisher, type, publication date, access date and supported claims. Never fabricate citations, prices,
quotations, opening hours, advisories, photographs or test results. Label estimates as estimates.

## 11. Definition of done

Website builds; globe interactive; every marker opens the right three slides; table ↔ globe linked; five
identical questions; submissions and edits work and stay unique; responses land in the spreadsheet when the
backend is configured; statistics correct; ineligible or > €2,500 destinations cannot win; mobile works;
images and sources documented; GitHub Pages paths and deep links work; deployment documented; limitations listed.
Untested integrations are never described as working.
