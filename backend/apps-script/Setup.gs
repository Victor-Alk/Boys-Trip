/**
 * Setup.gs — sheet schema, non-destructive tab creation, the "Expedition admin" menu and admin checks.
 *
 * Rules:
 *  - The script only ever touches the tabs named <SHEET_NAMESPACE>Responses, <SHEET_NAMESPACE>Results and
 *    <SHEET_NAMESPACE>History. Every other tab (including "Sheet1") is never read, renamed, cleared or deleted.
 *  - A missing tab is created (appended after the existing tabs). An existing but completely empty tab gets the
 *    header row. An existing tab whose header row differs from the schema is refused with a clear error; nothing
 *    is overwritten.
 */

var RESPONSES_HEADERS = [
  'response_id', 'participant_id', 'participant_name', 'destination_id', 'destination_name',
  'q1_overall_enthusiasm', 'q2_cultural_appeal', 'q3_geographical_appeal', 'q4_adventure_appeal', 'q5_practical_suitability',
  'individual_score', 'comments', 'created_at', 'updated_at', 'questionnaire_version', 'destination_version',
  'revision_number', 'last_request_id',
];
var RESPONSES_FORMATS = [
  '@', '@', '@', '@', '@',
  '0', '0', '0', '0', '0',
  '0.00', '@', '@', '@', '@', '@',
  '0', '@',
];

var HISTORY_HEADERS = [
  'history_id', 'original_response_id', 'participant_id', 'destination_id',
  'previous_q1', 'previous_q2', 'previous_q3', 'previous_q4', 'previous_q5',
  'previous_individual_score', 'previous_comments', 'previous_questionnaire_version', 'previous_destination_version',
  'previous_created_at', 'previous_updated_at', 'revision_number', 'superseded_by_revision', 'revision_timestamp',
  'request_id', 'previous_request_id', 'reason',
];
var HISTORY_FORMATS = [
  '@', '@', '@', '@',
  '0', '0', '0', '0', '0',
  '0.00', '@', '@', '@',
  '@', '@', '0', '0', '@',
  '@', '@', '@',
];

function resultsHeaders_() {
  var h = ['destination_id', 'destination_name', 'security_status', 'budget_status', 'realistic_total_eur',
    'material_budget_uncertainty', 'active_responses'];
  PARTICIPANTS.forEach(function (p) { h.push('score_' + p.id); });
  h = h.concat(['mean_score', 'median_score', 'min_score', 'max_score', 'pop_std_dev',
    'mean_q1', 'mean_q2', 'mean_q3', 'mean_q4', 'mean_q5',
    'significant_reservations', 'ranking_eligible', 'ranking_position', 'exclusion_reasons', 'last_updated']);
  return h;
}

function resultsFormats_() {
  var f = ['@', '@', '@', '@', '0.00', '@', '0'];
  PARTICIPANTS.forEach(function () { f.push('0.00'); });
  return f.concat(['0.00', '0.00', '0.00', '0.00', '0.0000', '0.00', '0.00', '0.00', '0.00', '0.00', '0', '@', '0', '@', '@']);
}

function tableSpecs_() {
  return [
    { key: 'responses', base: 'Responses', headers: RESPONSES_HEADERS, formats: RESPONSES_FORMATS },
    { key: 'results', base: 'Results', headers: resultsHeaders_(), formats: resultsFormats_() },
    { key: 'history', base: 'History', headers: HISTORY_HEADERS, formats: HISTORY_FORMATS },
    { key: 'prompts', base: 'Prompts', headers: PROMPTS_HEADERS, formats: PROMPTS_FORMATS },
  ];
}

function tableSpec_(key) {
  var specs = tableSpecs_();
  for (var i = 0; i < specs.length; i++) if (specs[i].key === key) return specs[i];
  throw new Error('Unknown table ' + key);
}

function openSpreadsheet_() {
  var cfg = getConfig_();
  try {
    return SpreadsheetApp.openById(cfg.spreadsheetId);
  } catch (e) {
    throw apiError_('SHEET_ERROR', 'The spreadsheet could not be opened');
  }
}

/** Reads the header row of an existing tab and classifies it: 'empty' | 'ok' | 'mismatch'. */
function inspectExistingTab_(sheet, spec) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 && lastCol === 0) return { status: 'empty', detail: '' };
  var width = Math.min(Math.max(lastCol, spec.headers.length), sheet.getMaxColumns());
  var row = sheet.getRange(1, 1, 1, width).getValues()[0];
  var compareWidth = Math.max(width, spec.headers.length);
  for (var c = 0; c < compareWidth; c++) {
    var expected = c < spec.headers.length ? spec.headers[c] : '';
    var found = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim();
    if (found !== expected) {
      return {
        status: 'mismatch',
        detail: 'column ' + (c + 1) + ' should be "' + (expected || '(empty)') + '" but is "' + (found.length > 40 ? found.slice(0, 40) + '…' : found) + '"',
      };
    }
  }
  return { status: 'ok', detail: '' };
}

/** Grows the tab's grid when needed (a new tab is 1000 × 26; getRange() outside the grid throws). */
function ensureGrid_(sheet, rows, columns) {
  var maxRows = sheet.getMaxRows();
  if (rows > maxRows) sheet.insertRowsAfter(maxRows, rows - maxRows);
  var maxCols = sheet.getMaxColumns();
  if (columns > maxCols) sheet.insertColumnsAfter(maxCols, columns - maxCols);
}

function writeHeaderRow_(sheet, spec) {
  ensureGrid_(sheet, 1, spec.headers.length);
  var range = sheet.getRange(1, 1, 1, spec.headers.length);
  range.setNumberFormat('@');
  range.setValues([spec.headers]);
  range.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Returns { responses, results, history } sheets (null when missing and create === false) plus a report.
 * Validates every tab before creating anything, so a schema problem never leaves a half-created setup.
 */
function ensureTables_(opts) {
  var create = !opts || opts.create !== false;
  var cfg = getConfig_();
  if (cfg.namespace === null) throw apiError_('NOT_CONFIGURED', 'SHEET_NAMESPACE is invalid');
  var ss = openSpreadsheet_();
  var specs = tableSpecs_();
  var found = specs.map(function (spec) {
    var name = cfg.namespace + spec.base;
    var sheet = ss.getSheetByName(name);
    if (!sheet) return { spec: spec, name: name, sheet: null, status: 'missing', detail: '' };
    var inspection = inspectExistingTab_(sheet, spec);
    return { spec: spec, name: name, sheet: sheet, status: inspection.status, detail: inspection.detail };
  });
  var bad = found.filter(function (f) { return f.status === 'mismatch'; });
  if (bad.length) {
    throw apiError_('NOT_CONFIGURED', bad.map(function (f) {
      return 'Tab "' + f.name + '" already exists with unexpected headers (' + f.detail + ').';
    }).join(' ') + ' Nothing was changed. Rename that tab, or set SHEET_NAMESPACE to use different tab names.');
  }
  var out = { report: {} };
  found.forEach(function (f) {
    if (f.status === 'missing' && create) {
      f.sheet = ss.insertSheet(f.name, ss.getSheets().length);
      writeHeaderRow_(f.sheet, f.spec);
      f.status = 'created';
    } else if (f.status === 'empty' && create) {
      writeHeaderRow_(f.sheet, f.spec);
      f.status = 'initialised';
    }
    out[f.spec.key] = f.status === 'missing' ? null : f.sheet;
    out.report[f.name] = f.status;
  });
  return out;
}

/** Writes one row with plain-text formats first, so user text can never become a formula, number or date. */
function writeRowAt_(sheet, rowIndex, values, formats) {
  ensureGrid_(sheet, rowIndex, values.length);
  var range = sheet.getRange(rowIndex, 1, 1, values.length);
  range.setNumberFormats([formats.slice(0, values.length)]);
  range.setValues([values.map(sanitizeForSheet_)]);
}

/** Data rows (without the header) of a tab, padded to the schema width. */
function readDataRows_(sheet, width) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, width).getValues();
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Admin entry points                                                                                           */
/* ----------------------------------------------------------------------------------------------------------- */

/**
 * One-click setup: creates SESSION_SECRET if missing, creates/validates the three tabs and rebuilds Results.
 * Safe to run any number of times.
 */
function setup() {
  var secret = generateSessionSecret();
  resetConfigCache_();
  var report = withScriptLock_(function () {
    var tables = ensureTables_({ create: true });
    var rebuilt = rebuildResultsLocked_(tables);
    return { tabs: tables.report, resultsRows: rebuilt.rows };
  });
  var cfg = getConfig_();
  report.sessionSecret = secret;
  report.namespace = cfg.namespace;
  report.configured = isConfigured_(cfg);
  report.problems = cfg.errors.slice();
  report.warnings = cfg.warnings.slice();
  console.log('Expedition setup: ' + JSON.stringify(report));
  return report;
}

/** Read-only configuration report (property names and statuses only, never values). */
function checkConfiguration() {
  resetConfigCache_();
  var cfg = getConfig_();
  var props = scriptProperties_().getProperties() || {};
  var tabs = {};
  var tabProblem = '';
  try {
    tabs = ensureTables_({ create: false }).report;
  } catch (e) {
    tabProblem = e && e.apiCode ? e.message : 'The spreadsheet could not be inspected';
  }
  var registry = getDestinationRegistry_();
  var pending = Object.keys(registry).filter(function (id) { return registry[id].pending; });
  var report = {
    backendVersion: BACKEND_VERSION,
    configured: isConfigured_(cfg),
    spreadsheetId: cfg.spreadsheetId === DEFAULT_SPREADSHEET_ID ? 'default' : 'custom',
    namespace: cfg.namespace,
    propertiesSet: Object.keys(props).sort(),
    participantsWithCodes: cfg.credentials ? Object.keys(cfg.credentials).sort() : [],
    questionnaireVersion: cfg.questionnaireVersion,
    revealPolicy: cfg.effectiveRevealPolicy,
    commentsVisibility: cfg.commentsVisibility,
    sessionHours: cfg.sessionHours,
    destinationIds: cfg.destinationIds.length,
    pendingDestinations: pending,
    tabs: tabs,
    resultsStaleSince: props[PROP_KEYS.RESULTS_STALE_SINCE] || null,
    problems: cfg.errors.concat(tabProblem ? [tabProblem] : []),
    warnings: cfg.warnings.slice(),
  };
  console.log('Expedition configuration: ' + JSON.stringify(report));
  return report;
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Spreadsheet menu                                                                                             */
/* ----------------------------------------------------------------------------------------------------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Expedition admin')
    .addItem('Set up (tabs + session secret)', 'menuSetup')
    .addItem('Check configuration', 'menuCheckConfiguration')
    .addSeparator()
    .addItem('Rebuild Results', 'menuRebuildResults')
    .addItem('Reconcile duplicates', 'menuReconcile')
    .addSeparator()
    .addItem('Rotate one access code…', 'menuRotateAccessCode')
    .addItem('Sign one participant out…', 'menuRevokeSessions')
    .addItem('Sign everyone out', 'menuRevokeAllSessions')
    .addToUi();
}

function menuAlert_(title, lines) {
  var ui = SpreadsheetApp.getUi();
  ui.alert(title, lines.join('\n'), ui.ButtonSet.OK);
}

function menuError_(title, e) {
  menuAlert_(title, [e && e.message ? e.message : String(e)]);
}

function menuSetup() {
  try {
    var r = setup();
    var lines = ['Session secret: ' + r.sessionSecret, 'Namespace: ' + (r.namespace || '(none)')];
    Object.keys(r.tabs).forEach(function (name) { lines.push('Tab ' + name + ': ' + r.tabs[name]); });
    lines.push('Results rows: ' + r.resultsRows);
    lines.push(r.configured ? 'Configuration complete.' : 'Still to do:');
    r.problems.forEach(function (p) { lines.push('• ' + p); });
    r.warnings.forEach(function (w) { lines.push('⚠ ' + w); });
    menuAlert_('Expedition setup', lines);
  } catch (e) {
    menuError_('Setup stopped — nothing was overwritten', e);
  }
}

function menuCheckConfiguration() {
  var r = checkConfiguration();
  var lines = [
    'Configured: ' + (r.configured ? 'yes' : 'NO'),
    'Spreadsheet: ' + r.spreadsheetId + ' · namespace: ' + (r.namespace || '(none)'),
    'Access codes for: ' + (r.participantsWithCodes.join(', ') || 'nobody'),
    'Reveal policy: ' + r.revealPolicy + ' · comments: ' + r.commentsVisibility + ' · sessions: ' + r.sessionHours + ' h',
    'Destinations: ' + r.destinationIds + ' (pending research: ' + (r.pendingDestinations.join(', ') || 'none') + ')',
  ];
  Object.keys(r.tabs).forEach(function (name) { lines.push('Tab ' + name + ': ' + r.tabs[name]); });
  if (r.resultsStaleSince) lines.push('⚠ Results tab stale since ' + r.resultsStaleSince + ' — run Rebuild Results.');
  r.problems.forEach(function (p) { lines.push('• ' + p); });
  r.warnings.forEach(function (w) { lines.push('⚠ ' + w); });
  menuAlert_('Expedition configuration', lines);
}

function menuRebuildResults() {
  try {
    var r = rebuildResults();
    menuAlert_('Results rebuilt', ['Rows written: ' + r.rows]);
  } catch (e) {
    menuError_('Rebuild failed', e);
  }
}

function menuReconcile() {
  try {
    var r = reconcile();
    var lines = ['Rows checked: ' + r.checkedRows, 'Duplicate groups: ' + r.duplicateGroups, 'Rows archived to History: ' + r.archived];
    if (r.invalidRows.length) {
      lines.push('Rows ignored because they are invalid (fix by hand):');
      r.invalidRows.slice(0, 20).forEach(function (x) { lines.push('• row ' + x.row + ': ' + x.reason); });
    }
    menuAlert_('Reconcile complete', lines);
  } catch (e) {
    menuError_('Reconcile failed', e);
  }
}

function promptParticipant_(title) {
  var ui = SpreadsheetApp.getUi();
  var ids = PARTICIPANTS.map(function (p) { return p.id; }).join(', ');
  var res = ui.prompt(title, 'Participant id (' + ids + '):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return null;
  return String(res.getResponseText() || '').trim().toLowerCase();
}

function menuRotateAccessCode() {
  var id = promptParticipant_('Rotate access code');
  if (!id) return;
  try {
    var code = rotateAccessCode(id);
    menuAlert_('New access code for ' + findParticipant_(id).name, [
      code,
      '',
      'Copy it now and send it privately. It is not stored anywhere and will not be shown again.',
      'The old code no longer works and this participant has been signed out everywhere.',
    ]);
  } catch (e) {
    menuError_('Rotation failed', e);
  }
}

function menuRevokeSessions() {
  var id = promptParticipant_('Sign a participant out');
  if (!id) return;
  try {
    revokeSessions(id);
    menuAlert_('Signed out', [findParticipant_(id).name + ' must sign in again on every device.']);
  } catch (e) {
    menuError_('Sign-out failed', e);
  }
}

function menuRevokeAllSessions() {
  try {
    revokeAllSessions();
    menuAlert_('Signed out', ['Everyone must sign in again on every device.']);
  } catch (e) {
    menuError_('Sign-out failed', e);
  }
}
