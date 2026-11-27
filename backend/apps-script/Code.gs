/**
 * Code.gs — web-app entry points (doPost / doGet), envelope, routing and error mapping.
 *
 * Contract: docs/architecture/api-contract.md. Requests are POSTed as text/plain JSON (a CORS "simple request",
 * so the browser sends no preflight). The session token travels in the JSON body, never in the URL.
 * Apps Script cannot set HTTP status codes: success or failure is always in the body.
 *
 * Logging policy: only the action name, the error code and generic error text are ever logged — never request
 * bodies, access codes, tokens, comments or scores.
 */

var RETRYABLE_CODES_ = { LOCK_TIMEOUT: true, SHEET_ERROR: true, INTERNAL: true };
var LOCK_DEPTH_ = 0;

function apiError_(code, message) {
  var err = new Error(message);
  err.apiCode = code;
  return err;
}

/**
 * Runs fn under the script lock (re-entrant within one execution). A busy lock → LOCK_TIMEOUT (retryable).
 * Pending spreadsheet writes are flushed before the lock is released.
 */
function withScriptLock_(fn) {
  if (LOCK_DEPTH_ > 0) return fn();
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    throw apiError_('LOCK_TIMEOUT', 'The server is busy; please try again');
  }
  LOCK_DEPTH_++;
  try {
    var out = fn();
    SpreadsheetApp.flush();
    return out;
  } finally {
    LOCK_DEPTH_--;
    lock.releaseLock();
  }
}

var ACTIONS_ = {
  health: { auth: false },
  config: { auth: false },
  login: { auth: false },
  logout: { auth: true },
  me: { auth: true },
  myResponses: { auth: true },
  submit: { auth: true },
  completion: { auth: true },
  results: { auth: true },
  novelty: { auth: true },
};

function runAction_(action, envelope) {
  if (action === 'health') {
    var cfg = getConfig_();
    return { status: 'ok', configured: isConfigured_(cfg), questionnaireVersion: cfg.questionnaireVersion, backendVersion: BACKEND_VERSION };
  }
  if (action === 'config') return publicConfig_();
  if (action === 'login') return handleLogin_(envelope.payload);

  var auth = authenticate_(envelope.token);
  switch (action) {
    case 'logout':
      return handleLogout_(auth);
    case 'me':
      return handleMe_(auth);
    case 'myResponses':
      return handleMyResponses_(auth);
    case 'submit':
      return handleSubmit_(auth, envelope.payload, envelope.requestId);
    case 'completion':
      return handleCompletion_(auth);
    case 'results':
      return handleResults_(auth);
    case 'novelty':
      return handleNovelty_(auth);
  }
  throw apiError_('UNKNOWN_ACTION', 'Unknown action');
}

/** Maps any thrown value to a contract error. Internal details are logged (sanitised), never returned. */
function toErrorBody_(err, action) {
  if (err && err.apiCode) {
    return { code: err.apiCode, message: String(err.message || err.apiCode), retryable: !!RETRYABLE_CODES_[err.apiCode] };
  }
  var raw = err && err.message ? String(err.message) : String(err);
  var looksLikeLock = /lock/i.test(raw) && /timeout|timed out|another process/i.test(raw);
  var looksLikeSheets = /spreadsheet|sheet|range|service .*(unavailable|error|timed out)|too many|quota|exceeded/i.test(raw);
  var code = looksLikeLock ? 'LOCK_TIMEOUT' : looksLikeSheets ? 'SHEET_ERROR' : 'INTERNAL';
  console.error('[expedition] action=' + action + ' code=' + code + ' error=' + raw.slice(0, 300));
  var message = code === 'LOCK_TIMEOUT' ? 'The server is busy; please try again'
    : code === 'SHEET_ERROR' ? 'The spreadsheet is temporarily unavailable; please try again'
      : 'Unexpected server error; please try again';
  return { code: code, message: message, retryable: true };
}

/** Processes one envelope object and returns the response object (used by doPost and by tests). */
function handleEnvelope_(envelope) {
  var action = '(none)';
  try {
    if (!isPlainObject_(envelope)) throw apiError_('BAD_REQUEST', 'Request body must be a JSON object');
    if (typeof envelope.action !== 'string' || !envelope.action) throw apiError_('BAD_REQUEST', 'action is required');
    if (!Object.prototype.hasOwnProperty.call(ACTIONS_, envelope.action)) {
      action = '(unknown)';
      throw apiError_('UNKNOWN_ACTION', 'Unknown action');
    }
    action = envelope.action;
    if (envelope.token !== undefined && envelope.token !== null && typeof envelope.token !== 'string') {
      throw apiError_('BAD_REQUEST', 'token must be a string');
    }
    if (envelope.payload !== undefined && envelope.payload !== null && !isPlainObject_(envelope.payload)) {
      throw apiError_('BAD_REQUEST', 'payload must be an object');
    }
    var data = runAction_(action, envelope);
    return { ok: true, data: data, serverTime: new Date().toISOString() };
  } catch (err) {
    return { ok: false, error: toErrorBody_(err, action), serverTime: new Date().toISOString() };
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var contents = e && e.postData && typeof e.postData.contents === 'string' ? e.postData.contents : '';
  if (!contents) {
    return jsonOutput_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Empty request body', retryable: false }, serverTime: new Date().toISOString() });
  }
  if (contents.length > MAX_REQUEST_BYTES) {
    return jsonOutput_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Request too large', retryable: false }, serverTime: new Date().toISOString() });
  }
  var envelope;
  try {
    envelope = JSON.parse(contents);
  } catch (parseError) {
    // The parser message can quote the body (which may contain a code): never log or echo it.
    return jsonOutput_({ ok: false, error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON', retryable: false }, serverTime: new Date().toISOString() });
  }
  return jsonOutput_(handleEnvelope_(envelope));
}

/** GET is for monitoring only: ?action=health (the default). Nothing private is ever served over GET. */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : 'health';
  if (action !== 'health') {
    return jsonOutput_({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Only action=health is available over GET; use POST', retryable: false },
      serverTime: new Date().toISOString(),
    });
  }
  return jsonOutput_(handleEnvelope_({ action: 'health' }));
}
