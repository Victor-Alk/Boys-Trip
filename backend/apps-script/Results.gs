/**
 * Results.gs — statistics, ranking eligibility, the derived Results tab and the `results` action.
 *
 * The Results tab is derived data: it is rebuilt from Responses after every write and can be rebuilt at any time
 * (rebuildResults). History is never counted. The `results` action does NOT read the Results tab: it applies the
 * reveal policy to the active responses so that unrevealed scores never leave the server in any form.
 *
 * Ranking (AGENTS.md §7): eligible = security "eligible" AND realistic total ≤ €2,500 AND no material budget
 * uncertainty AND all four participants evaluated. Order: collective mean desc, lowest individual score desc,
 * mean Q1 desc, destination id asc.
 */

function statMean_(xs) {
  if (!xs.length) return null;
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
}

function statMedian_(xs) {
  if (!xs.length) return null;
  var s = xs.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Population standard deviation (divides by n). */
function statPopulationSd_(xs) {
  if (!xs.length) return null;
  var mu = statMean_(xs);
  var acc = 0;
  for (var i = 0; i < xs.length; i++) acc += (xs[i] - mu) * (xs[i] - mu);
  return Math.sqrt(acc / xs.length);
}

/**
 * Statistics for one destination from its active responses (one per participant).
 * Returns plain numbers (null when there are no responses).
 */
function computeDestinationStats_(destinationId, meta, responses) {
  var byParticipant = {};
  responses.forEach(function (r) { byParticipant[r.participantId] = r; });
  var list = PARTICIPANTS.map(function (p) { return byParticipant[p.id]; }).filter(function (r) { return !!r; });
  var scores = list.map(function (r) { return individualScore_(r.answers); });
  var meanQ = {};
  QUESTION_IDS.forEach(function (q) {
    meanQ[q] = statMean_(list.map(function (r) { return r.answers[q]; }));
  });
  var individual = {};
  PARTICIPANTS.forEach(function (p) {
    individual[p.id] = byParticipant[p.id] ? individualScore_(byParticipant[p.id].answers) : null;
  });
  var reservations = list.filter(function (r) { return r.answers.q1 <= RESERVATION_Q1_THRESHOLD; }).length;
  var complete = list.length === PARTICIPANTS.length;

  var reasons = [];
  if (meta.pending) reasons.push('research pending');
  if (meta.securityStatus !== 'eligible') reasons.push('security ' + (meta.securityStatus || 'unknown'));
  if (typeof meta.realisticTotalEUR !== 'number' || !isFinite(meta.realisticTotalEUR)) reasons.push('budget unknown');
  else if (meta.realisticTotalEUR > RANKING_BUDGET_MAX_EUR) reasons.push('over €' + RANKING_BUDGET_MAX_EUR);
  if (meta.materialUncertainty !== false) reasons.push('material budget uncertainty');
  if (!complete) reasons.push('incomplete (' + list.length + '/' + PARTICIPANTS.length + ')');

  var lastUpdated = '';
  list.forEach(function (r) { if (r.updatedAt > lastUpdated) lastUpdated = r.updatedAt; });

  return {
    destinationId: destinationId,
    count: list.length,
    complete: complete,
    individual: individual,
    mean: statMean_(scores),
    median: statMedian_(scores),
    min: scores.length ? Math.min.apply(null, scores) : null,
    max: scores.length ? Math.max.apply(null, scores) : null,
    sd: statPopulationSd_(scores),
    meanByQuestion: meanQ,
    reservations: reservations,
    eligible: reasons.length === 0,
    exclusionReasons: reasons,
    lastUpdated: lastUpdated,
    rank: null,
  };
}

/** Assigns `rank` (1…n) to eligible destinations in place and returns them in ranking order. */
function rankEligible_(statsList) {
  var eligible = statsList.filter(function (s) { return s.eligible; });
  eligible.sort(function (a, b) {
    if (b.mean !== a.mean) return b.mean - a.mean;
    if (b.min !== a.min) return b.min - a.min;
    if (b.meanByQuestion.q1 !== a.meanByQuestion.q1) return b.meanByQuestion.q1 - a.meanByQuestion.q1;
    return a.destinationId < b.destinationId ? -1 : a.destinationId > b.destinationId ? 1 : 0;
  });
  eligible.forEach(function (s, i) { s.rank = i + 1; });
  return eligible;
}

/** Statistics for every configured destination from a list of (possibly duplicated) records. */
function computeAllStats_(records) {
  var cfg = getConfig_();
  var active = activeResponses_(records);
  var byDest = {};
  active.forEach(function (r) { (byDest[r.destinationId] = byDest[r.destinationId] || []).push(r); });
  var stats = cfg.destinationIds.map(function (id) {
    return computeDestinationStats_(id, getDestinationMeta_(id), byDest[id] || []);
  });
  rankEligible_(stats);
  return stats;
}

function blankIfNull_(v) {
  return v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : v;
}

function resultsRows_(records) {
  return computeAllStats_(records).map(function (s) {
    var meta = getDestinationMeta_(s.destinationId);
    var row = [
      s.destinationId,
      meta.name,
      meta.pending ? 'pending' : (meta.securityStatus || ''),
      meta.pending ? 'pending' : (meta.budgetStatus || ''),
      blankIfNull_(meta.realisticTotalEUR),
      meta.materialUncertainty === true ? 'yes' : meta.materialUncertainty === false ? 'no' : '',
      s.count,
    ];
    PARTICIPANTS.forEach(function (p) { row.push(blankIfNull_(s.individual[p.id])); });
    row.push(blankIfNull_(s.mean), blankIfNull_(s.median), blankIfNull_(s.min), blankIfNull_(s.max), blankIfNull_(s.sd));
    QUESTION_IDS.forEach(function (q) { row.push(blankIfNull_(s.meanByQuestion[q])); });
    row.push(s.reservations, s.eligible ? 'yes' : 'no', blankIfNull_(s.rank), s.exclusionReasons.join('; '), s.lastUpdated);
    return row;
  });
}

/** Caller holds the lock. Replaces the data rows of the Results tab (never any other tab). */
function rebuildResultsLocked_(tables, records) {
  if (!records) records = readResponseRows_(tables.responses).records;
  var spec = tableSpec_('results');
  var sheet = tables.results;
  var rows = resultsRows_(records);
  var lastRow = sheet.getLastRow();
  var width = spec.headers.length;
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, Math.max(width, sheet.getLastColumn())).clearContent();
  if (rows.length) {
    ensureGrid_(sheet, rows.length + 1, width);
    var range = sheet.getRange(2, 1, rows.length, width);
    range.setNumberFormats(rows.map(function () { return spec.formats.slice(); }));
    range.setValues(rows.map(function (r) { return r.map(sanitizeForSheet_); }));
  }
  var props = scriptProperties_();
  if (props.getProperty(PROP_KEYS.RESULTS_STALE_SINCE)) props.deleteProperty(PROP_KEYS.RESULTS_STALE_SINCE);
  return { rows: rows.length };
}

/** Rebuild that never fails the caller: on error the tab is flagged stale and repaired by the next write. */
function rebuildResultsSafely_(tables, records) {
  try {
    rebuildResultsLocked_(tables, records);
    return true;
  } catch (e) {
    try {
      scriptProperties_().setProperty(PROP_KEYS.RESULTS_STALE_SINCE, new Date().toISOString());
    } catch (ignored) {
      // nothing else to do; checkConfiguration() will not see the flag but rebuildResults() still repairs
    }
    console.error('Results rebuild failed: ' + (e && e.message ? e.message : 'unknown error'));
    return false;
  }
}

/** Admin: rebuilds the Results tab from Responses. */
function rebuildResults() {
  return withScriptLock_(function () {
    var tables = ensureTables_({ create: true });
    return rebuildResultsLocked_(tables);
  });
}

/* ----------------------------------------------------------------------------------------------------------- */
/* `results` action — reveal policy                                                                             */
/* ----------------------------------------------------------------------------------------------------------- */

function handleResults_(auth) {
  var cfg = getConfig_();
  var policy = cfg.effectiveRevealPolicy;
  var active = readActiveResponses_().filter(function (r) { return isKnownDestination_(r.destinationId); });
  var byDest = {};
  active.forEach(function (r) { (byDest[r.destinationId] = byDest[r.destinationId] || []).push(r); });
  var allComplete = active.length === maxActiveResponses_(cfg);

  var destinations = {};
  cfg.destinationIds.forEach(function (id) {
    var list = byDest[id] || [];
    var revealed;
    if (policy === 'always') revealed = true;
    else if (policy === 'per-destination-complete') revealed = list.length === PARTICIPANTS.length;
    else if (policy === 'all-complete') revealed = allComplete;
    else revealed = false; // admin-only (and anything unexpected)
    var responses = [];
    if (revealed) {
      var order = PARTICIPANTS.map(function (p) { return p.id; });
      list.slice().sort(function (a, b) { return order.indexOf(a.participantId) - order.indexOf(b.participantId); })
        .forEach(function (r) {
          var own = r.participantId === auth.participant.id;
          var showComments = own || cfg.commentsVisibility === 'after-reveal';
          responses.push({
            participantId: r.participantId,
            participantName: r.participantName,
            answers: { q1: r.answers.q1, q2: r.answers.q2, q3: r.answers.q3, q4: r.answers.q4, q5: r.answers.q5 },
            individualScore: r.individualScore,
            comments: showComments ? r.comments : null,
            updatedAt: r.updatedAt,
          });
        });
    }
    destinations[id] = { count: list.length, revealed: revealed, responses: responses };
  });
  return { policy: policy, blindVoting: cfg.blindVoting, destinations: destinations };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* `novelty` action                                                                                             */
/* ----------------------------------------------------------------------------------------------------------- */

/** NOVELTY_DATA (Script Property) for authenticated participants only; {} when unset or invalid. */
function handleNovelty_() {
  var cfg = getConfig_();
  var out = {};
  if (!cfg.noveltyRaw) return { destinations: out };
  var parsed;
  try {
    parsed = JSON.parse(cfg.noveltyRaw);
  } catch (e) {
    console.warn('NOVELTY_DATA is not valid JSON; returning no novelty data.');
    return { destinations: out };
  }
  if (!isPlainObject_(parsed)) return { destinations: out };
  cfg.destinationIds.forEach(function (id) {
    var e = parsed[id];
    if (!isPlainObject_(e)) return;
    var visitedBy = Array.isArray(e.visitedBy) ? e.visitedBy.filter(function (p) { return !!findParticipant_(p); }) : [];
    var visitedCount = typeof e.visitedCount === 'number' && isFinite(e.visitedCount) && e.visitedCount >= 0
      ? Math.floor(e.visitedCount) : visitedBy.length;
    out[id] = {
      newToAll: typeof e.newToAll === 'boolean' ? e.newToAll : visitedCount === 0,
      visitedCount: visitedCount,
      visitedBy: visitedBy,
      note: typeof e.note === 'string' ? e.note.slice(0, 500) : '',
    };
  });
  return { destinations: out };
}
