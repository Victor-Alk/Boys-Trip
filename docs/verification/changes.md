# A21 change log — destination data corrections

Verification agent A21, 27 November 2026. Every edit made to `data/destinations/*.json` is listed below with the field, the old value, the new value, the reason and the source actually read. Values are quoted in full. Files were rewritten with their original indentation (D01 and D08 were normalised to 2-space JSON; content otherwise unchanged). After the edits `npm run validate` passes for all 20 files (remaining warnings are pre-existing: D06 and D20 above €2,500; D10 economical-only self-drive lines non-monotonic by design) and `npx vitest run` passes 163/163.

Versioning: D13 (security reclassification) and D19 (itinerary change) → 1.1.0; all other files → 1.0.1. `lastUpdated` = 2026-11-27 everywhere. No budget amount, flight price, contingency or scenario quantity was changed; budget totals are identical before and after (see `budget-review.md`).

Source shorthand: **US data feed** = `https://cadataapi.state.gov/api/TravelAdvisories` (official State Department advisory feed, read 27 Nov 2026; the travel.state.gov pages return HTTP 403 to automated clients). **France Sécurité** = `https://www.diplomatie.gouv.fr/fr/information-par-pays/<pays>/conseils-aux-voyageurs-securite` (zone text read in full). Smartraveller (smartraveller.gov.au) could not be reached at all on 27 Nov 2026 (TCP connection failure and WebFetch timeout); no Smartraveller level was changed or added.

## Summary of changes

| File | Version | Logged edits | Nature |
|---|---|---|---|
| D01-taiwan.json | 1.0.0 → 1.0.1 | 8 | France level read (green); US Level 1 added |
| D02-iraq.json | 1.0.0 → 1.0.1 | 4 | US Level 4 re-read from official feed |
| D03-china.json | 1.0.0 → 1.0.1 | 12 | France level read (green); US level re-read |
| D04-india.json | 1.0.0 → 1.0.1 | 11 | France zones read; US level + north-east note; Dutch border-strip definition |
| D05-algeria.json | 1.0.0 → 1.0.1 | 9 | US advisory corrected (Illizi/Tamanrasset/eastern border at Level 4); FCDO kidnap text; summary/reassessment |
| D06-saudi-arabia.json | 1.0.0 → 1.0.1 | 7 | France level read (orange country-wide); US Level 3 added |
| D07-jordan.json | 1.0.0 → 1.0.1 | 17 | France orange zones corrected (Aqaba, Ma'an, West Bank border zone); US Level 3 date/text; route restrictions added |
| D08-tunisia.json | 1.0.0 → 1.0.1 | 6 | US level re-read |
| D09-egypt.json | 1.0.0 → 1.0.1 | 19 | France/FCDO/NL/US Western Desert wording corrected; dunes camp flagged as non-compliant |
| D10-sri-lanka.json | 1.0.0 → 1.0.1 | 4 | US level re-read |
| D11-laos.json | 1.0.0 → 1.0.1 | 6 | US level re-read; travel window aligned with rationale and flight dates |
| D12-vietnam.json | 1.0.0 → 1.0.1 | 10 | France level read; US level + border-permit note |
| D13-philippines.json | 1.0.0 → 1.1.0 | 20 | Security conditional → eligible; NL advisory added; material budget uncertainty set to true |
| D14-japan.json | 1.0.0 → 1.0.1 | 11 | France level read; US level re-read |
| D15-ethiopia.json | 1.0.0 → 1.0.1 | 8 | France level read (Amhara red); US Level 3/4 added |
| D16-senegal.json | 1.0.0 → 1.0.1 | 8 | Djoudj border-zone question resolved; US level re-read |
| D17-south-africa.json | 1.0.0 → 1.0.1 | 8 | France level read (yellow); US Level 2 added |
| D18-guatemala.json | 1.0.0 → 1.0.1 | 11 | France orange zones read; US Level 3 added; Acatenango reopening source; city-zone restriction |
| D19-mexico.json | 1.0.0 → 1.1.0 | 24 | Optional Mitla/Hierve el Agua day removed (route 190 orange); Hwy 175 access; US level re-read |
| D20-chile.json | 1.0.0 → 1.0.1 | 5 | Netherlands and US advisories added |

## D01-taiwan.json

1. **`sources[+S18]`**  
   - old: —  
   - new: France Diplomatie: Taiwan, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Page last updated 4 Nov 2026; text shows typhoon, drug-penalty and El Nino notices; the colour of the security map zones could not be read in the fetch  
   - new: Vigilance normale (green) for the whole territory (zone text updated 13 Mar 2026; security page read 27 Nov 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite
3. **`security.advisories.0.routeImpact`**  
   - old: No route-specific restriction found in the readable text; manual check of the map required.  
   - new: None.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite
4. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S18  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite
5. **`sources[+S19]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Taiwan <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 1: Exercise normal precautions (updated 24 Nov 2025)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.summary`**  
   - old: No UK warnings, Dutch advice green and no restrictions found for the east-coast and Tainan route. France Diplomatie's zone map colours could not be read from the fetched page and must be checked manually. Ordinary risks are earthquakes, mountain road closures and heavy rain.  
   - new: No UK warnings, Dutch advice green and no restrictions found for the east-coast and Tainan route. France Diplomatie places the whole territory in normal vigilance and the US rates Taiwan Level 1 (both read by A21 on 27 Nov 2026). Ordinary risks are earthquakes, mountain road closures and heavy rain.  
   - reason: France colour now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/taiwan/conseils-aux-voyageurs-securite
8. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D02-iraq.json

1. **`sources[+S11]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Iraq <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
2. **`security.advisories.3.level`**  
   - old: Level 4 Do Not Travel  
   - new: Level 4: Do Not Travel, for any reason, Kurdistan Region included (updated 22 Oct 2026; read via the State Department data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.3.sourceId`**  
   - old: S04  
   - new: S11  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D03-china.json

1. **`sources[+S24]`**  
   - old: —  
   - new: France Diplomatie: China, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
2. **`security.advisories.1.level`**  
   - old: Page updated 16 Nov 2026; vigilance colour not readable (map image); no formally advised-against zone for Yunnan visible in text  
   - new: Vigilance normale (green) for mainland China except Xinjiang (yellow); zone text updated 5 Mar 2026, security page read 27 Nov 2026  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
3. **`security.advisories.1.regionsAffected`**  
   - old: Gyirong district (Tibet) flood alert only  
   - new: Xinjiang (yellow); ad hoc access restrictions possible anywhere  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
4. **`security.advisories.1.routeImpact`**  
   - old: No visible conflict with route; re-verify colour map  
   - new: No restriction on the Yunnan route.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
5. **`security.advisories.1.sourceId`**  
   - old: S05  
   - new: S24  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
6. **`sources[+S25]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: China <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.4.level`**  
   - old: Level 2 - Exercise Increased Caution (via search snippets; page blocked)  
   - new: Level 2: Exercise increased caution (arbitrary law enforcement, exit bans, wrongful detention); updated 18 Oct 2026, read via the State Department data feed  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.4.sourceId`**  
   - old: S08  
   - new: S25  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.summary`**  
   - old: The reviewed advice shows no 'against all travel' or 'all but essential' warning for the Yunnan interior route. Main concerns are arbitrary detention/exit-ban warnings, spillover near the Myanmar border (avoided), and road safety. France's vigilance colour could not be read, so this should be re-verified.  
   - new: The reviewed advice shows no 'against all travel' or 'all but essential' warning for the Yunnan interior route. Main concerns are arbitrary detention/exit-ban warnings, spillover near the Myanmar border (avoided), and road safety. France Diplomatie rates mainland China green apart from Xinjiang (read 27 Nov 2026).  
   - reason: France colour now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
10. **`security.reassessmentRequired`**  
   - old: Re-check all advisories before booking and two weeks before departure; triggers: spillover from Myanmar, exit-ban incidents involving foreign tourists, new restrictions on Yunnan, France colour map.  
   - new: Re-check all advisories before booking and two weeks before departure; triggers: spillover from Myanmar, exit-ban incidents involving foreign tourists, new restrictions on Yunnan, any change to the France zone text.  
   - reason: France colour now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
11. **`uncertainties.1`**  
   - old: France Diplomatie colour for the route and any change after November 2026  
   - new: Any change to France Diplomatie zone text after November 2026 (read on 27 Nov 2026: green for Yunnan)  
   - reason: France colour now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/chine/conseils-aux-voyageurs-securite
12. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D04-india.json

1. **`sources[+S20]`**  
   - old: —  
   - new: France Diplomatie: India, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite
2. **`security.advisories.2.level`**  
   - old: Page updated 23 Nov 2026; regional vigilance map not retrievable in this session  
   - new: No orange or red zone named for Assam or Meghalaya; Kashmir valley and Pakistan border red, Indo-Myanmar border "fortement déconseillé"; north-east described as sometimes unstable (zone text updated 23 Nov 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite
3. **`security.advisories.2.regionsAffected`**  
   - old: Not assessed for Northeast  
   - new: Kashmir, Pakistan border, Myanmar border, Manipur  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite
4. **`security.advisories.2.routeImpact`**  
   - old: Requires recheck of the France 'sécurité' page before booking; satellite devices and GPS devices banned  
   - new: None on the Meghalaya–Assam route; keep away from the Myanmar border.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite
5. **`security.advisories.2.sourceId`**  
   - old: S05  
   - new: S20  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/inde/conseils-aux-voyageurs-securite
6. **`sources[+S21]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: India <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.4.level`**  
   - old: Level 2 for India; Manipur Level 4; caution in the Northeast (search summary; page fetch returned 403)  
   - new: Level 2: Exercise increased caution (updated 15 Jun 2025; data feed). Country information: occasional insurgent bombings in the north-east; avoid night trains and rural travel at night  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.4.routeImpact`**  
   - old: Route avoids Manipur; Northeast caution noted  
   - new: No route region at Level 3 or 4 in the feed; follow the no-night-travel advice in Assam.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.4.sourceId`**  
   - old: S08  
   - new: S21  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`security.advisories.1.routeImpact`**  
   - old: Route avoids Nagaland and Mizoram and stays away from the Bangladesh and China border areas; strip width is undefined, so the buffer is a precaution  
   - new: Route avoids Nagaland and Mizoram and stays away from the Bangladesh and China border areas; strip width is undefined, so the buffer is a precaution The Dutch text ties the Bangladesh-border orange to places that need an Indian Ministry of Home Affairs permit (re-read 27 Nov 2026); no stop on the route needs one.  
   - reason: Dutch wording re-read  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/india
11. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D05-algeria.json

1. **`sources[+S19]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Algeria <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
2. **`security.advisories.4.level`**  
   - old: Level 2 overall; Sahara overland travel and border crossings Level 4 outside an organised tour group (as reported in a search summary, page not fetchable)  
   - new: Level 2 overall; Level 4 Do Not Travel for areas near the eastern and southern borders, Bordj Badji Mokhtar, Illizi, In Guezzam, In Salah, Tamanrasset, the Tebessa mountains and Tindouf, and for remote Sahara areas without an organised tour (updated 24 Aug 2026; data feed)  
   - reason: Factual correction: the US Level 4 list names Illizi, Tamanrasset and "areas near the eastern and southern borders", not only travel outside tour groups. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.4.regionsAffected`**  
   - old: Southern desert near Mali, Niger and Libya  
   - new: Eastern (Libya) and southern border areas; Illizi and Tamanrasset; remote Sahara  
   - reason: Factual correction: the US Level 4 list names Illizi, Tamanrasset and "areas near the eastern and southern borders", not only travel outside tour groups. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`security.advisories.4.routeImpact`**  
   - old: Travel with an organised agency group is consistent with the advice; a US-specific restriction on government staff applies.  
   - new: Djanet wilaya is not named, but it belonged to Illizi until 2019 and the Tassili circuit lies near the eastern border: the Saharan leg is very probably inside the US Level 4 area. This is the strongest conflict in the official advice.  
   - reason: Factual correction: the US Level 4 list names Illizi, Tamanrasset and "areas near the eastern and southern borders", not only travel outside tour groups. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
5. **`security.advisories.4.sourceId`**  
   - old: S07  
   - new: S19  
   - reason: Factual correction: the US Level 4 list names Illizi, Tamanrasset and "areas near the eastern and southern borders", not only travel outside tour groups. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.advisories.1.routeImpact`**  
   - old: Djanet is about 64 km from Libya by an approximate map calculation and is outside the strip; the Tassili circuit approaches it and needs a track check.  
   - new: Djanet is about 64 km from Libya by an approximate map calculation and is outside the strip; the Tassili circuit approaches it and needs a track check. FCDO also states a heightened risk of kidnap in remote desert areas, particularly the southern and eastern border areas (re-read 27 Nov 2026).  
   - reason: FCDO terrorism text re-read  
   - source: https://www.gov.uk/foreign-travel-advice/algeria/safety-and-security
7. **`security.summary`**  
   - old: No official source puts Djanet or the Tassili plateau in an orange or red zone, but the southern leg sits close to the Libyan border strip, a tourist was killed in Djanet in October 2024, a Spanish tourist was kidnapped near Tamanrasset in January 2025, and the entire Sahara is subject to escort rules. The original Roman programme (Timgad, Djémila) was removed because France lists Batna and Sétif wilayas as orange.  
   - new: No official source puts Djanet or the Tassili plateau in an orange or red zone, but the southern leg sits close to the Libyan border strip, a tourist was killed in Djanet in October 2024, a Spanish tourist was kidnapped near Tamanrasset in January 2025, and the entire Sahara is subject to escort rules. The original Roman programme (Timgad, Djémila) was removed because France lists Batna and Sétif wilayas as orange. A21 (27 Nov 2026): the US places Illizi, Tamanrasset and areas near the eastern border at Level 4 (Do Not Travel) for terrorism and kidnapping, so the Saharan leg sits on the excluded side of conditional; only France (yellow, organised trips with escort) and the FCDO 30 km strip leave it open.  
   - reason: US Level 4 wording read in full  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.reassessmentRequired`**  
   - old: Re-check all advisories before booking and two weeks before departure. Reassess if: the agency's GPS route enters the 50 km Libyan strip or the 200 km Niger strip; any incident in Djanet or Tamanrasset; France or FCDO change Illizi or Djanet; Libya/Niger border conditions change; insurer declines cover. The route would then become excluded.  
   - new: Re-check all advisories before booking and two weeks before departure. Reassess if: the agency's GPS route enters the 50 km Libyan strip or the 200 km Niger strip; any incident in Djanet or Tamanrasset; France or FCDO change Illizi or Djanet; Libya/Niger border conditions change; insurer declines cover. The route would then become excluded. Reclassify as excluded if the State Department confirms that its Level 4 for Illizi and the eastern border covers Djanet wilaya, or if any other authority names Djanet.  
   - reason: US Level 4 wording read in full  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D06-saudi-arabia.json

1. **`sources[+S12]`**  
   - old: —  
   - new: France Diplomatie: Saudi Arabia, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/arabie-saoudite/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/arabie-saoudite/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Formal advice against travel to Najran, Abha, Khamis Mushait and Jizan, and against travelling to or transiting Riyadh King Khalid and Dammam King Fahd airports (page updated 20 Nov 2026). Colour code not read.  
   - new: Red: Yemen border zone to about 100 km (Najran, Abha, Khamis Mushait, Jizan) and transit via Riyadh and Dammam airports; rest of the country orange, déconseillé sauf raison impérative (zone text 13 Oct 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/arabie-saoudite/conseils-aux-voyageurs-securite
3. **`security.advisories.0.routeImpact`**  
   - old: Arrival airport Riyadh is covered; Jeddah is not named by the page text read.  
   - new: Every part of the route is orange; the arrival airport is red.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/arabie-saoudite/conseils-aux-voyageurs-securite
4. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S12  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/arabie-saoudite/conseils-aux-voyageurs-securite
5. **`sources[+S13]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Saudi Arabia <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 3: Reconsider travel; ordered departure of non-emergency US government staff from 23 Oct 2026 (updated 22 Oct 2026; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D07-jordan.json

1. **`sources[+S22]`**  
   - old: —  
   - new: France Diplomatie: Jordan, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Vigilance renforcee (Iranian missile/drone alert); Azraq and Mafraq 'fortement deconseille'; Aqaba 'vigilance particuliere'. Exact map colours not readable on the fetched page.  
   - new: Orange (déconseillé sauf raison impérative): Ma'an city, the strip next to the Syria/Iraq red zone, the border zone with the Palestinian territories, the north-east and Aqaba with its surroundings (Iranian missile and drone fire since 17 July); red: Syria and Iraq borders. Zone text 22 Jul 2026, page 30 Oct 2026  
   - reason: Factual correction: the France record understated the orange zones (Aqaba is orange, not "vigilance particulière"; Ma'an city and the Palestinian-territories border zone are also orange). France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
3. **`security.advisories.0.regionsAffected`**  
   - old: Azraq, Mafraq (north-east); Aqaba (south)  
   - new: Ma'an city; Jordan Valley/Dead Sea border zone with the West Bank (width not stated); north-east incl. Azraq/Mafraq; Aqaba and surroundings  
   - reason: Factual correction: the France record understated the orange zones (Aqaba is orange, not "vigilance particulière"; Ma'an city and the Palestinian-territories border zone are also orange). France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
4. **`security.advisories.0.routeImpact`**  
   - old: Route avoids Azraq, Mafraq and Aqaba; shelter instructions apply everywhere if sirens sound.  
   - new: Unresolved: Wadi Rum (Aqaba governorate) may fall within 'Aqaba et ses environs'; the Dead Sea float and Mount Nebo on day 4 may fall within the West Bank border zone; the Desert Highway passes Ma'an city (no stop).  
   - reason: Factual correction: the France record understated the orange zones (Aqaba is orange, not "vigilance particulière"; Ma'an city and the Palestinian-territories border zone are also orange). France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
5. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S22  
   - reason: Factual correction: the France record understated the orange zones (Aqaba is orange, not "vigilance particulière"; Ma'an city and the Palestinian-territories border zone are also orange). France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
6. **`sources[+S23]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Jordan <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.3.level`**  
   - old: Level 3 Reconsider Travel (search-snippet reading, dated 29 Aug 2026; page itself returned HTTP 403). Reported do-not-travel: Syria/Iraq borders, Rusayfah; reconsider Ma'an and Zarqa.  
   - new: Level 3: Reconsider travel (terrorism and armed conflict), updated 22 Oct 2026, read via the State Department data feed. Do not travel: Syria/Iraq borders, Ruwayshid, Mansheyat al Ghayyath, refugee camps, Rusayfah, Baqa'a  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.3.regionsAffected`**  
   - old: Country-wide level; specific zones as stated  
   - new: Country-wide Level 3; heightened risk in Zarqa, Ma'an city and Ma'an Governorate east of Highway 15 or within 2 km west of it  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.3.routeImpact`**  
   - old: Desert Highway passes Ma'an - do not stop there.  
   - new: The Desert Highway (Highway 15) legs on days 9 and 11 run through the heightened-risk Ma'an strip: daylight transit only, no stops.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`security.advisories.3.sourceId`**  
   - old: S05  
   - new: S23  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
11. **`security.advisories.4.level`**  
   - old: Reconsider your need to travel (search listing dated 2 Sept 2026; live page timed out).  
   - new: Reconsider your need to travel (search listing dated 2 Sept 2026; live page timed out). Not re-verified by A21: smartraveller.gov.au was unreachable on 27 Nov 2026 (connection failure).  
   - reason: Record what was actually read  
   - source: https://www.smartraveller.gov.au/destinations/middle-east/jordan
12. **`security.summary`**  
   - old: Conditional, close to the excluded line. The Amman-Petra-Wadi Rum-Dana route is outside the areas under 'all travel' (FCDO: within 3 km of the Syria border) and outside the Dutch orange zones (Aqaba, Azraq, Mafraq, border strips), and France's 'fortement deconseille' covers only Azraq/Mafraq. But official advice conflicts (US and Australia: reconsider travel; FCDO and Netherlands: no restriction on the route), Iran has repeatedly fired missiles and drones at Jordan in 2026 (latest dated attack 9 Sept), the US-Iran truce is described as fragile, and two lethal attacks occurred in October-November 2026 (Karak church, Amman).  
   - new: Conditional, close to the excluded line. Re-read on 27 Nov 2026: France Diplomatie lists Aqaba and its surroundings, the north-east, Ma'an city and the border zone with the Palestinian territories as orange (Iranian missile and drone fire since 17 July 2026); the US is at Level 3 for terrorism and armed conflict; FCDO restricts only 3 km along the Syrian border and the Netherlands is yellow outside Aqaba, Azraq, Mafraq and the border strips. Two route elements are unresolved against the French orange zones (Wadi Rum near Aqaba; the Dead Sea float and Mount Nebo near the West Bank border zone), and two lethal attacks occurred in October–November 2026 (Karak-area church, Amman).  
   - reason: France orange zones and US level re-read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
13. **`security.regionalRestrictions[+]`**  
   - old: —  
   - new: Dead Sea: skip the day-4 float or use a southern access point opposite Israel, not the northern shore facing the West Bank, until France confirms the extent of its orange 'zone frontalière avec les territoires palestiniens'.  
   - reason: Route elements touching France orange zones  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
14. **`security.regionalRestrictions[+]`**  
   - old: —  
   - new: Wadi Rum: confirm in writing with the French embassy (or wait for a narrower map) that Rum village is outside the orange 'Aqaba et ses environs'; the Dutch orange also covers Aqaba and its surrounding area.  
   - reason: Route elements touching France orange zones  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
15. **`security.regionalRestrictions[+]`**  
   - old: —  
   - new: Desert Highway: daylight transit only through Ma'an Governorate; no stop in Ma'an city (France orange; US heightened-risk strip along Highway 15).  
   - reason: Route elements touching France orange zones  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
16. **`security.reassessmentRequired`**  
   - old: Re-check all five advisories before booking and two weeks before departure. Reclassify to excluded if: Iranian strikes on Jordan resume or the US-Iran truce collapses; FCDO or Dutch advice extends 'all but essential' to Petra, Wadi Rum, Dana or Amman; any further attack on tourists or tourist sites; Jordanian airspace closes for extended periods; or insurers refuse cover.  
   - new: Re-check all five advisories before booking and two weeks before departure. Reclassify to excluded if: Iranian strikes on Jordan resume or the US-Iran truce collapses; FCDO or Dutch advice extends 'all but essential' to Petra, Wadi Rum, Dana or Amman; any further attack on tourists or tourist sites; Jordanian airspace closes for extended periods; or insurers refuse cover. Also reclassify to excluded if France confirms that its orange zones include Wadi Rum or the Dead Sea shore used by the route and the route cannot be adjusted.  
   - reason: France orange zones re-read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/jordanie/conseils-aux-voyageurs-securite
17. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D08-tunisia.json

1. **`sources[+S18]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Tunisia <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
2. **`security.advisories.3.level`**  
   - old: Level 2 (exercise increased caution), issued 21 May 2026 per a search snippet; the official page returned HTTP 403, so Do Not Travel areas were not confirmed  
   - new: Level 2: Exercise increased caution (updated 20 May 2026; data feed). Do not travel: within 16 km of the Algerian border (except Tabarka and Ain Draham) and of the Libyan border, the Chaambi, Salloum, Sammamma, Mghila and Orbata mountains, the desert south of Remada  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.3.regionsAffected`**  
   - old: Borders and Chaambi (secondary reports)  
   - new: Algerian and Libyan border strips (16 km), western mountains, desert south of Remada  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`security.advisories.3.routeImpact`**  
   - old: Consistent with the avoided areas; not independently confirmed.  
   - new: Consistent with the avoided areas: Bulla Regia (≈ 40 km), Tozeur (≈ 45 km) and Ong Jemel (≈ 25 km) are outside the 16 km strip.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
5. **`security.advisories.3.sourceId`**  
   - old: S07  
   - new: S18  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D09-egypt.json

1. **`sources[+S15]`**  
   - old: —  
   - new: France Diplomatie: Egypt, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Desert zone towards the Libyan border: formellement déconseillé (red). Exception: Cairo–Farafra–El Kharga triangle (White Desert), 'vigilance renforcée'. Zone south of Siwa closed to civilians and vehicles. Page updated 21 Sep 2026; vigilance map 5 Mar 2026. The map colour for Siwa itself could not be read from the text.  
   - new: Yellow (vigilance renforcée) for the oasis zone of Siwa reached by the secured road; orange for the desert between the forbidden military zone and the south and west of Marsa Matruh; red for the desert towards the Libyan border and the zone south of Siwa (zone text 5 Mar 2026, page 21 Sep 2026)  
   - reason: Factual correction: the Siwa oasis zone is yellow, the desert around it orange or red. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite
3. **`security.advisories.0.routeImpact`**  
   - old: Siwa oasis zone is described as compatible with tourism with reinforced vigilance; any off-road desert movement beyond permitted oasis zones is not recommended. Colour for Siwa to be confirmed on the live map.  
   - new: Siwa oasis is acceptable with reinforced vigilance; the 4x4 dunes camp outside the oasis (days 7–8) would be in the orange or red desert.  
   - reason: Factual correction: the Siwa oasis zone is yellow, the desert around it orange or red. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite
4. **`security.advisories.0.sourceId`**  
   - old: S03  
   - new: S15  
   - reason: Factual correction: the Siwa oasis zone is yellow, the desert around it orange or red. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite
5. **`security.advisories.1.level`**  
   - old: Against all travel within 20 km of the Egypt–Libya border (El Salloum: all but essential). Against all but essential travel to the area west of the Nile Valley and Delta, EXCEPT Siwa, Bahariya, Farafra, Dakhla, Kharga, the White and Black Deserts, Marsa Matruh–Siwa road, Luxor, Aswan, Abu Simbel. Against all but essential travel on the Bahariya (Al Bawiti)–Siwa road. Still current at 27 Nov 2026 (updated 27 Oct 2026).  
   - new: Against all travel within 20 km of the Libyan border; against all but essential travel to the area west of the Nile Valley and Delta EXCEPT named places including the Marsa Matruh–Siwa road and the oasis town of Siwa; against all but essential travel on the Bahariya–Siwa road (updated 27 Oct 2026)  
   - reason: Factual correction: the FCDO exception is "the oasis town of Siwa" and the Marsa Matruh–Siwa road, not the surrounding desert.  
   - source: https://www.gov.uk/foreign-travel-advice/egypt/warnings-and-insurance
6. **`security.advisories.1.routeImpact`**  
   - old: Route reaches Siwa via the Marsa Matruh road (named exception) and avoids the Bahariya–Siwa road; Siwa is about 50 km from the border, outside the 20 km zone. Off-road travel requires a qualified guide and Ministry of Interior permit.  
   - new: Siwa town and the Marsa Matruh road are named exceptions; a desert camp 1–2 h by sand track outside the town is not covered by the exception and falls under all-but-essential advice.  
   - reason: Factual correction: the FCDO exception is "the oasis town of Siwa" and the Marsa Matruh–Siwa road, not the surrounding desert.  
   - source: https://www.gov.uk/foreign-travel-advice/egypt/warnings-and-insurance
7. **`security.advisories.2.routeImpact`**  
   - old: Route stays on the yellow Nile Valley and Cairo side, plus Siwa town (excluded from orange). Camp excursions leave the town; their position relative to the orange line cannot be verified.  
   - new: Dutch orange covers western Egypt except the town of Siwa (reached by secured Highway 19), re-read 27 Nov 2026: the dunes camp outside the town is in the orange zone.  
   - reason: Dutch wording re-read  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/egypte
8. **`sources[+S16]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Egypt <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.3.authority`**  
   - old: US State Department (via OSAC summary)  
   - new: US Department of State  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`security.advisories.3.level`**  
   - old: Level 2: Exercise Increased Caution; Do Not Travel for Northern and Middle Sinai (terrorism). Earlier embassy alerts (March 2026, secondary) also referred to parts of the Western Desert. travel.state.gov returned HTTP 403 so the official page was not read.  
   - new: Level 2 overall; Level 3 Reconsider travel to the Western and Libyan Deserts; Level 4 for the Libyan and Sudan border regions and Central/Northern Sinai (updated 23 Nov 2026; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
11. **`security.advisories.3.regionsAffected`**  
   - old: Northern and Middle Sinai; parts of the Western Desert  
   - new: Western and Libyan Deserts (Siwa included); Libyan and Sudan borders; Sinai  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
12. **`security.advisories.3.routeImpact`**  
   - old: Route avoids Sinai. Western Desert wording not directly verified.  
   - new: Siwa itself lies in the US "reconsider" desert area: a conflict with FCDO and France that keeps the route conditional even without the dunes camp.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
13. **`security.advisories.3.sourceId`**  
   - old: S05  
   - new: S16  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
14. **`security.advisories.4.level`**  
   - old: Not retrieved: page fetch timed out. Search-result summary: Egypt 'Exercise a high degree of caution'; a reported ban on safaris and camping near Bahariya Oasis until further notice (unverified).  
   - new: Not retrieved: page fetch timed out. Search-result summary: Egypt 'Exercise a high degree of caution'; a reported ban on safaris and camping near Bahariya Oasis until further notice (unverified). Not re-verified by A21: smartraveller.gov.au unreachable on 27 Nov 2026.  
   - reason: Record what was actually read  
   - source: https://www.smartraveller.gov.au/destinations/africa/egypt
15. **`security.summary`**  
   - old: The redesigned route (Cairo area, Siwa via the Alexandria–Marsa Matruh road, Luxor and Upper Egypt) avoids the areas under UK 'against all travel' advice and Netherlands red, but the Western Desert advice differs between governments (France and the UK name Siwa and the oases as tolerable; the Netherlands marks 'western Egypt' orange apart from Siwa town; one search-sourced item reports a ban on safaris and camping near Bahariya). Siwa lies about 50 km from the Libyan border with an alleged infiltration and kidnapping risk, and desert excursions depend on permits that cannot be pre-verified. Bahariya, the White and Black Deserts and the Bahariya–Siwa road were removed from the plan.  
   - new: Conditional. Re-read on 27 Nov 2026: FCDO and the Netherlands except only the oasis town of Siwa (and its access road) from their all-but-essential/orange Western Desert advice, France rates the Siwa oasis zone yellow but the surrounding desert orange or red, and the US asks travellers to reconsider travel to the Western and Libyan Deserts (Level 3). The 4x4 dunes camp on days 7–8 lies outside the Siwa exceptions and cannot be kept under the group's rules; the classification applies to the route with that night replaced by an oasis-based day. Even then Siwa remains conditional because the US and European advice conflict.  
   - reason: Western Desert wording re-read from four authorities  
   - source: https://www.gov.uk/foreign-travel-advice/egypt/warnings-and-insurance
16. **`security.regionalRestrictions[+]`**  
   - old: —  
   - new: Days 7–8 (licensed 4x4 dunes camp outside Siwa town) are in FCDO all-but-essential and Dutch orange areas: replace with a second Siwa-oasis day (Gebel Dakrour, Fatnas, salt lakes by bicycle or local driver) before any reassessment.  
   - reason: Route element inside all-but-essential/orange areas  
   - source: https://www.gov.uk/foreign-travel-advice/egypt/warnings-and-insurance
17. **`security.reassessmentRequired`**  
   - old: Re-check all five advisories before booking and two weeks before departure, especially the Western Desert wording, the Siwa colour on the French map, the Smartraveller Bahariya statement, Ramadan/Eid logistics, and Libya or Gaza escalation. If Siwa becomes red, orange or all-but-essential on any list, switch to the Cairo–Fayoum–Luxor–Aswan variant.  
   - new: Re-check all five advisories before booking and two weeks before departure, especially the Western Desert wording, the Siwa colour on the French map, the Smartraveller Bahariya statement, Ramadan/Eid logistics, and Libya or Gaza escalation. If Siwa becomes red, orange or all-but-essential on any list, switch to the Cairo–Fayoum–Luxor–Aswan variant. Before reassessment, the dunes camp must be removed from the plan (A09/A00); reconsider eligibility only if the US lifts its Level 3 for the Western Desert.  
   - reason: Western Desert wording re-read  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
18. **`uncertainties.0`**  
   - old: Siwa colour on the French map and exact Smartraveller wording.  
   - new: Whether the US Level 3 for the Western and Libyan Deserts eases; the dunes camp is incompatible with FCDO and Dutch advice as read on 27 Nov 2026.  
   - reason: France colour now read; dunes camp outside exceptions  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/egypte/conseils-aux-voyageurs-securite
19. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D10-sri-lanka.json

1. **`sources[+S31]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Sri Lanka <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
2. **`security.advisories.3.level`**  
   - old: Level 2: Exercise Increased Caution (issued 14 Oct 2025; via search summary, page returned 403)  
   - new: Level 2: Exercise increased caution (civil unrest, terrorism, landmines); updated 13 Oct 2025, read via the State Department data feed  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.3.sourceId`**  
   - old: S07  
   - new: S31  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D11-laos.json

1. **`sources[+S24]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Laos <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
2. **`security.advisories.3.level`**  
   - old: Level 2 overall; Level 3 'Reconsider travel' for Xaisomboun Province (as reported in search results; page returned 403 and was not read directly)  
   - new: Level 2 overall; Level 3 Reconsider travel to Xaisomboun Province; increased caution for crime and UXO in Khammouane, Luang Prabang and Vientiane provinces (updated 27 Jul 2026; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.3.routeImpact`**  
   - old: None: route avoids it. Not read first-hand.  
   - new: None beyond ordinary crime and UXO precautions: route avoids Xaisomboun.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`security.advisories.3.sourceId`**  
   - old: S06  
   - new: S24  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
5. **`recommendedTravelWindow.window`**  
   - old: 6-19 February 2027 (or the last week of January through mid-February)  
   - new: 10–23 February 2027 (start around 10–12 February, after the Lunar New Year peak; the last week of January to mid-February also works)  
   - reason: Internal inconsistency: the window said 6–19 Feb (starting on Lunar New Year day) while the rationale, the research note and the flight dates (10–23 Feb) recommend starting around 10 Feb  
   - source: docs/research/D11-laos.md (February section)
6. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D12-vietnam.json

1. **`sources[+S25]`**  
   - old: —  
   - new: France Diplomatie: Vietnam, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite
2. **`security.advisories.2.level`**  
   - old: No red or orange zone text found on the country page fetched; alerts for heavy rain and landslides in mountain roads (central provinces), El Niño vigilance, dengue, typhoon season (page updated 16 November 2026). The carte de vigilance colour was not shown in the extracted text.  
   - new: Vigilance renforcée (yellow) for the whole territory; no region advised against; northern border areas with China described as sensitive and specially monitored (zone text 24 Mar 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite
3. **`security.advisories.2.regionsAffected`**  
   - old: Whole country; mountain roads in heavy rain  
   - new: Border areas with China, Laos and Cambodia (sensitive, not restricted)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite
4. **`security.advisories.2.routeImpact`**  
   - old: Avoid mountain roads, passes and river roads in heavy rain, especially after dark.  
   - new: No restriction; carry passports and permits near the Chinese border (Bản Giốc, Lũng Cú).  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite
5. **`security.advisories.2.sourceId`**  
   - old: S04  
   - new: S25  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/vietnam/conseils-aux-voyageurs-securite
6. **`sources[+S26]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Vietnam <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.4.level`**  
   - old: Level 1: Exercise normal precautions (issued 24 June 2026, via search result; the page itself returned HTTP 403).  
   - new: Level 1: Exercise normal precautions (updated 23 Jun 2026; data feed). Country information: border areas may need a local permit; detentions near the Chinese border have occurred  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.4.routeImpact`**  
   - old: None; ordinary crime and scam precautions.  
   - new: Use the operator to obtain any border-area permit; do not leave the road near the frontier.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.4.sourceId`**  
   - old: S06  
   - new: S26  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D13-philippines.json

1. **`sources[+S16]`**  
   - old: —  
   - new: France Diplomatie: Philippines, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Security page updated 20 Nov 2026: formellement déconseillé for western/south-western Mindanao and the maritime zone of the southern half of Palawan to the Sulu archipelago; déconseillé sauf raison impérative for parts of Mindanao  
   - new: Red: western/centre-west/south-west Mindanao and the maritime zone from the southern half of Palawan to the Sulu archipelago; orange: other Mindanao provinces; rest of the country vigilance renforcée (zone text 11 Mar 2026, page 20 Nov 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
3. **`security.advisories.0.routeImpact`**  
   - old: Route stays in northern Palawan but the boundary of the 'southern half' is not defined on the page text I fetched, and vigilance map date was 11 March 2026.  
   - new: Resolved: El Nido (northern tip of Palawan) and the Linapacan, Culion and Coron islands are in the northern half of Palawan province, about 170 km or more north of Puerto Princesa, so they are outside the southern-half maritime zone.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
4. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S16  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
5. **`sources[+S17]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Philippines <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.advisories.2.level`**  
   - old: Level 2 overall; Level 4 Sulu Archipelago and Sulu Sea (per search summary of the September 2026 page; direct fetch blocked)  
   - new: Level 2 overall; Level 4 Do Not Travel: the Sulu Archipelago including the southern Sulu Sea, and Marawi City; Level 3 for other areas of Mindanao (updated 31 Aug 2026; data feed)  
   - reason: Factual correction: the US Level 4 covers "the Sulu Archipelago, including the southern Sulu Sea", not the Sulu Sea as a whole. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.2.regionsAffected`**  
   - old: Sulu Archipelago and Sulu Sea  
   - new: Sulu Archipelago and the southern Sulu Sea; Mindanao  
   - reason: Factual correction: the US Level 4 covers "the Sulu Archipelago, including the southern Sulu Sea", not the Sulu Sea as a whole. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.2.routeImpact`**  
   - old: 'Sulu Sea' wording is not defined; Linapacan and the Culion coast border the northern Sulu Sea. Treated as unresolved until the full text is read.  
   - new: Resolved: the northern Palawan/Calamianes route is not in the southern Sulu Sea.  
   - reason: Factual correction: the US Level 4 covers "the Sulu Archipelago, including the southern Sulu Sea", not the Sulu Sea as a whole. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.2.sourceId`**  
   - old: S14  
   - new: S17  
   - reason: Factual correction: the US Level 4 covers "the Sulu Archipelago, including the southern Sulu Sea", not the Sulu Sea as a whole. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`security.advisories.3.level`**  
   - old: Reconsider eastern Mindanao; do not travel in other parts of Mindanao (May 2026 per search summary; page fetch timed out)  
   - new: Reconsider eastern Mindanao; do not travel in other parts of Mindanao (May 2026 per search summary; page fetch timed out) Not re-verified by A21: smartraveller.gov.au unreachable on 27 Nov 2026.  
   - reason: Record what was actually read  
   - source: https://www.smartraveller.gov.au/destinations/philippines
11. **`sources[+S18]`**  
   - old: —  
   - new: Nederland Wereldwijd: Reisadvies Filipijnen <https://www.nederlandwereldwijd.nl/reisadvies/filipijnen>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/filipijnen
12. **`security.advisories[+]`**  
   - old: —  
   - new: Netherlands Worldwide: Red: western Mindanao, Sulu archipelago and the Sulu Sea waters between Zamboanga, the Sulu islands, Palawan and eastern Malaysia (Tubbataha excepted); yellow elsewhere (changed 9 Sep 2026)  
   - reason: Dutch advice was missing from the record  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/filipijnen
13. **`security.status`**  
   - old: conditional  
   - new: eligible  
   - reason: Reclassification conditional → eligible. The two open questions are resolved by reading the full texts: France red covers the maritime zone from the southern half of Palawan to Sulu; the US Level 4 covers the Sulu Archipelago including the southern Sulu Sea; the Dutch red covers the Sulu Sea between Zamboanga, the Sulu islands, Palawan and eastern Malaysia; FCDO restricts only Mindanao and Sulu. No authority places El Nido, Linapacan, Culion or Coron in a restricted zone.  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite ; https://cadataapi.state.gov/api/TravelAdvisories ; https://www.nederlandwereldwijd.nl/reisadvies/filipijnen
14. **`security.summary`**  
   - old: The redesigned route stays in the north of Palawan, well away from the Mindanao/Sulu areas under all-travel advice. Conditional because France Diplomatie lists the maritime zone of the southern half of Palawan as formally discouraged and the US lists the 'Sulu Sea' at Level 4; the route's northern Sulu Sea margin cannot be matched to either boundary from the pages I could read.  
   - new: Eligible (A21 reassessment, 27 Nov 2026). The route stays in northern Palawan and the Calamianes, more than 400 km from the Mindanao and Sulu areas under all-travel advice. The full texts now read place the restricted waters in the southern half of Palawan to Sulu (France), the southern Sulu Sea (US) and the Sulu Sea between Zamboanga, the Sulu islands, Palawan and Malaysia (Netherlands); FCDO lists only Mindanao and Sulu. Residual risks are country-wide terrorism, sea conditions on small boats and typhoon-season storms (not in March).  
   - reason: Reclassification  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
15. **`security.reassessmentRequired`**  
   - old: Re-check all advisories before booking and two weeks before departure; read the full US Level 4 'Sulu Sea' wording and the France vigilance map for the exact southern-half boundary; if any text places Linapacan or Culion waters inside the zone, change to excluded or drop the Linapacan leg.  
   - new: Re-check all advisories before booking and two weeks before departure. Reclassify if any authority extends a red/orange or all-but-essential zone north of Puerto Princesa or to the Cuyo/Calamian waters, or after any kidnapping or piracy incident in Palawan waters.  
   - reason: Reclassification  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
16. **`uncertainties.1`**  
   - old: Exact reading of the France 'southern half of Palawan' and US 'Sulu Sea' wording for the northern route  
   - new: Resolved on 27 Nov 2026 for the current texts (France southern half of Palawan; US southern Sulu Sea; Dutch Sulu Sea polygon): any northward extension of these zones would change the status.  
   - reason: Reclassification  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
17. **`portfolioNote`**  
   - old: Conditional on the unresolved reading of the 'southern half of Palawan' and 'Sulu Sea' advisory wording; does not enter the eligible ranking until resolved.  
   - new: Security eligible since the A21 reassessment of 27 Nov 2026; still not rankable while the 2027 availability and price of the expedition (the defining €650 element) are unconfirmed (material budget uncertainty).  
   - reason: Reclassification and material-uncertainty flag  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/philippines/conseils-aux-voyageurs-securite
18. **`budget.materialUncertainty`**  
   - old: false  
   - new: true  
   - reason: Internal inconsistency: the note says expedition price and 2027 availability are unconfirmed (operator calendar showed no dates; price from search snippets) while the realistic total (€2,468) is only €32 below the €2,500 ceiling; under the rule used for D05 and D18 this is a material uncertainty.  
   - source: D13 sources S02, S03 (operator pages) and the D13 research note
19. **`budget.materialUncertaintyNote`**  
   - old: Expedition price and availability for 2027 must be confirmed with the operator; the local 3D2N alternative holds the economical case.  
   - new: The defining four-night expedition (about €650 of the €2,468 realistic total) has no confirmed 2027 departure or price: the operator calendar showed no open dates on 27 Nov 2026 and prices came from search summaries. The realistic total is €32 below the €2,500 ceiling, so a small price change moves the trip outside the budget. Confirm a dated quote before ranking.  
   - reason: Material-uncertainty flag set  
   - source: D13 sources S02, S03
20. **`version`**  
   - old: 1.0.0  
   - new: 1.1.0  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D14-japan.json

1. **`sources[+S18]`**  
   - old: —  
   - new: France Diplomatie: Japan, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Page updated 4 Nov 2026 with a typhoon-season alert; no vigilance colour or route-region warning found in the fetched text (security map not readable)  
   - new: No zone advised against; zone text (9 Mar 2026) covers wildlife warnings only; security page read 27 Nov 2026  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
3. **`security.advisories.0.regionsAffected`**  
   - old: No Kyushu region flagged in the fetched text  
   - new: Bear-attack warnings mainly in the north-west and Hokkaido  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
4. **`security.advisories.0.routeImpact`**  
   - old: None identified; confirm the colour on the live map before booking  
   - new: None.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
5. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S18  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
6. **`sources[+S19]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Japan <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.4.level`**  
   - old: Level 1: Exercise normal precautions (from search summary; page returned HTTP 403)  
   - new: Level 1: Exercise normal precautions (updated 14 May 2025; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.4.sourceId`**  
   - old: S05  
   - new: S19  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.summary`**  
   - old: Japan is rated at the lowest or equivalent level by the authorities reviewed: US Level 1, Smartraveller normal precautions, Dutch green outside Fukushima's exclusion zone. The relevant hazards on the route are volcanoes (Aso level 2, Shinmoedake level 2, Sakurajima level 3), earthquakes, typhoons and winter road conditions, not conflict. France's colour was not readable in the fetched page.  
   - new: Japan is rated at the lowest or equivalent level by the authorities reviewed: US Level 1, Smartraveller normal precautions, Dutch green outside Fukushima's exclusion zone. The relevant hazards on the route are volcanoes (Aso level 2, Shinmoedake level 2, Sakurajima level 3), earthquakes, typhoons and winter road conditions, not conflict. France Diplomatie lists no zone advised against (read 27 Nov 2026).  
   - reason: France page now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
10. **`uncertainties.5`**  
   - old: France's vigilance colour for Japan was not readable  
   - new: France Diplomatie zone text re-read on 27 Nov 2026 (no zone advised against); re-check before booking.  
   - reason: France page now read  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/japon/conseils-aux-voyageurs-securite
11. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D15-ethiopia.json

1. **`sources[+S11]`**  
   - old: —  
   - new: France Diplomatie: Ethiopia, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite
2. **`security.advisories.1.level`**  
   - old: Formellement déconseillé: all of Tigray, Afar areas bordering Tigray, and non-essential travel to the Danakil; Alamata/Kobo (Amhara) clashes noted  
   - new: Formellement déconseillé (red): Tigray, the Afar–Eritrea border strip, all of Amhara region and the South Sudan border (zone text 30 Sep 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite
3. **`security.advisories.1.regionsAffected`**  
   - old: Tigray, Afar/Danakil, Amhara–Tigray border  
   - new: Tigray, Amhara, Afar–Eritrea border, border areas  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite
4. **`security.advisories.1.routeImpact`**  
   - old: Axum, Gheralta and the Danakil are formally advised against; the page fetched gives no regional levels for Oromia or Amhara beyond the border clashes, and the security page could not be fetched.  
   - new: Lalibela, Gondar, Bahir Dar, Simien (Amhara) and Axum, Gheralta (Tigray) are all red.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite
5. **`security.advisories.1.sourceId`**  
   - old: S04  
   - new: S11  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/ethiopie/conseils-aux-voyageurs-securite
6. **`sources[+S12]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Ethiopia <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 3: Reconsider travel; Level 4 for Tigray, Amhara, parts of Afar, Gambella, Benishangul Gumuz and Oromia except Bishoftu and Bale Mountains NP (updated 26 Aug 2026; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D16-senegal.json

1. **`security.advisories.2.routeImpact`**  
   - old: Route lies in the yellow remainder; Djoudj area wording is ambiguous and must be re-checked.  
   - new: Resolved (re-read 27 Nov 2026): Dutch orange covers the eastern and north-eastern areas bordering Mali and Mauritania; Djoudj (Dagana department, north-west near Saint-Louis) is in the yellow remainder.  
   - reason: Dutch wording re-read  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/senegal
2. **`sources[+S13]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Senegal <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
3. **`security.advisories.3.authority`**  
   - old: US State Department  
   - new: US Department of State  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`security.advisories.3.level`**  
   - old: Reported Level 1 overall and Level 2 for Casamance (secondary source; travel.state.gov returned 403 on 2026-11-27)  
   - new: Level 1: Exercise normal precautions (updated 30 Nov 2025; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
5. **`security.advisories.3.sourceId`**  
   - old: S12  
   - new: S13  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.summary`**  
   - old: The route (Petite Côte, Saloum Delta, Lompoul, Saint-Louis/Djoudj, Dakar) stays out of the orange zones named by France (Mali border strip, Matam department, Casamance borders) and out of areas listed by the Netherlands. UK FCDO lists no region as against all or all-but-essential travel. Borderline point: Djoudj lies in the north near Mauritania, so it is done as a daytime excursion on the main RN2 route and should be re-checked.  
   - new: The route (Petite Côte, Saloum Delta, Lompoul, Saint-Louis/Djoudj, Dakar) stays out of the orange zones named by France (Mali border strip, Matam department, Casamance borders) and out of areas listed by the Netherlands. UK FCDO lists no region as against all or all-but-essential travel. Djoudj (north-west, Dagana department) is outside both France's orange (Mali border, Matam department) and the Dutch orange (eastern and north-eastern border areas), as re-read on 27 Nov 2026; it stays a daytime excursion.  
   - reason: Djoudj wording resolved  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/senegal
7. **`uncertainties.0`**  
   - old: Djoudj proximity to the Mauritanian border and Dutch orange wording must be re-checked  
   - new: Border-zone wording near the Senegal River should be re-read before departure (resolved for Djoudj on 27 Nov 2026).  
   - reason: Djoudj wording resolved  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/senegal
8. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D17-south-africa.json

1. **`sources[+S14]`**  
   - old: —  
   - new: France Diplomatie: South Africa, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite
2. **`security.advisories.2.level`**  
   - old: No vigilance colour in the text read; El Niño vigilance alert 29 Oct 2026  
   - new: Vigilance renforcée (yellow) for the whole country; particular vigilance in named Johannesburg, Pretoria and Cape Town districts (zone text 17 Mar 2026)  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite
3. **`security.advisories.2.regionsAffected`**  
   - old: National  
   - new: Cape Flats townships, Long Street at night, Cape Town airport surroundings; Johannesburg districts  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite
4. **`security.advisories.2.routeImpact`**  
   - old: Sécurité subpage not retrievable; not treated as a restriction.  
   - new: No restriction on the Western Cape route; follow the Cape Town district advice.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite
5. **`security.advisories.2.sourceId`**  
   - old: S03  
   - new: S14  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/afrique-du-sud/conseils-aux-voyageurs-securite
6. **`sources[+S15]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: South Africa <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 2: Exercise increased caution (crime, terrorism, unrest, kidnapping) (updated 26 May 2025; data feed)  
   - reason: Only FCDO and the Netherlands had been read; US added. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D18-guatemala.json

1. **`sources[+S19]`**  
   - old: —  
   - new: France Diplomatie: Guatemala, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
2. **`security.advisories.2.level`**  
   - old: Page updated 16 Nov 2026; the vigilance colour is only on a map image and could not be read; no zone déconseillée for the route is named in the text  
   - new: Orange: 20 km Mexican border strip (San Marcos, Huehuetenango), 20 km Honduran border strip, Guatemala City zones 6, 7, 12, 18 and Villa Nueva; rest yellow (zone text 16 Nov 2026). Alert of 10 Sep 2026: Fuego and Acatenango ascents banned until further notice  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
3. **`security.advisories.2.regionsAffected`**  
   - old: State of siege Izabal/Zacapa; Fuego red alert in Sacatepéquez, Chimaltenango, Escuintla (4 Aug 2026); Guatemala City armed attacks; Fuego and Acatenango ascents prohibited  
   - new: Mexican and Honduran border strips; Guatemala City zones 6, 7, 12, 18; Villa Nueva; Fuego/Acatenango ascents  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
4. **`security.advisories.2.routeImpact`**  
   - old: Acatenango overnight depends on reopening; Guatemala City movement kept to the airport  
   - new: Route avoids all orange zones (the airport is in zone 13). Acatenango is contradictory: the Acatenango municipality announced the trails reopened on 7 Aug 2026, while the French alert still lists a ban; keep the Antigua fallback.  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
5. **`security.advisories.2.sourceId`**  
   - old: S04  
   - new: S19  
   - reason: France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
6. **`sources[+S20]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Guatemala <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 3: Reconsider travel (crime and cartel/gang terrorism); Level 4 for San Marcos, Huehuetenango, Guatemala City zone 18 and Villa Nueva (updated 11 Mar 2026; data feed)  
   - reason: US advisory was missing from the record. Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`sources[+S21]`**  
   - old: —  
   - new: Reabren el volcán de Acatenango (Municipalidad de Acatenango, comunicado 09-08-2026) <https://www.elsalvador.com/?p=1287218>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.elsalvador.com/?p=1287218
9. **`security.regionalRestrictions[+]`**  
   - old: —  
   - new: Guatemala City: stay out of zones 6, 7, 12, 18 and Villa Nueva (France orange; US Level 4 for zone 18 and Villa Nueva).  
   - reason: France orange city zones  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
10. **`uncertainties[+]`**  
   - old: —  
   - new: Acatenango: reopened by the municipality on 7 Aug 2026 (reported 10 Aug) but still listed as banned in the French alert of 10 Sep 2026; confirm with INGUAT/CONRED and the operator before booking; Fuego remains closed.  
   - reason: Conflicting reports on the Acatenango ban  
   - source: https://www.elsalvador.com/?p=1287218 ; https://www.diplomatie.gouv.fr/fr/information-par-pays/guatemala/conseils-aux-voyageurs-securite
11. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D19-mexico.json

1. **`sources[+S11]`**  
   - old: —  
   - new: France Diplomatie: Mexico, Sécurité (zones de vigilance) <https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
2. **`security.advisories.0.level`**  
   - old: Chiapas orange except Tuxtla Gutiérrez and San Cristóbal; Oaxaca: only the Oaxaca–Santo Domingo Tehuantepec road (route 190) orange; rest of Oaxaca vigilance renforcée (colours read from the page text, map image not readable)  
   - new: Orange: Chiapas except Tuxtla Gutiérrez, San Cristóbal and the Palenque site; orange roads include federal route 190 Oaxaca – Santo Domingo Tehuantepec (listed in full); rest of Oaxaca vigilance renforcée (zone text 11 Mar 2026)  
   - reason: Re-read in full on 27 Nov 2026: route 190 is listed from Oaxaca, with no exception for the Central Valleys section. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
3. **`security.advisories.0.routeImpact`**  
   - old: Chiapas removed from the plan. Base route avoids route 190 towards the Isthmus; Mitla/Hierve el Agua sit on the east side of that corridor and are kept only as an optional day pending re-check.  
   - new: Chiapas removed. Route 190 is listed from Oaxaca city, so the optional Mitla/Hierve el Agua day (reached by route 190) was removed by A21; Cuajimoloyas must be reached by Hwy 175, not by the Teotitlán/Díaz Ordaz turn-off on route 190.  
   - reason: Re-read in full on 27 Nov 2026: route 190 is listed from Oaxaca, with no exception for the Central Valleys section. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
4. **`security.advisories.0.sourceId`**  
   - old: S01  
   - new: S11  
   - reason: Re-read in full on 27 Nov 2026: route 190 is listed from Oaxaca, with no exception for the Central Valleys section. France Diplomatie security page (zone text) read in full on 27 Nov 2026; replaces "colour not readable" or an incomplete reading  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
5. **`sources[+S12]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Mexico <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
6. **`security.advisories.3.authority`**  
   - old: US State Department (secondary report only)  
   - new: US Department of State  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
7. **`security.advisories.3.level`**  
   - old: Oaxaca Level 2 'exercise increased caution'; official page not readable (HTTP 403); Chiapas level not confirmed  
   - new: Level 2: Exercise increased caution (terrorism, crime, kidnapping), updated 28 May 2026, read via the State Department data feed; state-by-state detail not in the feed (page HTTP 403)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
8. **`security.advisories.3.routeImpact`**  
   - old: Oaxaca at Level 2 is not a material conflict; verify directly.  
   - new: Consistent with the plan: no inter-city driving after dark, dispatched taxis only.  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
9. **`security.advisories.3.sourceId`**  
   - old: S07  
   - new: S12  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
10. **`security.regionalRestrictions.1`**  
   - old: Avoid the Oaxaca–Tehuantepec road (route 190) and the Isthmus; Mitla is kept as an optional, re-checked day only.  
   - new: Do not use federal route 190 (Oaxaca–Tehuantepec; listed in full by France as déconseillé sauf raison impérative) or enter the Isthmus: no Tule/Teotitlán/Tlacolula/Mitla/Hierve el Agua day; reach Cuajimoloyas by Hwy 175 via Ixtepeji and Benito Juárez.  
   - reason: Route 190 orange re-confirmed; optional east-valley day removed  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
11. **`itinerary.days.9.title`**  
   - old: Flexible day: Etla valley and Cuilapan, or the east valley with a driver  
   - new: Flexible day: Cuilapan, Zaachila and the craft villages west and south of the city  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
12. **`itinerary.days.9.activities`**  
   - old: ["Default: Cuilapan convent, Zaachila, San Bartolo Coyotepec black pottery, Atzompa ceramics by taxi or driver", "Option only if advice is re-checked: Mitla and Hierve el Agua with a hired driver (see security notes on the Oaxaca–Tehuantepec federal road)"]  
   - new: ["Default: Cuilapan convent, Zaachila, San Bartolo Coyotepec black pottery, Atzompa ceramics by taxi or driver", "Not offered: Mitla and Hierve el Agua, because they are reached by federal route 190, which France Diplomatie lists as déconseillé sauf raison impérative from Oaxaca to Tehuantepec (re-read 27 Nov 2026)"]  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
13. **`itinerary.days.9.culturalHighlight`**  
   - old: Dominican architecture and Zapotec craft villages; Mitla mosaics if the option is used  
   - new: Dominican architecture at Cuilapan and Zapotec craft villages (Atzompa, San Bartolo Coyotepec)  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
14. **`itinerary.days.9.geographicalHighlight`**  
   - old: Hierve el Agua mineral cascades if the option is used  
   - new: Farmland and hills of the western Central Valleys  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
15. **`itinerary.days.9.practical`**  
   - old: Do not extend east beyond Mitla. Buffer day for delays or weather.  
   - new: Buffer day for delays, blockades or weather; stay west and south of Oaxaca city (route 190 east is excluded).  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
16. **`itinerary.days.9.stopIds`**  
   - old: ["s2", "s10"]  
   - new: ["s2"]  
   - reason: Remove the route-190 option (Mitla stop s10)  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
17. **`itinerary.days.9.imageIds`**  
   - old: ["D19-04", "D19-08"]  
   - new: []  
   - reason: Images D19-04 (Hierve el Agua) and D19-08 (Mitla) no longer on the route  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
18. **`itinerary.days.4.practical`**  
   - old: Book cabins and guides through the community operator in advance; carry layers.  
   - new: Book cabins and guides through the community operator in advance; carry layers. Drive up by Hwy 175 via Ixtepeji and Benito Juárez (not the Teotitlán/Díaz Ordaz access from route 190).  
   - reason: Keep the base route off route 190  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
19. **`itinerary.days.4.travelTime`**  
   - old: ≈ 2 h  
   - new: ≈ 2–3 h via Hwy 175  
   - reason: Hwy 175 access may take longer than the 190 access (reported 1.5–3.5 h); estimate  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
20. **`route.stops`**  
   - old: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]  
   - new: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s11"]  
   - reason: Remove Mitla (optional stop on route 190)  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
21. **`route.legs`**  
   - old: 10 legs incl. s2→s10  
   - new: 9 legs  
   - reason: Remove Mitla leg  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
22. **`route.legs[s2→s5].durationText`**  
   - old: ≈ 2 h  
   - new: ≈ 2–3 h (Hwy 175)  
   - reason: Hwy 175 access  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
23. **`budget.lines.8.label`**  
   - old: Hired driver, optional day 10 (east valley or Etla/Cuilapan)  
   - new: Hired driver, optional day 10 (Cuilapan, Zaachila, Atzompa)  
   - reason: Remove the route-190 option  
   - source: https://www.diplomatie.gouv.fr/fr/information-par-pays/mexique/conseils-aux-voyageurs-securite
24. **`version`**  
   - old: 1.0.0  
   - new: 1.1.0  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## D20-chile.json

1. **`sources[+S16]`**  
   - old: —  
   - new: Nederland Wereldwijd: Reisadvies Chili <https://www.nederlandwereldwijd.nl/reisadvies/chili>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/chili
2. **`security.advisories[+]`**  
   - old: —  
   - new: Netherlands Worldwide: Yellow: travel possible with specific risks (changed 21 Aug 2026); flood/landslide emergency in Tocopilla province  
   - reason: Second non-UK authority added (only France and FCDO had been read)  
   - source: https://www.nederlandwereldwijd.nl/reisadvies/chili
3. **`sources[+S17]`**  
   - old: —  
   - new: U.S. Department of State travel advisory data feed: Chile <https://cadataapi.state.gov/api/TravelAdvisories>  
   - reason: Add source actually read by A21 on 27 Nov 2026  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
4. **`security.advisories[+]`**  
   - old: —  
   - new: US Department of State: Level 2: Exercise increased caution (crime, unrest, health) (updated 18 Aug 2026; data feed)  
   - reason: Official US level re-read from the State Department advisory data feed (travel.state.gov pages return HTTP 403); replaces a search-snippet or secondary reading  
   - source: https://cadataapi.state.gov/api/TravelAdvisories
5. **`version`**  
   - old: 1.0.0  
   - new: 1.0.1  
   - reason: A21 verification edits  
   - source: docs/verification/changes.md

## Appendix — D19 objects removed or replaced (verbatim, for recovery)

Removed stop `s10`:

```json
{
  "id": "s10",
  "name": "Mitla (optional)",
  "lat": 16.9208,
  "lng": -96.3616,
  "kind": "archaeological-site",
  "days": [
    10
  ],
  "description": "Zapotec–Mixtec palace complex with geometric stone mosaics. Only an optional, driver-assisted day-10 variant; sits on the east side along the federal road 190 corridor.",
  "activities": [
    "Optional visit"
  ],
  "transport": "Hired driver",
  "imageIds": [
    "D19-08",
    "D19-04"
  ],
  "culturalImportance": "",
  "geography": "",
  "accommodation": "",
  "estimatedCostEUR": null,
  "costNote": ""
}
```
Removed leg:

```json
{
  "from": "s2",
  "to": "s10",
  "mode": "hired-driver",
  "geometry": "schematic",
  "durationText": "≈ 1 h (optional)",
  "distanceKm": 45
}
```
Day 10 before the edit:

```json
{
  "day": 10,
  "from": "Oaxaca city",
  "to": "Oaxaca city",
  "title": "Flexible day: Etla valley and Cuilapan, or the east valley with a driver",
  "activities": [
    "Default: Cuilapan convent, Zaachila, San Bartolo Coyotepec black pottery, Atzompa ceramics by taxi or driver",
    "Option only if advice is re-checked: Mitla and Hierve el Agua with a hired driver (see security notes on the Oaxaca–Tehuantepec federal road)"
  ],
  "transport": "Taxi or hired driver",
  "travelTime": "≈ 30 min to 2 h each way",
  "distanceKm": null,
  "accommodation": "Guesthouse, Oaxaca city",
  "culturalHighlight": "Dominican architecture and Zapotec craft villages; Mitla mosaics if the option is used",
  "geographicalHighlight": "Hierve el Agua mineral cascades if the option is used",
  "practical": "Do not extend east beyond Mitla. Buffer day for delays or weather.",
  "flexible": true,
  "stopIds": [
    "s2",
    "s10"
  ],
  "imageIds": [
    "D19-04",
    "D19-08"
  ],
  "sourceIds": []
}
```
Images D19-04 (Hierve el Agua) and D19-08 (Mitla) remain in `data/images/D19.json` and the manifest (owned by A19) but are no longer referenced by the itinerary.



## Post-verification fixes

- D09-egypt.json 1.0.1 → 1.1.0 (A09, 2026-11-27): removed the licensed 4x4 dunes-camp night (outside all Siwa exceptions); replaced by a third Siwa eco-lodge night and in-town activities; camping nights 0, camp/permit budget lines not-applicable, safari line replaced by local guide day; assessedRoute, signature experiences, route stops/legs and research doc updated; realistic total €1,582.
- D07-jordan.json 1.0.1 → 1.1.0 (A07, 2026-11-27): read France Diplomatie Sécurité page (orange: Ma'an city, Palestinian border zone, north-east, Aqaba and surroundings); removed Wadi Rum, Dead Sea float, Mount Nebo and Highway 15 through Ma'an; replaced by Umm ar-Rasas, inland Hasa-Tafilah road to Dana, a two-night Bedouin camp at Beidha and a King's Highway return; budget realistic €1,950 → €1,888; images D07-01/04 replaced (hero now D07-03); status stays conditional (conflicting advice and spillover; Feynan border-zone width unresolved).
