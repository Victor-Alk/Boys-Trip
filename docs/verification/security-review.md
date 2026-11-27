# Security review — cross-destination verification (A21)

Assessment date: **27 November 2026**. Scope: all 20 destination records in `data/destinations/`, re-checked against
the official advice for the specific route of each concept, then harmonised against one rule set. Corrections made
to the JSON records are logged field by field in `docs/verification/changes.md`.

## 1. What was actually read

Every authority below was read in full text by A21 on 27 Nov 2026 for all 20 destinations (and for the 12 reserve
countries in `docs/research/portfolio-review.md`), unless stated otherwise.

| Authority | How it was read | Result |
|---|---|---|
| UK FCDO | GOV.UK content API (`https://www.gov.uk/api/content/foreign-travel-advice/<country>`), all parts incl. *Warnings and insurance* | Read for all 20 |
| France Diplomatie | Per-country **Sécurité** page (`/fr/information-par-pays/<pays>/conseils-aux-voyageurs-securite`): the colour zones are written out in the text ("Zones formellement déconseillées / déconseillées sauf raison impérative / vigilance renforcée"), so the map image is not needed | Read for all 20; several agents had recorded "colour not readable" — now filled in |
| Netherlands Worldwide | `https://www.nederlandwereldwijd.nl/reisadvies/<land>` (the URL pattern that works; some `/landen/…/reizen/reisadvies` links used by agents also resolve) | Read for all 20 |
| US State Department | Official advisory data feed `https://cadataapi.state.gov/api/TravelAdvisories` (level, date and full summary incl. "Do not travel / Reconsider" lists) and `…/api/CountryTravelInformation` (country safety text). travel.state.gov pages still return HTTP 403 | Read for all 20; replaces search snippets and secondary (OSAC, press) readings |
| Australia Smartraveller | `smartraveller.gov.au` | **Not reachable** (TCP connection failure from curl; WebFetch timeout). No Smartraveller level was added or changed; existing snippet-based entries are now marked "not re-verified" where they matter (D07, D09, D13) |

Belgium (D05) and Canada (D05, D15) entries recorded by the agents were left as they were.

## 2. Rule set applied to all 20 (from AGENTS.md §6 and the agent brief)

- **Excluded** — (E1) any part of the concept *requires* an area under advice against all / all-but-essential travel:
  France red/orange, FCDO "against all"/"all but essential", Netherlands red/orange, and the US Level 4 "Do not
  travel" equivalent when it clearly covers the route; or (E2) the route itself is exposed to war, active armed
  conflict, or significant terrorism/kidnapping risk. Where a removable element breaches E1 (one night, one optional
  day), the element must be removed and the redesigned route is classified (as the agents did for Chiapas, Sbeitla,
  Timgad/Djémila).
- **Conditional** — inclusion in such an area is plausible but unresolved (undefined strip width, "et ses environs",
  undefined maritime boundary); or the official sources conflict, typically one authority at US Level 3 /
  "reconsider" for **conflict, terrorism or kidnapping** affecting the route while others impose no restriction; or
  regional spillover from an active conflict that has struck the country in the last six months.
- **Eligible** — none of the above. A US Level 3 driven by ordinary or cartel crime that the advisory itself locates
  outside the route (Guatemala) is treated as an ordinary-risk warning, not a trigger. Administrative permit regimes
  (Vietnam border districts, Meghalaya registration) are not triggers; escort regimes that exist because of a
  security threat (Algerian Sahara) are.

Calibration note: on 22 Oct 2026 the US also moved **Oman** (the group's public benchmark) to Level 3 "Reconsider
travel" for regional armed-conflict risk, the same level and wording as Jordan and Saudi Arabia. Under this rule set
an Oman trip planned today would itself be *conditional*, not excluded — which is why Jordan is kept conditional and
not excluded on the US level alone.

## 3. Outcome for all 20

Status changes: **one** — D13 Philippines conditional → **eligible**. Final count: **14 eligible, 3 conditional,
3 excluded** (before: 13 / 4 / 3).

| ID | Destination | Before | After | Authorities read by A21 (advice dated) | Route-specific reasoning | Reassessment triggers |
|---|---|---|---|---|---|---|
| D01 | Taiwan | eligible | **eligible** | FCDO (18 Nov 26): no restricted area · France (zones 13 Mar 26): *vigilance normale* whole territory · NL (20 Oct 26): green · US (24 Nov 25): Level 1 | Lowest level everywhere; hazards are earthquakes, typhoons, Taroko/Highway 8 closures | Cross-strait military escalation; Taroko or Highway 9 closures; quake/typhoon on the east coast |
| D02 | Iraq | excluded | **excluded** | FCDO (18 Nov 26): all-but-essential for Baghdad, Najaf, Karbala, Dhi Qar, Kurdistan; against all for Sadr City and other areas · France (zones 1 Jul 26): red/orange zones on the route · NL (25 Jun 26): red/orange · US (22 Oct 26): **Level 4** | Every route region under all-but-essential or worse; regional strikes | Only if FCDO, France and NL all lift the route regions below all-but-essential |
| D03 | China — Yunnan | eligible | **eligible** | FCDO (27 Aug 26): none · France (zones 5 Mar 26): green except Xinjiang · NL (28 Aug 26): yellow · US (18 Oct 26): Level 2 (exit bans, wrongful detention) | Interior Yunnan only; Myanmar border strip avoided; US Level 2 risk is legal/administrative, not conflict | Myanmar spillover; new Yunnan access restrictions; exit-ban cases involving tourists |
| D04 | India — Northeast | eligible | **eligible** | FCDO (7 Oct 26): Manipur all-but-essential only · France (zones 23 Nov 26): no zone for Assam/Meghalaya; Myanmar border strongly advised against · NL (9 Sep 26): orange for Bangladesh/Myanmar/China border areas — defined as places needing an MHA permit — and Mizoram, Nagaland; red Manipur · US (15 Jun 25): Level 2; country text notes occasional insurgent bombings in the north-east | No stop needs an MHA permit; route avoids Manipur, Nagaland, Mizoram and the border belts; residual insurgent/bandh risk in Upper Assam | Any advisory naming Assam or Meghalaya; Upper Assam (ULFA-I) incidents; bandhs; Assam–Meghalaya boundary flare-ups |
| D05 | Algeria | conditional | **conditional** (on the excluded side) | FCDO (25 Sep 26): against all travel within 30 km of the Libya/Niger/Mali/Mauritania borders; heightened kidnap risk in remote desert and the southern/eastern border areas · France (zones 2 Mar 26): border zones red (width not stated), Sahara around Tamanrasset yellow with guide + escort · NL (30 Jul 26): red 50 km from Libya, 200 km from Niger/Mali/Mauritania · US (24 Aug 26): Level 2, but **Level 4 for areas near the eastern and southern borders, Illizi, Tamanrasset** … and remote Sahara without an organised tour | Djanet wilaya is not named by the US but belonged to Illizi until 2019 and the Tassili circuit runs about 55–90 km from Libya (approximate geometry), next to the Dutch 50 km red strip. The record had understated the US advice (corrected). Sources conflict (France/FCDO open with escort; US Level 4; Belgium "dangerous"), so the brief's definition of conditional applies; the northern Roman leg alone is unproblematic | **Exclude** if the US confirms Djanet within its Level 4, if any authority names Djanet, if the agency track enters the Dutch 50 km strip, or after any incident in Djanet/Tamanrasset |
| D06 | Saudi Arabia | excluded | **excluded** | FCDO (18 Nov 26): **all but essential travel to the whole country**; airport strikes · France (zones 13 Oct 26): red Yemen zone + Riyadh/Dammam airports, **orange rest of the country** · NL (22 Oct 26): orange · US (22 Oct 26): Level 3, ordered departure of US staff | Whole route under all-but-essential/orange; active Houthi/Iranian strikes on airports | FCDO and NL both lift the country-wide advice and airport attacks stop |
| D07 | Jordan | conditional | **conditional** | FCDO (18 Nov 26): against all travel only within 3 km of Syria; Iran-aligned groups "likely to continue" attacks; Karak church shooting 23 Oct, Amman stabbing 5 Nov · France (zones 22 Jul 26): **orange for Ma'an city, the border zone with the Palestinian territories, the north-east and Aqaba with its surroundings** (Iranian missile/drone fire since 17 Jul) · NL (8 Sep 26): yellow except Aqaba city and surroundings, Azraq, Mafraq, 10 km border strips · US (22 Oct 26): **Level 3** (terrorism and armed conflict) | The record had understated the French orange zones (corrected). Wadi Rum (Aqaba governorate) may fall inside "Aqaba et ses environs"; the day-4 Dead Sea float and Mount Nebo may fall inside the West Bank border zone; Desert Highway transits pass Ma'an. Combined with the US Level 3 for armed conflict this is "unresolved route restriction + conflicting advice + regional spillover" | **Exclude** if Iranian strikes on Jordan resume, if France confirms Wadi Rum/Dead Sea inside orange and the route cannot be adjusted, if FCDO/NL extend restrictions to Amman, Petra, Dana or Rum, or after any attack on tourists |
| D08 | Tunisia | eligible | **eligible** | FCDO (24 Jul 26): against all/all-but-essential only for western mountains, Kasserine, Algerian border strips (20 km south of Jendouba), Libyan border · France (zones 13 Mar 26): red/orange south and west, 5 km Algerian border in Jendouba/Kef · NL (17 Sep 26): red borders (2 km from Algeria), orange Tataouine–Remada line and Kasserine · US (20 May 26): Level 2; do not travel within 16 km of the Algerian (except Tabarka, Ain Draham) and Libyan borders | Bulla Regia (≈ 40 km), Tozeur (≈ 45 km) and Ong Jemel (≈ 25 km) are outside every strip; Sbeitla and the Tataouine side already removed | New zone near Tozeur/Douz/Medenine/Djerba; attack on a tourist site; Libyan border escalation |
| D09 | Egypt | conditional | **conditional** | FCDO (27 Oct 26): all-but-essential west of the Nile except named places incl. **"the oasis town of Siwa"** and the Marsa Matruh–Siwa road · France (zones 5 Mar 26): Siwa oasis zone yellow; desert around it orange/red · NL (19 Jun 26): western Egypt orange **except the town of Siwa** · US (23 Nov 26): Level 2; **Level 3 "reconsider" for the Western and Libyan Deserts** | The 4x4 dunes camp (days 7–8, 1–2 h by sand track) lies outside every Siwa exception and cannot be kept: it must be replaced by an oasis-based day (flagged in the record; itinerary rewrite left to A09/A00). Even then, Siwa town is under the US Level 3 for terrorism → conflicting advice → conditional. Cairo, Saqqara and Luxor/Dendera/Abydos are unrestricted | Remove the dunes camp first; reconsider eligibility only if the US lifts its Western Desert Level 3; switch to the Cairo–Faiyum–Luxor–Aswan variant if any authority restricts Siwa |
| D10 | Sri Lanka | eligible | **eligible** | FCDO (21 Sep 26): none · France (zones 12 Mar 26): whole country yellow · NL (14 Sep 26): yellow (fuel shortage) · US (13 Oct 25): Level 2 | No restricted region; north and east (mines) not on route | Unrest/curfews; fuel crisis; cyclone alerts |
| D11 | Laos | eligible | **eligible** | FCDO (19 Nov 26): Xaisomboun all-but-essential · France (zones 10 Mar 26): Myanmar border orange, rest yellow · NL (9 Sep 26): orange Xaysomboune and Myanmar border · US (27 Jul 26): Level 2; Level 3 Xaisomboun | Route avoids Xaisomboun (train replaces Route 13 north) and Bokeo/Myanmar border | Unrest spreading from Xaisomboun; haze; border closures |
| D12 | Vietnam | eligible | **eligible** | FCDO (21 Sep 26): none · France (zones 24 Mar 26): whole country yellow, no region advised against, northern border areas "sensitive" · NL (9 Sep 26): yellow · US (23 Jun 26): Level 1; country text: border areas may need local permits, detentions near the Chinese border have occurred | The Hà Giang/Bản Giốc permit is an administrative, fee-based regime handled by the operator, not a security restriction → not a conditional trigger. Stay on roads near the frontier | Official notice restricting foreign access to Đồng Văn/Mèo Vạc/Bản Giốc; landslide closures |
| D13 | Philippines — northern Palawan | conditional | **eligible** ⬆ | FCDO (15 Jul 26): against all travel W/C Mindanao and Sulu only · France (zones 11 Mar 26): red for W Mindanao and "la zone maritime de la **moitié sud** de Palawan jusqu'à l'archipel de Sulu" · NL (9 Sep 26, missing from the record — added): red W Mindanao, Sulu archipelago and the Sulu Sea waters **between Zamboanga, the Sulu islands, Palawan and eastern Malaysia** · US (31 Aug 26): Level 2; Level 4 **"Sulu Archipelago, including the southern Sulu Sea"** | Both open questions are answered by the full texts: the US zone is the *southern* Sulu Sea, France's is the *southern half* of Palawan, the Dutch polygon is the Sulu Sea between Palawan, Zamboanga, the Sulu islands and Sabah (hence its Tubbataha exception). El Nido (northern tip of Palawan) and Linapacan, Culion and Coron (Calamianes) are in the northern half of Palawan province, ≥ 170 km north of Puerto Princesa and > 400 km from Mindanao and the Sulu archipelago | Any zone extended north of Puerto Princesa or to the Cuyo/Calamian waters; any kidnapping or piracy in Palawan waters. *Note: still not rankable — material budget uncertainty (see budget review)* |
| D14 | Japan — Kyushu | eligible | **eligible** | FCDO (28 Aug 26): none · France (zones 9 Mar 26): no zone advised against (wildlife warnings) · NL (16 Nov 26): green (Fukushima zone red) · US (14 May 25): Level 1 | Natural hazards only (Aso, Shinmoedake, Sakurajima alert levels) | JMA alert level ≥ 4 on a route volcano; major earthquake |
| D15 | Ethiopia | excluded | **excluded** | FCDO (23 Nov 26): against all travel to Amhara and Tigray; all-but-essential incl. East Shewa, Arsi, East Borena · France (zones 30 Sep 26): **all of Amhara red**, Tigray red · NL (5 Nov 26): red north/west and Guji, orange centre/south/east · US (26 Aug 26): Level 3; Level 4 Amhara, Tigray, Oromia except Bishoftu and Bale Mountains NP | Northern circuit entirely in against-all-travel areas; Bale reachable only across Level 4 / all-but-essential Oromia | FCDO lifts Amhara; secure road access to Bale |
| D16 | Senegal | eligible | **eligible** | FCDO (15 Oct 26): none · France (zones 12 Mar 26; page 25 Nov 26): orange only Mali border zones, the Matam part of the Mauritanian border and Casamance borders · NL (1 Sep 26): orange Casamance borders and the **eastern and north-eastern** areas bordering Mali and Mauritania · US (30 Nov 25): Level 1 | Resolved: Djoudj (Dagana department, north-west, near Saint-Louis) is outside both the French Matam orange and the Dutch "east and north-east" orange | Any zone extended west along the Senegal River; JNIM activity moving west |
| D17 | South Africa — Western Cape | eligible | **eligible** | FCDO (5 Nov 26): none · France (zones 17 Mar 26): whole country yellow, named Cape Town districts to avoid (Cape Flats townships, Long Street at night, airport surroundings) · NL (27 Nov 26): yellow · US (26 May 25): Level 2 (crime, express kidnapping) | Only two authorities had been read; now four, all without route restrictions; violent crime is an ordinary risk handled by route design (no night driving, no townships without a guide) | Unrest, wildfire/flood closures, any advisory change |
| D18 | Guatemala | eligible | **eligible** | FCDO (16 Nov 26): all-but-essential only for the 5 km Mexican border strip and Huehuetenango towns; Izabal–Zacapa emergency · France (zones 16 Nov 26): orange 20 km Mexican strip (San Marcos, Huehuetenango), 20 km Honduran strip, **Guatemala City zones 6, 7, 12, 18 and Villa Nueva**; alert of 10 Sep 26: Fuego and Acatenango ascents banned · NL (18 Nov 26): yellow · US (11 Mar 26): **Level 3** (crime and cartel "terrorism"), Level 4 San Marcos, Huehuetenango, zone 18, Villa Nueva | US Level 3 is crime-driven and its terrorism designation is located in departments/zones the route avoids; US staff may visit Antigua, Atitlán and Tikal → ordinary-risk warning (consistent with §2). Acatenango is an access question, not a security one: the Acatenango municipality reopened the trails on 7 Aug 2026 (communiqué reported 10 Aug) while France's 10 Sep alert still lists a ban — keep the built-in Antigua fallback; Fuego stays closed | New Fuego alert; any restriction in Petén or Sacatepéquez; extension of the Izabal–Zacapa emergency |
| D19 | Mexico — Oaxaca | eligible | **eligible** (route tightened) | FCDO (24 Nov 26): Oaxaca not listed · France (zones 11 Mar 26): Chiapas orange except Tuxtla/San Cristóbal/Palenque site; **route 190 Oaxaca – Tehuantepec listed in full as orange** · NL (26 Nov 26): Oaxaca yellow · US (28 May 26): Level 2 | France lists route 190 from Oaxaca city with no valley exception, so the optional day-10 Mitla/Hierve el Agua variant (reached by route 190) was removed and the Cuajimoloyas access fixed to Hwy 175 (not the Teotitlán/Díaz Ordaz turn-off on 190). The base route was already outside every orange zone | Any Oaxaca valley or Sierra Norte zone added; frequent blockades on Hwy 175/135D; widening of the route 190 restriction |
| D20 | Chile — Atacama | eligible | **eligible** | FCDO (9 Nov 26): none · France (zones 5 Mar 26): yellow only Araucanía, Biobío, Los Lagos, Easter Island · NL (21 Aug 26, added): yellow; flood emergency in Tocopilla (coast, off route) · US (18 Aug 26, added): Level 2 | Only France and FCDO had been read; now four. Hazards: altitude, border landmines off marked tracks, Lascar | Any zone in Antofagasta; altiplanic storms closing high roads |

## 4. Priority cases in detail

**Jordan (D07).** The agent's conditional call stands, but for stronger reasons than recorded. France's Sécurité
page lists four orange zones, three of which touch the itinerary: Aqaba "et ses environs" (Wadi Rum village is in
Aqaba governorate, about 60 km by road from the city; the Dutch orange also covers "the city of Aqaba and the
surrounding area"), "la zone frontalière avec les territoires palestiniens" (the northern Dead Sea shore faces the
West Bank; width not stated) and Ma'an city (bypassed on the Desert Highway). Three restrictions were added to the
record: skip the Dead Sea float or use a southern access point; obtain written confirmation that Rum is outside the
French orange; daylight transit only through Ma'an. Consistency: Jordan, Saudi Arabia and Oman share the same US
Level 3 wording; Saudi Arabia is excluded because FCDO, France and NL put the *whole country* under
all-but-essential/orange, which is not the case for Jordan's route.

**Algeria (D05).** The US record was materially wrong: the official feed places Illizi, Tamanrasset and "areas near
the eastern and southern borders" at Level 4 for terrorism and kidnapping, not only Sahara travel outside a tour
group. FCDO separately states a heightened kidnap risk in remote desert near the Libyan border. Algeria remains
conditional only because France (the primary authority) keeps the Sahara yellow for organised, escorted trips and
FCDO restricts only 30 km — i.e. the sources conflict. It is the destination closest to exclusion; reclassification to
excluded would require converting the itinerary to `informational` (validator rule), a decision for A00.

**Egypt (D09).** All four readable authorities agree that *Siwa town* is the limit: FCDO's exception list names "the
oasis town of Siwa", the Dutch orange excepts "de stad Siwa", France rates the oasis zone yellow and the surrounding
desert orange or red. The dunes camp is therefore inside all-but-essential/orange areas and is flagged in
`security.regionalRestrictions`. Because the US now asks travellers to reconsider travel to the Western and Libyan
Deserts (23 Nov 2026), Siwa itself stays conditional even after the camp is removed.

**Philippines (D13).** Reclassified eligible — see table. The record lacked the Dutch advice; it is now added.

**Senegal (D16), Vietnam (D12), Guatemala (D18), Mexico (D19).** Resolved as described in the table: Djoudj is
outside both orange zones; the Vietnamese permit is administrative; Acatenango reopened locally but France's alert is
contradictory (fallback kept); the Mexico option on route 190 was removed.

**Saudi Arabia, Iraq, Ethiopia.** Exclusion confirmed by all four readable authorities (and strengthened: France now
read as orange for all of Saudi Arabia and red for all of Amhara).

**Single-authority eligibles.** South Africa and Chile each had only France + FCDO or FCDO + NL read; both now have
four authorities, none restricting the route. China, Japan, Taiwan, Vietnam and India now have the France level filled
in from the Sécurité text.

## 5. Limits and open points

- Smartraveller could not be reached; its levels in D07, D09, D13 and D15 remain search-snippet readings and are
  labelled as not re-verified.
- France's zone texts for several countries are dated March 2026 (the pages say "information toujours valable à la
  date du jour"); the maps were not downloaded as PDFs because the text carries the same zone list.
- Distances to borders (Algeria, Tunisia, Jordan) are A21 approximations from coordinates, not surveyed figures.
- All statuses must be re-checked before booking and two weeks before departure (every record says so).
