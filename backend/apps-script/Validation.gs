/**
 * Validation.gs — request validation and spreadsheet-safety helpers.
 */

var UUID_PATTERN_ = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var SEMVER_PATTERN_ = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
/** Characters that make Google Sheets interpret a string as a formula (or strip a text marker). */
var FORMULA_TRIGGER_PATTERN_ = /^[=+\-@\t\r']/;
var SANITISED_PATTERN_ = /^'[=+\-@\t\r']/;

function isPlainObject_(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isUuid_(s) {
  return typeof s === 'string' && UUID_PATTERN_.test(s);
}

function isValidAnswer_(v) {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= ANSWER_MIN && v <= ANSWER_MAX;
}

/**
 * Validates a `submit` payload for the authenticated participant and returns a normalised copy.
 * The participant always comes from the verified session; a payload `participantId` that names anyone else is
 * rejected (FORBIDDEN), and one that matches the caller is ignored.
 */
function validateSubmitPayload_(payload, participant) {
  var cfg = getConfig_();
  if (!isPlainObject_(payload)) throw apiError_('VALIDATION_FAILED', 'payload must be an object');

  if (payload.participantId !== undefined && payload.participantId !== null && payload.participantId !== participant.id) {
    throw apiError_('FORBIDDEN', 'You can only submit your own evaluations');
  }

  var destinationId = payload.destinationId;
  if (typeof destinationId !== 'string' || !destinationId) throw apiError_('VALIDATION_FAILED', 'destinationId is required');
  if (!isKnownDestination_(destinationId)) throw apiError_('VALIDATION_FAILED', 'Unknown destination ' + safeEcho_(destinationId));

  var answers = payload.answers;
  if (!isPlainObject_(answers)) throw apiError_('VALIDATION_FAILED', 'answers must contain q1 to q5');
  var keys = Object.keys(answers);
  for (var k = 0; k < keys.length; k++) {
    if (QUESTION_IDS.indexOf(keys[k]) === -1) throw apiError_('VALIDATION_FAILED', 'Unexpected answer ' + safeEcho_(keys[k]));
  }
  var clean = {};
  for (var i = 0; i < QUESTION_IDS.length; i++) {
    var q = QUESTION_IDS[i];
    if (!(q in answers)) throw apiError_('VALIDATION_FAILED', q + ' is missing');
    if (!isValidAnswer_(answers[q])) throw apiError_('VALIDATION_FAILED', q + ' must be an integer from ' + ANSWER_MIN + ' to ' + ANSWER_MAX);
    clean[q] = answers[q];
  }

  var comments = payload.comments;
  if (comments === undefined || comments === null) comments = '';
  if (typeof comments !== 'string') throw apiError_('VALIDATION_FAILED', 'comments must be text');
  comments = normaliseComment_(comments);
  if (comments.length > COMMENT_MAX_LENGTH) {
    throw apiError_('VALIDATION_FAILED', 'comments must be at most ' + COMMENT_MAX_LENGTH + ' characters');
  }

  if (payload.questionnaireVersion !== cfg.questionnaireVersion) {
    throw apiError_('VALIDATION_FAILED', 'Questionnaire version mismatch (expected ' + cfg.questionnaireVersion + '); please reload the page');
  }
  var destinationVersion = payload.destinationVersion;
  if (typeof destinationVersion !== 'string' || !SEMVER_PATTERN_.test(destinationVersion)) {
    throw apiError_('VALIDATION_FAILED', 'destinationVersion must look like 1.0.0');
  }

  return {
    destinationId: destinationId,
    destinationName: getDestinationMeta_(destinationId).name,
    answers: clean,
    individualScore: individualScore_(clean),
    comments: comments,
    questionnaireVersion: cfg.questionnaireVersion,
    destinationVersion: destinationVersion,
  };
}

/** Unrounded mean of the five answers (computed server-side only). */
function individualScore_(answers) {
  var sum = 0;
  for (var i = 0; i < QUESTION_IDS.length; i++) sum += answers[QUESTION_IDS[i]];
  return sum / QUESTION_IDS.length;
}

/** CRLF → LF, strip control characters other than tab/newline, trim. */
function normaliseComment_(s) {
  return String(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/** Short, harmless echo of a client value for error messages (never echoes long or odd input). */
function safeEcho_(v) {
  var s = String(v);
  if (s.length > 12 || !/^[A-Za-z0-9_-]*$/.test(s)) return '(invalid value)';
  return '"' + s + '"';
}

/**
 * Formula-injection protection. Any string written to a sheet that starts with = + - @ tab, CR or an
 * apostrophe gets a leading apostrophe, which Sheets treats as "this is text". The target cells are also
 * formatted as plain text ("@") before writing (see Responses.gs), so either layer alone prevents evaluation.
 */
function sanitizeForSheet_(value) {
  if (typeof value !== 'string') return value;
  return FORMULA_TRIGGER_PATTERN_.test(value) ? "'" + value : value;
}

/** Inverse of sanitizeForSheet_ for values read back (Sheets may or may not keep the marker). */
function unsanitizeFromSheet_(value) {
  if (typeof value !== 'string') return value;
  return SANITISED_PATTERN_.test(value) ? value.slice(1) : value;
}

/** Normalises a cell value that should be an ISO 8601 string (Sheets may return a Date object). */
function cellToIso_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}

function cellToString_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return cellToIso_(v);
  return String(v);
}

function cellToNumber_(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  var n = typeof v === 'number' ? v : Number(v);
  return isFinite(n) ? n : NaN;
}
