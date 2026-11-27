/**
 * Auth.gs — access codes, session tokens, throttling and rotation.
 *
 * Access codes: 24 Crockford base32 characters (120 random bits), shown grouped as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.
 * Only a salted HMAC-SHA256 of the normalised code is stored (PARTICIPANT_CREDENTIALS). With 120 bits of entropy
 * per code a slow password hash adds nothing; throttling below stops online guessing.
 *
 * Session token (opaque to the browser, sent in the JSON body only):
 *   ge1.<participantId>.<sessionVersion>.<issuedAt s>.<expiresAt s>.<nonce>.<signature>
 *   signature = base64url_nopad(HMAC_SHA256(key = SESSION_SECRET, message = everything before the last ".")).
 * Logout and code rotation increment the participant's SESSION_VERSIONS entry, which invalidates every token
 * that carries the old version. Rotating SESSION_SECRET invalidates every token of everyone.
 *
 * Nothing in this file logs codes, hashes, salts, secrets or tokens.
 */

var TOKEN_PREFIX_ = 'ge1';
var CREDENTIAL_CONTEXT_ = 'ge-access-v1';
var CROCKFORD_ALPHABET_ = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
var GLOBAL_THROTTLE_KEY_ = '__global__';

/* ----------------------------------------------------------------------------------------------------------- */
/* Encoding helpers                                                                                             */
/* ----------------------------------------------------------------------------------------------------------- */

function base64UrlNoPad_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, '');
}

function hmacSha256B64_(message, key) {
  return base64UrlNoPad_(Utilities.computeHmacSha256Signature(message, key));
}

/** Compares two strings without an early exit (the inputs are HMAC outputs, never raw codes). */
function constantTimeEquals_(a, b) {
  a = String(a);
  b = String(b);
  var len = Math.max(a.length, b.length);
  var diff = a.length === b.length ? 0 : 1;
  for (var i = 0; i < len; i++) {
    var ca = i < a.length ? a.charCodeAt(i) : 0;
    var cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Cryptographically strong random bytes. Apps Script has no direct CSPRNG API; Utilities.getUuid() returns
 * version-4 UUIDs from Java's SecureRandom (122 random bits each). Two UUIDs per 32-byte block are hashed.
 */
function randomBytes_(n) {
  var out = [];
  var counter = 0;
  while (out.length < n) {
    var block = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + counter++
    );
    for (var i = 0; i < block.length && out.length < n; i++) out.push(block[i] & 0xff);
  }
  return out;
}

function randomToken_(byteLength) {
  var bytes = randomBytes_(byteLength).map(function (b) {
    return b > 127 ? b - 256 : b;
  });
  return base64UrlNoPad_(bytes);
}

/** Encodes unsigned bytes as Crockford base32 (5 bits per character, most significant bits first). */
function crockfordEncode_(bytes) {
  var bits = 0;
  var value = 0;
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] & 0xff);
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD_ALPHABET_.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD_ALPHABET_.charAt((value << (5 - bits)) & 31);
  return out;
}

/** New access code: 15 random bytes = 120 bits = 24 characters, grouped by four. */
function generateAccessCode_() {
  var raw = crockfordEncode_(randomBytes_(15));
  return raw.match(/.{1,4}/g).join('-');
}

/** Upper-case, drop spaces/hyphens, map Crockford look-alikes (O→0, I/L→1). */
function normalizeAccessCode_(code) {
  return String(code)
    .toUpperCase()
    .replace(/[\s\-_.]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

function credentialHash_(participantId, normalizedCode, salt) {
  return hmacSha256B64_(CREDENTIAL_CONTEXT_ + ':' + participantId + ':' + normalizedCode, salt);
}

/** Credential entry in the exact PARTICIPANT_CREDENTIALS format (used by rotation and by the demo seed). */
function buildCredential_(participantId, accessCode, salt) {
  var s = salt || randomToken_(16);
  return { salt: s, hash: credentialHash_(participantId, normalizeAccessCode_(accessCode), s) };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Session versions                                                                                             */
/* ----------------------------------------------------------------------------------------------------------- */

function getSessionVersions_() {
  var raw = scriptProperties_().getProperty(PROP_KEYS.SESSION_VERSIONS);
  if (!raw) return {};
  try {
    var parsed = JSON.parse(raw);
    return isPlainObject_(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function currentSessionVersion_(participantId) {
  var v = getSessionVersions_()[participantId];
  return typeof v === 'number' && v >= 1 ? Math.floor(v) : 1;
}

/** Caller must hold the script lock. */
function bumpSessionVersionLocked_(participantIds) {
  var versions = getSessionVersions_();
  participantIds.forEach(function (id) {
    var v = typeof versions[id] === 'number' && versions[id] >= 1 ? Math.floor(versions[id]) : 1;
    versions[id] = v + 1;
  });
  scriptProperties_().setProperty(PROP_KEYS.SESSION_VERSIONS, JSON.stringify(versions));
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Tokens                                                                                                       */
/* ----------------------------------------------------------------------------------------------------------- */

function requireSessionSecret_() {
  var cfg = getConfig_();
  if (!cfg.sessionSecret || cfg.sessionSecret.length < 32) {
    throw apiError_('NOT_CONFIGURED', 'The backend is not configured yet (SESSION_SECRET missing)');
  }
  return cfg.sessionSecret;
}

function issueSession_(participant) {
  var cfg = getConfig_();
  var secret = requireSessionSecret_();
  var iat = Math.floor(Date.now() / 1000);
  var exp = iat + Math.round(cfg.sessionHours * 3600);
  var nonce = randomToken_(12);
  var body = [TOKEN_PREFIX_, participant.id, currentSessionVersion_(participant.id), iat, exp, nonce].join('.');
  return {
    token: body + '.' + hmacSha256B64_(body, secret),
    participant: publicParticipant_(participant),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verifies a session token and returns { participant, expiresAt, sessionVersion }.
 * The participant identity used by every authenticated action comes from here and nowhere else.
 */
function authenticate_(token) {
  if (typeof token !== 'string' || !token) throw apiError_('UNAUTHENTICATED', 'Please sign in');
  var secret = requireSessionSecret_();
  if (token.length > 400) throw apiError_('UNAUTHENTICATED', 'Invalid session; please sign in again');
  var parts = token.split('.');
  if (parts.length !== 7 || parts[0] !== TOKEN_PREFIX_) throw apiError_('UNAUTHENTICATED', 'Invalid session; please sign in again');
  var body = parts.slice(0, 6).join('.');
  if (!constantTimeEquals_(hmacSha256B64_(body, secret), parts[6])) {
    throw apiError_('UNAUTHENTICATED', 'Invalid session; please sign in again');
  }
  var participant = findParticipant_(parts[1]);
  if (!participant || !/^\d{1,9}$/.test(parts[2]) || !/^\d{1,12}$/.test(parts[3]) || !/^\d{1,12}$/.test(parts[4])) {
    throw apiError_('UNAUTHENTICATED', 'Invalid session; please sign in again');
  }
  var sv = parseInt(parts[2], 10);
  var iat = parseInt(parts[3], 10);
  var exp = parseInt(parts[4], 10);
  var nowS = Date.now() / 1000;
  var maxAge = getConfig_().sessionHours * 3600;
  if (exp <= nowS || nowS - iat > maxAge) throw apiError_('SESSION_EXPIRED', 'Your session has expired; please sign in again');
  if (sv !== currentSessionVersion_(participant.id)) {
    throw apiError_('UNAUTHENTICATED', 'This session was signed out; please sign in again');
  }
  return { participant: participant, expiresAt: new Date(exp * 1000).toISOString(), sessionVersion: sv };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Login throttling (CacheService: best effort, entries may be evicted early)                                   */
/* ----------------------------------------------------------------------------------------------------------- */

function throttleKey_(kind, who) {
  return 'ge:' + kind + ':' + who;
}

function lockedOutSeconds_(cache, participantId) {
  var now = Date.now();
  var keys = [GLOBAL_THROTTLE_KEY_];
  if (participantId) keys.push(participantId);
  var remaining = 0;
  keys.forEach(function (who) {
    var until = Number(cache.get(throttleKey_('lockout', who)) || 0);
    if (until > now) remaining = Math.max(remaining, Math.ceil((until - now) / 1000));
  });
  return remaining;
}

function recordFailure_(cache, who, limit) {
  var now = Date.now();
  var key = throttleKey_('fail', who);
  var state = null;
  try {
    state = JSON.parse(cache.get(key) || 'null');
  } catch (e) {
    state = null;
  }
  if (!state || typeof state.n !== 'number' || now - state.t0 > LOGIN_FAILURE_WINDOW_SECONDS * 1000) state = { n: 0, t0: now };
  state.n += 1;
  if (state.n >= limit) {
    cache.put(throttleKey_('lockout', who), String(now + LOGIN_LOCKOUT_SECONDS * 1000), LOGIN_LOCKOUT_SECONDS);
    cache.remove(key);
    return;
  }
  var ttl = Math.max(1, LOGIN_FAILURE_WINDOW_SECONDS - Math.floor((now - state.t0) / 1000));
  cache.put(key, JSON.stringify(state), ttl);
}

function recordLoginFailure_(participantId) {
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(5000);
  } catch (e) {
    locked = false;
  }
  try {
    if (participantId) recordFailure_(cache, participantId, LOGIN_PARTICIPANT_FAILURE_LIMIT);
    recordFailure_(cache, GLOBAL_THROTTLE_KEY_, LOGIN_GLOBAL_FAILURE_LIMIT);
  } finally {
    if (locked) lock.releaseLock();
  }
}

function clearLoginFailures_(participantId) {
  var cache = CacheService.getScriptCache();
  cache.remove(throttleKey_('fail', participantId));
  cache.remove(throttleKey_('lockout', participantId));
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Actions                                                                                                      */
/* ----------------------------------------------------------------------------------------------------------- */

function handleLogin_(payload) {
  var cfg = getConfig_();
  requireSessionSecret_();
  if (!cfg.credentials) throw apiError_('NOT_CONFIGURED', 'The backend is not configured yet (access codes missing)');
  if (!isPlainObject_(payload)) throw apiError_('BAD_REQUEST', 'participantId and accessCode are required');
  var participantId = typeof payload.participantId === 'string' ? payload.participantId.trim().toLowerCase() : '';
  var accessCode = typeof payload.accessCode === 'string' ? payload.accessCode : '';
  if (!participantId || !accessCode) throw apiError_('BAD_REQUEST', 'participantId and accessCode are required');

  var participant = findParticipant_(participantId);
  var cache = CacheService.getScriptCache();
  var wait = lockedOutSeconds_(cache, participant ? participant.id : null);
  if (wait > 0) {
    throw apiError_('RATE_LIMITED', 'Too many failed sign-in attempts. Try again in ' + Math.ceil(wait / 60) + ' minute(s).');
  }

  var ok = false;
  var normalized = normalizeAccessCode_(accessCode.slice(0, 128));
  if (participant) {
    var cred = cfg.credentials[participant.id];
    if (!cred) throw apiError_('NOT_CONFIGURED', 'No access code is configured for this participant yet');
    ok = accessCode.length <= 128 && constantTimeEquals_(credentialHash_(participant.id, normalized, cred.salt), cred.hash);
  } else {
    credentialHash_('unknown', normalized, 'unknown-participant-salt'); // similar work for unknown ids
  }
  if (!ok) {
    recordLoginFailure_(participant ? participant.id : null);
    throw apiError_('INVALID_CREDENTIALS', 'Unknown participant or wrong access code');
  }
  clearLoginFailures_(participant.id);
  return issueSession_(participant);
}

function handleLogout_(auth) {
  withScriptLock_(function () {
    // Only bump if the token's version is still current (a second logout with the same token is a no-op).
    if (currentSessionVersion_(auth.participant.id) === auth.sessionVersion) bumpSessionVersionLocked_([auth.participant.id]);
  });
  return { loggedOut: true };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Admin functions (run from the "Expedition admin" menu or the editor; they never log codes or secrets)        */
/* ----------------------------------------------------------------------------------------------------------- */

/** Creates SESSION_SECRET if it is missing. Returns 'created' or 'exists'. Never returns the secret. */
function generateSessionSecret() {
  return withScriptLock_(function () {
    var props = scriptProperties_();
    var existing = props.getProperty(PROP_KEYS.SESSION_SECRET);
    if (existing && existing.length >= 32) return 'exists';
    props.setProperty(PROP_KEYS.SESSION_SECRET, randomToken_(48));
    resetConfigCache_();
    return 'created';
  });
}

/** Replaces SESSION_SECRET: every participant is signed out everywhere. */
function rotateSessionSecret() {
  return withScriptLock_(function () {
    scriptProperties_().setProperty(PROP_KEYS.SESSION_SECRET, randomToken_(48));
    resetConfigCache_();
    return 'rotated';
  });
}

/**
 * Generates a new access code for one participant, stores only its salted hash, signs that participant out
 * everywhere and clears their throttle state. Returns the new code so the menu can show it ONCE; it is not
 * stored or logged anywhere.
 */
function rotateAccessCode(participantId) {
  var participant = findParticipant_(String(participantId || '').trim().toLowerCase());
  if (!participant) throw new Error('Unknown participant id. Use one of: ' + PARTICIPANTS.map(function (p) { return p.id; }).join(', '));
  return withScriptLock_(function () {
    var props = scriptProperties_();
    var creds = {};
    try {
      creds = JSON.parse(props.getProperty(PROP_KEYS.PARTICIPANT_CREDENTIALS) || '{}') || {};
    } catch (e) {
      throw new Error('PARTICIPANT_CREDENTIALS is not valid JSON; fix or regenerate it first.');
    }
    var code = generateAccessCode_();
    creds[participant.id] = buildCredential_(participant.id, code);
    props.setProperty(PROP_KEYS.PARTICIPANT_CREDENTIALS, JSON.stringify(creds));
    bumpSessionVersionLocked_([participant.id]);
    clearLoginFailures_(participant.id);
    resetConfigCache_();
    return code;
  });
}

/** Signs one participant out of every device. */
function revokeSessions(participantId) {
  var participant = findParticipant_(String(participantId || '').trim().toLowerCase());
  if (!participant) throw new Error('Unknown participant id');
  withScriptLock_(function () {
    bumpSessionVersionLocked_([participant.id]);
  });
  return 'revoked';
}

/** Signs everyone out of every device. */
function revokeAllSessions() {
  withScriptLock_(function () {
    bumpSessionVersionLocked_(PARTICIPANTS.map(function (p) { return p.id; }));
  });
  return 'revoked';
}
