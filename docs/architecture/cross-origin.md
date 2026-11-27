# Cross-origin calls: GitHub Pages → Apps Script

Owner: A23 · Related: `docs/architecture/api-contract.md`, `src/lib/api.ts`, `docs/deployment/apps-script.md`

The website is served from `https://<user>.github.io/<repo>/`; the backend is an Apps Script web app at
`https://script.google.com/macros/s/<id>/exec`. Different origins, so the browser applies CORS. Apps Script gives us
no control over HTTP headers or status codes and has no `doOptions` handler, which shapes everything below.

## Strategy: one CORS "simple request" per call

`src/lib/api.ts` sends every call as:

```ts
fetch(execUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action, token, requestId, payload }),
  redirect: 'follow',
  credentials: 'omit',
  signal, // AbortController, 25 s
});
```

- **POST + `text/plain`** is a CORS-safelisted combination: the browser sends the request directly, without an
  `OPTIONS` preflight. A preflight would fail, because Apps Script cannot answer `OPTIONS` with CORS headers.
  The body is still JSON; the server parses `e.postData.contents` and ignores the declared content type.
- **No custom headers** (no `Authorization`, no `X-…`, no `Content-Type: application/json`): any of them makes the
  request "non-simple" and triggers the failing preflight. The session token therefore travels **inside the JSON
  body**.
- **Nothing private in the URL**: tokens and codes in a query string would end up in browser history, Google's
  request logs and `Referer`-style leaks. The client refuses an `appsScriptUrl` containing `?` or `#`. GET is used
  only for `?action=health`, which returns no private data; `doGet` rejects every other action.
- **`credentials: 'omit'`**: the deployment is "Anyone" (anonymous), so Google cookies are not needed. Sending them
  could change how Google routes the request when a user is signed into several Google accounts, and cross-site
  cookie blocking (Safari ITP, Firefox, Chrome) would make cookie-based access unreliable anyway.

## The 302 redirect

What Google does with a web-app request (as documented by Google for ContentService and widely relied on; **not
observed from this repository**, see "What was tested"):

1. `POST script.google.com/macros/s/<id>/exec` → Google runs `doPost(e)` **once** and stores the output.
2. Google answers `302 Found` with `Location: https://script.googleusercontent.com/macros/echo?user_content_key=…`.
3. The browser follows the redirect (`redirect: 'follow'`). Per the Fetch standard a 302 after a POST becomes a
   **GET without a body**; that is fine, because the script has already run and the GET only fetches the stored
   output.
4. `script.googleusercontent.com` serves the JSON with `Access-Control-Allow-Origin: *`, so `fetch` can read it.

Consequences:

- Apps Script cannot set status codes, so success/failure is always in the body (`ok: true|false`).
- A retried request is a new execution. That is why every `submit` carries a client-generated `requestId`: the
  server applies a given `requestId` at most once per participant (see the contract).
- An HTML response (Google sign-in page, quota or error page) instead of JSON is reported by the client as
  `INTERNAL` "unexpected (non-JSON) response". The usual cause is a deployment whose access is not "Anyone" or a
  `/dev` URL.
- Cold starts: the first call after a quiet period can take several seconds. The client times out after 25 s
  (`TIMEOUT`, retryable); the UI should offer "Try again", reusing the same `requestId` for a submission.

## Why not the alternatives

| Option | Why not |
|---|---|
| `mode: 'no-cors'` | The response becomes opaque: the page cannot read the JSON, so it cannot know whether a vote was saved or show errors. Never used. |
| JSONP (`<script src="…?callback=">`) | GET only, so the token/payload would have to be in the URL (history, logs); executes remote script in the page; no error handling. |
| `Authorization: Bearer …` header | Not CORS-safelisted → preflight → fails on Apps Script. |
| `Content-Type: application/json` | Not safelisted → preflight → fails. |
| A proxy (Cloudflare Worker, Firebase, …) | Forbidden by the architecture: GitHub Pages + Apps Script + Sheets only. |
| Google Sign-In / OAuth for the four friends | Adds Google-account coupling and consent screens; access codes are simpler and sufficient for a private group. |

## Safari and mobile notes

- iOS/macOS Safari and every iOS browser use WebKit. The simple-request strategy needs no cookies, so Intelligent
  Tracking Prevention does not affect it. Private Browsing works; demo mode's `localStorage` may be cleared when the
  private tab closes (the live mode stores nothing important locally besides the session token).
- `crypto.randomUUID()` exists from Safari 15.4; older versions fall back to `crypto.getRandomValues()` in
  `newRequestId()`. `AbortController` exists from Safari 12.1.
- In-app browsers (WhatsApp, Instagram, Messenger) are WebKit/Chromium web views and should behave like their
  engines, but they were not tested. If a friend has trouble, ask them to open the link in Safari/Chrome.
- Content blockers or corporate networks that block `script.google.com` or `script.googleusercontent.com` will make
  every call fail with `NETWORK`.
- Demo mode runs the backend in the page with `new Function` (the emulator). If a strict Content-Security-Policy
  without `'unsafe-eval'` is ever added to the site, demo mode stops working (live mode is unaffected).

## What was and was not tested

Tested here (automated, `npx vitest run tests/backend`):

- the request the client builds: method, `text/plain` header only, no `Authorization`, `credentials: 'omit'`,
  `redirect: 'follow'`, never `no-cors`, token and `requestId` in the body, no query strings;
- client error mapping: network failure → `NETWORK`, abort after the timeout → `TIMEOUT`, HTML or HTTP 5xx →
  `INTERNAL`, error envelopes → `ApiError` with the server's `code`/`retryable`;
- the live client against the real `.gs` code running in the emulator (login, submit, replay, results, logout);
- the single pasted file `backend/dist/ExpeditionBackend.gs` (built by `npm run backend:bundle`) loaded alone in the
  emulator: menu, Set up, health over GET and POST, login, submit, replay, revision, blind results and reveal;
- the demo client, which loads the same `.gs` files through Vite `?raw` imports, including a production Vite build.

**Not tested — this environment cannot reach Google:**

- the real `script.google.com` → 302 → `script.googleusercontent.com` flow and its CORS headers;
- real Apps Script runtime behaviour (V8 quirks, quotas, cold-start latency, LockService/CacheService under real
  concurrency, Sheets' handling of leading apostrophes on text-formatted cells);
- any real browser or phone against a deployed backend.

Until §10 of `docs/deployment/apps-script.md` has been completed, the live integration must be described as
**untested**. Quick manual check from the deployed site's origin (browser DevTools console on the GitHub Pages
page):

```js
await (await fetch('https://script.google.com/macros/s/<id>/exec', {
  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ action: 'health' }), redirect: 'follow', credentials: 'omit',
})).json();
```

Expected: `{ ok: true, data: { status: 'ok', configured: true, … } }`. In the Network tab there must be no
`OPTIONS` request, one `POST` (302) and one `GET` to `script.googleusercontent.com` (200).

## Fallback if direct calls ever stop working: an HtmlService-hosted voting page

If Google changes the redirect/CORS behaviour, the backend logic does not need to change, only the transport:

1. Add to the Apps Script project an `Index.html` page (the evaluation form) and serve it from `doGet` with
   `HtmlService.createHtmlOutputFromFile('Index')` when `?action=` is absent or `app`.
2. Add one public function, e.g. `apiCall(envelopeJson) { return JSON.stringify(handleEnvelope_(JSON.parse(envelopeJson))); }`.
3. In that page, call it with `google.script.run.withSuccessHandler(…).apiCall(JSON.stringify(envelope))`.
   `google.script.run` talks to the script through Google's own channel, so there is no CORS at all, and the same
   authentication, validation, locking and reveal rules apply because everything goes through `handleEnvelope_`.
4. On the GitHub Pages site, replace the evaluation form with a link ("Vote on the secure page") to the `/exec` URL;
   the globe and presentations stay on GitHub Pages.

Trade-offs: the page is served inside a Google sandbox iframe on `script.googleusercontent.com` with a "created by a
Google Apps Script user" banner, has its own (simpler) styling, and cannot share the site's session storage, so users
sign in there separately. It is a contingency, not implemented, because nothing indicates the direct calls fail.
