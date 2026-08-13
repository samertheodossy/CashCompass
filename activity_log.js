/**
 * Activity ledger: discrete user/script actions (Quick add / quick_pay, bill skip, bill autopay, bill_add, bill_update, bill_deactivate, house expense, house_add, house_value_update, house_deactivate, donations, upcoming add/status/cashflow, bank_account_add, bank_account_update, bank_account_deactivate, investment_add, investment_update, investment_account_update, investment_deactivate, investment_reactivate, investment_planning_purpose_update, debt_add, debt_deactivate, debt_reactivate, debt_update, income_add, income_deactivate, planner_email_deferred, planner_email_sent, planner_email_invalid_recipient, …). Eligible Donations retain fingerprint-gated removal; newly recorded direct Quick Add operations can be corrected through their exact operation envelope. Other events remain audit evidence.
 * Complements OUT - History (planner-run snapshots). Tab: LOG - Activity.
 */

var ACTIVITY_LOG_SHEET_NAME = 'LOG - Activity';

var ACTIVITY_LOG_HEADERS = [
  'Logged At',
  'Event Type',
  'Entry Date',
  'Amount',
  'Direction',
  'Payee',
  'Category',
  'Account / Source',
  'Cash Flow Sheet',
  'Cash Flow Month',
  'Dedupe Key',
  'Details'
];

/** 1-based column index for Dedupe Key column. */
var ACTIVITY_LOG_DEDUPE_COL = 11;

/**
 * Operation metadata lives inside the existing Details JSON cell. This is an
 * additive contract only: no Activity column or sheet migration is required.
 *
 * Existing event-specific `detailsVersion` fields remain untouched. The
 * correction contract is deliberately nested so those earlier schemas can
 * continue to evolve independently.
 */
var ACTIVITY_OPERATION_ENVELOPE_VERSION_ = 1;
var ACTIVITY_TARGET_DESCRIPTOR_VERSION_ = 1;
var ACTIVITY_WRITER_PROVENANCE_VERSION_ = 1;

/**
 * Capture the exact Apps Script web-app deployment behind an Activity write.
 *
 * Apps Script exposes the deployed service URL rather than its friendly
 * numeric version label (for example, `@555`). The deployment ID in that URL
 * is stable and maps back to the version through the deployment inventory.
 * Non-web executions and unavailable/malformed service URLs remain explicit
 * instead of being attributed to a guessed deployment.
 */
function activityWriterProvenance_() {
  var provenance = {
    provenanceVersion: ACTIVITY_WRITER_PROVENANCE_VERSION_,
    source: 'unavailable',
    deploymentId: '',
    deploymentMode: ''
  };
  try {
    if (typeof ScriptApp === 'undefined' || !ScriptApp.getService) {
      return provenance;
    }
    var service = ScriptApp.getService();
    if (!service || !service.getUrl) return provenance;
    var serviceUrl = String(service.getUrl() || '').trim();
    if (!serviceUrl) return provenance;

    var match = serviceUrl.match(/\/s\/([^/?#]+)\/(exec|dev)(?:[/?#]|$)/i);
    if (!match) {
      provenance.source = 'unresolved_service_url';
      return provenance;
    }
    provenance.source = 'web_app';
    provenance.deploymentId = String(match[1] || '').trim();
    provenance.deploymentMode = String(match[2] || '').toLowerCase();
    return provenance;
  } catch (_e) {
    return provenance;
  }
}

function activityOpaqueIdentity_(prefix, rawValue) {
  var value = String(rawValue || '').trim();
  if (!value) return '';
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return String(prefix || '') +
    Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '').slice(0, 24);
}

function activityWorkbookIdentity_(ss) {
  var spreadsheetId = ss && typeof ss.getId === 'function'
    ? String(ss.getId() || '').trim()
    : '';
  return activityOpaqueIdentity_('', spreadsheetId);
}

function activityActorIdentity_() {
  var email = '';
  try {
    email = typeof getCurrentUserEmail_ === 'function'
      ? getCurrentUserEmail_()
      : String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  } catch (_e) {
    email = '';
  }
  return activityOpaqueIdentity_('actor::', email);
}

/**
 * Create the server-owned correlation context before the first write of a
 * correctable operation. IDs correlate effects; workbook/actor identity and
 * exact state checks authorize any future correction.
 */
function createActivityOperationContext_(ss, operationType) {
  return {
    envelopeVersion: ACTIVITY_OPERATION_ENVELOPE_VERSION_,
    operationId: Utilities.getUuid(),
    operationType: String(operationType || '').trim(),
    workbookIdentity: activityWorkbookIdentity_(ss),
    actorIdentity: activityActorIdentity_()
  };
}

function activityJsonObject_(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return JSON.parse(JSON.stringify(raw));
  }
  var text = String(raw || '').trim();
  if (!text) return {};
  try {
    var parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (_e) {
    // Preserve unexpected historical text instead of dropping it.
  }
  return { legacyDetailsText: text };
}

function normalizeActivityTargetDescriptor_(raw) {
  raw = raw || {};
  var descriptor = {
    targetVersion: Number(raw.targetVersion || ACTIVITY_TARGET_DESCRIPTOR_VERSION_),
    targetType: String(raw.targetType || '').trim(),
    targetKey: String(raw.targetKey || '').trim(),
    locator: activityJsonObject_(raw.locator),
    before: activityJsonObject_(raw.before),
    after: activityJsonObject_(raw.after)
  };
  if (descriptor.targetVersion !== ACTIVITY_TARGET_DESCRIPTOR_VERSION_ ||
      !descriptor.targetType || !descriptor.targetKey ||
      !Object.keys(descriptor.locator).length ||
      !Object.keys(descriptor.before).length ||
      !Object.keys(descriptor.after).length) {
    throw new Error('Activity target descriptor is incomplete or unsupported.');
  }
  return descriptor;
}

/**
 * Merge immutable operation metadata into the existing Details JSON. Every new
 * Activity row receives a unique eventId. Callers that do not yet provide exact
 * target descriptors remain audit-only even though they receive correlation
 * metadata; this prevents accidental correction of partially described events.
 */
function buildActivityDetailsForAppend_(ss, payload) {
  payload = payload || {};
  var details = activityJsonObject_(payload.details);
  var supplied = payload.operationEnvelope || {};
  var context = supplied.context || {};
  var operationId = String(context.operationId || supplied.operationId || '').trim();
  var operationType = String(
    context.operationType || supplied.operationType || payload.eventType || ''
  ).trim();
  var targets = Array.isArray(supplied.targets)
    ? supplied.targets.map(normalizeActivityTargetDescriptor_)
    : [];

  var workbookIdentity = String(
    context.workbookIdentity || supplied.workbookIdentity || activityWorkbookIdentity_(ss)
  ).trim();
  var actorIdentity = String(
    context.actorIdentity || supplied.actorIdentity || activityActorIdentity_()
  ).trim();

  details.operationEnvelope = {
    envelopeVersion: ACTIVITY_OPERATION_ENVELOPE_VERSION_,
    operationId: operationId || Utilities.getUuid(),
    eventId: Utilities.getUuid(),
    operationType: operationType,
    workbookIdentity: workbookIdentity,
    actorIdentity: actorIdentity,
    correctable: supplied.correctable === true && targets.length > 0,
    targets: targets
  };
  details.writerProvenance = activityWriterProvenance_();
  return details;
}

function parseActivityOperationEnvelope_(rawDetails) {
  var details = activityJsonObject_(rawDetails);
  var envelope = details.operationEnvelope;
  if (!envelope || typeof envelope !== 'object') {
    return { status: 'LEGACY_READ_ONLY', envelope: null, details: details };
  }
  try {
    if (Number(envelope.envelopeVersion) !== ACTIVITY_OPERATION_ENVELOPE_VERSION_ ||
        !String(envelope.operationId || '').trim() ||
        !String(envelope.eventId || '').trim() ||
        !String(envelope.operationType || '').trim() ||
        !String(envelope.workbookIdentity || '').trim() ||
        !String(envelope.actorIdentity || '').trim()) {
      throw new Error('Operation envelope identity is incomplete.');
    }
    var normalizedTargets = Array.isArray(envelope.targets)
      ? envelope.targets.map(normalizeActivityTargetDescriptor_)
      : [];
    if (envelope.correctable === true && !normalizedTargets.length) {
      throw new Error('Correctable operation has no verified targets.');
    }
    envelope.targets = normalizedTargets;
    envelope.correctable = envelope.correctable === true;
    return {
      status: envelope.correctable ? 'READY_FOR_PREVIEW' : 'AUDIT_ONLY',
      envelope: envelope,
      details: details
    };
  } catch (e) {
    return {
      status: 'INVALID_READ_ONLY',
      envelope: null,
      details: details,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function activityNormalizedState_(value) {
  if (Array.isArray(value)) return value.map(activityNormalizedState_);
  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).sort().forEach(function(key) {
      out[key] = activityNormalizedState_(value[key]);
    });
    return out;
  }
  return typeof value === 'number' && isFinite(value) ? round2_(value) : value;
}

function activityStatesEqual_(left, right) {
  return JSON.stringify(activityNormalizedState_(left)) ===
    JSON.stringify(activityNormalizedState_(right));
}

function findActivityOperationEvents_(ss, operationId) {
  var requested = String(operationId || '').trim();
  if (!requested || requested.length > 100) {
    throw new Error('A valid Activity operation ID is required.');
  }
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(
    2,
    1,
    sh.getLastRow() - 1,
    ACTIVITY_LOG_HEADERS.length
  ).getValues();
  var found = [];
  for (var i = 0; i < values.length; i++) {
    var parsed = parseActivityOperationEnvelope_(values[i][11]);
    if (parsed.envelope &&
        String(parsed.envelope.operationId || '').trim() === requested) {
      found.push({
        sheetRow: i + 2,
        eventType: String(values[i][1] || '').trim(),
        rowValues: values[i],
        parsed: parsed
      });
    }
  }
  return found;
}

/**
 * Read-only operation preview. It resolves by immutable operationId, verifies
 * workbook scope and distinct event IDs, and compares every supported target
 * with the recorded before/after states. It never offers or performs a write.
 */
function previewActivityOperationInSpreadsheet_(ss, operationId) {
  var events = findActivityOperationEvents_(ss, operationId);
  if (!events.length) {
    return { ok: false, status: 'LEGACY_OR_NOT_FOUND', correctable: false, targets: [] };
  }

  var currentWorkbookIdentity = activityWorkbookIdentity_(ss);
  var currentActorIdentity = activityActorIdentity_();
  var eventIds = {};
  var operationType = '';
  var targetsByKey = {};
  for (var i = 0; i < events.length; i++) {
    var parsed = events[i].parsed;
    var envelope = parsed.envelope;
    if (!envelope || parsed.status === 'INVALID_READ_ONLY') {
      return { ok: false, status: 'INVALID_READ_ONLY', correctable: false, targets: [] };
    }
    if (envelope.workbookIdentity !== currentWorkbookIdentity) {
      return { ok: false, status: 'WORKBOOK_CHANGED', correctable: false, targets: [] };
    }
    if (!currentActorIdentity || envelope.actorIdentity !== currentActorIdentity) {
      return { ok: false, status: 'ACTOR_CHANGED', correctable: false, targets: [] };
    }
    if (eventIds[envelope.eventId]) {
      return { ok: false, status: 'DUPLICATE_EVENT_ID', correctable: false, targets: [] };
    }
    eventIds[envelope.eventId] = true;
    if (operationType && operationType !== envelope.operationType) {
      return { ok: false, status: 'MIXED_OPERATION_TYPE', correctable: false, targets: [] };
    }
    operationType = envelope.operationType;
    for (var j = 0; j < envelope.targets.length; j++) {
      var target = envelope.targets[j];
      var existing = targetsByKey[target.targetKey];
      if (existing && !activityStatesEqual_(existing, target)) {
        return { ok: false, status: 'CONFLICTING_TARGETS', correctable: false, targets: [] };
      }
      targetsByKey[target.targetKey] = target;
    }
  }

  var targetKeys = Object.keys(targetsByKey);
  if (!targetKeys.length || !events.some(function(event) {
    return event.parsed.envelope.correctable === true;
  })) {
    return {
      ok: true,
      status: 'AUDIT_ONLY',
      operationId: String(operationId),
      operationType: operationType,
      correctable: false,
      targets: []
    };
  }

  var previews = targetKeys.map(function(key) {
    var target = targetsByKey[key];
    if (typeof inspectActivityOperationTargetInSpreadsheet_ !== 'function') {
      return { targetKey: key, targetType: target.targetType, status: 'UNSUPPORTED_TARGET' };
    }
    var inspection = inspectActivityOperationTargetInSpreadsheet_(ss, target);
    if (!inspection || inspection.supported !== true) {
      return { targetKey: key, targetType: target.targetType, status: 'UNSUPPORTED_TARGET' };
    }
    var current = activityNormalizedState_(inspection.current);
    var status = activityStatesEqual_(current, target.after)
      ? 'MATCHES_AFTER'
      : (activityStatesEqual_(current, target.before) ? 'MATCHES_BEFORE' : 'CHANGED');
    return {
      targetKey: key,
      targetType: target.targetType,
      status: status,
      before: target.before,
      after: target.after,
      current: current
    };
  });
  var ready = previews.every(function(target) {
    return target.status === 'MATCHES_AFTER';
  });
  return {
    ok: true,
    status: ready ? 'READY' : 'PRECONDITION_FAILED',
    operationId: String(operationId),
    operationType: operationType,
    correctable: ready,
    eventCount: events.length,
    targets: previews
  };
}

/** PUBLIC, READ-ONLY. No correction action is exposed in 5h. */
function previewActivityOperationCorrection(operationId) {
  return previewActivityOperationInSpreadsheet_(getUserSpreadsheet_(), operationId);
}

function activityCorrectionReason_(rawReason, rawOther) {
  var reason = String(rawReason || '').trim();
  var allowed = ['Entered twice', 'Wrong amount', 'Wrong payee/date', 'Other'];
  if (allowed.indexOf(reason) === -1) {
    throw new Error('Choose why this entry is being corrected.');
  }
  var other = String(rawOther || '').trim();
  if (reason === 'Other' && !other) {
    throw new Error('Add a short note for this correction.');
  }
  if (other.length > 240) throw new Error('Correction note must be 240 characters or fewer.');
  return { reason: reason, note: reason === 'Other' ? other : '' };
}

function activityCorrectionLedger_(ss) {
  var out = {};
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return out;
  var details = sh.getRange(2, 12, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < details.length; i++) {
    var parsed = activityJsonObject_(details[i][0]);
    var reversed = String(parsed.reversalOfOperationId || '').trim();
    if (reversed && !out[reversed]) out[reversed] = i + 2;
  }
  return out;
}

function activityCorrectionIndex_(ss) {
  var ledger = activityCorrectionLedger_(ss);
  var out = {};
  Object.keys(ledger).forEach(function(operationId) {
    out[operationId] = true;
  });
  return out;
}

/**
 * Compensate an Activity append only while the enclosing correction transaction
 * is still failing. Successful audit history is immutable; this helper removes
 * only the exact unique row appended by the failed in-flight transaction.
 */
function rollbackFailedActivityAppend_(ss, eventType, dedupeKey) {
  var wantedType = String(eventType || '').trim();
  var wantedDedupe = String(dedupeKey || '').trim();
  if (!wantedType || !wantedDedupe) return false;
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return false;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getDisplayValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][1] || '').trim() === wantedType &&
        String(values[i][10] || '').trim() === wantedDedupe) {
      sh.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function activityCorrectionRelationsFromValues_(values) {
  var corrected = {};
  var superseded = {};
  var correctionByOriginal = {};
  var operationById = {};
  (values || []).forEach(function(row, index) {
    var parsed = parseActivityOperationEnvelope_(row[11]);
    var envelope = parsed.envelope;
    var operationId = envelope
      ? String(envelope.operationId || '').trim()
      : '';
    if (operationId) {
      operationById[operationId] = {
        row: row,
        sheetRow: index + 2,
        parsed: parsed
      };
    }
    var details = parsed.details || {};
    var original = String(details.reversalOfOperationId || '').trim();
    if (original) {
      corrected[original] = true;
      correctionByOriginal[original] = {
        mode: String(details.correctionMode || 'remove').trim(),
        replacementOperationId: String(
          details.replacementOperationId || ''
        ).trim(),
        reason: String(details.correctionReason || '').trim(),
        note: String(details.correctionNote || '').trim(),
        originalAmount: round2_(Math.abs(toNumber_(details.originalAmount))),
        correctedAmount: details.correctedAmount === null ||
          details.correctedAmount === undefined
          ? null
          : round2_(Math.abs(toNumber_(details.correctedAmount))),
        loggedAt: String(row[0] || '').trim()
      };
      if (correctionByOriginal[original].replacementOperationId) {
        superseded[original] = true;
      }
    }
  });
  return {
    corrected: corrected,
    superseded: superseded,
    correctionByOriginal: correctionByOriginal,
    operationById: operationById
  };
}

function activityCorrectionHistory_(relations, operationId) {
  var history = [];
  var current = String(operationId || '').trim();
  var seen = {};
  while (current && !seen[current]) {
    seen[current] = true;
    var operation = relations.operationById[current];
    var details = operation && operation.parsed
      ? operation.parsed.details || {}
      : {};
    var previous = String(details.replacesOperationId || '').trim();
    if (!previous) break;
    var correction = relations.correctionByOriginal[previous] || {};
    history.push({
      fromAmount: correction.originalAmount,
      toAmount: correction.correctedAmount,
      reason: correction.reason,
      note: correction.note,
      loggedAt: correction.loggedAt
    });
    current = previous;
  }
  return history;
}

function activityQuickAddEntrySummary_(events) {
  var event = events && events.length ? events[0] : null;
  var row = event && event.rowValues ? event.rowValues : [];
  var details = event && event.parsed ? event.parsed.details : {};
  var targets = event && event.parsed && event.parsed.envelope
    ? event.parsed.envelope.targets || []
    : [];
  var cashTarget = null;
  for (var i = 0; i < targets.length; i++) {
    if (targets[i].targetType === 'cash_flow_month') {
      cashTarget = targets[i];
      break;
    }
  }
  var locator = cashTarget && cashTarget.locator ? cashTarget.locator : {};
  var rawMonth = locator.month || row[9];
  var cashFlowMonth = rawMonth instanceof Date && !isNaN(rawMonth.getTime())
    ? Utilities.formatDate(rawMonth, Session.getScriptTimeZone(), 'MMM-yy')
    : String(rawMonth || '').trim();
  return {
    entryType: String(row[4] || '').trim().toLowerCase() === 'income' ? 'Income' : 'Expense',
    payee: String(row[5] || '').trim(),
    entryDate: String(locator.entryDate || '').trim() ||
      activityLogEntryDateToYyyyMmDd_(row[2]),
    amount: round2_(Math.abs(toNumber_(row[3]))),
    cashFlowSheet: String(locator.sheetName || row[8] || '').trim(),
    cashFlowMonth: cashFlowMonth,
    activityOrigin: String(details.activityOrigin || '').trim(),
    replacesOperationId: String(details.replacesOperationId || '').trim(),
    rootOperationId: String(
      details.rootOperationId ||
      details.replacesOperationId ||
      (event && event.parsed && event.parsed.envelope
        ? event.parsed.envelope.operationId
        : '')
    ).trim(),
    correctedFromAmount: details.correctedFromAmount === undefined
      ? null
      : round2_(Math.abs(toNumber_(details.correctedFromAmount)))
  };
}

function activityQuickAddImpactForClient_(targetPreview, entry) {
  var before = targetPreview.current || targetPreview.after || {};
  var after = targetPreview.desired || targetPreview.before || {};
  if (targetPreview.targetType === 'cash_flow_month') {
    return {
      type: 'cash_flow_month',
      label: entry.cashFlowMonth + ' Cash Flow total',
      currentValue: before.value,
      restoredValue: after.value,
      removesCreatedRow: after.exists === false
    };
  }
  if (targetPreview.targetType === 'debt_balance') {
    return {
      type: 'debt_balance',
      label: entry.payee + ' tracked balance',
      currentValue: before.value,
      restoredValue: after.value,
      removesCreatedRow: false
    };
  }
  return { type: targetPreview.targetType, label: 'Recorded value' };
}

function activityQuickAddRelevantState_(targetType, rawState) {
  rawState = rawState || {};
  if (targetType === 'cash_flow_month') {
    return {
      exists: rawState.exists === true,
      value: round2_(toNumber_(rawState.value)),
      flowSource: String(rawState.flowSource || '').trim()
    };
  }
  if (targetType === 'debt_balance') {
    return {
      exists: rawState.exists === true,
      value: round2_(toNumber_(rawState.value))
    };
  }
  return activityNormalizedState_(rawState);
}

function activityQuickAddApplyEffect_(targetType, state, operation, target) {
  var next = activityQuickAddRelevantState_(targetType, state);
  var before = activityQuickAddRelevantState_(targetType, target.before);
  var after = activityQuickAddRelevantState_(targetType, target.after);
  if (targetType === 'cash_flow_month') {
    var signedAmount = operation.entry.entryType === 'Expense'
      ? -Math.abs(toNumber_(operation.entry.amount))
      : Math.abs(toNumber_(operation.entry.amount));
    next.exists = true;
    next.value = round2_(toNumber_(next.value) + signedAmount);
    if (before.flowSource !== after.flowSource) next.flowSource = after.flowSource;
    return next;
  }
  if (targetType === 'debt_balance') {
    next.exists = true;
    next.value = round2_(Math.max(
      0,
      toNumber_(next.value) - Math.abs(toNumber_(operation.entry.amount))
    ));
    return next;
  }
  throw new Error('Unsupported Quick Add correction target.');
}

function activityQuickAddStatesMatchForChain_(targetType, left, right) {
  return activityStatesEqual_(
    activityQuickAddRelevantState_(targetType, left),
    activityQuickAddRelevantState_(targetType, right)
  );
}

function activityQuickAddRowKey_(target) {
  if (!target || target.targetType !== 'cash_flow_month') return '';
  var locator = target.locator || {};
  return [
    String(locator.sheetName || '').trim().toLowerCase(),
    String(locator.entryType || '').trim().toLowerCase(),
    String(locator.payee || '').trim().toLowerCase()
  ].join('::');
}

function collectQuickAddOperationLedger_(ss) {
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(
    2,
    1,
    sh.getLastRow() - 1,
    ACTIVITY_LOG_HEADERS.length
  ).getValues();
  var corrections = activityCorrectionLedger_(ss);
  var operations = [];
  for (var i = 0; i < values.length; i++) {
    var parsed = parseActivityOperationEnvelope_(values[i][11]);
    var envelope = parsed.envelope;
    if (!envelope || envelope.operationType !== 'quick_pay') continue;
    var event = {
      sheetRow: i + 2,
      eventType: String(values[i][1] || '').trim(),
      rowValues: values[i],
      parsed: parsed
    };
    operations.push({
      sheetRow: event.sheetRow,
      operationId: String(envelope.operationId || '').trim(),
      envelope: envelope,
      entry: activityQuickAddEntrySummary_([event]),
      targets: envelope.targets || [],
      corrected: !!corrections[String(envelope.operationId || '').trim()],
      correctedAtSheetRow:
        Number(corrections[String(envelope.operationId || '').trim()] || 0)
    });
  }
  operations.sort(function(left, right) { return left.sheetRow - right.sheetRow; });
  return operations;
}

function activityQuickAddSimulateChain_(targetType, chain, operationToExclude) {
  var state = activityQuickAddRelevantState_(targetType, chain[0].target.before);
  for (var i = 0; i < chain.length; i++) {
    var item = chain[i];
    if (item.operation.corrected ||
        item.operation.operationId === String(operationToExclude || '')) {
      continue;
    }
    state = activityQuickAddApplyEffect_(
      targetType,
      state,
      item.operation,
      item.target
    );
  }
  return state;
}

function activityQuickAddSimulateChainAtRow_(targetType, chain, beforeSheetRow) {
  var state = activityQuickAddRelevantState_(targetType, chain[0].target.before);
  var boundary = Number(beforeSheetRow || 0);
  for (var i = 0; i < chain.length; i++) {
    var item = chain[i];
    if (Number(item.operation.sheetRow || 0) >= boundary) break;
    var correctedBeforeBoundary = item.operation.correctedAtSheetRow > 0 &&
      item.operation.correctedAtSheetRow < boundary;
    if (correctedBeforeBoundary) continue;
    state = activityQuickAddApplyEffect_(
      targetType,
      state,
      item.operation,
      item.target
    );
  }
  return state;
}

function buildDirectQuickAddCorrectionPlanInSpreadsheet_(ss, operationId) {
  var requested = String(operationId || '').trim();
  var events = findActivityOperationEvents_(ss, requested);
  if (!events.length) {
    return { ok: false, status: 'LEGACY_OR_NOT_FOUND', correctable: false,
      message: 'This older Activity entry cannot be corrected automatically.' };
  }
  var entry = activityQuickAddEntrySummary_(events);
  if (events.some(function(event) {
    return !event.parsed.envelope ||
      event.parsed.envelope.operationType !== 'quick_pay';
  }) || entry.activityOrigin !== QUICK_ADD_ACTIVITY_ORIGIN_DIRECT_) {
    return { ok: false, status: 'AUDIT_ONLY', correctable: false, entry: entry,
      message: 'This entry belongs to a linked or legacy workflow and remains read-only.' };
  }
  if (activityCorrectionIndex_(ss)[requested]) {
    return { ok: true, status: 'ALREADY_CORRECTED', correctable: false, entry: entry,
      message: 'This Quick Add entry has already been corrected.' };
  }

  var currentWorkbookIdentity = activityWorkbookIdentity_(ss);
  var currentActorIdentity = activityActorIdentity_();
  var ledger = collectQuickAddOperationLedger_(ss);
  var selected = null;
  for (var i = 0; i < ledger.length; i++) {
    if (ledger[i].operationId === requested) {
      if (selected) {
        return { ok: false, status: 'DUPLICATE_OPERATION', correctable: false,
          entry: entry, message: 'This Activity operation is duplicated and remains read-only.' };
      }
      selected = ledger[i];
    }
  }
  if (!selected) {
    return { ok: false, status: 'LEGACY_OR_NOT_FOUND', correctable: false,
      entry: entry, message: 'This Activity entry can no longer be resolved.' };
  }
  if (selected.envelope.workbookIdentity !== currentWorkbookIdentity) {
    return { ok: false, status: 'WORKBOOK_CHANGED', correctable: false,
      entry: entry, message: 'This entry belongs to a different workbook.' };
  }
  if (!currentActorIdentity || selected.envelope.actorIdentity !== currentActorIdentity) {
    return { ok: false, status: 'ACTOR_CHANGED', correctable: false,
      entry: entry, message: 'This entry belongs to a different signed-in user.' };
  }

  var selectedTargets = collectActivityOperationTargets_(events);
  var writes = [];
  var laterActiveOperations = {};
  for (var targetIndex = 0; targetIndex < selectedTargets.length; targetIndex++) {
    var selectedTarget = selectedTargets[targetIndex];
    var targetType = selectedTarget.targetType;
    var chain = [];
    for (var opIndex = 0; opIndex < ledger.length; opIndex++) {
      var operation = ledger[opIndex];
      for (var operationTargetIndex = 0;
           operationTargetIndex < operation.targets.length;
           operationTargetIndex++) {
        var operationTarget = operation.targets[operationTargetIndex];
        if (operationTarget.targetKey === selectedTarget.targetKey) {
          if (operation.envelope.workbookIdentity !== currentWorkbookIdentity ||
              operation.envelope.actorIdentity !== currentActorIdentity) {
            return { ok: false, status: 'CHAIN_IDENTITY_CHANGED', correctable: false,
              entry: entry,
              message: 'A later entry has different workbook or user ownership.' };
          }
          chain.push({ operation: operation, target: operationTarget });
        }
      }
    }
    if (!chain.length) {
      return { ok: false, status: 'CHAIN_NOT_FOUND', correctable: false,
        entry: entry, message: 'The Quick Add history could not be verified.' };
    }

    for (var chainIndex = 0; chainIndex < chain.length; chainIndex++) {
      var chainItem = chain[chainIndex];
      var historicalState = activityQuickAddSimulateChainAtRow_(
        targetType,
        chain,
        chainItem.operation.sheetRow
      );
      if (!activityQuickAddStatesMatchForChain_(
        targetType,
        historicalState,
        chainItem.target.before
      )) {
        return { ok: false, status: 'CHAIN_CHANGED', correctable: false,
          entry: entry,
          message: 'The recorded Quick Add sequence has an unexplained value change.' };
      }
      historicalState = activityQuickAddApplyEffect_(
        targetType,
        chainItem.target.before,
        chainItem.operation,
        chainItem.target
      );
      if (!activityQuickAddStatesMatchForChain_(
        targetType,
        historicalState,
        chainItem.target.after
      )) {
        return { ok: false, status: 'CHAIN_INVALID', correctable: false,
          entry: entry,
          message: 'The recorded Quick Add sequence is incomplete and remains read-only.' };
      }
      if (!chainItem.operation.corrected &&
          chainItem.operation.sheetRow > selected.sheetRow) {
        laterActiveOperations[chainItem.operation.operationId] = true;
      }
    }

    var expected = activityQuickAddSimulateChain_(targetType, chain, '');
    var desired = activityQuickAddSimulateChain_(targetType, chain, requested);
    var inspection = inspectActivityOperationTargetInSpreadsheet_(ss, selectedTarget);
    if (!inspection || inspection.supported !== true) {
      return { ok: false, status: 'UNSUPPORTED_TARGET', correctable: false,
        entry: entry, message: 'This entry no longer has a supported financial target.' };
    }

    if (targetType === 'cash_flow_month') {
      var rowKey = activityQuickAddRowKey_(selectedTarget);
      var activeRowOperations = 0;
      var desiredRowOperations = 0;
      for (var rowOpIndex = 0; rowOpIndex < ledger.length; rowOpIndex++) {
        var rowOperation = ledger[rowOpIndex];
        for (var rowTargetIndex = 0;
             rowTargetIndex < rowOperation.targets.length;
             rowTargetIndex++) {
          if (activityQuickAddRowKey_(rowOperation.targets[rowTargetIndex]) !== rowKey) continue;
          if (!rowOperation.corrected) activeRowOperations++;
          if (!rowOperation.corrected && rowOperation.operationId !== requested) {
            desiredRowOperations++;
          }
        }
      }
      if (expected.exists === false && activeRowOperations > 0) expected.exists = true;
      if (desired.exists === false && desiredRowOperations > 0) desired.exists = true;

      // Delete a row only when this selected operation created it, no other
      // active Quick Add still needs it, and the complete original row
      // fingerprint still matches. Otherwise preserve the row and zero only
      // this operation's verified month contribution.
      if (desired.exists === false) {
        var canDeleteCreatedRow = selectedTarget.before.exists === false &&
          desiredRowOperations === 0 &&
          selectedTarget.after && selectedTarget.after.rowSnapshot &&
          inspection.current && inspection.current.rowSnapshot &&
          activityStatesEqual_(
            inspection.current.rowSnapshot,
            selectedTarget.after.rowSnapshot
          );
        if (!canDeleteCreatedRow) {
          desired.exists = true;
          desired.value = 0;
          desired.flowSource = String(
            inspection.current && inspection.current.flowSource || ''
          ).trim();
        }
      }
    }

    var current = activityQuickAddRelevantState_(targetType, inspection.current);
    if (!activityQuickAddStatesMatchForChain_(targetType, current, expected)) {
      return { ok: false, status: 'PRECONDITION_FAILED', correctable: false,
        entry: entry,
        message: 'A value changed outside this verified Quick Add sequence. CashCompass will not overwrite it.' };
    }
    writes.push({
      target: selectedTarget,
      targetType: targetType,
      current: current,
      desired: desired
    });
  }

  var impacts = writes.map(function(write) {
    return activityQuickAddImpactForClient_({
      targetType: write.targetType,
      current: write.current,
      desired: write.desired
    }, entry);
  });
  var laterCount = Object.keys(laterActiveOperations).length;
  return {
    ok: true,
    status: 'READY',
    operationId: requested,
    operationType: 'quick_pay',
    entryFamily: 'quick_add',
    correctable: true,
    entry: entry,
    impacts: impacts,
    writes: writes,
    laterEntryCount: laterCount,
    message: laterCount
      ? 'CashCompass verified this entry and ' + laterCount +
        ' later entr' + (laterCount === 1 ? 'y' : 'ies') +
        '. Correcting removes only this entry and keeps the later entries.'
      : 'CashCompass verified the current values. Correcting removes only this entry.'
  };
}

/**
 * Read-only, user-facing preview for 5i. Static Activity eligibility is only
 * a discoverability hint; this server preview is the authority.
 */
function previewDirectQuickAddCorrectionInSpreadsheet_(ss, operationId) {
  return buildDirectQuickAddCorrectionPlanInSpreadsheet_(ss, operationId);
}

function previewDirectQuickAddCorrection(operationId) {
  return previewDirectQuickAddCorrectionInSpreadsheet_(
    getUserSpreadsheet_(),
    operationId
  );
}

function previewActivityEntryCorrection(operationId) {
  var ss = getUserSpreadsheet_();
  var events = findActivityOperationEvents_(ss, operationId);
  if (!events.length || !events[0].parsed.envelope) {
    return {
      ok: false,
      status: 'LEGACY_OR_NOT_FOUND',
      correctable: false,
      message: 'This older Activity entry remains read-only.'
    };
  }
  var operationType = String(
    events[0].parsed.envelope.operationType || ''
  ).trim();
  if (operationType === 'quick_pay') {
    return previewDirectQuickAddCorrectionInSpreadsheet_(ss, operationId);
  }
  if (operationType === 'donation' &&
      typeof previewDonationCorrectionInSpreadsheet_ === 'function') {
    return previewDonationCorrectionInSpreadsheet_(ss, operationId);
  }
  return {
    ok: false,
    status: 'AUDIT_ONLY',
    correctable: false,
    message: 'This Activity entry is audit history and cannot be corrected here.'
  };
}

function correctActivityEntry(
  operationId,
  reason,
  otherNote,
  correctionMode,
  correctedAmount
) {
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var ss = getUserSpreadsheet_();
    var events = findActivityOperationEvents_(ss, operationId);
    if (!events.length || !events[0].parsed.envelope) {
      return {
        ok: false,
        status: 'LEGACY_OR_NOT_FOUND',
        error: 'This older Activity entry remains read-only.'
      };
    }
    var operationType = String(
      events[0].parsed.envelope.operationType || ''
    ).trim();
    if (operationType === 'quick_pay') {
      return correctDirectQuickAddOperationInSpreadsheet_(
        ss,
        operationId,
        reason,
        otherNote,
        correctionMode,
        correctedAmount
      );
    }
    if (operationType === 'donation' &&
        typeof correctDonationOperationInSpreadsheet_ === 'function') {
      return correctDonationOperationInSpreadsheet_(
        ss,
        operationId,
        reason,
        otherNote,
        correctionMode,
        correctedAmount
      );
    }
    return {
      ok: false,
      status: 'AUDIT_ONLY',
      error: 'This Activity entry is audit history and cannot be corrected here.'
    };
  } finally {
    lock.releaseLock();
  }
}

function collectActivityOperationTargets_(events) {
  var byKey = {};
  events.forEach(function(event) {
    event.parsed.envelope.targets.forEach(function(target) {
      byKey[target.targetKey] = target;
    });
  });
  return Object.keys(byKey).map(function(key) { return byKey[key]; });
}

function normalizeActivityCorrectionMode_(rawMode) {
  var mode = String(rawMode || 'remove').trim().toLowerCase();
  if (mode !== 'remove' && mode !== 'change_amount') {
    throw new Error('Choose whether to change the amount or remove the entry.');
  }
  return mode;
}

function activityCorrectedAmount_(rawAmount) {
  var amount = Math.abs(toNumber_(rawAmount));
  if (!isFinite(amount) || amount <= 0) {
    throw new Error('Enter a corrected amount greater than $0.00.');
  }
  return round2_(amount);
}

function activityQuickAddReplacementWrites_(preview, correctedAmount) {
  var replacementOperation = {
    entry: {
      entryType: preview.entry.entryType,
      amount: correctedAmount
    }
  };
  return (preview.writes || []).map(function(write) {
    return {
      target: write.target,
      targetType: write.targetType,
      current: write.current,
      withoutOriginal: activityQuickAddRelevantState_(
        write.targetType,
        write.desired
      ),
      desired: activityQuickAddApplyEffect_(
        write.targetType,
        write.desired,
        replacementOperation,
        write.target
      )
    };
  });
}

function activityQuickAddImpactsFromWrites_(writes, entry) {
  return (writes || []).map(function(write) {
    return activityQuickAddImpactForClient_({
      targetType: write.targetType,
      current: write.current,
      desired: write.desired
    }, entry);
  });
}

function correctDirectQuickAddOperationInSpreadsheet_(
  ss,
  operationId,
  reason,
  otherNote,
  correctionMode,
  correctedAmount
) {
  var reasonData = activityCorrectionReason_(reason, otherNote);
  var mode = normalizeActivityCorrectionMode_(correctionMode);
  var replacementAmount = mode === 'change_amount'
    ? activityCorrectedAmount_(correctedAmount)
    : null;
  var preview = buildDirectQuickAddCorrectionPlanInSpreadsheet_(ss, operationId);
  if (!preview.ok || preview.status !== 'READY' || preview.correctable !== true) {
    return {
      ok: false,
      status: preview.status || 'CORRECTION_REFUSED',
      error: preview.message || 'This entry can no longer be corrected safely.'
    };
  }
  if (mode === 'change_amount' &&
      round2_(replacementAmount) === round2_(preview.entry.amount)) {
    return {
      ok: false,
      status: 'NO_CHANGE',
      error: 'Enter a different amount, or choose Remove entry.'
    };
  }

  var writes = mode === 'change_amount'
    ? activityQuickAddReplacementWrites_(preview, replacementAmount)
    : (preview.writes || []).slice();
  writes.sort(function(left, right) {
    var leftDeletesRow = left.targetType === 'cash_flow_month' &&
      left.desired && left.desired.exists === false;
    var rightDeletesRow = right.targetType === 'cash_flow_month' &&
      right.desired && right.desired.exists === false;
    return leftDeletesRow === rightDeletesRow ? 0 : (leftDeletesRow ? 1 : -1);
  });
  var applied = [];
  var correctionAuditDedupe =
    'quick_pay_correction::' + String(operationId || '').trim();
  var replacementAuditDedupe =
    'quick_pay_replacement::' + String(operationId || '').trim();
  var correctionAuditAppended = false;
  var replacementAuditAppended = false;
  try {
    for (var i = 0; i < writes.length; i++) {
      writeActivityOperationTargetStateInSpreadsheet_(
        ss,
        writes[i].target,
        writes[i].desired
      );
      applied.push(writes[i]);
    }
    SpreadsheetApp.flush();

    for (var j = 0; j < writes.length; j++) {
      var inspection = inspectActivityOperationTargetInSpreadsheet_(
        ss,
        writes[j].target
      );
      if (!inspection || inspection.supported !== true ||
          !activityQuickAddStatesMatchForChain_(
            writes[j].targetType,
            inspection.current,
            writes[j].desired
          )) {
        throw new Error('The corrected values could not be verified.');
      }
    }

    var replacementContext = mode === 'change_amount'
      ? createActivityOperationContext_(ss, 'quick_pay')
      : null;
    var correctionContext = createActivityOperationContext_(ss, 'quick_pay_correction');
    var appended = appendActivityLog_(ss, {
      eventType: 'quick_pay_correction',
      entryDate: preview.entry.entryDate,
      amount: 0,
      direction: '',
      payee: preview.entry.payee,
      category: '',
      accountSource: '',
      cashFlowSheet: preview.entry.cashFlowSheet,
      cashFlowMonth: preview.entry.cashFlowMonth,
      dedupeKey: correctionAuditDedupe,
      operationEnvelope: {
        context: correctionContext,
        correctable: false,
        targets: []
      },
      details: JSON.stringify({
        reversalOfOperationId: String(operationId || '').trim(),
        correctionMode: mode,
        replacementOperationId: replacementContext
          ? replacementContext.operationId
          : '',
        correctionReason: reasonData.reason,
        correctionNote: reasonData.note,
        originalAmount: preview.entry.amount,
        correctedAmount: replacementAmount,
        originalEntryType: preview.entry.entryType
      })
    });
    if (!appended) throw new Error('The correction audit record could not be saved.');
    correctionAuditAppended = true;

    if (replacementContext) {
      var replacementTargets = writes.map(function(write) {
        var afterState = activityQuickAddRelevantState_(
          write.targetType,
          write.desired
        );
        if (write.targetType === 'cash_flow_month' &&
            write.target && write.target.after && write.target.after.rowSnapshot) {
          var replacementInspection = inspectActivityOperationTargetInSpreadsheet_(
            ss,
            write.target
          );
          if (replacementInspection && replacementInspection.supported === true &&
              replacementInspection.current &&
              replacementInspection.current.rowSnapshot) {
            afterState.rowSnapshot = replacementInspection.current.rowSnapshot;
          }
        }
        return {
          targetVersion: ACTIVITY_TARGET_DESCRIPTOR_VERSION_,
          targetType: write.targetType,
          targetKey: write.target.targetKey,
          locator: write.target.locator,
          before: activityQuickAddRelevantState_(
            write.targetType,
            write.withoutOriginal
          ),
          after: afterState
        };
      });
      var replacementAppended = appendActivityLog_(ss, {
        eventType: 'quick_pay',
        entryDate: preview.entry.entryDate,
        amount: replacementAmount,
        direction: preview.entry.entryType === 'Expense' ? 'expense' : 'income',
        payee: preview.entry.payee,
        category: '',
        accountSource: '',
        cashFlowSheet: preview.entry.cashFlowSheet,
        cashFlowMonth: preview.entry.cashFlowMonth,
        dedupeKey: replacementAuditDedupe,
        operationEnvelope: {
          context: replacementContext,
          correctable: true,
          targets: replacementTargets
        },
        details: JSON.stringify({
          previousValue: replacementTargets.length
            ? replacementTargets[0].before.value
            : '',
          newValue: replacementTargets.length
            ? replacementTargets[0].after.value
            : '',
          signedAmount: preview.entry.entryType === 'Expense'
            ? -replacementAmount
            : replacementAmount,
          createIfMissing: false,
          debtBalanceNote: null,
          activityOrigin: QUICK_ADD_ACTIVITY_ORIGIN_DIRECT_,
          replacesOperationId: String(operationId || '').trim(),
          rootOperationId: String(
            preview.entry.rootOperationId || operationId || ''
          ).trim(),
          correctedFromAmount: preview.entry.amount
        })
      });
      if (!replacementAppended) {
        throw new Error('The corrected entry could not be added to Activity.');
      }
      replacementAuditAppended = true;
    }

    touchDashboardSourceUpdated_('quick_payment');
    touchDashboardSourceUpdated_('cash_flow');
    if (writes.some(function(write) { return write.targetType === 'debt_balance'; })) {
      touchDashboardSourceUpdated_('debts');
    }
    return {
      ok: true,
      status: 'CORRECTED',
      operationId: String(operationId || '').trim(),
      replacementOperationId: replacementContext
        ? replacementContext.operationId
        : '',
      correctionMode: mode,
      message: mode === 'change_amount'
        ? 'Amount changed. The correction remains in Activity history.'
        : 'Entry removed. The original Activity record remains in history.',
      entry: Object.assign({}, preview.entry, {
        correctedAmount: replacementAmount
      }),
      impacts: activityQuickAddImpactsFromWrites_(writes, preview.entry)
    };
  } catch (e) {
    if (replacementAuditAppended) {
      try {
        rollbackFailedActivityAppend_(
          ss,
          'quick_pay',
          replacementAuditDedupe
        );
      } catch (replacementAuditRollbackError) {
        Logger.log(
          'Quick Add replacement audit compensation failed: ' +
          replacementAuditRollbackError
        );
      }
    }
    if (correctionAuditAppended) {
      try {
        rollbackFailedActivityAppend_(
          ss,
          'quick_pay_correction',
          correctionAuditDedupe
        );
      } catch (correctionAuditRollbackError) {
        Logger.log(
          'Quick Add correction audit compensation failed: ' +
          correctionAuditRollbackError
        );
      }
    }
    // Best-effort compensation restores the exact pre-correction state. This is
    // reached only after all preconditions passed under the same user lock.
    for (var k = applied.length - 1; k >= 0; k--) {
      try {
        writeActivityOperationTargetStateInSpreadsheet_(
          ss,
          applied[k].target,
          applied[k].current
        );
      } catch (rollbackError) {
        Logger.log('Quick Add correction compensation failed: ' + rollbackError);
      }
    }
    SpreadsheetApp.flush();
    return {
      ok: false,
      status: 'CORRECTION_FAILED',
      error: e && e.message ? e.message : String(e)
    };
  }
}

function correctDirectQuickAddOperation(
  operationId,
  reason,
  otherNote,
  correctionMode,
  correctedAmount
) {
  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    return correctDirectQuickAddOperationInSpreadsheet_(
      getUserSpreadsheet_(),
      operationId,
      reason,
      otherNote,
      correctionMode,
      correctedAmount
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Canonical first-create column widths (px), keyed by exact header text.
 *
 * Source: Golden Workbook parity (Validator "AdoptGolden" — LOG - Activity
 * column widths, 2026-07-11). The prior first-create polish called
 * autoResizeColumns() on the empty, header-only sheet, which fit columns to the
 * header text alone and produced extremely narrow columns (e.g. Payee 42px,
 * Dedupe Key 76px) vs the mature Golden layout. These are the Golden widths.
 *
 * Applied via the shared widen-only, header-addressed helper
 * applyCanonicalColumnWidthsByHeader_ (sheet_bootstrap.js) at FIRST CREATE ONLY.
 * Widen-only: a column already ≥ its canonical width is left untouched, so this
 * never shrinks a sheet a user has widened. Header-addressed: robust to column
 * reordering; missing headers are skipped safely.
 */
var ACTIVITY_LOG_CANONICAL_WIDTHS_ = {
  'Logged At': 162,
  'Event Type': 100,
  'Entry Date': 100,
  'Amount': 100,
  'Direction': 127,
  'Payee': 392,
  'Category': 116,
  'Account / Source': 214,
  'Cash Flow Sheet': 177,
  'Cash Flow Month': 144,
  'Dedupe Key': 601,
  'Details': 100
};

/**
 * LOG - Activity "Entry Date" is often a real date cell: getValues() returns a Date, not the yyyy-MM-dd string we wrote.
 * Donation undo fingerprint must compare using the same calendar day as INPUT - Donation.
 * @param {*} cellVal
 * @returns {string} yyyy-MM-dd or best-effort trimmed string
 */
function activityLogEntryDateToYyyyMmDd_(cellVal) {
  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    return Utilities.formatDate(stripTime_(cellVal), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(cellVal || '').trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  try {
    var d = stripTime_(parseIsoDateLocal_(s));
    if (isNaN(d.getTime())) return s;
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return s;
  }
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
/**
 * Creates LOG - Activity and headers if missing. Safe to call on every Bills Due / dashboard load.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function ensureActivityLogSheet_(ss) {
  getOrCreateActivityLogSheet_(ss);
}

function getOrCreateActivityLogSheet_(ss) {
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (sh) {
    // Self-heal an empty sheet only (blank A1). Do NOT touch populated
    // sheets — existing rows keep whatever formatting the user had.
    if (sh.getLastRow() === 0 || String(sh.getRange(1, 1).getValue() || '').trim() === '') {
      sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
      sh.setFrozenRows(1);
    }
    return sh;
  }
  try {
    sh = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
  } catch (insertErr) {
    // On a truly blank workbook the dashboard fires several RPCs in
    // parallel (buildDashboardSnapshot_, getBillsDueFromCashFlowForDashboard,
    // etc.), each of which calls ensureActivityLogSheet_. The
    // getSheetByName check above and this insertSheet call are not
    // atomic across concurrent executions, so two threads can both
    // observe "missing" and race. The loser's insertSheet call throws
    // "A sheet with the name 'LOG - Activity' already exists." — that
    // surfaces as a red banner on the Overview. Treat the collision as
    // "the winner just created it" and return the now-existing sheet.
    // Any other insert failure is re-thrown so genuine problems still
    // surface clearly.
    var existing = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (existing) return existing;
    throw insertErr;
  }
  sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
  sh.setFrozenRows(1);

  // First-creation-only polish. All wrapped in try/catch — cosmetic
  // only, must never fail a log write. Existing `LOG - Activity` sheets
  // are skipped above (get / self-heal branches return early), so this
  // block runs exclusively on truly-new logs (first-create only).
  try {
    sh.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setFontWeight('bold');
  } catch (_boldErr) { /* cosmetic only */ }
  // Golden-parity column widths. Replaces the previous autoResizeColumns()
  // call, which fit an empty header-only sheet and produced far-too-narrow
  // columns. Uses the shared widen-only, header-addressed helper so it never
  // shrinks a user-widened column and is safe if a header ever moves.
  try {
    applyCanonicalColumnWidthsByHeader_(sh, 1, ACTIVITY_LOG_CANONICAL_WIDTHS_);
  } catch (_resizeErr) { /* cosmetic only */ }

  return sh;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} dedupeKey
 * @returns {boolean}
 */
/**
 * Phase 1B (Bills Due perf): request-scoped Activity Log dedupe-key cache.
 *
 * Non-null only while getBillsDueFromCashFlowForDashboard() is executing (it
 * sets/clears this). When active, activityLogDedupeKeyExists_() consults an
 * in-memory Set built once from the dedupe-key column instead of re-reading
 * that column on every call, and appendActivityLog_() adds any key it writes
 * so same-pass idempotency is preserved. Outside the Bills Due RPC this stays
 * null and every caller keeps the original per-call read behavior unchanged.
 *
 * Shape: { keys: Set<string>|null } — the Set is built lazily on first check.
 */
var __billsDueDedupeCache_ = null;

/**
 * Build a Set of every existing dedupe key (trimmed), matching the exact
 * read + trim semantics activityLogDedupeKeyExists_() uses for comparison.
 */
function buildActivityLogDedupeKeySet_(ss) {
  var set = new Set();
  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return set;
  var lastRow = sh.getLastRow();
  var values = sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var k = String(values[i][0] || '').trim();
    if (k) set.add(k);
  }
  return set;
}

function activityLogDedupeKeyExists_(ss, dedupeKey) {
  var key = String(dedupeKey || '').trim();
  if (!key) return false;

  // Phase 1B: when the Bills Due request cache is active, answer from the
  // in-memory Set (built once, lazily) instead of re-reading the column.
  // Semantics are identical to the fallback loop below because the Set is
  // built with the same trim rules and kept current on same-pass appends.
  if (__billsDueDedupeCache_) {
    if (!__billsDueDedupeCache_.keys) {
      __billsDueDedupeCache_.keys = buildActivityLogDedupeKeySet_(ss);
    }
    return __billsDueDedupeCache_.keys.has(key);
  }

  var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return false;

  var lastRow = sh.getLastRow();
  // Read exactly the dedupe-key column, rows 2..lastRow (one column only).
  // Previously this passed `ACTIVITY_LOG_DEDUPE_COL` as the `numColumns`
  // argument by mistake, reading a `lastRow × 11` block starting at
  // col K; it only worked today because `values[i][0]` still pointed at
  // the right column, but was wasteful and would throw the moment the
  // sheet's max-columns dropped below K + 11 − 1.
  var values = sh.getRange(2, ACTIVITY_LOG_DEDUPE_COL, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === key) return true;
  }
  return false;
}

/**
 * @param {string} payee
 * @param {string} monthHeader e.g. Jan-26
 * @param {Date} dueDate
 * @param {number} amount
 * @returns {string}
 */
function buildBillAutopayDedupeKey_(payee, monthHeader, dueDate, amount) {
  var dd =
    dueDate instanceof Date
      ? formatBillOccurrenceDateIso_(dueDate)
      : String(dueDate || '');
  return (
    'bill_autopay::' +
    normalizeActivityKeyPart_(payee) +
    '::' +
    String(monthHeader || '').trim() +
    '::' +
    dd +
    '::' +
    String(round2_(Math.abs(toNumber_(amount))))
  );
}

function normalizeActivityKeyPart_(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {{ payee: string, year: number, monthHeader: string, dueDate?: string }} bill
 * @returns {string} yyyy-MM-dd or ''
 */
function activityLogEntryDateFromSkipBill_(bill) {
  if (!bill) return '';
  if (bill.dueDate) return String(bill.dueDate).trim();
  if (bill.year && bill.monthHeader) {
    var d = monthHeaderToFirstOfMonthDate_(bill.monthHeader, bill.year);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return '';
}

function monthHeaderToFirstOfMonthDate_(monthHeader, fullYear) {
  var mon = String(monthHeader || '').split('-')[0];
  var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var idx = monthNames.indexOf(mon);
  if (idx === -1) return new Date(fullYear, 0, 1);
  return new Date(fullYear, idx, 1);
}

/** Month column label from Cash Flow row 1 (e.g. Jan-26). */
function activityLogMonthHeaderFromCell_(sheet, col1Based) {
  return String(sheet.getRange(1, col1Based).getDisplayValue() || '').trim();
}

/** If getDashboardBillByKey_ fails, best-effort payee from skip key (payee must not contain "::"). */
function activityLogFallbackPayeeFromSkipKey_(skipKey) {
  var t = String(skipKey || '');
  if (t.indexOf('dashboard_bill_skip::') === 0 || t.indexOf('dashboard_recurring_skip::') === 0) {
    var parts = t.split('::');
    return parts.length >= 2 ? String(parts[1] || '').trim() : '';
  }
  return '';
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {{
 *   eventType: string,
 *   entryDate: string,
 *   amount: number,
 *   direction: string,
 *   payee: string,
 *   category?: string,
 *   accountSource?: string,
 *   cashFlowSheet?: string,
 *   cashFlowMonth?: string,
 *   dedupeKey?: string,
 *   details?: string,
 *   operationEnvelope?: Object
 * }} payload
 * @returns {boolean}
 */
function appendActivityLog_(ss, payload) {
  try {
    var dedupe = String(payload.dedupeKey || '').trim();
    if (dedupe && activityLogDedupeKeyExists_(ss, dedupe)) {
      return false;
    }

    var sh = getOrCreateActivityLogSheet_(ss);
    var tz = Session.getScriptTimeZone();
    var loggedAt = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    var details = buildActivityDetailsForAppend_(ss, payload);

    var row = [
      loggedAt,
      String(payload.eventType || '').trim(),
      String(payload.entryDate || '').trim(),
      round2_(Math.abs(toNumber_(payload.amount))),
      String(payload.direction || '').trim(),
      String(payload.payee || '').trim(),
      String(payload.category || '').trim(),
      String(payload.accountSource || '').trim(),
      String(payload.cashFlowSheet || '').trim(),
      String(payload.cashFlowMonth || '').trim(),
      dedupe,
      JSON.stringify(details)
    ];

    sh.appendRow(row);

    // Phase 1B: keep the request-scoped Bills Due dedupe cache current so a
    // marker written during this same pass (e.g. a fresh bill_autopay) is
    // treated as already-existing by later checks in the same request. Only
    // needed when the Set has already been built; if it hasn't, a later check
    // will build it from the sheet, which now includes this appended row.
    if (dedupe && __billsDueDedupeCache_ && __billsDueDedupeCache_.keys) {
      __billsDueDedupeCache_.keys.add(dedupe);
    }

    return true;
  } catch (e) {
    Logger.log('appendActivityLog_ failed: ' + e);
    return false;
  }
}

/**
 * Removes one data row from LOG - Activity (row 1 = headers is never deleted).
 * @param {number} row1Based 1-based sheet row (must be >= 2).
 * @returns {{ ok: boolean, error?: string }}
 */
function deleteActivityLogRow(row1Based) {
  try {
    var row = Number(row1Based);
    if (!isFinite(row) || row !== Math.floor(row) || row < 2) {
      return { ok: false, error: 'Invalid row.' };
    }
    var ss = getUserSpreadsheet_();
    var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sh) {
      return { ok: false, error: 'Activity log not found.' };
    }
    var last = sh.getLastRow();
    if (row > last) {
      return { ok: false, error: 'That row is no longer in the log. Click Apply to refresh.' };
    }

    var logVals = sh.getRange(row, 1, row, ACTIVITY_LOG_HEADERS.length).getValues()[0];
    var ev = String(logVals[1] || '').trim().toLowerCase();
    if (ev !== 'donation') {
      return {
        ok: false,
        error:
          'Remove from the dashboard is only enabled for Donation rows for now (other event types need safe undo before we enable them).'
      };
    }

    var activityUndo = '';
    var activityUndoDetail = '';
    var det = {};
    try {
      det = JSON.parse(String(logVals[11] || '') || '{}');
    } catch (pe) {
      det = {};
    }
    var sr = Number(det.sheetRow);
    if (isFinite(sr) && sr >= 2) {
      var amtSigned =
        det.amountSigned !== undefined && det.amountSigned !== null && String(det.amountSigned) !== ''
          ? round2_(toNumber_(det.amountSigned))
          : null;
      var fp = {
        taxYear: Number(det.taxYear),
        charityName: String(logVals[5] || '').trim(),
        entryDate: activityLogEntryDateToYyyyMmDd_(logVals[2]),
        amountAbs: round2_(toNumber_(logVals[3])),
        amountSigned: amtSigned,
        comments: det.comments != null ? String(det.comments).trim() : '',
        paymentType: String(det.paymentType || logVals[6] || '').trim()
      };
      if (!isNaN(fp.taxYear)) {
        var u = tryDeleteDonationRowForActivityUndo_(ss, Math.floor(sr), fp);
        if (u.deleted) {
          activityUndo = 'donation_sheet_deleted';
        } else if (u.mismatch) {
          activityUndo = 'donation_skipped_mismatch';
        } else if (u.error) {
          activityUndo = 'donation_skipped_error';
          activityUndoDetail = u.error;
        } else if (u.skip) {
          activityUndo = 'donation_skipped_no_undo';
        }
      } else {
        activityUndo = 'donation_skipped_no_undo';
      }
    } else {
      activityUndo = 'donation_skipped_no_undo';
    }

    sh.deleteRow(row);
    return { ok: true, activityUndo: activityUndo, activityUndoDetail: activityUndoDetail };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Maps normalized payee → INPUT - Debts Type and INPUT - Bills Category for Activity "Kind" column.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{ debtByNorm: Object<string, string>, billCatByNorm: Object<string, string> }}
 */
function buildActivityKindLookup_(ss) {
  var debtByNorm = {};
  var billCatByNorm = {};
  try {
    var debtSheet = getSheet_(ss, 'DEBTS');
    var d = debtSheet.getDataRange().getDisplayValues();
    var dh = d[0] || [];
    var nameCol = dh.indexOf('Account Name');
    var typeCol = dh.indexOf('Type');
    if (nameCol !== -1 && typeCol !== -1) {
      for (var r = 1; r < d.length; r++) {
        var n = String(d[r][nameCol] || '').trim();
        if (!n) continue;
        var nk = normalizeBillName_(n);
        if (nk) debtByNorm[nk] = String(d[r][typeCol] || '').trim();
      }
    }
  } catch (e) {
    Logger.log('buildActivityKindLookup_ debts: ' + e);
  }
  try {
    var billSheet = getSheet_(ss, 'BILLS');
    var b = billSheet.getDataRange().getDisplayValues();
    var bh = b[0] || [];
    var pCol = bh.indexOf('Payee');
    var cCol = bh.indexOf('Category');
    if (pCol !== -1 && cCol !== -1) {
      for (var r2 = 1; r2 < b.length; r2++) {
        var p = String(b[r2][pCol] || '').trim();
        if (!p) continue;
        var pk = normalizeBillName_(p);
        if (pk) billCatByNorm[pk] = String(b[r2][cCol] || '').trim();
      }
    }
  } catch (e2) {
    Logger.log('buildActivityKindLookup_ bills: ' + e2);
  }
  return { debtByNorm: debtByNorm, billCatByNorm: billCatByNorm };
}

/**
 * Stored Type on HOUSES sheets uses value "Tax" while the UI label is "Property Tax".
 * @param {string} logCategory Category column from LOG - Activity (House Expenses form Type).
 * @returns {string}
 */
function formatHouseExpenseTypeForActivityKind_(logCategory) {
  var c = String(logCategory || '').trim();
  if (!c) return '';
  if (c === 'Tax') return 'Property Tax';
  return c;
}

/**
 * Human-readable kind: Loan, Bill, HOA, Tuition, Income, house expense types (Repair, Utilities, …), Other.
 * Uses INPUT - Debts / INPUT - Bills when payee matches; keyword overrides for HOA/Tuition.
 */
function classifyActivityKind_(lookup, payee, eventType, direction, logCategory) {
  var pay = String(payee || '').trim();
  var cat = String(logCategory || '').trim();
  var etEarly = String(eventType || '').toLowerCase();
  if (etEarly === 'house_expense') {
    var houseType = formatHouseExpenseTypeForActivityKind_(cat);
    if (houseType) return houseType;
    return 'House Expenses';
  }
  if (etEarly === 'donation' || etEarly === 'donation_comment_update' ||
      etEarly === 'donation_update') return 'Donation';
  if (etEarly.indexOf('upcoming_') === 0) return 'Upcoming';
  if (etEarly === 'bank_account_add') return 'Bank';
  if (etEarly === 'bank_account_update') return 'Bank';
  if (etEarly === 'bank_account_deactivate') return 'Bank';
  if (etEarly === 'bank_account_reactivate') return 'Bank';
  if (etEarly === 'bill_add') return 'Bill';
  if (etEarly === 'bill_update') return 'Bill';
  if (etEarly === 'bill_deactivate') return 'Bill';
  if (etEarly === 'house_add') return 'House Expenses';
  if (etEarly === 'house_value_update') return 'House Expenses';
  if (etEarly === 'house_deactivate') return 'House Expenses';
  if (etEarly === 'investment_add') return 'Investment';
  if (etEarly === 'investment_update') return 'Investment';
  if (etEarly === 'investment_account_update') return 'Investment';
  if (etEarly === 'investment_deactivate') return 'Investment';
  if (etEarly === 'investment_reactivate') return 'Investment';
  if (etEarly === 'investment_planning_purpose_update') return 'Investment';
  if (etEarly === 'debt_add') return 'Debt';
  if (etEarly === 'debt_deactivate') return 'Debt';
  if (etEarly === 'debt_reactivate') return 'Debt';
  if (etEarly === 'debt_update') return 'Debt';
  if (etEarly === 'debt_rename') return 'Debt';
  // income_add / income_deactivate are the canonical event names after
  // the refactor that made INPUT - Cash Flow <year> the source of truth
  // for income. Legacy rows written by the old INPUT - Income Sources
  // architecture (income_source_add / income_source_deactivate) still
  // need a clean label so historical activity stays readable.
  if (etEarly === 'income_add') return 'Income';
  if (etEarly === 'income_deactivate') return 'Income';
  if (etEarly === 'income_source_add') return 'Income';
  if (etEarly === 'income_source_deactivate') return 'Income';
  // Planner email lifecycle events get their own kind so the user can
  // filter them in (or out) from the Type dropdown without confusing
  // them with the bill / debt / etc. categories. All three are
  // non-monetary; see activityLogIsNonMonetaryEvent_.
  if (etEarly === 'planner_email_deferred') return 'Planner';
  if (etEarly === 'planner_email_sent') return 'Planner';
  if (etEarly === 'planner_email_invalid_recipient') return 'Planner';
  // Bank Import lifecycle events. Covers Step 2a ingestion outcomes
  // (bank_import_auto_matched / _pending / _ignored_hit / _row_error)
  // and Step 2b review actions (bank_import_review_add_new / _match /
  // _ignore) under one filterable kind so the user can pull the whole
  // import audit trail with a single Type filter without confusing it
  // with the bill / debt / bank balance categories.
  if (etEarly.indexOf('bank_import_') === 0) return 'Bank Import';

  var combined = pay + ' ' + cat;
  var blob = combined.toLowerCase();

  if (/\bhoa\b|hoa\s|^hoa|association/i.test(combined)) return 'HOA';
  if (/tuition/i.test(blob)) return 'Tuition';

  var norm = normalizeBillName_(pay);
  var dt =
    norm && lookup.debtByNorm[norm] ? String(lookup.debtByNorm[norm]).trim().toLowerCase() : '';
  if (dt) {
    if (dt === 'loan' || dt === 'heloc') return 'Loan';
    if (dt.indexOf('credit') !== -1) return 'Bill';
    return dt.charAt(0).toUpperCase() + dt.slice(1);
  }

  var billCat = norm && lookup.billCatByNorm[norm] ? String(lookup.billCatByNorm[norm]) : '';
  if (billCat) {
    if (/hoa/i.test(billCat)) return 'HOA';
    if (/tuition/i.test(billCat)) return 'Tuition';
  }

  var et = String(eventType || '').toLowerCase();
  var dir = String(direction || '').toLowerCase();
  if (et === 'quick_pay_correction') return 'Correction';
  if (et === 'donation_correction') return 'Correction';
  if (et === 'donation') return 'Donation';
  if (et === 'quick_pay' && dir === 'income') return 'Income';
  if (et === 'quick_pay' && dir === 'expense') return 'Bill';
  if (et === 'bill_skip' || et === 'bill_autopay' || et === 'bill_paid') return 'Bill';
  return 'Other';
}

/**
 * Display-only per-event label surfaced next to the broad "Type" pill so
 * users can tell similar kinds apart at a glance (e.g. "Bill" covers both
 * bill_add and bill_deactivate — but the row should still read "Bill added"
 * vs "Tracking stopped").
 *
 * Returning '' means "no secondary label"; the pill alone is enough.
 *
 * Importantly, this does NOT replace `kindLabel` — the Type filter dropdown
 * and sort still operate on the broad kindLabel, so filtering by "Bill"
 * keeps surfacing every bill lifecycle event as it did before.
 *
 * The optional `detailsJson` second arg lets a handful of events enrich
 * their label from existing details (e.g. upcoming_payment shows the paid
 * amount and remaining balance). We deliberately do NOT change the Amount
 * column rendering or add new fields — this is label-clarity only.
 */
function activityLogActionLabel_(eventType, detailsJson) {
  var et = String(eventType || '').trim().toLowerCase();
  switch (et) {
    case 'quick_pay':
      return activityLogQuickPayActionLabel_(detailsJson);
    case 'bill_add': return 'Bill added';
    // bill_update is non-monetary (Amount renders "—") because a
    // field edit on a tracked bill doesn't move money. The action
    // label inlines the field name + new value for single-field
    // edits, or "Updated N fields" for multi-field edits — see
    // billUpdateActionLabel_ for formatting rules.
    case 'bill_update':
      return billUpdateActionLabel_(detailsJson);
    case 'bill_deactivate': return 'Tracking stopped';
    case 'bill_skip': return 'Bill skipped';
    case 'bill_autopay': return 'Bill autopay';
    // Per-occurrence "handled by manual pay" markers are intentionally hidden
    // from the customer-facing Activity table. The label remains available for
    // internal/read-only consumers of the immutable log.
    case 'bill_paid': return 'Bill paid';
    case 'bank_account_add': return 'Account added';
    // bank_account_update is non-monetary (Amount renders "—") because the
    // user is recording a balance snapshot, not a money movement. The
    // action label inlines the month + new balance — e.g.
    //   "Updated May-26 balance to $1,234.56"
    // Falls back to "Balance updated" for legacy rows that predate the
    // details JSON. See bankAccountUpdateActionLabel_ for formatting rules.
    case 'bank_account_update':
      return bankAccountUpdateActionLabel_(detailsJson);
    case 'bank_account_deactivate': return 'Tracking stopped';
    case 'bank_account_reactivate': return 'Account reactivated';
    case 'house_add': return 'House added';
    // house_value_update is non-monetary — see houseValueUpdateActionLabel_.
    // Renders e.g. "Updated May-26 value to $850,000.00" so the user can
    // tell which month's valuation moved without opening details.
    case 'house_value_update':
      return houseValueUpdateActionLabel_(detailsJson);
    case 'house_deactivate': return 'Tracking stopped';
    case 'investment_add': return 'Account added';
    // investment_update is non-monetary — see investmentUpdateActionLabel_.
    // Renders e.g. "Updated May-26 balance to $25,432.10".
    case 'investment_update':
      return investmentUpdateActionLabel_(detailsJson);
    case 'investment_account_update': return 'Account details updated';
    case 'investment_deactivate': return 'Tracking stopped';
    case 'investment_reactivate': return 'Account reactivated';
    case 'investment_planning_purpose_update': return 'Planning purpose updated';
    case 'debt_add': return 'Account added';
    case 'debt_deactivate': return 'Tracking stopped';
    case 'debt_reactivate': return 'Tracking resumed';
    // debt_update is always non-monetary (Amount renders "—"), so the
    // action label carries the new value inline — e.g.
    //   "Updated Account Balance to $54,000.00"
    //   "Updated Int Rate to 4.50%"
    //   "Updated Due Date to 15"
    // Falls back to a plain label for legacy rows with no details JSON.
    case 'debt_update':
      return debtUpdateActionLabel_(detailsJson);
    // debt_rename is non-monetary; the label carries old → new inline, e.g.
    //   "Renamed Credit Card - Marriott → Marriott Bonvoy Visa"
    case 'debt_rename':
      return debtRenameActionLabel_(detailsJson);
    case 'income_add': return 'Income source added';
    case 'income_deactivate': return 'Tracking stopped';
    // Legacy rows from the old INPUT - Income Sources architecture.
    case 'income_source_add': return 'Income source added';
    case 'income_source_deactivate': return 'Tracking stopped';
    case 'upcoming_add': return 'Upcoming added';
    // upcoming_status is now only written by dismissUpcomingExpense() — the
    // previous Planned/Paid/Skipped status toggle is gone. Keep the label
    // tight so legacy rows and new Dismiss events both read cleanly.
    case 'upcoming_status': return 'Dismissed';
    // upcoming_payment is the non-monetary lifecycle event paired with a
    // quick_pay money movement. Amount stays "—" (the dollars are on the
    // quick_pay row) but we surface paid + remaining context in the label
    // so the Activity list doesn't just read "Payment applied" with no
    // numbers next to it. Falls back to the plain label for legacy rows
    // that predate the detail fields.
    case 'upcoming_payment':
      return upcomingPaymentActionLabel_(detailsJson);
    // upcoming_update is the field-level edit lifecycle event written
    // by upcoming_expenses.js::updateUpcomingExpenseFromDashboard. Non-
    // monetary; the action label inlines the new value when a single
    // field changed (Due Date or Amount get specialized formatting).
    // See upcomingUpdateActionLabel_ for the rendered text.
    case 'upcoming_update':
      return upcomingUpdateActionLabel_(detailsJson);
    // Legacy: upcoming_cashflow is no longer emitted (direct "Add to Cash
    // Flow" path removed), but historical rows still need a readable label.
    case 'upcoming_cashflow': return 'Pushed to cash flow';
    case 'quick_pay_correction': return quickPayCorrectionActionLabel_(detailsJson);
    case 'donation_correction': return quickPayCorrectionActionLabel_(detailsJson);
    case 'donation_update': return 'Donation updated';
    case 'donation_comment_update': return 'Donation comments updated';
    // Planner email lifecycle. All three are non-monetary (Amount = "—").
    //   planner_email_deferred — LEGACY. New per-save defers no longer
    //     write this row (a heavy month-start session was producing
    //     20-50 redundant rows that crowded out real money events).
    //     The deferred count is now rolled up onto the eventual
    //     planner_email_sent row's action label as "(N saves
    //     batched)". This case stays so existing historical rows in
    //     LOG - Activity still render correctly.
    //   planner_email_sent — the actual email went out. Surfaces
    //     recipient count from the row's details JSON when present.
    //   planner_email_invalid_recipient — Profile had a value in
    //     `Email` or `Spouse Email` that failed regex validation, so
    //     that recipient was dropped. The bad address itself is
    //     intentionally never logged; only the field name is.
    case 'planner_email_deferred': return 'Email deferred';
    case 'planner_email_sent': return plannerEmailSentActionLabel_(detailsJson);
    case 'planner_email_invalid_recipient':
      return plannerEmailInvalidRecipientActionLabel_(detailsJson);
    // Bank Import — Step 2b review actions. All three are non-monetary
    // (Amount renders "—") so the review decision lives entirely in
    // the action label. See activityLogIsNonMonetaryEvent_. Add /
    // Match are link-only as of Step 2d — the imported balance is
    // applied separately by bank_import_apply_balance below.
    case 'bank_import_review_add_new': return 'Linked new account from import';
    case 'bank_import_review_match': return 'Linked to existing account';
    case 'bank_import_review_unlink_match': return 'Unlinked match';
    case 'bank_import_review_ignore': return 'Ignored bank import';
    // Bank Import — Step 2d Apply. The user explicitly approved
    // writing the staged snapshot to INPUT - Bank Accounts; this row
    // is the audit trail for that approval. Non-monetary so the
    // snapshot doesn't double-count against Activity totals (the
    // snapshot is a balance, not a money movement).
    case 'bank_import_apply_balance': return 'Applied imported balance';
    default: return '';
  }
}

/**
 * A Bills Due payment writes its dollars as quick_pay and links the occurrence
 * through a separate bill_paid marker. Label the monetary row so the Activity
 * table can present the action as one clear customer-facing event.
 */
function activityLogQuickPayActionLabel_(detailsJson) {
  var details = activityJsonObject_(detailsJson);
  return String(details.activityOrigin || '').trim() === 'bill_payment'
    ? 'Bill paid'
    : '';
}

/**
 * Internal coordination markers remain in LOG - Activity for occurrence
 * suppression and audit, but are not separate customer-facing Activity rows.
 */
function activityLogHiddenFromDashboard_(eventType) {
  return String(eventType || '').trim().toLowerCase() === 'bill_paid';
}

function quickPayCorrectionActionLabel_(detailsJson) {
  var details = activityJsonObject_(detailsJson);
  var amount = Number(details.originalAmount);
  return isFinite(amount)
    ? 'Reversed Quick Add of ' + fmtCurrency_(Math.abs(amount))
    : 'Quick Add reversed';
}

/**
 * Build the `planner_email_sent` action label from the row's details
 * JSON. Surfaces recipient count when available so the user can tell
 * at a glance whether spouse was included.
 *
 *   "Email sent to 2 recipients"                          — primary + spouse, immediate send
 *   "Email sent to 2 recipients (12 saves batched)"       — primary + spouse, after a debounced burst
 *   "Email sent to 1 recipient"                           — primary only, immediate send
 *   "Email sent to 1 recipient (1 save batched)"          — primary only, one save deferred then sent
 *   "Email sent"                                          — legacy row with no details
 *
 * `deferredSaveCount` is omitted when 0 or missing so manual Run
 * Planner runs (which always bypass debounce) read clean.
 */
function plannerEmailSentActionLabel_(detailsJson) {
  var fallback = 'Email sent';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;
  var d;
  try {
    d = JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;
  var n = Number(d.recipientCount);
  if (!isFinite(n) || n <= 0) return fallback;
  var label = 'Email sent to ' + n + ' recipient' + (n === 1 ? '' : 's');
  var deferred = Number(d.deferredSaveCount);
  if (isFinite(deferred) && deferred >= 1) {
    label += ' (' + deferred + ' save' + (deferred === 1 ? '' : 's') + ' batched)';
  }
  return label;
}

/**
 * Build the `planner_email_invalid_recipient` action label from the
 * row's details JSON. The Profile field name (e.g. `Spouse Email`) is
 * surfaced so the user knows which slot to fix; we deliberately never
 * include the bad address itself.
 *
 *   "Invalid Spouse Email — skipped"
 *   "Invalid Email — skipped"
 *   "Invalid recipient — skipped"   — legacy row with no details
 */
function plannerEmailInvalidRecipientActionLabel_(detailsJson) {
  var fallback = 'Invalid recipient — skipped';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;
  var d;
  try {
    d = JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;
  var field = String(d.field || '').trim();
  if (!field) return fallback;
  return 'Invalid ' + field + ' — skipped';
}

/**
 * Build the upcoming_payment action label from the row's details JSON.
 * Uses paidAmount + remainingAfter + fullyPaid that are already written
 * by appendUpcomingActivityPayment_ — no schema changes.
 *
 *   "Applied $500.00 (Remaining $250.00)"   — partial payment
 *   "Applied $500.00 (Fully paid)"          — terminal payment
 *   "Applied $500.00"                       — amount only (missing remaining)
 *   "Payment applied"                       — legacy row with no details
 */
function upcomingPaymentActionLabel_(detailsJson) {
  var fallback = 'Payment applied';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var paid = activityLogAsFiniteNumber_(d.paidAmount);
  if (paid === null || paid <= 0) return fallback;

  var label = 'Applied ' + activityLogFmtMoney_(paid);
  var fullyPaid = d.fullyPaid === true;
  var remaining = activityLogAsFiniteNumber_(d.remainingAfter);

  if (fullyPaid) {
    label += ' (Fully paid)';
  } else if (remaining !== null && remaining >= 0) {
    label += ' (Remaining ' + activityLogFmtMoney_(remaining) + ')';
  }

  return label;
}

/**
 * Build the upcoming_update action label from the row's details JSON
 * written by upcoming_expenses.js::updateUpcomingExpenseFromDashboard.
 * Uses the explicit `changedFields` list so we don't have to re-diff
 * `previous` vs `new` here. Defensive against missing/partial details
 * — falls back to a plain "Updated" label rather than throwing.
 *
 *   one field, dueDate    → "Updated Due Date to 2026-05-19"
 *   one field, amount     → "Updated Amount to $9,500.00"
 *   one field, other      → "Updated <Display Name>"
 *   multiple fields       → "Updated 3 fields"
 *   legacy / no details   → "Updated"
 */
function upcomingUpdateActionLabel_(detailsJson) {
  var fallback = 'Updated';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;
  var d;
  try {
    d = JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var changed = (d.changedFields && d.changedFields.length) ? d.changedFields : [];
  if (!changed.length) return fallback;

  if (changed.length > 1) {
    return 'Updated ' + changed.length + ' fields';
  }

  var field = String(changed[0] || '').trim();
  if (!field) return fallback;

  // Read `new` defensively — `new` is a reserved word in some contexts so
  // we always go through bracket access.
  var newVals = (d['new'] && typeof d['new'] === 'object') ? d['new'] : null;
  var newVal = newVals ? newVals[field] : null;

  if (field === 'dueDate') {
    var iso = String(newVal || '').trim();
    return iso ? 'Updated Due Date to ' + iso : 'Updated Due Date';
  }
  if (field === 'amount') {
    var n = activityLogAsFiniteNumber_(newVal);
    return n !== null ? 'Updated Amount to ' + activityLogFmtMoney_(n) : 'Updated Amount';
  }
  return 'Updated ' + upcomingUpdateFieldDisplayName_(field);
}

/**
 * Map an upcoming_update field key (matches the JSON keys written by
 * appendUpcomingActivityUpdate_) to the user-facing display name shown
 * in the action label. Unknown keys fall through to the raw key so a
 * future field added without a label doesn't crash the activity row.
 */
function upcomingUpdateFieldDisplayName_(key) {
  switch (String(key || '').trim()) {
    case 'expenseName': return 'Expense Name';
    case 'category': return 'Category';
    case 'payee': return 'Payee';
    case 'dueDate': return 'Due Date';
    case 'amount': return 'Amount';
    case 'accountSource': return 'Account / Source';
    case 'autoAddToCashFlow': return 'Auto Add To Cash Flow';
    case 'notes': return 'Notes';
    default: return key || 'Field';
  }
}

/**
 * Build the bill_update action label from the row's details JSON
 * written by bills.js::updateTrackedBillFromDashboard.
 *
 * Mirrors upcomingUpdateActionLabel_'s shape so single-field edits
 * inline the new value while multi-field edits collapse to a
 * compact count:
 *
 *   "Updated Default Amount to $126.00"
 *   "Updated Due Day to 15"
 *   "Updated Autopay to Yes"
 *   "Updated Payee"            (no inlined value — names get long)
 *   "Updated 3 fields"         (multi-field)
 *   "Updated bill"             (legacy / malformed details)
 *
 * Defensive: a missing/partial details blob still produces a clean
 * label rather than throwing.
 */
function billUpdateActionLabel_(detailsJson) {
  var fallback = 'Updated bill';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var changed = (d.changedFields && d.changedFields.length) ? d.changedFields : [];
  if (!changed.length) return fallback;

  if (changed.length > 1) {
    return 'Updated ' + changed.length + ' fields';
  }

  var field = String(changed[0] || '').trim();
  if (!field) return fallback;

  // Read `new` defensively — keyword in some contexts so always go
  // through bracket access.
  var newVals = (d['new'] && typeof d['new'] === 'object') ? d['new'] : null;
  var newVal = newVals ? newVals[field] : null;

  if (field === 'defaultAmount') {
    var n = activityLogAsFiniteNumber_(newVal);
    return n !== null
      ? 'Updated Default Amount to ' + activityLogFmtMoney_(n)
      : 'Updated Default Amount';
  }
  if (field === 'dueDay') {
    var i = activityLogAsFiniteNumber_(newVal);
    return i !== null
      ? 'Updated Due Day to ' + String(Math.trunc(i))
      : 'Updated Due Day';
  }

  var displayName = billUpdateFieldDisplayName_(field);
  // Payee renames can be long ("Acme Pest Control of Northern …") so
  // we deliberately suppress the " to <value>" suffix; the previous
  // and new values live in the details JSON for audit.
  if (field === 'payee' || field === 'notes') {
    return 'Updated ' + displayName;
  }

  var asString = '';
  if (newVal !== null && typeof newVal !== 'undefined' && newVal !== '') {
    asString = String(newVal).trim();
  }
  return asString ? 'Updated ' + displayName + ' to ' + asString : 'Updated ' + displayName;
}

/**
 * Map a bill_update field key (the JSON keys written by
 * updateTrackedBillFromDashboard) to the user-facing display name
 * shown in the action label. Unknown keys fall through to the raw
 * key so a future field added without a label still renders.
 */
function billUpdateFieldDisplayName_(key) {
  switch (String(key || '').trim()) {
    case 'payee': return 'Payee';
    case 'defaultAmount': return 'Default Amount';
    case 'dueDay': return 'Due Day';
    case 'frequency': return 'Frequency';
    case 'paymentSource': return 'Payment Source';
    case 'category': return 'Category';
    case 'autopay': return 'Autopay';
    case 'varies': return 'Varies';
    case 'notes': return 'Notes';
    default: return key || 'Field';
  }
}

/**
 * Build the debt_update action label from the row's details JSON written
 * by debts.js::updateDebtField. Uses fieldName + fieldKind + newRaw (with
 * newDisplay as a fallback) to format the new value with the right units.
 * Kept intentionally defensive so a missing/partial details blob still
 * renders a clean "Updated <Field>" label instead of blowing up.
 *
 *   currency → "Updated Account Balance to $54,000.00"
 *   percent  → "Updated Int Rate to 4.50%"
 *   integer  → "Updated Due Date to 15"
 *   text     → "Updated <Field> to <newDisplay>" (or just "Updated <Field>")
 *   legacy   → "Updated"
 */
function debtRenameActionLabel_(detailsJson) {
  var fallback = 'Renamed account';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;
  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;
  var oldName = String(d.oldName || '').trim();
  var newName = String(d.newName || '').trim();
  if (oldName && newName) return 'Renamed ' + oldName + ' \u2192 ' + newName;
  if (newName) return 'Renamed to ' + newName;
  return fallback;
}

function debtUpdateActionLabel_(detailsJson) {
  var fallback = 'Updated';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var fieldName = String(d.fieldName || '').trim();
  if (!fieldName) {
    // Consolidated multi-field edit (Manage Debts): no single fieldName, but a
    // changedFields list. Render a compact "Updated N field(s)" summary.
    if (d.changedFields && d.changedFields.length) {
      var n = d.changedFields.length;
      if (n === 1) return 'Updated ' + String(d.changedFields[0]);
      return 'Updated ' + n + ' fields';
    }
    return fallback;
  }

  var kind = String(d.fieldKind || '').trim().toLowerCase();
  var label = 'Updated ' + fieldName;

  var formattedNew = '';
  if (kind === 'currency') {
    var n = activityLogAsFiniteNumber_(d.newRaw);
    if (n !== null) formattedNew = activityLogFmtMoney_(n);
  } else if (kind === 'percent') {
    var p = activityLogAsFiniteNumber_(d.newRaw);
    if (p !== null) formattedNew = p.toFixed(2) + '%';
  } else if (kind === 'integer') {
    var i = activityLogAsFiniteNumber_(d.newRaw);
    if (i !== null) formattedNew = String(Math.trunc(i));
  } else {
    // Text / unknown: prefer the display rendered by the client if present;
    // otherwise coerce whatever raw value was logged.
    var disp = String(d.newDisplay || '').trim();
    if (disp) {
      formattedNew = disp;
    } else if (d.newRaw !== null && typeof d.newRaw !== 'undefined' && d.newRaw !== '') {
      formattedNew = String(d.newRaw);
    }
  }

  return formattedNew ? label + ' to ' + formattedNew : label;
}

/**
 * Build the bank_account_update action label from the row's details JSON
 * written by bank_accounts.js::updateBankAccountValueByDate. Uses
 * monthLabel + newRaw (currency) to format the label so the user can tell
 * which month's balance was changed without opening the row, e.g.
 *
 *   "Updated May-26 balance to $1,234.56"   — typical case
 *   "Updated balance to $1,234.56"          — missing monthLabel fallback
 *   "Balance updated"                       — legacy / malformed details
 *
 * Mirrors debtUpdateActionLabel_'s defensive style: a missing/partial
 * details blob still renders a clean label instead of throwing. Side
 * updates (Available Now / Min Buffer) are deliberately not surfaced in
 * the label — they live in details JSON and would clutter the row.
 */
function bankAccountUpdateActionLabel_(detailsJson) {
  var fallback = 'Balance updated';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  if (String(d.updateKind || '') === 'account_details') {
    var changed = Array.isArray(d.changedFields) ? d.changedFields : [];
    if (changed.indexOf('Account Name') !== -1 && changed.length === 1) {
      return 'Account renamed';
    }
    if (changed.length === 1) return 'Updated ' + String(changed[0] || 'account details');
    if (changed.length > 1) return 'Updated ' + changed.length + ' account details';
    return 'Account details updated';
  }

  var newRawNum = activityLogAsFiniteNumber_(d.newRaw);
  if (newRawNum === null) return fallback;
  var formattedNew = activityLogFmtMoney_(newRawNum);

  var monthLabel = String(d.monthLabel || '').trim();
  if (monthLabel) {
    return 'Updated ' + monthLabel + ' balance to ' + formattedNew;
  }
  return 'Updated balance to ' + formattedNew;
}

/**
 * Build the house_value_update action label from the row's details JSON
 * written by house_values.js::updateHouseValueByDate. Same shape as
 * bankAccountUpdateActionLabel_ but uses "value" instead of "balance"
 * because INPUT - House Values stores property valuations, not bank
 * balances. Defensive against missing/partial details — a malformed
 * row still renders a clean fallback instead of throwing.
 *
 *   "Updated May-26 value to $850,000.00"   — typical case
 *   "Updated value to $850,000.00"          — missing monthLabel fallback
 *   "Value updated"                         — legacy / malformed details
 */
function houseValueUpdateActionLabel_(detailsJson) {
  var fallback = 'Value updated';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var newRawNum = activityLogAsFiniteNumber_(d.newRaw);
  if (newRawNum === null) return fallback;
  var formattedNew = activityLogFmtMoney_(newRawNum);

  var monthLabel = String(d.monthLabel || '').trim();
  if (monthLabel) {
    return 'Updated ' + monthLabel + ' value to ' + formattedNew;
  }
  return 'Updated value to ' + formattedNew;
}

/**
 * Build the investment_update action label from the row's details JSON
 * written by investments.js::updateInvestmentValueByDate. Identical
 * formatting to bankAccountUpdateActionLabel_ — investment accounts
 * also store balance snapshots month-to-month — but kept as its own
 * function so the event-type → label mapping in activityLogActionLabel_
 * stays one-to-one (easier to audit and adjust per-event wording later
 * without affecting the others).
 *
 *   "Updated May-26 balance to $25,432.10"   — typical case
 *   "Updated balance to $25,432.10"          — missing monthLabel fallback
 *   "Balance updated"                        — legacy / malformed details
 */
function investmentUpdateActionLabel_(detailsJson) {
  var fallback = 'Balance updated';
  var raw = String(detailsJson || '').trim();
  if (!raw) return fallback;

  var d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
  if (!d || typeof d !== 'object') return fallback;

  var newRawNum = activityLogAsFiniteNumber_(d.newRaw);
  if (newRawNum === null) return fallback;
  var formattedNew = activityLogFmtMoney_(newRawNum);

  var monthLabel = String(d.monthLabel || '').trim();
  if (monthLabel) {
    return 'Updated ' + monthLabel + ' balance to ' + formattedNew;
  }
  return 'Updated balance to ' + formattedNew;
}

function activityLogAsFiniteNumber_(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

function activityLogFmtMoney_(n) {
  var v = Number(n) || 0;
  if (!isFinite(v)) return '—';
  var sign = v < 0 ? '-' : '';
  var abs = Math.abs(v).toFixed(2);
  // Thin thousands-separator formatter so we don't depend on Utilities/Intl
  // in this server-side path.
  var parts = abs.split('.');
  var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '$' + whole + '.' + parts[1];
}

/**
 * Event types that represent lifecycle/metadata actions rather than a money
 * movement. Activity UI renders these rows with a blank amount ("—") so we
 * don't show a misleading $0.00.
 */
function activityLogIsNonMonetaryEvent_(eventType) {
  var et = String(eventType || '').trim().toLowerCase();
  // upcoming_status is the Dismiss lifecycle event (Paid transitions now
  // flow through upcoming_payment instead). upcoming_payment is the
  // non-monetary partner of a quick_pay money-movement row — rendering
  // both as "—" prevents double-counting the payment dollars.
  return (
    et === 'bill_deactivate' ||
    // bill_paid is the non-monetary partner of a quick_pay money-movement
    // row (Bills Due → Pay on a weekly/biweekly occurrence). The dollars are
    // recorded on the quick_pay row; this marker only flags the occurrence as
    // handled so Bills Due suppresses it. Rendering Amount as "—" prevents
    // double-counting the same payment.
    et === 'bill_paid' ||
    // bill_update is non-monetary — a field edit on a tracked bill
    // (Payee / Default Amount / Due Day / etc.) doesn't move money.
    // The action label inlines the field + new value so the
    // Activity row stays informative without filling the Amount
    // column with a misleading $0.00. See billUpdateActionLabel_.
    et === 'bill_update' ||
    et === 'bank_account_deactivate' ||
    et === 'bank_account_reactivate' ||
    // bank_account_update / house_value_update / investment_update all
    // log a snapshot edit, not a money movement. Rendering the dollar
    // value in Amount would double-count it against the Activity totals;
    // the new balance/value is shown inline in the action label instead
    // (see bankAccountUpdateActionLabel_ / houseValueUpdateActionLabel_ /
    // investmentUpdateActionLabel_).
    et === 'bank_account_update' ||
    et === 'house_value_update' ||
    et === 'investment_update' ||
    et === 'investment_account_update' ||
    et === 'house_deactivate' ||
    et === 'investment_deactivate' ||
    et === 'investment_reactivate' ||
    et === 'investment_planning_purpose_update' ||
    et === 'debt_deactivate' ||
    et === 'debt_reactivate' ||
    // debt_update rows carry the new value inside the action label (not
    // the Amount column) so we don't double-count a config edit as money
    // moved. See debtUpdateActionLabel_ for the rendered text.
    et === 'debt_update' ||
    et === 'income_deactivate' ||
    et === 'income_source_deactivate' ||
    et === 'upcoming_status' ||
    et === 'upcoming_payment' ||
    et === 'quick_pay_correction' ||
    et === 'donation_correction' ||
    et === 'donation_update' ||
    et === 'donation_comment_update' ||
    // upcoming_update rows carry the new value inline in the action
    // label (see upcomingUpdateActionLabel_) so we render Amount as
    // "—" — otherwise a Due Date / Notes edit would appear as $0.00.
    et === 'upcoming_update' ||
    // Planner email lifecycle: these rows describe a notification
    // event, not a money movement, so Amount renders "—" — otherwise
    // a heavy update session would show ten "$0.00" Email deferred
    // rows in Activity for no reason.
    et === 'planner_email_deferred' ||
    et === 'planner_email_sent' ||
    et === 'planner_email_invalid_recipient' ||
    // Bank Import — Step 2b review actions + Step 2d Apply. The
    // dollars on apply represent a balance snapshot, not a money
    // movement; rendering Amount here would double-count it against
    // the Activity totals. The action label carries the month + new
    // balance for context.
    et === 'bank_import_review_add_new' ||
    et === 'bank_import_review_match' ||
    et === 'bank_import_review_unlink_match' ||
    et === 'bank_import_review_ignore' ||
    et === 'bank_import_apply_balance'
  );
}

function parseOptionalAmountFilter_(raw) {
  var s = String(raw || '').trim();
  if (!s) return null;
  var n = round2_(toNumber_(s));
  if (isNaN(n)) return null;
  return n;
}

function activityLogLoggedDatePart_(loggedAtStr) {
  var s = String(loggedAtStr || '').trim();
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

function activityLogRowKind_(lookup, r) {
  var payee = String(r[5] || '').trim();
  return classifyActivityKind_(
    lookup,
    payee,
    String(r[1] || '').trim(),
    String(r[4] || '').trim(),
    String(r[6] || '').trim()
  );
}

function activityLogDistinctKindsFromValues_(values, lookup) {
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (!String(r[0] || '').trim() && !String(r[1] || '').trim()) continue;
    var eventType = String(r[1] || '').trim().toLowerCase();
    if (eventType === 'quick_pay_correction' ||
        eventType === 'donation_correction') {
      continue;
    }
    var k = activityLogRowKind_(lookup, r);
    if (k) seen[k] = true;
  }
  return Object.keys(seen).sort(function(a, b) {
    return a.localeCompare(b);
  });
}

function activityLogRowHiddenByCorrectionRelations_(row, relations) {
  var eventType = String(row && row[1] || '').trim().toLowerCase();
  if (eventType === 'quick_pay_correction' ||
      eventType === 'donation_correction') {
    return true;
  }
  var operation = parseActivityOperationEnvelope_(
    String(row && row[11] || '').trim()
  );
  var operationId = operation.envelope
    ? String(operation.envelope.operationId || '').trim()
    : '';
  return !!(
    operationId &&
    relations &&
    relations.superseded &&
    relations.superseded[operationId]
  );
}

function activityLogRowMatchesDashboardFilters_(r, dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup) {
  var loggedAt = String(r[0] || '').trim();
  if (!loggedAt && !String(r[1] || '').trim()) return false;
  var ld = activityLogLoggedDatePart_(loggedAt);
  if (dateFrom && ld && ld < dateFrom) return false;
  if (dateTo && ld && ld > dateTo) return false;
  var payee = String(r[5] || '').trim();
  if (payeeSearch && payee.toLowerCase().indexOf(payeeSearch) === -1) return false;
  var amtVal = round2_(toNumber_(r[3]));
  if (minNum !== null && amtVal < minNum) return false;
  if (maxNum !== null && amtVal > maxNum) return false;
  if (kindType) {
    if (activityLogRowKind_(lookup, r) !== kindType) return false;
  }
  return true;
}

/**
 * Activity tab: filtered rows (newest first, capped) plus distinct Type labels from the whole log.
 * @param {{ dateFrom?: string, dateTo?: string, payeeSearch?: string, kindType?: string, amountMin?: string|number, amountMax?: string|number, matchLimit?: number }} filters
 */
function getActivityDashboardData(filters) {
  filters = filters || {};
  try {
    var ss = getUserSpreadsheet_();
    var sh = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: true,
        rows: [],
        kinds: [],
        scannedRows: 0,
        truncated: false,
        message: 'No activity recorded yet.'
      };
    }

    var values = sh.getRange(2, 1, sh.getLastRow(), ACTIVITY_LOG_HEADERS.length).getDisplayValues();
    var lookup = buildActivityKindLookup_(ss);
    var correctionRelations = activityCorrectionRelationsFromValues_(values);
    var correctionIndex = correctionRelations.corrected;
    var kinds = activityLogDistinctKindsFromValues_(values, lookup);

    var dateFrom = String(filters.dateFrom || '').trim();
    var dateTo = String(filters.dateTo || '').trim();
    var payeeSearch = String(filters.payeeSearch || '').trim().toLowerCase();
    var minNum = parseOptionalAmountFilter_(filters.amountMin);
    var maxNum = parseOptionalAmountFilter_(filters.amountMax);
    var kindType = String(filters.kindType || '').trim();
    var matchLimit = Math.min(2000, Math.max(1, Number(filters.matchLimit) || 500));

    var out = [];
    var i;
    for (i = values.length - 1; i >= 0 && out.length < matchLimit; i--) {
      var r = values[i];
      if (!activityLogRowMatchesDashboardFilters_(r, dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup)) {
        continue;
      }
      if (activityLogRowHiddenByCorrectionRelations_(
        r,
        correctionRelations
      )) {
        continue;
      }

      var payee = String(r[5] || '').trim();
      var eventType = String(r[1] || '').trim();
      if (activityLogHiddenFromDashboard_(eventType)) {
        continue;
      }
      var direction = String(r[4] || '').trim();
      var logCategory = String(r[6] || '').trim();
      var amtVal = round2_(toNumber_(r[3]));
      var operation = parseActivityOperationEnvelope_(String(r[11] || '').trim());
      var operationEnvelope = operation.envelope;
      var operationId = operationEnvelope
        ? String(operationEnvelope.operationId || '').trim()
        : '';
      var operationOrigin = String(operation.details.activityOrigin || '').trim();
      var isCorrected = !!(operationId && correctionIndex[operationId]);
      if (operationId && correctionRelations.superseded[operationId]) {
        continue;
      }
      var canCorrectQuickAdd = eventType === 'quick_pay' &&
        operation.status === 'READY_FOR_PREVIEW' &&
        operationEnvelope.operationType === 'quick_pay' &&
        operationOrigin === QUICK_ADD_ACTIVITY_ORIGIN_DIRECT_ &&
        !isCorrected;
      var canCorrectDonation = eventType === 'donation' &&
        operation.status === 'READY_FOR_PREVIEW' &&
        operationEnvelope.operationType === 'donation' &&
        operationOrigin === 'direct_donation' &&
        !isCorrected;
      var correctionHistory = operationId
        ? activityCorrectionHistory_(correctionRelations, operationId)
        : [];
      var latestCorrection = correctionHistory.length
        ? correctionHistory[0]
        : null;

      out.push({
        sheetRow: i + 2,
        loggedAt: String(r[0] || '').trim(),
        eventType: eventType,
        entryDate: String(r[2] || '').trim(),
        amount: r[3],
        amountNum: amtVal,
        direction: direction,
        payee: payee,
        category: logCategory,
        accountSource: String(r[7] || '').trim(),
        cashFlowSheet: String(r[8] || '').trim(),
        cashFlowMonth: String(r[9] || '').trim(),
        dedupeKey: String(r[10] || '').trim(),
        details: String(r[11] || '').trim(),
        kindLabel: activityLogRowKind_(lookup, r),
        actionLabel: isCorrected
          ? 'Removed'
          : (latestCorrection
            ? 'Corrected from ' + activityLogFmtMoney_(latestCorrection.fromAmount)
            : activityLogActionLabel_(eventType, String(r[11] || '').trim())),
        isNonMonetary: activityLogIsNonMonetaryEvent_(eventType),
        operationId: canCorrectQuickAdd || canCorrectDonation || isCorrected
          ? operationId
          : '',
        correctionAction: canCorrectQuickAdd || canCorrectDonation
          ? 'correct_entry'
          : '',
        correctionState: isCorrected ? 'removed' : '',
        correctionHistory: correctionHistory,
        entryFamily: canCorrectDonation ? 'donation' : 'quick_add'
      });
    }

    var truncated = false;
    if (out.length >= matchLimit && i >= 0) {
      for (var j = i; j >= 0; j--) {
        if (
          activityLogRowMatchesDashboardFilters_(values[j], dateFrom, dateTo, payeeSearch, minNum, maxNum, kindType, lookup) &&
          !activityLogRowHiddenByCorrectionRelations_(
            values[j],
            correctionRelations
          )
        ) {
          truncated = true;
          break;
        }
      }
    }

    return {
      ok: true,
      rows: out,
      kinds: kinds,
      scannedRows: values.length,
      truncated: truncated,
      matchLimit: matchLimit
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), rows: [], kinds: [], truncated: false };
  }
}

/**
 * Read LOG - Activity for the web dashboard (rows only; use getActivityDashboardData for kinds + Type filter).
 * @param {{ dateFrom?: string, dateTo?: string, payeeSearch?: string, kindType?: string, amountMin?: string|number, amountMax?: string|number, limit?: number, matchLimit?: number }} filters
 */
function getActivityLogForDashboard(filters) {
  var f = filters || {};
  var res = getActivityDashboardData({
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    payeeSearch: f.payeeSearch,
    kindType: f.kindType,
    amountMin: f.amountMin,
    amountMax: f.amountMax,
    matchLimit: f.matchLimit != null ? f.matchLimit : f.limit
  });
  if (!res.ok) {
    return { ok: false, error: res.error, rows: [] };
  }
  return {
    ok: true,
    rows: res.rows,
    scannedRows: res.scannedRows,
    message: res.message,
    truncated: res.truncated,
    matchLimit: res.matchLimit
  };
}
