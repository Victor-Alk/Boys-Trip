/**
 * Destination proposals ("prompts").
 *
 * Signed-in participants describe an expedition they would like researched; the text is stored in the
 * Prompts tab with status "new". The orchestrator's processing script (scripts/prompts.mjs) reads new
 * prompts with an admin key, researches each one into a full destination, registers it here so votes are
 * accepted without re-pasting the backend, and marks the prompt "done". A prompt is only ever processed
 * while its status is "new", so nothing is researched twice.
 *
 * Script Properties used:
 *   ADMIN_KEY_HASH       "salt:hmac" written by `npm run admin-key` (the key itself never leaves the Mac)
 *   EXTRA_DESTINATIONS   JSON map of registry entries for destinations added after D20 (managed by the API)
 */

var PROMPTS_HEADERS = [
  'prompt_id', 'participant_id', 'participant_name', 'prompt', 'created_at', 'status',
  'updated_at', 'destination_id', 'processor_note', 'request_id',
];
var PROMPTS_FORMATS = ['@', '@', '@', '@', '@', '@', '@', '@', '@', '@'];
var PROMPT_STATUSES = ['new', 'processing', 'done', 'declined'];
var PROMPT_MIN_CHARS = 10;
var PROMPT_MAX_CHARS = 1500;
var MAX_OPEN_PROMPTS_PER_PARTICIPANT = 5;
var ADMIN_FAIL_LIMIT = 10;
var ADMIN_FAIL_WINDOW_S = 900;

function promptsSheet_() {
  return ensureTables_().prompts;
}

function promptFromRow_(row) {
  return {
    promptId: String(row[0]),
    participantId: String(row[1]),
    participantName: String(row[2]),
    prompt: unsanitizeFromSheet_(String(row[3])),
    createdAt: String(row[4]),
    status: String(row[5]) || 'new',
    updatedAt: String(row[6]),
    destinationId: String(row[7]) || null,
    note: unsanitizeFromSheet_(String(row[8])),
    requestId: String(row[9]),
  };
}

function readPrompts_() {
  var sheet = promptsSheet_();
  return readDataRows_(sheet, PROMPTS_HEADERS.length)
    .filter(function (r) { return String(r[0]); })
    .map(function (r, i) {
      var p = promptFromRow_(r);
      p.rowIndex = i + 2;
      return p;
    });
}

function publicPrompt_(p) {
  return {
    promptId: p.promptId, participantId: p.participantId, participantName: p.participantName, prompt: p.prompt,
    createdAt: p.createdAt, status: p.status, updatedAt: p.updatedAt, destinationId: p.destinationId, note: p.note,
  };
}

/** submitPrompt (auth): one new proposal, idempotent on requestId. */
function handleSubmitPrompt_(auth, payload, requestId) {
  payload = payload || {};
  var text = typeof payload.prompt === 'string' ? payload.prompt.replace(/\s+/g, ' ').trim() : '';
  if (text.length < PROMPT_MIN_CHARS) throw apiError_('VALIDATION_FAILED', 'Describe the expedition in at least ' + PROMPT_MIN_CHARS + ' characters');
  if (text.length > PROMPT_MAX_CHARS) throw apiError_('VALIDATION_FAILED', 'Keep the proposal under ' + PROMPT_MAX_CHARS + ' characters');
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(requestId)) throw apiError_('BAD_REQUEST', 'requestId is required');
  return withScriptLock_(function () {
    var all = readPrompts_();
    for (var i = 0; i < all.length; i++) {
      if (all[i].requestId === requestId && all[i].participantId === auth.participant.id) {
        return { prompt: publicPrompt_(all[i]), idempotentReplay: true };
      }
    }
    var open = all.filter(function (p) { return p.participantId === auth.participant.id && (p.status === 'new' || p.status === 'processing'); });
    if (open.length >= MAX_OPEN_PROMPTS_PER_PARTICIPANT) {
      throw apiError_('VALIDATION_FAILED', 'You already have ' + open.length + ' proposals waiting; wait until they are processed');
    }
    var now = new Date().toISOString();
    var rec = {
      promptId: 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(),
      participantId: auth.participant.id, participantName: auth.participant.name, prompt: text,
      createdAt: now, status: 'new', updatedAt: now, destinationId: null, note: '', requestId: requestId,
    };
    var sheet = promptsSheet_();
    writeRowAt_(sheet, Math.max(sheet.getLastRow(), 1) + 1, [
      rec.promptId, rec.participantId, rec.participantName, rec.prompt, rec.createdAt, rec.status,
      rec.updatedAt, '', '', rec.requestId,
    ], PROMPTS_FORMATS);
    return { prompt: publicPrompt_(rec), idempotentReplay: false };
  });
}

/** prompts (auth): every proposal — they are proposals to the whole group, not votes. */
function handleListPrompts_() {
  return { prompts: readPrompts_().map(publicPrompt_).reverse() };
}

/* ------------------------------------------------------------------------------------------------------- */
/* Admin (processing script)                                                                                */
/* ------------------------------------------------------------------------------------------------------- */

function requireAdmin_(envelope) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('adminfail') || '0', 10);
  if (fails >= ADMIN_FAIL_LIMIT) throw apiError_('RATE_LIMITED', 'Too many attempts; try again later');
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY_HASH');
  var key = envelope && typeof envelope.adminKey === 'string' ? envelope.adminKey : '';
  if (!stored || stored.indexOf(':') === -1) throw apiError_('NOT_CONFIGURED', 'ADMIN_KEY_HASH is not set');
  var salt = stored.slice(0, stored.indexOf(':'));
  var expected = stored.slice(stored.indexOf(':') + 1);
  if (!key || key.length > 200 || !constantTimeEquals_(hmacSha256B64_(key, salt), expected)) {
    cache.put('adminfail', String(fails + 1), ADMIN_FAIL_WINDOW_S);
    throw apiError_('FORBIDDEN', 'Admin key rejected');
  }
}

function handleAdminListPrompts_(payload) {
  var status = payload && typeof payload.status === 'string' ? payload.status : null;
  if (status && PROMPT_STATUSES.indexOf(status) === -1) throw apiError_('VALIDATION_FAILED', 'Unknown status');
  return { prompts: readPrompts_().filter(function (p) { return !status || p.status === status; }).map(publicPrompt_) };
}

/** adminUpdatePrompt: status transitions new → processing → done | declined (done is final). */
function handleAdminUpdatePrompt_(payload) {
  payload = payload || {};
  if (PROMPT_STATUSES.indexOf(payload.status) === -1) throw apiError_('VALIDATION_FAILED', 'Unknown status');
  if (payload.destinationId != null && !/^D\d{2}$/.test(String(payload.destinationId))) throw apiError_('VALIDATION_FAILED', 'destinationId must look like D21');
  var note = typeof payload.note === 'string' ? payload.note.slice(0, 500) : '';
  return withScriptLock_(function () {
    var all = readPrompts_();
    var p = all.filter(function (x) { return x.promptId === payload.promptId; })[0];
    if (!p) throw apiError_('VALIDATION_FAILED', 'Unknown promptId');
    if (p.status === 'done' && payload.status !== 'done') throw apiError_('VALIDATION_FAILED', 'This prompt is already done');
    var now = new Date().toISOString();
    var sheet = promptsSheet_();
    writeRowAt_(sheet, p.rowIndex, [
      p.promptId, p.participantId, p.participantName, p.prompt, p.createdAt, payload.status,
      now, payload.destinationId || p.destinationId || '', note || p.note || '', p.requestId,
    ], PROMPTS_FORMATS);
    p.status = payload.status;
    p.updatedAt = now;
    p.destinationId = payload.destinationId || p.destinationId;
    p.note = note || p.note;
    return { prompt: publicPrompt_(p) };
  });
}

/** adminRegisterDestination: lets a researched destination receive votes without re-pasting the script. */
function handleAdminRegisterDestination_(payload) {
  var e = payload && payload.entry;
  if (!e || !/^D\d{2}$/.test(String(e.id))) throw apiError_('VALIDATION_FAILED', 'entry.id must look like D21');
  if (DESTINATION_REGISTRY[e.id]) throw apiError_('VALIDATION_FAILED', e.id + ' is one of the original destinations');
  var entry = {
    name: String(e.name || e.id).slice(0, 80),
    title: String(e.title || '').slice(0, 160),
    version: /^\d+\.\d+\.\d+$/.test(String(e.version)) ? String(e.version) : '1.0.0',
    securityStatus: ['eligible', 'conditional', 'excluded'].indexOf(e.securityStatus) !== -1 ? e.securityStatus : 'conditional',
    realisticTotalEUR: typeof e.realisticTotalEUR === 'number' && isFinite(e.realisticTotalEUR) ? e.realisticTotalEUR : null,
    budgetStatus: typeof e.budgetStatus === 'string' ? e.budgetStatus.slice(0, 40) : null,
    materialUncertainty: !!e.materialUncertainty,
    pending: false,
  };
  return withScriptLock_(function () {
    var props = PropertiesService.getScriptProperties();
    var extra = parseExtraDestinations_(props.getProperty('EXTRA_DESTINATIONS'));
    extra[e.id] = entry;
    props.setProperty('EXTRA_DESTINATIONS', JSON.stringify(extra));
    CONFIG_CACHE_ = null;
    return { registered: e.id, destinationIds: getConfig_().destinationIds };
  });
}

function parseExtraDestinations_(raw) {
  if (!raw) return {};
  try {
    var obj = JSON.parse(raw);
    var out = {};
    Object.keys(obj || {}).forEach(function (id) {
      if (/^D\d{2}$/.test(id) && obj[id] && typeof obj[id] === 'object') out[id] = obj[id];
    });
    return out;
  } catch (err) {
    return {};
  }
}

/** adminSetNovelty: replaces NOVELTY_DATA (private travel-history novelty) — never stored in the repository. */
function handleAdminSetNovelty_(payload) {
  var map = payload && payload.novelty;
  if (!map || typeof map !== 'object') throw apiError_('VALIDATION_FAILED', 'novelty map required');
  var clean = {};
  Object.keys(map).forEach(function (id) {
    var e = map[id];
    if (!/^D\d{2}$/.test(id) || !e || typeof e !== 'object') return;
    var visitedBy = Array.isArray(e.visitedBy) ? e.visitedBy.filter(function (p) { return !!findParticipant_(p); }) : [];
    clean[id] = { newToAll: visitedBy.length === 0, visitedCount: visitedBy.length, visitedBy: visitedBy, note: String(e.note || '').slice(0, 300) };
  });
  var json = JSON.stringify(clean);
  if (json.length > 9000) throw apiError_('VALIDATION_FAILED', 'Novelty data too large for one Script Property');
  PropertiesService.getScriptProperties().setProperty('NOVELTY_DATA', json);
  CONFIG_CACHE_ = null;
  return { destinations: Object.keys(clean).length };
}
