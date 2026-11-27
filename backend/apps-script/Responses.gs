/**
 * Responses.gs — evaluations: submit (create / revise), idempotency, History archive, reconcile, reads.
 *
 * Google Sheets is not transactional. Every write runs under the script lock and is ordered so that a failure at
 * any step leaves a state that the next attempt (same requestId) or reconcile() completes without duplicates:
 *   new evaluation : 1 append active row (last_request_id = requestId) → 2 rebuild Results
 *   revision       : 1 append History copy of the previous version (skipped if that exact version is already
 *                      archived) → 2 overwrite the active row in place → 3 rebuild Results
 *   A Results failure never fails the submission: the evaluation is saved, RESULTS_STALE_SINCE is set and the
 *   next write (or "Rebuild Results") repairs the derived tab.
 */

/* ----------------------------------------------------------------------------------------------------------- */
/* Row mapping                                                                                                  */
/* ----------------------------------------------------------------------------------------------------------- */

function responseToRow_(r) {
  return [
    r.responseId, r.participantId, r.participantName, r.destinationId, r.destinationName,
    r.answers.q1, r.answers.q2, r.answers.q3, r.answers.q4, r.answers.q5,
    r.individualScore, r.comments, r.createdAt, r.updatedAt, r.questionnaireVersion, r.destinationVersion,
    r.revisionNumber, r.lastRequestId || '',
  ];
}

/** Returns { record } for a valid row, { invalid: reason } for a broken one, or null for a blank row. */
function rowToResponse_(row, rowIndex) {
  var blank = row.every(function (v) { return v === '' || v === null || v === undefined; });
  if (blank) return null;
  var pid = cellToString_(row[1]).trim();
  var participant = findParticipant_(pid);
  if (!participant) return { invalid: 'unknown participant_id' };
  var destinationId = cellToString_(row[3]).trim();
  if (!/^D\d{2}$/.test(destinationId)) return { invalid: 'invalid destination_id' };
  var answers = {};
  for (var i = 0; i < QUESTION_IDS.length; i++) {
    var n = cellToNumber_(row[5 + i]);
    if (!isValidAnswer_(n)) return { invalid: QUESTION_IDS[i] + ' is not an integer from 1 to 10' };
    answers[QUESTION_IDS[i]] = n;
  }
  var revision = cellToNumber_(row[16]);
  return {
    record: {
      rowIndex: rowIndex,
      responseId: cellToString_(row[0]),
      participantId: participant.id,
      participantName: participant.name,
      destinationId: destinationId,
      destinationName: unsanitizeFromSheet_(cellToString_(row[4])) || getDestinationMeta_(destinationId).name,
      answers: answers,
      // Recomputed from the answers so a hand-edited score can never disagree with them.
      individualScore: individualScore_(answers),
      comments: unsanitizeFromSheet_(cellToString_(row[11])),
      createdAt: cellToIso_(row[12]),
      updatedAt: cellToIso_(row[13]),
      questionnaireVersion: unsanitizeFromSheet_(cellToString_(row[14])),
      destinationVersion: unsanitizeFromSheet_(cellToString_(row[15])),
      revisionNumber: isFinite(revision) && revision >= 1 ? Math.floor(revision) : 1,
      lastRequestId: cellToString_(row[17]).trim().toLowerCase(),
    },
  };
}

/** { records, invalid: [{ row, reason }] } — every non-blank row of the Responses tab. */
function readResponseRows_(sheet) {
  var out = { records: [], invalid: [] };
  readDataRows_(sheet, RESPONSES_HEADERS.length).forEach(function (row, i) {
    var parsed = rowToResponse_(row, i + 2);
    if (!parsed) return;
    if (parsed.invalid) out.invalid.push({ row: i + 2, reason: parsed.invalid });
    else out.records.push(parsed.record);
  });
  return out;
}

function responseKey_(r) {
  return r.participantId + '|' + r.destinationId;
}

/** Latest version wins: updated_at, then revision_number, then the lower row. */
function pickLatest_(list) {
  var best = list[0];
  for (var i = 1; i < list.length; i++) {
    var r = list[i];
    if (r.updatedAt > best.updatedAt ||
      (r.updatedAt === best.updatedAt && (r.revisionNumber > best.revisionNumber ||
        (r.revisionNumber === best.revisionNumber && r.rowIndex > best.rowIndex)))) {
      best = r;
    }
  }
  return best;
}

/** One record per participant + destination (duplicates — which reconcile() removes — collapse to the latest). */
function activeResponses_(records) {
  var groups = {};
  var order = [];
  records.forEach(function (r) {
    var k = responseKey_(r);
    if (!groups[k]) {
      groups[k] = [];
      order.push(k);
    }
    groups[k].push(r);
  });
  return order.map(function (k) { return pickLatest_(groups[k]); });
}

/** Active responses for read-only actions (no tab is created; missing tabs mean "no evaluations yet"). */
function readActiveResponses_() {
  var tables = ensureTables_({ create: false });
  return activeResponses_(readResponseRows_(tables.responses).records);
}

function toEvaluationRecord_(r) {
  return {
    responseId: r.responseId,
    participantId: r.participantId,
    participantName: r.participantName,
    destinationId: r.destinationId,
    destinationName: r.destinationName,
    answers: { q1: r.answers.q1, q2: r.answers.q2, q3: r.answers.q3, q4: r.answers.q4, q5: r.answers.q5 },
    individualScore: r.individualScore,
    comments: r.comments,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    questionnaireVersion: r.questionnaireVersion,
    destinationVersion: r.destinationVersion,
    revisionNumber: r.revisionNumber,
  };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* History                                                                                                      */
/* ----------------------------------------------------------------------------------------------------------- */

function readHistoryRows_(sheet) {
  return readDataRows_(sheet, HISTORY_HEADERS.length).map(function (row) {
    return {
      originalResponseId: cellToString_(row[1]),
      participantId: cellToString_(row[2]),
      destinationId: cellToString_(row[3]),
      previousUpdatedAt: cellToIso_(row[14]),
      revisionNumber: cellToNumber_(row[15]),
      requestId: cellToString_(row[18]).trim().toLowerCase(),
      previousRequestId: cellToString_(row[19]).trim().toLowerCase(),
    };
  });
}

function isArchived_(historyRows, r) {
  for (var i = 0; i < historyRows.length; i++) {
    var h = historyRows[i];
    if (h.originalResponseId === r.responseId && h.revisionNumber === r.revisionNumber && h.previousUpdatedAt === r.updatedAt) return true;
  }
  return false;
}

/** Appends a copy of `r` (the version being replaced) to History unless that exact version is already there. */
function archiveResponse_(historySheet, historyRows, r, info) {
  if (isArchived_(historyRows, r)) return false;
  var row = [
    Utilities.getUuid(), r.responseId, r.participantId, r.destinationId,
    r.answers.q1, r.answers.q2, r.answers.q3, r.answers.q4, r.answers.q5,
    r.individualScore, r.comments, r.questionnaireVersion, r.destinationVersion,
    r.createdAt, r.updatedAt, r.revisionNumber, info.supersededBy === null ? '' : info.supersededBy, info.timestamp,
    info.requestId || '', r.lastRequestId || '', info.reason,
  ];
  writeRowAt_(historySheet, historySheet.getLastRow() + 1, row, HISTORY_FORMATS);
  historyRows.push({
    originalResponseId: r.responseId, participantId: r.participantId, destinationId: r.destinationId,
    previousUpdatedAt: r.updatedAt, revisionNumber: r.revisionNumber, requestId: info.requestId || '',
    previousRequestId: r.lastRequestId || '',
  });
  return true;
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Submit                                                                                                       */
/* ----------------------------------------------------------------------------------------------------------- */

function idempotencyCacheKey_(participantId, requestId) {
  return 'ge:req:' + (getConfig_().namespace || '') + ':' + participantId + ':' + requestId;
}

function sameContent_(r, input) {
  for (var i = 0; i < QUESTION_IDS.length; i++) {
    if (r.answers[QUESTION_IDS[i]] !== input.answers[QUESTION_IDS[i]]) return false;
  }
  return r.comments === input.comments && r.questionnaireVersion === input.questionnaireVersion &&
    r.destinationVersion === input.destinationVersion;
}

function countFor_(records, participantId) {
  return activeResponses_(records).filter(function (r) {
    return r.participantId === participantId && isKnownDestination_(r.destinationId);
  }).length;
}

/** Was this requestId already applied for this participant? Looks at active rows, then archived versions. */
function findAppliedRequest_(records, historyRows, participantId, requestId) {
  var active = activeResponses_(records);
  for (var i = 0; i < active.length; i++) {
    if (active[i].participantId === participantId && active[i].lastRequestId === requestId) return active[i];
  }
  for (var j = 0; j < historyRows.length; j++) {
    var h = historyRows[j];
    if (h.participantId === participantId && h.previousRequestId === requestId) {
      for (var k = 0; k < active.length; k++) {
        if (active[k].participantId === participantId && active[k].destinationId === h.destinationId) return active[k];
      }
    }
  }
  return null;
}

function handleSubmit_(auth, payload, requestId) {
  if (!isUuid_(requestId)) throw apiError_('BAD_REQUEST', 'requestId (a UUID) is required for submit');
  requestId = requestId.toLowerCase();
  var participant = auth.participant;
  var input = validateSubmitPayload_(payload, participant);
  var cache = CacheService.getScriptCache();
  var cacheKey = idempotencyCacheKey_(participant.id, requestId);

  var cached = cache.get(cacheKey);
  if (cached) {
    var fromCache = JSON.parse(cached);
    fromCache.idempotentReplay = true;
    return fromCache;
  }

  return withScriptLock_(function () {
    var tables = ensureTables_({ create: true });
    var read = readResponseRows_(tables.responses);
    var historyRows = readHistoryRows_(tables.history);

    var applied = findAppliedRequest_(read.records, historyRows, participant.id, requestId);
    if (applied) {
      if (scriptProperties_().getProperty(PROP_KEYS.RESULTS_STALE_SINCE)) rebuildResultsSafely_(tables);
      return {
        response: toEvaluationRecord_(applied),
        created: applied.revisionNumber === 1 && applied.lastRequestId === requestId,
        idempotentReplay: true,
        completedCount: countFor_(read.records, participant.id),
      };
    }

    // Defensive: if a race or a manual copy left duplicates for this key, resolve them first.
    var mine = read.records.filter(function (r) { return r.participantId === participant.id && r.destinationId === input.destinationId; });
    if (mine.length > 1) {
      reconcileLocked_(tables);
      read = readResponseRows_(tables.responses);
      historyRows = readHistoryRows_(tables.history);
      mine = read.records.filter(function (r) { return r.participantId === participant.id && r.destinationId === input.destinationId; });
    }

    var now = new Date().toISOString();
    var record;
    var created;
    var wrote = true;
    if (mine.length === 0) {
      record = {
        responseId: Utilities.getUuid(),
        participantId: participant.id,
        participantName: participant.name,
        destinationId: input.destinationId,
        destinationName: input.destinationName,
        answers: input.answers,
        individualScore: input.individualScore,
        comments: input.comments,
        createdAt: now,
        updatedAt: now,
        questionnaireVersion: input.questionnaireVersion,
        destinationVersion: input.destinationVersion,
        revisionNumber: 1,
        lastRequestId: requestId,
      };
      writeRowAt_(tables.responses, tables.responses.getLastRow() + 1, responseToRow_(record), RESPONSES_FORMATS);
      read.records.push(record);
      created = true;
    } else {
      var previous = mine[0];
      created = false;
      if (sameContent_(previous, input)) {
        // Re-sending identical content is not a revision: nothing is written.
        record = previous;
        wrote = false;
      } else {
        archiveResponse_(tables.history, historyRows, previous, {
          reason: 'revision', supersededBy: previous.revisionNumber + 1, timestamp: now, requestId: requestId,
        });
        record = {
          rowIndex: previous.rowIndex,
          responseId: previous.responseId,
          participantId: participant.id,
          participantName: participant.name,
          destinationId: input.destinationId,
          destinationName: input.destinationName,
          answers: input.answers,
          individualScore: input.individualScore,
          comments: input.comments,
          createdAt: previous.createdAt || now,
          updatedAt: now,
          questionnaireVersion: input.questionnaireVersion,
          destinationVersion: input.destinationVersion,
          revisionNumber: previous.revisionNumber + 1,
          lastRequestId: requestId,
        };
        writeRowAt_(tables.responses, previous.rowIndex, responseToRow_(record), RESPONSES_FORMATS);
        read.records = read.records.map(function (r) { return r === previous ? record : r; });
      }
    }

    if (wrote || scriptProperties_().getProperty(PROP_KEYS.RESULTS_STALE_SINCE)) {
      rebuildResultsSafely_(tables, read.records);
    }
    var result = {
      response: toEvaluationRecord_(record),
      created: created,
      idempotentReplay: false,
      completedCount: countFor_(read.records, participant.id),
    };
    // Cached even when nothing was written: an identical re-send leaves no trace in the sheet, so without this a
    // late retry of it (after a newer revision) would be applied again and roll the evaluation back.
    try {
      cache.put(cacheKey, JSON.stringify(result), IDEMPOTENCY_CACHE_SECONDS);
    } catch (e) {
      // The spreadsheet (last_request_id / History) remains the durable idempotency record for writes.
    }
    return result;
  });
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Reads                                                                                                        */
/* ----------------------------------------------------------------------------------------------------------- */

function handleMyResponses_(auth) {
  var mine = readActiveResponses_().filter(function (r) {
    return r.participantId === auth.participant.id && isKnownDestination_(r.destinationId);
  });
  mine.sort(function (a, b) { return a.destinationId < b.destinationId ? -1 : a.destinationId > b.destinationId ? 1 : 0; });
  return { responses: mine.map(toEvaluationRecord_) };
}

function handleMe_(auth) {
  var count = readActiveResponses_().filter(function (r) {
    return r.participantId === auth.participant.id && isKnownDestination_(r.destinationId);
  }).length;
  return { participant: publicParticipant_(auth.participant), expiresAt: auth.expiresAt, completedCount: count };
}

/** Counts only — never scores. */
function handleCompletion_() {
  var cfg = getConfig_();
  var active = readActiveResponses_().filter(function (r) { return isKnownDestination_(r.destinationId); });
  var perParticipant = {};
  PARTICIPANTS.forEach(function (p) { perParticipant[p.id] = 0; });
  var perDestination = {};
  cfg.destinationIds.forEach(function (id) { perDestination[id] = 0; });
  active.forEach(function (r) {
    perParticipant[r.participantId] += 1;
    perDestination[r.destinationId] += 1;
  });
  var fully = cfg.destinationIds.filter(function (id) { return perDestination[id] === PARTICIPANTS.length; }).length;
  return {
    totalActive: active.length,
    maxActive: maxActiveResponses_(cfg),
    perParticipant: perParticipant,
    perDestination: perDestination,
    fullyEvaluated: fully,
  };
}

/* ----------------------------------------------------------------------------------------------------------- */
/* Reconcile                                                                                                    */
/* ----------------------------------------------------------------------------------------------------------- */

/** Caller holds the lock. Keeps the latest row per participant + destination; archives and removes the others. */
function reconcileLocked_(tables) {
  var read = readResponseRows_(tables.responses);
  var historyRows = readHistoryRows_(tables.history);
  var groups = {};
  read.records.forEach(function (r) {
    var k = responseKey_(r);
    (groups[k] = groups[k] || []).push(r);
  });
  var now = new Date().toISOString();
  var toDelete = [];
  var duplicateGroups = 0;
  Object.keys(groups).forEach(function (k) {
    var list = groups[k];
    if (list.length < 2) return;
    duplicateGroups++;
    var keep = pickLatest_(list);
    list.forEach(function (r) {
      if (r === keep) return;
      archiveResponse_(tables.history, historyRows, r, {
        reason: 'reconcile-duplicate', supersededBy: keep.revisionNumber, timestamp: now, requestId: '',
      });
      toDelete.push(r.rowIndex);
    });
  });
  toDelete.sort(function (a, b) { return b - a; }).forEach(function (rowIndex) {
    tables.responses.deleteRow(rowIndex);
  });
  return {
    checkedRows: read.records.length + read.invalid.length,
    duplicateGroups: duplicateGroups,
    archived: toDelete.length,
    invalidRows: read.invalid,
  };
}

/**
 * Admin: detects duplicate active rows (same participant + destination), keeps the latest, archives the others to
 * History (reason "reconcile-duplicate"), removes them from Responses and rebuilds Results. Invalid rows (for
 * example hand-edited answers outside 1–10) are reported, never deleted. Safe to run repeatedly.
 */
function reconcile() {
  return withScriptLock_(function () {
    var tables = ensureTables_({ create: true });
    var report = reconcileLocked_(tables);
    rebuildResultsLocked_(tables);
    return report;
  });
}
