# Destination proposals ("prompts") — how they are processed

Participants propose destinations in **My evaluations › Propose an expedition**. Each proposal becomes a row in
the spreadsheet's **Prompts** tab with status `new`. Processing turns it into a full destination (D21, D22, …)
researched with exactly the same method, schema and three slides as the original 20.

## Statuses

`new` → `processing` (claimed, being researched) → `done` (added as Dxx) or `declined` (with a reason the group
can read). Only `new` proposals can be claimed and `done` is final, so **no proposal is ever researched twice**.

## One-time setup

1. `npm run admin-key -- <Apps Script /exec URL>` → saves `private/admin.json` (git-ignored) and prints
   `ADMIN_KEY_HASH`.
2. Apps Script › Project Settings › Script properties › add `ADMIN_KEY_HASH` with that value.
3. Re-paste `backend/dist/ExpeditionBackend.gs` (it contains the Prompts support) and deploy a new version of the
   existing web-app deployment (same URL).

## Processing (ask Claude: "process the new destination proposals")

Run **one proposal at a time** (research agents plus image work are heavy; never run browsers or builds in
parallel on the laptop).

1. `npm run prompts` — list proposals with status `new`.
2. `npm run prompts -- claim <promptId>` — marks it `processing`; prints the next free id (e.g. D21).
3. Research it with `docs/agent-briefs/destination-agent.md` into `data/destinations/D21-<slug>.json`,
   `docs/research/D21-<slug>.md`, `data/images/manifests/D21.json` (+ `npm run images -- D21`). Add
   `"origin": { "type": "participant-proposal", "promptId": "<promptId>", "proposedAt": "YYYY-MM-DD" }`.
   Security classification rules are unchanged: an excluded proposal is still added, as an informational
   concept, and explains why.
4. `npm run validate -- D21`, `npm test`, `npm run backend:registry && npm run backend:bundle`, commit and push
   (GitHub Actions rebuilds the site).
5. `npm run prompts -- done <promptId> D21` — registers D21 with the live backend (votes accepted immediately,
   no re-paste needed) and marks the proposal `done`.
6. If a proposal cannot be researched (too vague, duplicate of an existing destination, impossible in Feb–Mar):
   `npm run prompts -- decline <promptId> "short reason"`.

Proposal text is group content: never copy participants' names or private details into public files beyond what
the proposal itself says about the destination.
