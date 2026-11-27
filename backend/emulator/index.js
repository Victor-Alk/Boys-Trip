/**
 * Apps Script emulator — runs the real backend/apps-script/*.gs sources in Node (tests) or in the browser
 * (demo mode) with in-memory fakes of SpreadsheetApp, PropertiesService, CacheService, LockService, Utilities,
 * ContentService, Logger and Session. ES module, no Node built-ins.
 *
 *   const emu = createAppsScriptEmulator({ sources, storage, now, properties });
 *   emu.doPost(JSON.stringify({ action: 'health' }))  → parsed JSON response
 *   emu.doGet({ action: 'health' })                    → parsed JSON response
 *   emu.call('rebuildResults')                         → return value of any top-level .gs function
 *
 * Every doPost / doGet / call is a separate "execution": the sources' top-level code runs again with fresh
 * globals (as in Apps Script), locks held by the execution are released when it ends, and the state is saved
 * through `storage` (if given). Locks are shared between executions, so a nested call made from a write hook
 * observes the lock as held — that is how concurrency is simulated.
 */
import { createSheetsService, createUi } from './sheets.js';
import {
  base64Decode, base64Encode, base64EncodeWebSafe, hmacSha256, sha256, toBytes, toSignedArray, utf8Decode, uuidV4,
} from './crypto.js';

/** Load order used by the demo client and the tests (function declarations make the order non-critical). */
export const BACKEND_SOURCE_FILES = [
  'Configuration.gs', 'Destinations.gs', 'Validation.gs', 'Auth.gs', 'Setup.gs', 'Responses.gs', 'Results.gs', 'Code.gs',
];

export const DEFAULT_SPREADSHEET_ID = '1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg';
const MAX_CACHE_TTL_SECONDS = 21600;

function normaliseSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('createAppsScriptEmulator: `sources` must be a non-empty array');
  return sources.map((s, i) => {
    if (typeof s === 'string') return { name: `source${i}.gs`, code: s };
    if (s && typeof s.code === 'string') return { name: s.name || `source${i}.gs`, code: s.code };
    throw new Error('createAppsScriptEmulator: each source must be a string or { name, code }');
  });
}

function emptyState() {
  return { version: 1, properties: {}, userProperties: {}, cache: {}, spreadsheets: {} };
}

export function createAppsScriptEmulator(options = {}) {
  const list = normaliseSources(options.sources);
  const nowFn = typeof options.now === 'function' ? () => Number(options.now()) : () => Date.now();
  const storage = options.storage || null;
  const activeSpreadsheetId = options.activeSpreadsheetId || DEFAULT_SPREADSHEET_ID;

  let state = null;
  if (storage && typeof storage.load === 'function') {
    try {
      state = storage.load();
    } catch {
      state = null;
    }
  }
  if (!state || typeof state !== 'object' || state.version !== 1) state = emptyState();
  for (const k of ['properties', 'userProperties', 'cache', 'spreadsheets']) if (!state[k] || typeof state[k] !== 'object') state[k] = {};
  if (options.properties) {
    for (const [k, v] of Object.entries(options.properties)) {
      if (!(k in state.properties) && v !== undefined && v !== null) state.properties[k] = String(v);
    }
  }
  if (options.spreadsheets) {
    for (const [id, ss] of Object.entries(options.spreadsheets)) if (!state.spreadsheets[id]) state.spreadsheets[id] = ss;
  }

  const logs = [];
  const hooks = { onWrite: null };
  const lockState = { holder: null };
  const { ui, record: uiRecord } = createUi();
  let executionCounter = 0;

  // ---- Date with an injectable clock --------------------------------------------------------------------------
  const RealDate = Date;
  class EmulatedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(nowFn());
      else super(...args);
    }
    static now() {
      return nowFn();
    }
  }

  // ---- Code under test ----------------------------------------------------------------------------------------
  const code = list.map((s) => `// ---- ${s.name} ----\n${s.code}`).join('\n;\n');
  const fnNames = Array.from(new Set(Array.from(code.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm), (m) => m[1])));
  const exportsSrc = `\n;\nreturn {${fnNames.map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`).join(', ')}};`;
  const injected = ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'Utilities', 'ContentService',
    'HtmlService', 'Logger', 'Session', 'ScriptApp', 'console', 'Date'];
  // eslint-disable-next-line no-new-func
  const factory = new Function(...injected, code + exportsSrc);

  // ---- Services -----------------------------------------------------------------------------------------------
  const log = (level, args) => {
    logs.push({ level, message: args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ') });
  };
  const fakeConsole = {
    log: (...a) => log('log', a), info: (...a) => log('info', a), warn: (...a) => log('warn', a),
    error: (...a) => log('error', a), debug: (...a) => log('debug', a),
  };
  const Logger = { log: (...a) => { log('logger', a); return Logger; }, getLog: () => logs.map((l) => l.message).join('\n'), clear: () => { logs.length = 0; } };

  const propertyStore = (bag) => ({
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(state[bag], k) ? state[bag][k] : null),
    setProperty(k, v) { state[bag][String(k)] = String(v); return this; },
    getProperties: () => ({ ...state[bag] }),
    setProperties(obj, deleteAllOthers) {
      if (deleteAllOthers) state[bag] = {};
      for (const [k, v] of Object.entries(obj || {})) state[bag][k] = String(v);
      return this;
    },
    deleteProperty(k) { delete state[bag][k]; return this; },
    deleteAllProperties() { state[bag] = {}; return this; },
    getKeys: () => Object.keys(state[bag]),
  });
  const PropertiesService = {
    getScriptProperties: () => propertyStore('properties'),
    getUserProperties: () => propertyStore('userProperties'),
    getDocumentProperties: () => propertyStore('userProperties'),
  };

  const scriptCache = {
    get(key) {
      const e = state.cache[key];
      if (!e) return null;
      if (e.e <= nowFn()) {
        delete state.cache[key];
        return null;
      }
      return e.v;
    },
    getAll(keys) {
      const out = {};
      for (const k of keys) {
        const v = scriptCache.get(k);
        if (v !== null) out[k] = v;
      }
      return out;
    },
    put(key, value, ttlSeconds = 600) {
      const ttl = Math.max(1, Math.min(MAX_CACHE_TTL_SECONDS, Number(ttlSeconds) || 600));
      state.cache[String(key)] = { v: String(value), e: nowFn() + ttl * 1000 };
    },
    putAll(values, ttlSeconds) {
      for (const [k, v] of Object.entries(values)) scriptCache.put(k, v, ttlSeconds);
    },
    remove(key) { delete state.cache[key]; },
    removeAll(keys) { for (const k of keys) delete state.cache[k]; },
  };
  const CacheService = { getScriptCache: () => scriptCache, getUserCache: () => scriptCache, getDocumentCache: () => scriptCache };

  const DigestAlgorithm = { MD2: 'MD2', MD5: 'MD5', SHA_1: 'SHA_1', SHA_256: 'SHA_256', SHA_384: 'SHA_384', SHA_512: 'SHA_512' };
  const MacAlgorithm = { HMAC_MD5: 'HMAC_MD5', HMAC_SHA_1: 'HMAC_SHA_1', HMAC_SHA_256: 'HMAC_SHA_256', HMAC_SHA_384: 'HMAC_SHA_384', HMAC_SHA_512: 'HMAC_SHA_512' };
  const Charset = { US_ASCII: 'US_ASCII', UTF_8: 'UTF_8' };
  const makeBlob = (bytes, contentType = null, name = null) => {
    let data = toBytes(bytes);
    const blob = {
      getBytes: () => toSignedArray(data),
      getDataAsString: () => utf8Decode(data),
      setDataFromString(s) { data = toBytes(String(s)); return blob; },
      getContentType: () => contentType,
      getName: () => name,
      setName(n) { name = n; return blob; },
    };
    return blob;
  };
  const Utilities = {
    DigestAlgorithm, MacAlgorithm, Charset,
    computeDigest(algorithm, value) {
      if (algorithm !== DigestAlgorithm.SHA_256) throw new Error(`Emulator: digest ${algorithm} not implemented`);
      return toSignedArray(sha256(toBytes(value)));
    },
    computeHmacSha256Signature(value, key) {
      return toSignedArray(hmacSha256(toBytes(key), toBytes(value)));
    },
    computeHmacSignature(algorithm, value, key) {
      if (algorithm !== MacAlgorithm.HMAC_SHA_256) throw new Error(`Emulator: MAC ${algorithm} not implemented`);
      return toSignedArray(hmacSha256(toBytes(key), toBytes(value)));
    },
    base64Encode: (data) => base64Encode(toBytes(data)),
    base64EncodeWebSafe: (data) => base64EncodeWebSafe(toBytes(data)),
    base64Decode: (s) => toSignedArray(base64Decode(s)),
    base64DecodeWebSafe: (s) => toSignedArray(base64Decode(s)),
    getUuid: () => uuidV4(),
    newBlob: (data, contentType, name) => makeBlob(data, contentType, name),
    sleep() {},
    formatDate: (date) => new RealDate(date.getTime()).toISOString(),
  };

  const ContentService = {
    MimeType: { JSON: 'JSON', TEXT: 'TEXT', CSV: 'CSV', JAVASCRIPT: 'JAVASCRIPT', XML: 'XML' },
    createTextOutput(content = '') {
      let body = String(content);
      let mime = 'TEXT';
      const out = {
        getContent: () => body,
        setContent(c) { body = String(c); return out; },
        append(c) { body += String(c); return out; },
        setMimeType(m) { mime = m; return out; },
        getMimeType: () => mime,
      };
      return out;
    },
  };
  const HtmlService = {
    createHtmlOutput(html = '') {
      let content = String(html);
      const out = {
        getContent: () => content,
        setTitle() { return out; },
        setWidth() { return out; },
        setHeight() { return out; },
        append(c) { content += String(c); return out; },
      };
      return out;
    },
  };
  const Session = {
    getActiveUser: () => ({ getEmail: () => '' }),
    getEffectiveUser: () => ({ getEmail: () => 'owner@example.invalid' }),
    getScriptTimeZone: () => 'Europe/Paris',
    getTemporaryActiveUserKey: () => '',
  };
  const ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/EMULATOR/exec' }) };

  const sheetsCtx = { state, hooks, DateCtor: EmulatedDate, activeSpreadsheetId, ui, autoCreate: options.autoCreateSpreadsheets !== false };
  const SpreadsheetApp = createSheetsService(sheetsCtx);

  function makeLockService(execution) {
    const makeLock = () => ({
      waitLock() {
        if (lockState.holder === null || lockState.holder === execution.id) {
          lockState.holder = execution.id;
          return;
        }
        throw new Error('Lock timeout: another process was holding the lock for too long.');
      },
      tryLock() {
        if (lockState.holder === null || lockState.holder === execution.id) {
          lockState.holder = execution.id;
          return true;
        }
        return false;
      },
      releaseLock() {
        if (lockState.holder === execution.id) lockState.holder = null;
      },
      hasLock: () => lockState.holder === execution.id,
    });
    return { getScriptLock: makeLock, getUserLock: makeLock, getDocumentLock: makeLock };
  }

  function persist() {
    const t = nowFn();
    for (const [k, e] of Object.entries(state.cache)) if (!e || e.e <= t) delete state.cache[k];
    if (storage && typeof storage.save === 'function') {
      try {
        storage.save(state);
      } catch {
        // storage full or unavailable: keep running in memory
      }
    }
  }

  function execute(fn) {
    const execution = { id: ++executionCounter };
    const g = factory(SpreadsheetApp, PropertiesService, CacheService, makeLockService(execution), Utilities, ContentService,
      HtmlService, Logger, Session, ScriptApp, fakeConsole, EmulatedDate);
    try {
      return fn(g);
    } finally {
      if (lockState.holder === execution.id) lockState.holder = null; // Apps Script releases locks at the end
      persist();
    }
  }

  const parseOutput = (out) => {
    const text = out && typeof out.getContent === 'function' ? out.getContent() : String(out);
    return JSON.parse(text);
  };

  return {
    /** Live state (plain JSON). */
    get state() { return state; },
    logs,
    hooks,
    ui: uiRecord,
    functionNames: fnNames.slice(),

    doPost(body) {
      const contents = typeof body === 'string' ? body : JSON.stringify(body);
      return execute((g) => parseOutput(g.doPost({
        postData: { contents, type: 'text/plain', length: contents.length, name: 'postData' },
        parameter: {}, parameters: {}, queryString: '', contentLength: contents.length, contextPath: '',
      })));
    },
    doGet(params = {}) {
      const parameter = { ...params };
      const parameters = Object.fromEntries(Object.entries(parameter).map(([k, v]) => [k, [String(v)]]));
      return execute((g) => parseOutput(g.doGet({
        parameter, parameters, queryString: new URLSearchParams(parameter).toString(), contentLength: -1, contextPath: '',
      })));
    },
    call(fnName, ...args) {
      return execute((g) => {
        const fn = g[fnName];
        if (typeof fn !== 'function') throw new Error(`No top-level function named ${fnName}`);
        return fn(...args);
      });
    },

    getProperty: (k) => (Object.prototype.hasOwnProperty.call(state.properties, k) ? state.properties[k] : null),
    setProperty(k, v) {
      if (v === null || v === undefined) delete state.properties[k];
      else state.properties[k] = String(v);
      persist();
    },
    /** Holds the script lock "from another process" until release() is called. */
    holdLock() {
      const holder = `external-${++executionCounter}`;
      lockState.holder = holder;
      return () => {
        if (lockState.holder === holder) lockState.holder = null;
      };
    },
    clearCache() {
      state.cache = {};
      persist();
    },
    spreadsheet(id = activeSpreadsheetId) {
      return state.spreadsheets[id] || null;
    },
    sheet(name, id = activeSpreadsheetId) {
      const ss = state.spreadsheets[id];
      return ss ? ss.sheets.find((s) => s.name === name) || null : null;
    },
    /** Values of a tab as getDataRange().getValues() would return them ([] if the tab does not exist). */
    sheetValues(name, id = activeSpreadsheetId) {
      const ss = state.spreadsheets[id];
      if (!ss || !ss.sheets.some((s) => s.name === name)) return [];
      const sheet = SpreadsheetApp.openById(id).getSheetByName(name);
      if (sheet.getLastRow() === 0) return [];
      return sheet.getDataRange().getValues();
    },
    reset() {
      const fresh = emptyState();
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, fresh);
      persist();
    },
  };
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
