# Budget review — cross-destination verification (A21)

Review date: **27 November 2026**. Totals below are computed with `src/lib/budget.ts` from the corrected records
(per person, EUR, flights included; contingency on the local subtotal). **No amount, quantity, flight price or
contingency rate was changed**: every check either passed or raised an issue that is a planning judgement rather
than a clear error. The only budget-field correction is D13's `materialUncertainty` flag (see §5). All totals are
therefore identical before and after verification.

## 1. Headline figures (realistic scenario = headline)

| ID | Destination | Security | Economical | **Realistic** | Comfortable | Tier (realistic) | Realistic flight | Local + contingency per day | Material uncertainty |
|---|---|---|---|---|---|---|---|---|---|
| D01 | Taiwan | eligible | 1,642 | **2,307** | 3,596 | Exceptional | 880 | 110 | no |
| D02 | Iraq | excluded | 1,370 | **2,466** | 4,242 | Exceptional (indicative) | 600 | 144 | yes (visa, permits unknown) |
| D03 | China — Yunnan | eligible | 1,386 | **2,018** | 3,207 | Exceptional | 750 | 91 | no |
| D04 | India — Northeast | eligible | 1,364 | **1,934** | 2,974 | Within preferred | 640 | 86 | no |
| D05 | Algeria | conditional | 1,267 | **2,031** | 3,189 | Exceptional | 250 | 137 | yes |
| D06 | Saudi Arabia | excluded | 1,744 | **2,635** | 4,378 | Outside budget | 620 | 168 | yes |
| D07 | Jordan | conditional | 1,275 | **1,950** | 3,031 | Within preferred | 420 | 118 | no |
| D08 | Tunisia | eligible | 929 | **1,457** | 2,310 | Affordable | 200 | 97 | no |
| D09 | Egypt | conditional | 1,124 | **1,629** | 2,497 | Within preferred | 330 | 100 | no |
| D10 | Sri Lanka | eligible | 1,492 | **1,930** | 2,651 | Within preferred | 850 | 83 | no |
| D11 | Laos | eligible | 1,171 | **1,632** | 2,377 | Within preferred | 820 | 58 | no |
| D12 | Vietnam | eligible | 1,223 | **1,775** | 2,449 | Within preferred | 780 | 77 | no |
| D13 | Philippines | eligible | 1,643 | **2,468** | 3,540 | Exceptional | 820 | 118 | **yes (set by A21)** |
| D14 | Japan — Kyushu | eligible | 1,951 | **2,438** | 3,660 | Exceptional | 960 | 106 | no (borderline, see §6) |
| D15 | Ethiopia | excluded | 1,507 | **2,247** | 3,333 | Exceptional (indicative) | 680 | 121 | yes |
| D16 | Senegal | eligible | 1,280 | **1,822** | 2,834 | Within preferred | 560 | 97 | no |
| D17 | South Africa | eligible | 1,501 | **2,044** | 3,141 | Exceptional | 750 | 92 | no |
| D18 | Guatemala | eligible | 1,778 | **2,233** | 3,488 | Exceptional | 920 | 101 | yes |
| D19 | Mexico — Oaxaca | eligible | 1,450 | **2,058** | 3,049 | Exceptional | 1,000 | 88 | no |
| D20 | Chile — Atacama | eligible | 1,949 | **2,850** | 4,242 | Outside budget | 1,150 | 131 | no |

Counts (realistic): **8 within €2,000** (D04, D07, D08, D09, D10, D11, D12, D16) · **10 at €2,001–2,500**
(D01, D02, D03, D05, D13, D14, D15, D17, D18, D19) · **2 above €2,500** (D06, D20).
Every 2,001–2,500 record has an `exceptionalJustification`.

Rankable today (eligible security, ≤ €2,500, no material uncertainty): **11** — D04, D08, D10, D11, D12, D16
(≤ €2,000) and D01, D03, D14, D17, D19 (exceptional). Not rankable: D13 and D18 (material uncertainty), D20
(> €2,500), D05/D07/D09 (conditional), D02/D06/D15 (excluded).

## 2. Flight harmonisation (reference departure Paris CDG for all 20)

All 20 records use **Paris CDG** as `referenceDeparture`, give arrival/return airports, routing, indicative dates,
baggage assumption, three scenario prices, `checkedAt` 2026-11-27 and a confidence label. No record claims an
`observed` live quote. Labels are honest: `representative` is used only where the agent saw cached airline or
aggregator fares (D01, D09–D14); the rest are `estimate`. The "A21 plausibility band" is A21's planning judgement for
an economy return with one checked bag on the indicative dates (not a quote).

| ID | Route (out / back) | Indicative dates | Realistic | Confidence | Basis in record | A21 plausibility band | Verdict |
|---|---|---|---|---|---|---|---|
| D08 | CDG–TUN / DJE–CDG (open-jaw) | 13–25 Mar | 200 | estimate | Direct LCC/legacy, not verified | 150–300 | consistent |
| D05 | CDG–ALG return | 14–26 Mar | 250 | estimate | Air Algérie CDG; Transavia ORY €113–129 seen | 180–350 | consistent (ORY alternative €140 recorded) |
| D09 | CDG–CAI return | 13–25 Mar | 330 | representative | Aggregator snapshots €240–300 | 250–450 | consistent |
| D07 | CDG–AMM return | 12–24 Mar | 420 | estimate | Fare-tracker snapshots; RJ non-stop | 300–550 | consistent; volatile with regional conflict |
| D16 | CDG–DSS return | 1–13 Feb | 560 | estimate | General knowledge, not searched | 450–700 | consistent; February is French school-holiday season |
| D02 | CDG–BGW / EBL–CDG | 11–23 Mar | 600 | estimate | Planning guess | 450–800 | consistent (excluded) |
| D06 | CDG–RUH return | 15–26 Mar | 620 | estimate | No search | 400–700 | consistent (excluded) |
| D04 | CDG–DEL return (+ domestic in b4) | 6–20 Feb | 640 | estimate | Not searched | 500–750 | consistent |
| D15 | CDG–ADD return | 6–18 Feb | 680 | estimate | Not searched | 500–800 | consistent (excluded) |
| D03 | CDG–KMG return | 12–25 Mar | 750 | estimate | Route pages €450–650 + margin | 550–850 | consistent |
| D17 | CDG–CPT return | 6–19 Mar | 750 | estimate | Recalled carriers | 700–1,000 | consistent, low side of band |
| D12 | CDG–HAN return | 8–20 Mar | 780 | representative | Vietnam Airlines "from" €893–936 (earlier dates) | 650–900 | consistent |
| D11 | CDG–VTE / LPQ–CDG | 10–23 Feb | 820 | representative | Skyscanner €742 + open-jaw margin | 700–1,000 | consistent |
| D13 | CDG–MNL return | 4–17 Mar | 820 | representative | Airline/aggregator €640–862 | 650–950 | consistent |
| D10 | CDG–CMB return | 8–20 Feb | 850 | representative | Turkish from €718, SriLankan from €884 | 650–950 | consistent (Feb is peak season) |
| D01 | CDG–TPE return | 10–22 Mar | 880 | representative | EVA widgets €811–924 | 750–1,000 | consistent |
| D18 | CDG–GUA return | 12–24 Feb | 920 | estimate | Not searched | 800–1,100 | consistent |
| D14 | CDG–FUK return | 2–15 Mar | 960 | representative | VN €814, KE €913–1,024 | 850–1,100 | consistent; a €1,024 fare would push D14 over €2,500 |
| D19 | CDG–MEX–OAX return | 15–26 Feb | 1,000 | estimate | Not searched | 800–1,000 | **upper edge** — higher than D18 although CDG–MEX has non-stop service; see §6 |
| D20 | CDG–SCL return | 4–16 Mar | 1,150 | estimate | "€900–1,300 common" | 900–1,300 | consistent (southern summer) |

Ordering across similar routes is coherent: North Africa/Levant €200–420; West Africa and Delhi €560–680; South/East
Asia €750–960 with Japan highest; Latin America €920–1,150. The realistic range in the portfolio is €200–€1,150, as
stated in the brief. No flight figure was changed: none is implausible, and replacing one estimate with another
without a quotation would not improve accuracy.

## 3. Line-level checks

| Check | Method | Result |
|---|---|---|
| Required categories | Validator + script over all 19 categories | All 20 complete |
| Unknown ≠ 0 | Searched applicable lines with 0 cost and null lines | Only D02 Iraq has null (visa, permits) — correctly `unknown`. Zero-cost applicable lines are justified: D07 visa waived by the Jordan Pass (12-night stay meets the minimum), D10 ETA fee waiver and D13 eTravel (both nationality-dependent, noted), D16 bag included, D12 economical visa exemption |
| Shared rooms | Every `per-room` accommodation line compared with the itinerary's bed-nights | All 23 per-room lines use quantity = nights × 2 rooms with `shared`; person-night lines (D07 Feynan/Rum, D14 ryokan, D16 camps) are `individual`; nights reconcile with the itinerary in all 17 operational records (camp nights counted once) |
| Travel insurance | `travel-insurance` lines | All 20 `individual`, per policy; realistic €75–150 (adventure/trekking/evacuation wording in every label). Spread reflects risk (Chile altitude €120, Iraq €150). D17 at €75 for 14 days with hiking is at the low end but within the brief's €50–150 |
| Contingency | `contingencyPercent` | 10 / 12 / 15 % in all 20, never a line |
| Monotonic scenarios | Validator | Totals monotonic everywhere. D10 shows four non-monotonic lines because the economical scenario is self-drive and the others use a driver — a deliberate scenario design, total still monotonic |
| Flights in headline | `computeScenario` | Included in every headline |
| Double counting | Manual review of bundled items | No confirmed double count. Watch points: D09 b15 dunes-camp night vs b20 safari "incl. camp logistics" (note says most operators bundle the camp; €20 at stake, and the camp must be removed anyway for security); D19 b1 domestic baggage €50 although the CDG–OAX fare is assumed through-ticketed (bag normally included); D05 b16 desert meals vs the agency package (agency quotes usually include the cook's meals) |

## 4. Plausibility spot checks (no change made)

- Daily local spend (local + contingency per day) ranges from €58 (Laos) to €168 (Saudi Arabia); within comparable
  pairs it is coherent: Vietnam €77 vs Laos €58; Tunisia €97 vs Egypt €100 vs Jordan €118; Japan €106 vs Taiwan €110.
- D18 Guatemala b8: seven private van transfers at an average €75 include two long legs (Pana–Chichi–Xela with a
  market stop; Xela–Guatemala City ≈ 4.5 h) that are often quoted higher; the line may be €80–120 low for the group.
- D07 Jordan Pass (Explorer, 75 JOD) at €90 implies EUR/USD ≈ 1.17 — plausible.
- D16 fuel ≈ 180 L for ≈ 1,500 km at ≈ €1.2/L — plausible for a minibus.

## 5. Correction made

| File | Field | Old → new | Reason |
|---|---|---|---|
| D13-philippines.json | `budget.materialUncertainty` | false → **true** (note rewritten) | The record's own note says the defining four-night expedition (≈ €650) has no confirmed 2027 departure or price (operator calendar empty when fetched; prices from search snippets), and the realistic total is only €32 below the €2,500 ceiling. D05 and D18 are flagged for comparable reasons; leaving D13 unflagged was inconsistent. Effect: D13 becomes security-eligible but stays out of the ranking until a dated quote is obtained |

## 6. Issues for A00 / destination owners (judgement calls, not changed)

1. **No written rule for "material uncertainty".** Flags were set by each agent. A21 recommends one rule for all:
   *true* when a defining component's price or availability is unverified **and** a plausible variation (±10 %, or the
   component's own quoted range) would carry the realistic total across €2,500. Under that rule D14 Japan (€62 below
   the ceiling; a €1,024 Korean Air March fare already seen by the agent would exceed it) and D01 Taiwan (€193 below)
   become borderline; D18 Guatemala (€267 below) would no longer need its flag unless the Acatenango package or the
   fare is genuinely unknown.
2. **D19 flight at the top of the band.** €1,000 for CDG–OAX via Mexico City is higher than D18's €920 to Guatemala
   City although Paris–Mexico City has non-stop service. A dated quote could move D19 below €2,000 (it needs only
   €58 less); removing the €50 domestic-bag line if the fare is through-ticketed would bring it to ≈ €2,002.
3. **D09 Egypt** must lose the dunes-camp night for security reasons (see security review); that removes b15 and part
   of b20/b24 (≈ €60–70 per person) and adds one Siwa guesthouse night (≈ €16 per person).
4. **D13 Philippines** needs a dated operator quote for March 2027 (Tao or a local 3D2N alternative) before ranking.
5. **D10 Sri Lanka** economical scenario relies on self-drive under a contested licensing regime; if A10 removes it,
   the economical total rises by ≈ €40 per person (driver instead of rental) — no effect on the headline.
