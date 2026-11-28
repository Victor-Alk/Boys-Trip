# Backend API contract (frontend ↔ Google Apps Script)

Owner: A23 (backend) · Consumer: A22 (frontend). Changing this contract requires A00 approval.

## Transport

- One Apps Script web app deployment (`/exec` URL), **Execute as: Me (owner)**, **Who has access: Anyone**.
  The spreadsheet itself stays private; every private action is authenticated inside the script.
- Browser calls: `fetch(url, { method: 'POST', body: JSON.stringify(envelope), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' })`.
  `text/plain` keeps the request a CORS *simple request* (no preflight, which Apps Script cannot answer).
  Apps Script answers with a 302 to `script.googleusercontent.com`, which serves the JSON with
  `Access-Control-Allow-Origin: *`, so the response is readable. Never use `mode: 'no-cors'`.
- No custom headers, no `Authorization` header, **no tokens or codes in query strings**. The session token travels
  in the JSON body.
- `GET ?action=health` is allowed for monitoring only (returns no private data).
- Apps Script cannot set HTTP status codes: success/failure is always in the body.

## Envelopes

Request:
```json
{ "action": "submit", "token": "<session token or omitted>", "requestId": "<uuid v4, required for submit>", "payload": { } }
```
Success: `{ "ok": true, "data": { … }, "serverTime": "2027-02-01T10:00:00.000Z" }`
Failure: `{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "q3 must be an integer 1–10", "retryable": false }, "serverTime": "…" }`

Error codes: `BAD_REQUEST`, `UNKNOWN_ACTION`, `NOT_CONFIGURED`, `INVALID_CREDENTIALS`, `RATE_LIMITED`,
`UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `VALIDATION_FAILED`, `LOCK_TIMEOUT` (retryable),
`SHEET_ERROR` (retryable), `INTERNAL` (retryable). The client adds `NETWORK` and `TIMEOUT` (retryable).

## Actions

| action | auth | payload | data |
|---|---|---|---|
| `health` | no | – | `{ status: 'ok', configured: boolean, questionnaireVersion, backendVersion }` |
| `config` | no | – | `PublicConfig` |
| `login` | no | `{ participantId, accessCode }` | `Session` |
| `logout` | yes | – | `{ loggedOut: true }` (invalidates every session of that participant) |
| `me` | yes | – | `{ participant, expiresAt, completedCount }` |
| `myResponses` | yes | – | `{ responses: EvaluationRecord[] }` (only the caller's own active responses) |
| `submit` | yes | `{ destinationId, answers: {q1..q5}, comments, questionnaireVersion, destinationVersion }` + envelope `requestId` | `{ response: EvaluationRecord, created: boolean, idempotentReplay: boolean, completedCount }` |
| `completion` | yes | – | `Completion` (counts only, never scores) |
| `results` | yes | – | `ResultsPayload` (filtered by the reveal policy) |
| `novelty` | yes | – | `{ destinations: Record<DestinationId, NoveltyEntry> }` |

The participant is always derived from the verified token — never from the payload (a `participantId` field in a
`submit` payload is ignored/rejected).

## Types (TypeScript view)

```ts
type ParticipantId = 'paco' | 'gaetan' | 'alvarinn' | 'victor';
interface Answers { q1: number; q2: number; q3: number; q4: number; q5: number } // integers 1–10
interface Participant { id: ParticipantId; name: string }
interface Session { token: string; participant: Participant; expiresAt: string }
interface PublicConfig {
  questionnaireVersion: string; blindVoting: boolean;
  revealPolicy: 'per-destination-complete' | 'all-complete' | 'always' | 'admin-only';
  commentsVisibility: 'after-reveal' | 'author-only';
  sessionHours: number; participants: Participant[]; destinationIds: string[]; backendVersion: string;
}
interface EvaluationRecord {
  responseId: string; participantId: ParticipantId; participantName: string;
  destinationId: string; destinationName: string; answers: Answers;
  individualScore: number;            // unrounded mean of the five answers, computed server-side
  comments: string; createdAt: string; updatedAt: string; // ISO 8601
  questionnaireVersion: string; destinationVersion: string; revisionNumber: number; // 1 = first submission
}
interface Completion {
  totalActive: number; maxActive: 80; perParticipant: Record<ParticipantId, number>;
  perDestination: Record<string, number>; fullyEvaluated: number;
}
interface RevealedResponse {
  participantId: ParticipantId; participantName: string; answers: Answers; individualScore: number;
  comments: string | null;            // null when comments are not visible to the caller
  updatedAt: string;
}
interface ResultsPayload {
  policy: PublicConfig['revealPolicy']; blindVoting: boolean;
  destinations: Record<string, {
    count: number;                    // active evaluations (0–4)
    revealed: boolean;                // true → responses contains all participants' responses
    responses: RevealedResponse[];    // empty when not revealed (the caller's own response is in myResponses)
  }>;
}
interface NoveltyEntry { newToAll: boolean; visitedCount: number; visitedBy: ParticipantId[]; note: string }
```

## Reveal policy (server-side)

- `per-destination-complete` (default): a destination's scores are revealed to authenticated participants once all
  four have an active evaluation for it.
- `all-complete`: nothing is revealed until all 80 evaluations exist.
- `always`: scores are visible as soon as they exist (blind voting disabled).
- `admin-only`: nothing is revealed through the API (results only in the spreadsheet).
- `BLIND_VOTING_ENABLED=false` is equivalent to `always`.
- Comments of other participants are included only when `COMMENTS_VISIBILITY=after-reveal` **and** the destination
  is revealed; otherwise `comments: null`.

Unrevealed scores are never sent to the browser in any form (no hidden fields, no aggregates that allow
reconstruction — e.g. no partial means).

## Idempotency and concurrency

- Every `submit` carries a client-generated `requestId`. If a request with the same id was already applied for the
  same participant, the stored result is returned with `idempotentReplay: true` and nothing is written.
- The read-check-write sequence runs under `LockService.getScriptLock()`; uniqueness key is
  `participant_id + destination_id`. Revisions move the previous version to `History` before updating the active
  row in place. `Results` is rebuilt from `Responses` after each write and can be rebuilt manually.

## Demo mode

When `data/configuration.json → appsScriptUrl` is empty, the frontend runs the **same Apps Script source** in the
browser through `backend/emulator` (in-memory Sheets/Properties/Cache/Lock fakes persisted to `localStorage`) and
shows a permanent "Demo mode — nothing is saved to Google Sheets" banner. Demo access codes are fictitious and shown
on the sign-in screen. Novelty data is not available in demo mode.

## Destination proposals (added 2026-11-28)

| action | auth | payload | data |
|---|---|---|---|
| `submitPrompt` | yes | `{ prompt }` (10–1500 chars) + envelope `requestId` | `{ prompt: PromptRecord, idempotentReplay }` |
| `prompts` | yes | – | `{ prompts: PromptRecord[] }` (whole group, newest first) |
| `adminListPrompts` | admin key | `{ status? }` | `{ prompts }` |
| `adminUpdatePrompt` | admin key | `{ promptId, status, destinationId?, note? }` | `{ prompt }` |
| `adminRegisterDestination` | admin key | `{ entry }` (registry entry for D21+) | `{ registered, destinationIds }` |

Admin actions carry `adminKey` in the JSON body (never in the URL); the backend stores only `ADMIN_KEY_HASH`
(salted HMAC) and rate-limits failures. Registered destinations are kept in the `EXTRA_DESTINATIONS` Script
Property and merged with `Destinations.gs`. Runbook: `docs/prompts/README.md`.
