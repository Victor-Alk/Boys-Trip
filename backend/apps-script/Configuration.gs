/**
 * Configuration.gs — constants and Script Properties.
 *
 * Every Apps Script file shares one global scope. Top-level statements here are plain literals only, so the
 * order in which Apps Script loads the files never matters. Names ending in "_" are private helpers (they do
 * not appear in the editor's Run menu).
 *
 * Script Properties (Project Settings › Script Properties). Formats are documented in
 * docs/deployment/apps-script.md and backend/apps-script/script-properties.example.json.
 *   SPREADSHEET_ID           optional  spreadsheet id; default = the expedition spreadsheet below
 *   SESSION_SECRET           required  ≥ 32 characters; created by "Expedition admin › Set up" (never share it)
 *   PARTICIPANT_CREDENTIALS  required  JSON {"paco":{"salt":"…","hash":"…"},…} from `npm run codes`
 *   SESSION_VERSIONS         managed   JSON {"paco":1,…}; bumped by logout / rotation. Do not edit or delete.
 *   QUESTIONNAIRE_VERSION    optional  default "q1"
 *   BLIND_VOTING_ENABLED     optional  "true" (default) | "false"  (false ≡ RESULTS_REVEAL_POLICY=always)
 *   RESULTS_REVEAL_POLICY    optional  per-destination-complete (default) | all-complete | always | admin-only
 *   COMMENTS_VISIBILITY      optional  after-reveal (default) | author-only
 *   SESSION_EXPIRY_HOURS     optional  default 168 (1–2160)
 *   ALLOWED_DESTINATION_IDS  optional  "D01,D02,…" or JSON array; default = every id in Destinations.gs
 *   NOVELTY_DATA             optional  JSON {"D01":{"newToAll":true,"visitedCount":0,"visitedBy":[],"note":""},…}
 *   SHEET_NAMESPACE          optional  tab-name prefix such as "TEST_" (letters, digits, "_"; ≤ 20 chars)
 */

var BACKEND_VERSION = '1.0.0';
var DEFAULT_SPREADSHEET_ID = '1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg';

var PARTICIPANTS = [
  { id: 'paco', name: 'Paco' },
  { id: 'gaetan', name: 'Gaetan' },
  { id: 'alvarinn', name: 'Alvarinn' },
  { id: 'victor', name: 'Victor' },
];

var QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5'];
var ANSWER_MIN = 1;
var ANSWER_MAX = 10;
var COMMENT_MAX_LENGTH = 2000;
/** "Significant individual reservation" = Q1 (overall enthusiasm) at or below this value. */
var RESERVATION_Q1_THRESHOLD = 4;
/** Realistic total per person (EUR, flights included) above which a destination can never be ranked. */
var RANKING_BUDGET_MAX_EUR = 2500;

var REVEAL_POLICIES = ['per-destination-complete', 'all-complete', 'always', 'admin-only'];
var COMMENTS_VISIBILITIES = ['after-reveal', 'author-only'];

var DEFAULT_QUESTIONNAIRE_VERSION = 'q1';
var DEFAULT_REVEAL_POLICY = 'per-destination-complete';
var DEFAULT_COMMENTS_VISIBILITY = 'after-reveal';
var DEFAULT_SESSION_HOURS = 168;
var MAX_SESSION_HOURS = 2160;

/** LockService: how long a write waits for the script lock before answering LOCK_TIMEOUT. */
var LOCK_WAIT_MS = 20000;
/** Login throttling (CacheService). */
var LOGIN_FAILURE_WINDOW_SECONDS = 900;
var LOGIN_PARTICIPANT_FAILURE_LIMIT = 5;
var LOGIN_GLOBAL_FAILURE_LIMIT = 25;
var LOGIN_LOCKOUT_SECONDS = 900;
/** Idempotency cache lifetime (CacheService maximum is 6 h). The spreadsheet is the durable record. */
var IDEMPOTENCY_CACHE_SECONDS = 21600;
var MAX_REQUEST_BYTES = 16384;

var PROP_KEYS = {
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  SESSION_SECRET: 'SESSION_SECRET',
  PARTICIPANT_CREDENTIALS: 'PARTICIPANT_CREDENTIALS',
  SESSION_VERSIONS: 'SESSION_VERSIONS',
  QUESTIONNAIRE_VERSION: 'QUESTIONNAIRE_VERSION',
  BLIND_VOTING_ENABLED: 'BLIND_VOTING_ENABLED',
  RESULTS_REVEAL_POLICY: 'RESULTS_REVEAL_POLICY',
  COMMENTS_VISIBILITY: 'COMMENTS_VISIBILITY',
  SESSION_EXPIRY_HOURS: 'SESSION_EXPIRY_HOURS',
  ALLOWED_DESTINATION_IDS: 'ALLOWED_DESTINATION_IDS',
  NOVELTY_DATA: 'NOVELTY_DATA',
  SHEET_NAMESPACE: 'SHEET_NAMESPACE',
  RESULTS_STALE_SINCE: 'RESULTS_STALE_SINCE',
};

/** Per-execution cache (each Apps Script execution starts with fresh globals). */
var CONFIG_CACHE_ = null;

function scriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function resetConfigCache_() {
  CONFIG_CACHE_ = null;
}

/**
 * Parsed configuration. Never contains access codes; contains SESSION_SECRET and credential hashes, so it must
 * never be returned to a client or logged.
 */
function getConfig_() {
  if (CONFIG_CACHE_) return CONFIG_CACHE_;
  var props = scriptProperties_().getProperties() || {};
  var warnings = [];
  var errors = [];

  var spreadsheetId = String(props[PROP_KEYS.SPREADSHEET_ID] || '').trim() || DEFAULT_SPREADSHEET_ID;
  var sessionSecret = String(props[PROP_KEYS.SESSION_SECRET] || '');
  if (!sessionSecret) errors.push('SESSION_SECRET is not set (run Expedition admin › Set up).');
  else if (sessionSecret.length < 32) errors.push('SESSION_SECRET is too short (≥ 32 characters required).');

  var credentials = parseCredentials_(props[PROP_KEYS.PARTICIPANT_CREDENTIALS], errors, warnings);

  var questionnaireVersion = String(props[PROP_KEYS.QUESTIONNAIRE_VERSION] || '').trim() || DEFAULT_QUESTIONNAIRE_VERSION;
  var blindVoting = parseBoolean_(props[PROP_KEYS.BLIND_VOTING_ENABLED], true, 'BLIND_VOTING_ENABLED', warnings);

  var revealPolicy = String(props[PROP_KEYS.RESULTS_REVEAL_POLICY] || '').trim() || DEFAULT_REVEAL_POLICY;
  if (REVEAL_POLICIES.indexOf(revealPolicy) === -1) {
    warnings.push('RESULTS_REVEAL_POLICY "' + revealPolicy + '" is not recognised; using ' + DEFAULT_REVEAL_POLICY + '.');
    revealPolicy = DEFAULT_REVEAL_POLICY;
  }
  var effectiveRevealPolicy = blindVoting ? revealPolicy : 'always';

  var commentsVisibility = String(props[PROP_KEYS.COMMENTS_VISIBILITY] || '').trim() || DEFAULT_COMMENTS_VISIBILITY;
  if (COMMENTS_VISIBILITIES.indexOf(commentsVisibility) === -1) {
    warnings.push('COMMENTS_VISIBILITY "' + commentsVisibility + '" is not recognised; using author-only.');
    commentsVisibility = 'author-only';
  }

  var sessionHours = DEFAULT_SESSION_HOURS;
  if (props[PROP_KEYS.SESSION_EXPIRY_HOURS] !== undefined && String(props[PROP_KEYS.SESSION_EXPIRY_HOURS]).trim() !== '') {
    var h = Number(props[PROP_KEYS.SESSION_EXPIRY_HOURS]);
    if (isFinite(h) && h > 0 && h <= MAX_SESSION_HOURS) sessionHours = h;
    else warnings.push('SESSION_EXPIRY_HOURS must be a number between 1 and ' + MAX_SESSION_HOURS + '; using ' + DEFAULT_SESSION_HOURS + '.');
  }

  var namespace = String(props[PROP_KEYS.SHEET_NAMESPACE] || '').trim();
  if (!/^[A-Za-z0-9_]{0,20}$/.test(namespace)) {
    errors.push('SHEET_NAMESPACE may only contain letters, digits and "_" (≤ 20 characters).');
    namespace = null;
  }

  var destinationIds = parseAllowedDestinationIds_(props[PROP_KEYS.ALLOWED_DESTINATION_IDS], warnings);

  CONFIG_CACHE_ = {
    spreadsheetId: spreadsheetId,
    sessionSecret: sessionSecret,
    credentials: credentials,
    questionnaireVersion: questionnaireVersion,
    blindVoting: blindVoting && effectiveRevealPolicy !== 'always',
    revealPolicy: revealPolicy,
    effectiveRevealPolicy: effectiveRevealPolicy,
    commentsVisibility: commentsVisibility,
    sessionHours: sessionHours,
    namespace: namespace,
    destinationIds: destinationIds,
    noveltyRaw: props[PROP_KEYS.NOVELTY_DATA] || '',
    errors: errors,
    warnings: warnings,
  };
  return CONFIG_CACHE_;
}

function parseBoolean_(raw, fallback, name, warnings) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  var s = String(raw).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  warnings.push(name + ' must be "true" or "false"; using ' + fallback + '.');
  return fallback;
}

/**
 * PARTICIPANT_CREDENTIALS = {"paco":{"salt":"<base64url ≥16 chars>","hash":"<base64url, 43 chars>"},…}
 * hash = base64url_nopad(HMAC_SHA256(key = salt (UTF-8 string), message = "ge-access-v1:" + id + ":" + normalisedCode))
 */
function parseCredentials_(raw, errors, warnings) {
  if (!raw) {
    errors.push('PARTICIPANT_CREDENTIALS is not set (generate it with `npm run codes`).');
    return null;
  }
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    errors.push('PARTICIPANT_CREDENTIALS is not valid JSON.');
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('PARTICIPANT_CREDENTIALS must be a JSON object keyed by participant id.');
    return null;
  }
  var out = {};
  PARTICIPANTS.forEach(function (p) {
    var c = parsed[p.id];
    if (!c) {
      errors.push('PARTICIPANT_CREDENTIALS has no entry for "' + p.id + '".');
      return;
    }
    if (typeof c.salt !== 'string' || c.salt.length < 16 || typeof c.hash !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(c.hash)) {
      errors.push('PARTICIPANT_CREDENTIALS entry for "' + p.id + '" must have a salt (≥ 16 chars) and a 43-character base64url hash.');
      return;
    }
    out[p.id] = { salt: c.salt, hash: c.hash };
  });
  Object.keys(parsed).forEach(function (k) {
    if (!findParticipant_(k)) warnings.push('PARTICIPANT_CREDENTIALS contains an unknown participant "' + k + '" (ignored).');
  });
  return out;
}

function parseAllowedDestinationIds_(raw, warnings) {
  var registryIds = Object.keys(getDestinationRegistry_()).sort();
  if (raw === undefined || raw === null || String(raw).trim() === '') return registryIds;
  var list;
  var s = String(raw).trim();
  if (s.charAt(0) === '[') {
    try {
      list = JSON.parse(s);
    } catch (e) {
      warnings.push('ALLOWED_DESTINATION_IDS is not valid JSON; using every registry id.');
      return registryIds;
    }
  } else {
    list = s.split(/[\s,;]+/);
  }
  var seen = {};
  var ids = [];
  (Array.isArray(list) ? list : []).forEach(function (id) {
    var v = String(id).trim().toUpperCase();
    if (!v) return;
    if (!/^D\d{2}$/.test(v)) {
      warnings.push('ALLOWED_DESTINATION_IDS entry "' + v + '" is not an id like D07 (ignored).');
      return;
    }
    if (!seen[v]) {
      seen[v] = true;
      ids.push(v);
    }
  });
  if (!ids.length) {
    warnings.push('ALLOWED_DESTINATION_IDS is empty; using every registry id.');
    return registryIds;
  }
  return ids.sort();
}

function findParticipant_(id) {
  for (var i = 0; i < PARTICIPANTS.length; i++) {
    if (PARTICIPANTS[i].id === id) return PARTICIPANTS[i];
  }
  return null;
}

function publicParticipant_(p) {
  return { id: p.id, name: p.name };
}

/** Registry entry for a destination (see Destinations.gs), with a safe fallback for ids not in the registry. */
function getDestinationMeta_(id) {
  var reg = getDestinationRegistry_();
  var m = reg[id];
  if (m) return m;
  return { name: id, title: null, version: null, securityStatus: null, realisticTotalEUR: null, budgetStatus: null, materialUncertainty: null, pending: true };
}

function isKnownDestination_(id) {
  return typeof id === 'string' && getConfig_().destinationIds.indexOf(id) !== -1;
}

function getDestinationRegistry_() {
  return typeof DESTINATION_REGISTRY === 'object' && DESTINATION_REGISTRY ? DESTINATION_REGISTRY : {};
}

/** True when every participant can log in and sessions can be signed. */
function isConfigured_(cfg) {
  cfg = cfg || getConfig_();
  return cfg.errors.length === 0 && !!cfg.credentials && Object.keys(cfg.credentials).length === PARTICIPANTS.length;
}

function maxActiveResponses_(cfg) {
  cfg = cfg || getConfig_();
  return PARTICIPANTS.length * cfg.destinationIds.length;
}

/** PublicConfig (contract) — no secrets. */
function publicConfig_() {
  var cfg = getConfig_();
  return {
    questionnaireVersion: cfg.questionnaireVersion,
    blindVoting: cfg.blindVoting,
    revealPolicy: cfg.effectiveRevealPolicy,
    commentsVisibility: cfg.commentsVisibility,
    sessionHours: cfg.sessionHours,
    participants: PARTICIPANTS.map(publicParticipant_),
    destinationIds: cfg.destinationIds.slice(),
    backendVersion: BACKEND_VERSION,
  };
}
