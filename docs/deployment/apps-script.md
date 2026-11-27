# Deploying the voting backend (Google Apps Script)

Owner: A23 · Audience: the spreadsheet owner (no programming needed) · Contract: `docs/architecture/api-contract.md`

The website (GitHub Pages) sends every vote to a small Apps Script program attached to the existing spreadsheet
`1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg`. The program runs as you (the owner), checks every request itself
(access codes, signed sessions, blind voting) and writes to three tabs that it creates: **Responses**, **Results**
and **History**. It never reads, changes or deletes any other tab — including the existing empty **Sheet1**.

You paste **two files** into Google's editor:

| File (in this repository) | Goes into |
|---|---|
| `backend/dist/ExpeditionBackend.gs` | the project's only script file (`Code.gs`) |
| `backend/dist/appsscript.json` | the project's manifest (`appsscript.json`) |

> **Honest status.** The backend — including the exact single file you paste — has been tested only in an emulator
> on a computer (117 automated tests, `npx vitest run tests/backend`). It has **not** run on Google's servers:
> nothing in this repository can reach Google. §10 is the real test. Until it passes, treat the live site as
> untested. §17 lists exactly what was and was not tested.

Time needed: about 40 minutes.

---

## 0. At a glance

1. Build the two files on your computer (§1).
2. Spreadsheet sharing → **Restricted** (§2).
3. Extensions › Apps Script → paste `ExpeditionBackend.gs` and `appsscript.json` (§3–§4).
4. `npm run codes` → paste `PARTICIPANT_CREDENTIALS` into Script Properties; add `SHEET_NAMESPACE` = `TEST_` (§5–§6).
5. Spreadsheet menu **Expedition admin › Set up** (§7).
6. Deploy › New deployment › Web app · Execute as **Me** · Who has access **Anyone** → copy the `/exec` URL (§8).
7. Put the URL in the GitHub repository variable `VITE_APPS_SCRIPT_URL` and re-run the deploy (§9).
8. Test health, sign-in and one vote in the `TEST_` tabs, then delete `SHEET_NAMESPACE` and run Set up again (§10).
9. Final check (§11). Later updates: Manage deployments › Edit › **New version** (§12).

---

## 1. Before you start: build the two files

You need:

- the Google account that **owns** the spreadsheet;
- this repository on your Mac, with Node.js 22 or newer.

Open **Terminal** in the project folder: type `cd ` (with a space), drag the `BoysTrip` folder from Finder into the
Terminal window, press Return. Then run these three commands, one at a time:

```bash
npm install
```

```bash
npm run backend:registry
```

```bash
npm run backend:bundle
```

- `npm install` is needed only once per computer.
- `backend:registry` refreshes the list of destinations (names, security status, realistic budget) from the
  research files.
- `backend:bundle` checks the backend code and writes `backend/dist/ExpeditionBackend.gs` and
  `backend/dist/appsscript.json`. It ends with a summary such as
  `Destinations: 13/20 with research data; pending: D14, D15, …`.

**Pending destinations are expected for now.** Research for some destinations is still in progress. A pending
destination can already be evaluated, but it can never appear in the ranking. When research is finished, run the
two `backend:` commands again and follow §12 to paste the new file — the URL does not change.

`backend/dist/` is not saved in git (it is generated). Always run `npm run backend:bundle` right before pasting, so
you never paste an old copy.

## 2. Lock down the spreadsheet

The spreadsheet currently appears to be shared as **"Anyone with the link can edit"**. That would let anyone who
gets the link read or change every vote, bypassing all of the script's protections. The web app runs as you, so it
does **not** need any link sharing.

1. Open the spreadsheet → **Share** (top right).
2. Under **General access**, change "Anyone with the link" to **Restricted**.
3. Under *People with access*, remove anyone who should not see raw votes. Click **Done**.

About blind voting: the website never shows anyone's scores before they are revealed. But whoever can open the
spreadsheet itself — you, as owner — can see the raw **Responses** tab. Agree within the group not to open it
before results are revealed (or let a non-voting person own the spreadsheet).

## 3. Open the Apps Script editor

1. In the spreadsheet: **Extensions › Apps Script**. A new browser tab opens with a project containing one file,
   `Code.gs`.
2. Click the project name at the top ("Untitled project") and rename it, for example **Great Expedition backend**.
   (This name appears on Google's permission screens.)

Use this spreadsheet's own **Extensions › Apps Script** menu. A project created from script.google.com would not be
attached to the spreadsheet and would not get the *Expedition admin* menu.

## 4. Paste the code and the manifest

### 4a. The code — one file only

1. In Terminal, copy the file to the clipboard:
   ```bash
   pbcopy < backend/dist/ExpeditionBackend.gs
   ```
2. In the Apps Script editor, click `Code.gs`, select everything in it (**Cmd + A**), paste (**Cmd + V**) and save
   (**Cmd + S**). The file starts with `ExpeditionBackend.gs — The Great Expedition 2027` and is about 2,100 lines.
3. `Code.gs` must be the **only** script file. If the left panel lists any other `.gs` file (for example `Auth.gs`,
   `Setup.gs` from an earlier install that used eight separate files), delete each one: hover it › **⋮** › **Delete**.
   Two copies of the same code would conflict, and the older one could silently win.

Check: the function drop-down in the toolbar (next to **Run** and **Debug**) now lists functions such as `setup`,
`checkConfiguration` and `doPost`.

### 4b. The manifest

1. Left panel › **Project Settings** (gear icon) › tick **Show "appsscript.json" manifest file in editor**.
2. Back in **Editor** (`< >` icon), open `appsscript.json`.
3. In Terminal:
   ```bash
   pbcopy < backend/dist/appsscript.json
   ```
4. In the editor, select everything in `appsscript.json`, paste, save.

The manifest sets the V8 runtime, the time zone (Europe/Paris), the web-app settings (runs as you; reachable without a
Google sign-in) and the only two permissions the script will ask for:

- `spreadsheets` — Google describes it as access to your spreadsheets in general; the code opens only this
  spreadsheet, to write its Responses, Results and History tabs.
- `script.container.ui` — Google describes it as showing content in prompts and sidebars; it is used for the
  *Expedition admin* menu and its dialogs.

If Google's permission screen asks for anything else (Gmail, Drive, contacts…), stop: the wrong code or manifest was
pasted.

## 5. Generate the access codes (on your computer)

```bash
npm run codes
```

This prints, **once**:

- four access codes such as `K7QF-3M9X-…` (24 characters, 120 random bits each), one per friend;
- one line of JSON for the Script Property `PARTICIPANT_CREDENTIALS`. It contains salted hashes only — no codes.

Nothing is written to disk and the codes are stored nowhere else. Right away:

1. Copy the JSON line for §6.
2. Put each person's code in your password manager or a private message draft addressed to that person only
   (never a group chat, never a file in this repository). Send them once §10 has passed.
3. Clear the Terminal (**Cmd + K**).

A lost code cannot be recovered; issue a new one instead (§13, *Rotate one access code…*).

## 6. Set the Script Properties

In the Apps Script editor: **Project Settings** (gear) › scroll to **Script Properties** › **Add script property**
(or **Edit script properties** if some exist). For each row type the **Property** name and the **Value** exactly as
below — no quotes around the value — then click **Save script properties**. Changes apply from the next request; no
redeploy is needed.

### 6a. Set these now

| Property | Value |
|---|---|
| `PARTICIPANT_CREDENTIALS` | the whole JSON line printed by `npm run codes`, pasted as is. Format: `{"paco":{"salt":"…","hash":"…"},"gaetan":{…},"alvarinn":{…},"victor":{…}}` — each salt at least 16 characters, each hash exactly 43 characters (letters, digits, `-`, `_`). |
| `SHEET_NAMESPACE` | `TEST_` — during testing only; you delete it in §10. Letters, digits and `_`, at most 20 characters. Test data then goes to tabs `TEST_Responses`, `TEST_Results`, `TEST_History`. |

### 6b. Do not type these (the script manages them)

| Property | What it is |
|---|---|
| `SESSION_SECRET` | Signs sign-in sessions. **Set up** (§7) creates it (64 random characters). Never copy or share it. |
| `SESSION_VERSIONS` | Created by the script when someone signs out or a code is rotated, e.g. `{"paco":2}`. Do not edit or delete. |
| `RESULTS_STALE_SINCE` | Appears only if a Results rebuild failed; cleared automatically by the next vote or *Rebuild Results*. |

### 6c. Optional (leave unset to use the default)

| Property | Default | Accepted values |
|---|---|---|
| `SPREADSHEET_ID` | `1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg` | another spreadsheet id (not needed) |
| `QUESTIONNAIRE_VERSION` | `q1` | must equal `"version"` in `data/questionnaire.json` |
| `BLIND_VOTING_ENABLED` | `true` | `true` or `false` (`false` = every score visible as soon as it exists) |
| `RESULTS_REVEAL_POLICY` | `per-destination-complete` | `per-destination-complete` (a destination is revealed once all four have evaluated it), `all-complete` (nothing until all evaluations exist), `always`, `admin-only` (never through the website) |
| `COMMENTS_VISIBILITY` | `after-reveal` | `after-reveal` or `author-only` (anything else is treated as `author-only`) |
| `SESSION_EXPIRY_HOURS` | `168` (7 days) | a number from 1 to 2160 |
| `ALLOWED_DESTINATION_IDS` | all 20 | `D01,D02,D07` (commas or spaces) or `["D01","D02","D07"]` |
| `NOVELTY_DATA` | unset (the site then shows no novelty information) | see below |

**`NOVELTY_DATA`** (private; served only to signed-in participants). Leave it unset until the orchestrator gives
you the value; do not write it yourself. Format only — the values below are placeholders, not data:

```json
{"D01":{"newToAll":<true|false>,"visitedCount":<0–4>,"visitedBy":["<participant id>"],"note":"<short private note>"}}
```

- One entry per destination id (`D01`…`D20`); ids not in the destination list are ignored.
- `newToAll` — boolean; defaults to `visitedCount == 0`.
- `visitedCount` — whole number ≥ 0; defaults to the length of `visitedBy`.
- `visitedBy` — participant ids among `paco`, `gaetan`, `alvarinn`, `victor` (other values are dropped).
- `note` — text, at most 500 characters (longer notes are cut).
- One line of JSON, at most 9 KB (Google's limit for one Script Property value). Invalid JSON is ignored (no
  novelty shown) rather than breaking the site.

All keys with placeholders: `backend/apps-script/script-properties.example.json`.

## 7. Run Set up from the *Expedition admin* menu

1. Go back to the spreadsheet tab and **reload** it. After a few seconds a menu **Expedition admin** appears to the
   right of *Help*.
2. **Expedition admin › Set up (tabs + session secret)**.
3. The first time, Google asks for permission: **Authorization required** › **Continue** (or *Review
   permissions*) › choose the owner account › *"Google hasn't verified this app"* › **Advanced** › **Go to Great
   Expedition backend (unsafe)** › if checkboxes are shown, tick **Select all** › **Continue / Allow**.
   "Unverified" is normal for a private script you installed yourself; it gets only the two permissions of §4b.
4. If the first click only showed the permission screens, click **Set up** again. The dialog should read:

   ```
   Session secret: created
   Namespace: TEST_
   Tab TEST_Responses: created
   Tab TEST_Results: created
   Tab TEST_History: created
   Results rows: 20
   Configuration complete.
   ```

   If it ends with **Still to do:** followed by bullet points, fix those (usually `PARTICIPANT_CREDENTIALS` missing
   or pasted incompletely) and run Set up again.

Set up is safe to repeat: the second time it reports `Session secret: exists` and `ok` for each tab. If a tab called
`Responses`, `Results` or `History` already exists with other column headers, Set up **stops without changing
anything** and names the column that differs.

**Expedition admin › Check configuration** shows the same status at any time (property *names* only, never values).

Alternative from the editor: choose `setup` in the function drop-down › **Run**, and read the result under
**Execution log**. (The functions whose names start with `menu` only work from the spreadsheet menu.)

## 8. Deploy as a web app

1. In the Apps Script editor: **Deploy › New deployment**.
2. Click the gear next to *Select type* › **Web app**.
3. Fill in:
   - Description: `v1`
   - **Execute as: Me** (your address)
   - **Who has access: Anyone** — not "Anyone with Google account". The site calls the script without a Google
     sign-in; every private action is still protected by the access codes and signed sessions.
4. **Deploy**. If Google asks to authorise again, repeat the screens of §7 step 3.
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec` and must end with
   **`/exec`** (not `/dev`). Keep it: you need it in §9 and §10.

## 9. Connect the website

Give the URL to the published site through a **GitHub repository variable**. Leave `data/configuration.json`
alone: the automated end-to-end tests build the site from that file and expect it in demo mode, so a URL there
would make them run against your real backend and fail.

1. On GitHub, open the repository › **Settings › Secrets and variables › Actions** › tab **Variables** › **New
   repository variable**.
   - Name: `VITE_APPS_SCRIPT_URL`
   - Value: `https://script.google.com/macros/s/AKfy…/exec` (the URL must not contain `?` or `#`; the site refuses
     it).
   - **Add variable**.
2. Rebuild the site: **Actions** › *Deploy to GitHub Pages* › **Run workflow** (or push any commit to `main`). Only
   the deploy build reads this variable; the test workflow stays in demo mode.
3. Open the published site. The demo banner ("nothing is saved to Google Sheets") must be gone. While the variable
   is missing or empty, the site stays in **demo mode** (fictitious codes).

(Alternative without GitHub settings: put the URL in `"appsScriptUrl"` in `data/configuration.json`. The site works
the same way, but the end-to-end tests then fail until they are made to force demo mode.)

The URL is not a secret (anyone can call `health`), but there is no reason to post it publicly.

## 10. Test with `SHEET_NAMESPACE` = `TEST_`, then go live

Everything below goes to the `TEST_` tabs.

1. **Health (browser).** Open `https://script.google.com/macros/s/AKfy…/exec?action=health` in a **private /
   incognito window**. In a normal window you are signed in to Google as the owner, so the check can pass even
   when *Who has access* is wrong; your friends and the website are not signed in. Expected:
   ```json
   {"ok":true,"data":{"status":"ok","configured":true,"questionnaireVersion":"q1","backendVersion":"1.0.0"},"serverTime":"…"}
   ```
   A Google sign-in page or an HTML page instead means *Who has access* is not **Anyone**, or you used a `/dev` URL.
   `configured:false` means §6–§7 are incomplete (run *Check configuration*).
2. **Health (Terminal, optional)** — `-L` follows Google's redirect:
   ```bash
   curl -sL -H 'Content-Type: text/plain;charset=utf-8' -d '{"action":"health"}' 'https://script.google.com/macros/s/AKfy…/exec'
   ```
3. **Sign-in.** On the published site, sign in with your own name and code. Then sign out and try a deliberately wrong
   code once: it must be refused. (Five wrong codes in a row lock that name for 15 minutes — do not test that on a
   real name.)
4. **One vote.** Sign in again and evaluate one destination. In the spreadsheet:
   - `TEST_Responses` has one row with your answers and `revision_number` 1;
   - `TEST_Results` shows `active_responses` 1 for that destination.

   Change one answer and submit again: the same row now shows `revision_number` 2 and `TEST_History` has one row
   with the old version.
5. **Browser / phone.** Repeat steps 3–4 on a phone if possible (Safari on iPhone, Chrome on Android). If something
   fails only in a browser, see `docs/architecture/cross-origin.md` (it includes a one-line DevTools check: no
   `OPTIONS` request, one `POST` answered 302, one `GET` to `script.googleusercontent.com`).
6. **Go live.**
   1. Project Settings › Script Properties › **Edit script properties** › delete the `SHEET_NAMESPACE` row (bin icon)
      › **Save script properties**. From the next request, real tabs are used.
   2. Spreadsheet › **Expedition admin › Set up**. Expected: `Session secret: exists`, `Namespace: (none)`, tabs
      `Responses`, `Results`, `History` `created`, `Configuration complete.`
   3. Delete the three `TEST_` tabs by hand if you like (right-click the tab › **Delete**). The script never deletes
      tabs. Leave `Sheet1` alone or delete it — the script does not use it either way.
   4. Optional: **Expedition admin › Sign everyone out**, so that test sessions end.
7. Send each friend their own code (§5).

## 11. Final check

- [ ] Spreadsheet **Share › General access** is **Restricted** (§2). Only people who may see raw votes are listed.
- [ ] Script Properties contain `PARTICIPANT_CREDENTIALS` and `SESSION_SECRET`, and **no** `SHEET_NAMESPACE`.
- [ ] *Expedition admin › Check configuration* says `Configured: yes` and lists `Tab Responses: ok`, `Tab Results: ok`,
      `Tab History: ok`.
- [ ] `…/exec?action=health` returns `"configured":true`.
- [ ] The deployment is **Execute as: Me**, **Who has access: Anyone** (Deploy › Manage deployments).
- [ ] The Apps Script project contains exactly one `.gs` file.

## 12. Updating the code later (same URL)

Do this after any change to the backend code, and when destination research is finished (to replace the pending
entries):

1. In Terminal: `npm run backend:registry`, then `npm run backend:bundle`.
2. `pbcopy < backend/dist/ExpeditionBackend.gs`, then in the editor open `Code.gs`, select everything, paste, save.
   If `backend/dist/appsscript.json` changed, paste it into `appsscript.json` too.
3. **Deploy › Manage deployments** › select the active web-app deployment › **pencil (Edit)** › *Version*:
   **New version** › **Deploy**.

This keeps the same `/exec` URL. Do **not** use *New deployment* for updates: that creates a second URL while the site
keeps calling the old code. Saving the code alone is not enough either — the `/exec` URL serves the version chosen in
the deployment. Script Properties and the spreadsheet are unaffected by redeploying.

To confirm which code is in the editor: the file header shows a `bundle id`, which `npm run backend:bundle` prints
too. If the manifest's permissions ever change, run **Set up** once from the menu and accept the new permission.

## 13. Day-to-day administration (*Expedition admin* menu)

| Item | What it does |
|---|---|
| Set up (tabs + session secret) | Creates `SESSION_SECRET` if missing, creates/validates the three tabs, rebuilds Results. Safe to repeat. |
| Check configuration | Read-only report: missing properties, tabs, pending destinations, warnings. |
| Rebuild Results | Recomputes the Results tab from Responses (History is never counted). |
| Reconcile duplicates | If two active rows ever exist for the same person + destination, keeps the latest and archives the others to History (`reason = reconcile-duplicate`). Reports invalid rows (e.g. hand-edited scores) without deleting them. |
| Rotate one access code… | Asks for a participant id (`paco`, `gaetan`, `alvarinn`, `victor`), shows a new code **once**, stores only its hash and signs that person out everywhere. |
| Sign one participant out… / Sign everyone out | Invalidates sessions (for example after a lost phone). |

Alternative rotation from your computer: `npm run codes -- --participant paco` prints a new code and the replacement
`"paco":{…}` entry to put inside `PARTICIPANT_CREDENTIALS`; then run *Sign one participant out…* for that person.

To sign everyone out *and* invalidate every token ever issued (for example if you suspect `SESSION_SECRET` leaked),
choose `rotateSessionSecret` in the editor's function drop-down › **Run**.

Do not edit the Responses or History tabs by hand. If you must, run **Reconcile duplicates** and **Rebuild Results**
afterwards. Scores are always recomputed from the five answers, so editing `individual_score` has no effect.

## 14. Sheet layout (for reference)

- **Responses** (one active row per participant + destination): `response_id, participant_id, participant_name,
  destination_id, destination_name, q1_overall_enthusiasm, q2_cultural_appeal, q3_geographical_appeal,
  q4_adventure_appeal, q5_practical_suitability, individual_score, comments, created_at, updated_at,
  questionnaire_version, destination_version, revision_number, last_request_id`.
  `individual_score` is the unrounded mean (displayed with two decimals). Timestamps are ISO 8601 (UTC).
- **History** (previous versions, never counted): `history_id, original_response_id, participant_id, destination_id,
  previous_q1…previous_q5, previous_individual_score, previous_comments, previous_questionnaire_version,
  previous_destination_version, previous_created_at, previous_updated_at, revision_number (of the archived version),
  superseded_by_revision, revision_timestamp, request_id (the request that replaced it), previous_request_id, reason`.
- **Results** (derived, rebuilt after every write): `destination_id, destination_name, security_status,
  budget_status, realistic_total_eur, material_budget_uncertainty, active_responses, score_paco, score_gaetan,
  score_alvarinn, score_victor, mean_score, median_score, min_score, max_score, pop_std_dev, mean_q1…mean_q5,
  significant_reservations (Q1 ≤ 4), ranking_eligible, ranking_position, exclusion_reasons, last_updated`.
  Ranking-eligible = research available AND security *eligible* AND realistic total ≤ €2,500 AND no material budget
  uncertainty AND 4/4 evaluations; ordered by mean, then the higher lowest individual score, then mean Q1, then id.

All user text is written as plain text: cells are formatted as text and any value starting with `=`, `+`, `-`, `@`,
a tab, a carriage return or an apostrophe gets a leading apostrophe, so a comment like `=HYPERLINK(…)` can never
become a formula.

## 15. Reliability notes (Sheets is not a database)

- Every write runs under a script lock (up to 20 s wait). If the lock is busy the site receives `LOCK_TIMEOUT` and
  retries with the **same request id**, which the server applies at most once (it checks `last_request_id`, History
  and a 6-hour cache).
- Re-sending identical answers writes nothing; that request id is remembered for 6 hours (cache only), so a very late
  retry of such a no-change request could in theory re-apply its answers. The site retries within seconds, so this is
  not expected in practice.
- Order of a revision: History copy → overwrite the active row → rebuild Results. If Google fails half-way, the
  retry completes the missing step without duplicating the History copy. If only the Results rebuild fails, the
  vote is still saved and `RESULTS_STALE_SINCE` is set; the next vote or **Rebuild Results** repairs it.
- Sign-in throttling uses Apps Script's cache, which Google may clear early; it is a brake on guessing, not a vault.
  The codes' 120-bit entropy is what makes guessing hopeless.
- A global lockout (25 failures in 15 minutes across all names) also blocks real users for 15 minutes; it only
  triggers under a deliberate attack.

## 16. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| No *Expedition admin* menu | Reload the spreadsheet and wait a few seconds. Check that the code was pasted in this spreadsheet's own *Extensions › Apps Script* project and saved. |
| "Script function not found: menuSetup" | The code was not saved, or was pasted into another project. Paste again into `Code.gs`, save, reload the spreadsheet. |
| Permission screens loop, or "Sorry, unable to open the file" | You are signed into several Google accounts. Use a private window signed into the owner account only. |
| "Cannot call SpreadsheetApp.getUi() from this context" | A `menu…` function was run from the editor. Use the spreadsheet menu, or run `setup` / `checkConfiguration` instead. |
| Odd or old behaviour right after pasting | Another `.gs` file is still in the project (§4a step 3), or you saved without deploying a **new version** (§12). |
| `health` shows `configured: false` | Run **Check configuration**; usually `PARTICIPANT_CREDENTIALS` missing/malformed or Set up not run. |
| Browser shows a Google sign-in page or HTML | Deployment access is not **Anyone**, or you used the `/dev` URL. |
| `NOT_CONFIGURED` mentioning a tab | A tab with that name exists with other headers. Rename it or set `SHEET_NAMESPACE`. |
| `RATE_LIMITED` | Too many wrong codes; wait 15 minutes, or rotate the code. |
| Everyone suddenly signed out | Someone ran *Sign everyone out*, `rotateSessionSecret`, or `SESSION_VERSIONS` was edited. |
| Website still shows old behaviour after a code change | You created a new deployment instead of a new **version** of the existing one (§12). |
| "Authorization required" after an update | The manifest's permissions changed; run **Set up** once from the menu and accept. |
| Errors in detail | Apps Script editor › **Executions**. Logs never contain codes, tokens, scores or comments. |
| `npm run backend:bundle` says "Bundle NOT written" | A source file in `backend/apps-script/` was changed in an unsafe way; the message lists each problem. Nothing was written, so the previous bundle (if any) is unchanged — ask a developer. |

## 17. What has and has not been tested

**Tested here, automatically, in an emulator** (`npx vitest run tests/backend`, 117 tests; the emulator is
`backend/emulator/`, in-memory fakes of SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities and
ContentService):

- the exact bundle, built by `scripts/bundle-backend.mjs` and loaded **alone**, following this guide: the menu, Set up
  on a spreadsheet whose only tab is an empty `Sheet1` (left untouched), `TEST_` tabs, health over GET and POST,
  wrong and right sign-in, one submission, a replay with the same request id (nothing written), a revision with its
  History row, blind results before 4/4 and the reveal after, formula-injection protection, removing
  `SHEET_NAMESPACE` and creating the real tabs, no codes/tokens/secrets in the logs;
- the bundler itself: same functions as the separate files, deterministic output, an identical manifest, and refusal
  to write a bundle with an unknown file, a duplicate name, order-dependent top-level code, a syntax error or
  anything that looks like an access code or credential;
- everything else in the backend: validation, uniqueness, idempotency, locking, partial failures, reveal policies,
  statistics, ranking eligibility, code rotation, session expiry and the website's API client
  (`docs/architecture/cross-origin.md`).

**Not tested — only you can test these** (§10):

- pasting into the real editor and Google's permission screens;
- real Apps Script behaviour: Sheets, LockService and CacheService under real use, quotas, cold-start delays;
- the real `script.google.com` → `script.googleusercontent.com` redirect and its CORS headers;
- any real browser or phone against the deployed backend.
