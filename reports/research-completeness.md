# Research completeness report (A21)

Date: **27 November 2026**, after the A21 corrections (`docs/verification/changes.md`). Checks: `npm run validate`
(schema + methodology rules, all 20 pass), a scripted audit of every record, HTTP checks of all 337 cited source URLs,
Wikimedia Commons metadata for a sample of image files, and a heading check of every `docs/research/DXX-*.md`.

## 1. Portfolio-wide results

| Item | Requirement | Result |
|---|---|---|
| Schema / required fields | `src/types/destination.ts` | 20/20 valid; every required block present |
| Itinerary | 10–15 days, days = `totalDays`, ≥ 1 flexible day (operational) | 17 operational records all consistent; 3 excluded records informational with ≥ 3 overview entries |
| Route | 8–16 stops, schematic legs | 9–15 stops everywhere |
| Signature experiences | 3–5 | 3–5 everywhere |
| Introduction | 80–120 words | 92–110 words everywhere |
| Sources | ≥ 8 real sources | 11–31 per record (plus 1–4 official sources added by A21) |
| Source URLs | exist | 281 return 200; 37 return 403 (bot blocking — travel.state.gov, UNESCO, airlines; pages exist); 13 unreachable (9 Smartraveller pages — the site was down for every client tested — plus the Taiwan forestry news page, Sygic, Culture Trip and a Turkish Airlines route page); 2 return **404** (D03 S17, D04 S19); 4 rate-limited/405 (OSAC, Expedia, trvlogue) |
| Official advisories | ≥ 2 authorities, France and FCDO expected | All 20 now carry France, FCDO, Netherlands and US readings made on 27 Nov 2026 (see security review); Smartraveller entries are snippets, not re-verified |
| Images | 6–10 Commons files, real places, hero landscape ≥ 1,920 px preferred | 8–10 per record, all licences resolved; no image found to show the wrong place (sample checked against Commons descriptions/coordinates: Nangalao = Linapacan, Erg Admer, Sefar, Douz, Wadi Feynan, Muang Ngoi, Coron wrecks, Cuajimoloyas…). Low resolution: D19 hero (480 px), D17 four images at 480 px (one is an experience image), D15 one 480 px image, D15 hero 960 px. D09 hero is a 1,440 × 456 panorama (hard to crop) |
| Research documents | 11 sections | All 20 contain the required sections (Overview … Source list) |
| Budget confidence | honest labels | No line claims `observed`; 0–8 `representative` lines per record, the rest `estimate` |

## 2. Per destination

| ID | Required fields / itinerary | Sources (count · status) | Images | Weak spots |
|---|---|---|---|---|
| D01 Taiwan | Complete · 13 days, 3 flexible · 14 stops · 5 experiences | 19 · 2 blocked, 1 unreachable (forestry news page) | 8, hero 1,440 px | Fare from cached EVA widgets; rental one-way fee and campsite tent hire are estimates; Taroko access windows can change; France level now filled in |
| D02 Iraq (excluded) | Informational, as required | 11 · 4 blocked (US, UNESCO) | 9 | Visa and permit costs unknown (null, correctly); indicative only |
| D03 China — Yunnan | Complete · 14 days, 2 flexible · 12 stops | 25 · **S17 (wmf.org/node/13697) returns 404** | 8 | Visa-free entry for many Europeans ends 31 Dec 2026 (hedged at €50); HSR times "to confirm"; day 6 is a 5–6 h drive |
| D04 India — Northeast | Complete · 15 days, 2 flexible · 12 stops | 21 · **S19 (outlookindia Nameri guide) returns 404** | 10 | Two 5–5.5 h driving days back to back (days 6–7); Upper Assam insurgent risk; Dibrugarh not found among e-Visa ports (exit only); fees for Nameri from an old guide |
| D05 Algeria (conditional) | Complete · 13 days, 2 flexible · 10 stops | 19 · 3 blocked | 9 | Sahara package price spread (€690–2,490 published) → material uncertainty; two after-midnight flight arrivals (days 6 and 12); US Level 4 wording now recorded |
| D06 Saudi Arabia (excluded) | Informational | 13 · 2 blocked | 8 (1 unused: D06-08) | Prices unverified (indicative) |
| D07 Jordan (conditional) | Complete · 13 days, 2 flexible · 12 stops | 23 · 4 blocked, 1 unreachable (Smartraveller) | 9 | French orange zones touch Wadi Rum, the Dead Sea float and Ma'an transits; Jordan Pass prices from secondary guides; Smartraveller level not re-verified |
| D08 Tunisia | Complete · 13 days, 2 flexible · 15 stops | 18 · 1 blocked | 10 | All budget lines `estimate`; open-jaw fare not searched; two ≈ 5 h driving days (5 and 10) |
| D09 Egypt (conditional) | Complete · 13 days, 2 flexible · 14 stops | 16 · 2 blocked, 1 unreachable, 2 rate-limited/405 | 9; hero is a 1,440 × 456 panorama | **Dunes camp (days 7–8) outside every Siwa exception — must be replaced**; three overnight transport legs (two 9–14 h buses, one sleeper train); Abela timetable unconfirmed |
| D10 Sri Lanka | Complete · 13 days, 2 flexible · 14 stops | 31 (most of any record) · 6 blocked, 2 unreachable | 10 | Economical scenario depends on a contested self-drive licensing regime; Sigiriya fee from a third-party seller |
| D11 Laos | Complete · 14 days, 2 flexible · 9 stops | 24 · 1 blocked, 2 unreachable (Sygic, Culture Trip) | 9 | Vientiane–Thakhek out-and-back = two 6–8 h bus days; March rated poor (haze); travel window corrected to 10–23 Feb |
| D12 Vietnam | Complete · 13 days, **1 flexible day, and it is the departure day** · 14 stops | 26 · 3 blocked, 1 rate-limited | 8 | No real buffer inside the mountain loop; two 6–7 h road days (6 and 11); border-area permit fee unofficial (administrative only) |
| D13 Philippines | Complete · 14 days, 3 flexible · 10 stops | 18 · 3 blocked, 1 unreachable | 9 (2 unused: D13-07, D13-09) | **2027 departure and price of the €650 expedition unconfirmed** (material uncertainty set); Smartraveller not re-verified; security now eligible |
| D14 Japan — Kyushu | Complete · 14 days, 3 flexible · 15 stops | 19 · 2 blocked, 1 unreachable | 10 | Realistic total €62 below the €2,500 ceiling; all budget lines `estimate`; licence-country rules for IDP vs JAF translation |
| D15 Ethiopia (excluded) | Informational | 12 · 1 unreachable | 10; hero 960 px, D15-04 480 px | Indicative only |
| D16 Senegal | Complete · 13 days, 3 flexible · 13 stops | 13 · 1 405 (OSAC) | 10 (1 unused: D16-07) | Fewest sources among the operational eligibles after D19; fare not searched; a 1–13 Feb trip overlaps Ramadan for about six days; 5 h drive Kaolack–Lompoul |
| D17 South Africa | Complete · 14 days, **1 flexible** · 12 stops | 15 · all reachable | 9; **four at 480 px** (D17-05 to D17-08, incl. experience image D17-07) | Fare not searched; several 4.5–5 h self-drive days incl. gravel passes plus an 8 h Wolfberg Arch hike day; insurance line at the low end (€75) |
| D18 Guatemala | Complete · 13 days, 3 flexible · 12 stops | 21 · all reachable | 8 | Acatenango status contradictory (municipal reopening 7 Aug 2026 vs French alert 10 Sep); fare not searched; private-transfer line may be low for the Xela–Guatemala City leg |
| D19 Mexico — Oaxaca | Complete · 12 days, **1 flexible** · 10 stops (Mitla removed) | 12 (fewest) · all reachable | 8; **hero only 480 px**; D19-05 480 px; D19-04 and D19-08 now unused after the route-190 fix | Fare (€1,000) at the top of the plausible band and not searched; Hwy 175 access time to Cuajimoloyas uncertain (1.5–3.5 h reported); A19 should replace the hero and the two unused images |
| D20 Chile — Atacama | Complete · 13 days, 2 flexible · 12 stops | 17 · all reachable | 10 | Outside budget (€2,850); 6–7 h driving days at 4,000 m+ (days 5 and 10); IDP described as "recommended" — Chilean rules should be checked against the licence country |

## 3. Items for the owners (A01–A20) or A00

1. Replace the two dead sources (D03 S17, D04 S19) or re-point them to an archived copy.
2. A19: choose a ≥ 1,920 px hero for D19 and replace or drop D19-04/D19-08; A17: replace the 480 px images (D17-05 to
   D17-08); A09: consider a less extreme panorama as hero.
3. A09: rewrite days 7–8 without the dunes camp (security requirement) and adjust b15/b20/b24 and the signature
   experience accordingly.
4. A12: add a genuine buffer day inside the Hà Giang/Cao Bằng loop; A11: consider replacing the Thakhek out-and-back
   bus days with a southern exit (e.g. fly out of Pakse or Savannakhet) to remove one 6–8 h day.
5. A13, A18: obtain dated quotes (expedition; long-haul fare and Acatenango package) to clear the material-uncertainty
   flags.
6. A00: adopt one written definition of material budget uncertainty (proposal in `docs/verification/budget-review.md` §6).
