/**
 * Bank Import — Step 1 scaffold only.
 *
 * Creates the two new SYS sheets and the new SYS - Accounts column that
 * Step 2's ingestion pipeline (processBankImportBatch_, normalization,
 * matching, activity logging, dev harness) will need. This file is
 * intentionally inert in Step 1: nothing in the existing app calls
 * anything here, so merging it has zero effect on planner, overview,
 * retirement, cash flow, or the existing manual bank account UI.
 *
 * Scope discipline (Step 1):
 *   - No ingestion, normalization, matching, logging, or dedupe logic.
 *   - No dev/test harness.
 *   - No UI changes.
 *   - Does not modify any existing module (bank_accounts.js,
 *     dashboard_data.js, planner_core.js, cash_to_use.js, code.js,
 *     onboarding.js, sheet_bootstrap.js, activity_log.js,
 *     next_actions.js, Dashboard_*.html).
 *
 * Design contract (matches ensureSysAccountsSheet_ and
 * ensureAccountsActiveColumn_ in bank_accounts.js):
 *   - Never overwrites, clears, or reorders existing sheets/columns.
 *   - First-run safe on blank workbooks and a no-op on populated ones.
 *   - Race-safe around insertSheet(): if another caller inserts the
 *     sheet concurrently we treat the now-existing sheet as a no-op.
 *   - Cosmetic formatting (bold header, frozen row 1) is wrapped so it
 *     can never break a sheet create that otherwise succeeded.
 */

function ensureImportStagingBankAccountsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetNames_().IMPORT_STAGING_BANK;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    // Race: another caller may have inserted the sheet between our
    // getSheetByName() check and insertSheet(). Treat that as a no-op.
    const retry = ss.getSheetByName(sheetName);
    if (retry) return retry;
    throw e;
  }

  const headers = [
    'Staging Id',
    'First Seen',
    'Last Seen',
    'External Account Id',
    'External Institution',
    'Display Name',
    'Last 4',
    'Type',
    'Currency',
    'Latest Balance',
    'Latest Balance As Of',
    'Status',
    'Pending Reason'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  try {
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } catch (_fmt) {
    // Cosmetic only; the sheet + headers are already in place.
  }

  return sheet;
}

function ensureImportIgnoredBankAccountsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetNames_().IMPORT_IGNORED_BANK;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    const retry = ss.getSheetByName(sheetName);
    if (retry) return retry;
    throw e;
  }

  const headers = [
    'External Account Id',
    'Institution',
    'Display Name',
    'Last 4',
    'Ignored At',
    'Ignored By',
    'Scope'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  try {
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } catch (_fmt) {
    // Cosmetic only.
  }

  return sheet;
}

/**
 * Appends an "External Account Id" column to SYS - Accounts if missing.
 * Never reorders existing columns and never writes to data rows — only
 * the header cell of the newly-appended column is populated. No-op when
 * the header is already present anywhere in row 1.
 *
 * Mirrors the ensureAccountsActiveColumn_ pattern in bank_accounts.js:
 * when the sheet has a stray empty trailing column, we still append
 * flush to the right of the last non-empty header cell so the new
 * header does not drift.
 */
function ensureAccountsExternalIdColumn_(accountsSheet) {
  const targetHeader = 'External Account Id';
  const lastCol = Math.max(accountsSheet.getLastColumn(), 1);
  const headerRow = accountsSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];

  for (let c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c] || '').trim() === targetHeader) return;
  }

  let targetCol = lastCol + 1;
  for (let c = headerRow.length; c >= 1; c--) {
    if (String(headerRow[c - 1] || '').trim() === '') {
      targetCol = c;
    } else {
      break;
    }
  }

  accountsSheet.getRange(1, targetCol).setValue(targetHeader);
}

/* ===========================================================================
 * Step 2a — ingestion pipeline (server-only, no UI)
 * ---------------------------------------------------------------------------
 * Implements the first end-to-end ingestion path on top of the Step 1
 * scaffold. Strict behavior per the approved Step 2a checklist:
 *
 *   1. Ignored check (permanent only) — exact non-blank External Account
 *      Id, otherwise composite (institution + displayName + last4).
 *   2. Exact-id auto-match — single active SYS - Accounts row, currency
 *      USD, no type conflict; writes balance through the proven bank
 *      account history/update path (updateBankAccountsHistory_ +
 *      syncAllAccountsFromLatestCurrentYear_ + touchDashboardSourceUpdated_)
 *      and never touches Available Now / Min Buffer / Use Policy /
 *      Priority / Active.
 *   3. Pending staging — everything else lands in
 *      SYS - Import Staging — Bank Accounts with Status=pending and a
 *      pending_reason from the approved allow-list.
 *   4. Balance fingerprint dedupe — second auto-match attempt for the
 *      same fingerprint is a no-op (no writes, no log row).
 *   5. Activity log events — bank_import_auto_matched,
 *      bank_import_pending, bank_import_ignored_hit, bank_import_row_error.
 *
 * Out of scope for Step 2a (do not introduce here):
 *   - UI surfaces, suggestion scoring, until_changed ignore behavior,
 *     external sync, planner/snapshot integration, schema beyond the
 *     Step 1 scaffold, External Institution column on SYS - Accounts.
 *
 * Per-row planner runs are intentionally avoided. Auto-match uses the
 * same helpers updateBankAccountValueByDate uses, minus runDebtPlanner —
 * running the planner inside an N-row batch loop would be both slow and
 * misleading (the user invokes the planner via the existing top-bar
 * button when ready).
 * ========================================================================= */

var BANK_IMPORT_STATUS_PENDING = 'pending';

var BANK_IMPORT_PENDING_REASONS = {
  NO_EXACT_ID_MATCH: 'no_exact_id_match',
  CURRENCY_MISMATCH: 'currency_mismatch',
  TYPE_CONFLICT: 'type_conflict',
  INACTIVE_MATCH: 'inactive_match',
  AMBIGUOUS_EXTERNAL_ID: 'ambiguous_external_id',
  STALE_BALANCE: 'stale_balance'
};

var BANK_IMPORT_EVENT_AUTO_MATCHED = 'bank_import_auto_matched';
var BANK_IMPORT_EVENT_PENDING = 'bank_import_pending';
var BANK_IMPORT_EVENT_IGNORED_HIT = 'bank_import_ignored_hit';
var BANK_IMPORT_EVENT_ROW_ERROR = 'bank_import_row_error';

// Stale-balance window for auto-match. Future-dated balanceAsOf is
// always rejected (clock skew / bad data); past balances older than
// this many days are routed to pending so a stale snapshot never
// overwrites a fresher SYS - Accounts.Current Balance.
var BANK_IMPORT_STALE_BALANCE_DAYS = 90;

/**
 * Public entry point. Processes a batch of bank-account import rows
 * end-to-end (ignore → auto-match → pending) with activity logging.
 *
 * Payload:
 *   {
 *     rows: [
 *       {
 *         externalAccountId: string,    // canonical id from aggregator
 *         institution: string,
 *         displayName: string,
 *         last4: string,
 *         type: string,                 // e.g. CHECKING, SAVINGS
 *         currency: string,             // 'USD' for auto-match
 *         balance: number,
 *         balanceAsOf: 'YYYY-MM-DD'
 *       },
 *       ...
 *     ],
 *     source?: string                   // optional provenance string
 *   }
 *
 * Returns an immutable summary suitable for the dev harness:
 *   {
 *     ok: true,
 *     processed: N,
 *     autoMatched: N,
 *     pending: N,
 *     ignored: N,
 *     dedupeNoop: N,
 *     errors: N,
 *     outcomes: [
 *       { rowIndex, outcome, reason?, accountName?, stagingId?, error? },
 *       ...
 *     ]
 *   }
 *
 * Failures inside a single row are isolated: a row error is logged via
 * bank_import_row_error and the batch continues. The batch as a whole
 * fails only on framework-level errors (sheet creation, lock, etc.).
 */
function processBankImportBatch_(payload) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return {
      ok: false,
      error: 'Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr),
      processed: 0,
      autoMatched: 0,
      pending: 0,
      ignored: 0,
      dedupeNoop: 0,
      errors: 0,
      outcomes: []
    };
  }

  var summary = {
    ok: true,
    processed: 0,
    autoMatched: 0,
    pending: 0,
    ignored: 0,
    dedupeNoop: 0,
    errors: 0,
    outcomes: []
  };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Idempotent ensure of all Step-1 scaffold pieces. Cheap on populated
    // workbooks; required so the first dev-harness run on a fresh
    // workbook does not throw on missing sheets/columns.
    ensureImportStagingBankAccountsSheet_();
    ensureImportIgnoredBankAccountsSheet_();
    var accountsSheet = ensureSysAccountsSheet_();
    ensureAccountsExternalIdColumn_(accountsSheet);

    var rows = (payload && Array.isArray(payload.rows)) ? payload.rows : [];
    var source = String(payload && payload.source || '').trim();

    summary.processed = rows.length;

    var ignoredEntries = bankImportLoadIgnoredEntries_(ss);

    for (var i = 0; i < rows.length; i++) {
      var rowResult = bankImportProcessSingleRow_(
        ss,
        rows[i],
        i,
        ignoredEntries,
        source
      );
      summary.outcomes.push(rowResult);
      if (rowResult.outcome === 'auto_matched') summary.autoMatched++;
      else if (rowResult.outcome === 'pending') summary.pending++;
      else if (rowResult.outcome === 'ignored_hit') summary.ignored++;
      else if (rowResult.outcome === 'dedupe_noop') summary.dedupeNoop++;
      else if (rowResult.outcome === 'error') summary.errors++;
    }

    return summary;
  } catch (e) {
    summary.ok = false;
    summary.error = String(e && e.message || e);
    return summary;
  } finally {
    try { lock.releaseLock(); } catch (_releaseErr) { /* best effort */ }
  }
}

/**
 * Processes a single row through the Step 2a pipeline. Errors from this
 * function are caught and converted to a `{ outcome: 'error' }` result
 * + a bank_import_row_error log row, so a malformed row never aborts
 * the surrounding batch.
 */
function bankImportProcessSingleRow_(ss, rawRow, rowIndex, ignoredEntries, source) {
  var normalized;
  try {
    normalized = bankImportNormalizeRow_(rawRow);
  } catch (normErr) {
    var errMsg = String(normErr && normErr.message || normErr);
    bankImportLogActivity_(ss, BANK_IMPORT_EVENT_ROW_ERROR, null, '', {
      rowIndex: rowIndex,
      error: errMsg,
      source: source
    });
    return { rowIndex: rowIndex, outcome: 'error', error: errMsg };
  }

  // 1) Ignored check (permanent only).
  var ignoredHit = bankImportMatchIgnored_(ignoredEntries, normalized);
  if (ignoredHit) {
    bankImportLogActivity_(ss, BANK_IMPORT_EVENT_IGNORED_HIT, normalized, '', {
      matchType: ignoredHit.matchType,
      scope: ignoredHit.scope || 'permanent',
      source: source
    });
    return {
      rowIndex: rowIndex,
      outcome: 'ignored_hit',
      reason: ignoredHit.matchType
    };
  }

  // 2) Pre-flight checks that route to pending without consulting
  // SYS - Accounts at all (cheap, deterministic).
  if (!normalized.externalAccountId) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.NO_EXACT_ID_MATCH, rowIndex, source
    );
  }

  if (normalized.currency !== 'USD') {
    // Step 2a auto-match requires an explicit 'USD'. Blank or any other
    // currency routes to pending so a non-USD snapshot can never sneak
    // into a user's USD account history via auto-match.
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.CURRENCY_MISMATCH, rowIndex, source
    );
  }

  if (bankImportIsStaleBalance_(normalized.balanceAsOfDate)) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.STALE_BALANCE, rowIndex, source
    );
  }

  // 3) Lookup against SYS - Accounts.External Account Id.
  var lookup = bankImportLookupAccountByExternalId_(ss, normalized.externalAccountId);
  if (lookup.matches.length === 0) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.NO_EXACT_ID_MATCH, rowIndex, source
    );
  }
  if (lookup.matches.length > 1) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.AMBIGUOUS_EXTERNAL_ID, rowIndex, source
    );
  }

  var match = lookup.matches[0];
  if (!match.active) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.INACTIVE_MATCH, rowIndex, source
    );
  }

  if (bankImportTypeConflicts_(match.type, normalized.type)) {
    return bankImportRouteToPending_(
      ss, normalized, BANK_IMPORT_PENDING_REASONS.TYPE_CONFLICT, rowIndex, source
    );
  }

  // 4) Balance fingerprint dedupe — same fingerprint already
  // auto-matched means we do nothing (no balance write, no log row).
  var fingerprint = bankImportFingerprint_(
    normalized.externalAccountId,
    normalized.balance,
    normalized.balanceAsOf
  );
  if (activityLogDedupeKeyExists_(ss, fingerprint)) {
    return {
      rowIndex: rowIndex,
      outcome: 'dedupe_noop',
      accountName: match.name
    };
  }

  // 5) Auto-match: write balance through the proven path and log it.
  try {
    bankImportApplyAutoMatchWrite_(match.name, normalized.balanceAsOfDate, normalized.balance);
  } catch (writeErr) {
    var writeMsg = String(writeErr && writeErr.message || writeErr);
    bankImportLogActivity_(ss, BANK_IMPORT_EVENT_ROW_ERROR, normalized, '', {
      rowIndex: rowIndex,
      stage: 'auto_match_write',
      accountName: match.name,
      error: writeMsg,
      source: source
    });
    return { rowIndex: rowIndex, outcome: 'error', error: writeMsg };
  }

  bankImportLogActivity_(ss, BANK_IMPORT_EVENT_AUTO_MATCHED, normalized, fingerprint, {
    accountName: match.name,
    matchedRow: match.rowNum,
    source: source
  });

  return {
    rowIndex: rowIndex,
    outcome: 'auto_matched',
    accountName: match.name,
    dedupeKey: fingerprint
  };
}

/**
 * Normalizes a raw incoming row. Trims strings, coerces balance to a
 * finite number, parses balanceAsOf to a Date, and uppercases currency.
 * Throws on missing required fields so the caller can convert to a
 * row-error outcome with an actionable message.
 */
function bankImportNormalizeRow_(rawRow) {
  if (!rawRow || typeof rawRow !== 'object') {
    throw new Error('Row is not an object.');
  }

  var externalAccountId = String(rawRow.externalAccountId || '').trim();
  var institution = String(rawRow.institution || '').trim();
  var displayName = String(rawRow.displayName || '').trim();
  var last4 = String(rawRow.last4 || '').trim();
  var type = String(rawRow.type || '').trim();
  var currency = String(rawRow.currency || '').trim().toUpperCase();
  var balanceAsOfRaw = String(rawRow.balanceAsOf || '').trim();

  if (!balanceAsOfRaw) {
    throw new Error('balanceAsOf is required (YYYY-MM-DD).');
  }
  var balanceAsOfDate = parseIsoDateLocal_(balanceAsOfRaw);
  if (isNaN(balanceAsOfDate.getTime())) {
    throw new Error('Invalid balanceAsOf: ' + balanceAsOfRaw);
  }

  if (rawRow.balance === '' || rawRow.balance === null || rawRow.balance === undefined) {
    throw new Error('balance is required.');
  }
  var balance = round2_(toNumber_(rawRow.balance));
  if (!isFinite(balance)) {
    throw new Error('balance is not a finite number: ' + rawRow.balance);
  }

  if (!institution && !displayName && !last4 && !externalAccountId) {
    throw new Error('Row is empty (no externalAccountId / institution / displayName / last4).');
  }

  return {
    externalAccountId: externalAccountId,
    institution: institution,
    displayName: displayName,
    last4: last4,
    type: type,
    currency: currency,
    balance: balance,
    balanceAsOf: balanceAsOfRaw,
    balanceAsOfDate: balanceAsOfDate
  };
}

function bankImportLowerTrim_(s) {
  return String(s || '').trim().toLowerCase();
}

function bankImportCompositeIgnoredKey_(institution, displayName, last4) {
  return (
    bankImportLowerTrim_(institution) + '::' +
    bankImportLowerTrim_(displayName) + '::' +
    bankImportLowerTrim_(last4)
  );
}

/**
 * Reads SYS - Import Ignored — Bank Accounts into a small in-memory
 * structure for fast per-row lookups. Blank or unknown Scope is
 * coerced to 'permanent' for Step 2a (until_changed handling is
 * deferred to a later step).
 */
function bankImportLoadIgnoredEntries_(ss) {
  var sheet = ss.getSheetByName(getSheetNames_().IMPORT_IGNORED_BANK);
  var byExternalId = Object.create(null);
  var byComposite = Object.create(null);
  if (!sheet) return { byExternalId: byExternalId, byComposite: byComposite };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { byExternalId: byExternalId, byComposite: byComposite };

  var values = sheet.getRange(1, 1, lastRow, 7).getDisplayValues();
  var headers = values[0] || [];
  var idxExtId = headers.indexOf('External Account Id');
  var idxInst = headers.indexOf('Institution');
  var idxDisplay = headers.indexOf('Display Name');
  var idxLast4 = headers.indexOf('Last 4');
  var idxScope = headers.indexOf('Scope');

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var scope = idxScope === -1 ? '' : String(row[idxScope] || '').trim().toLowerCase();
    if (!scope || (scope !== 'permanent' && scope !== 'until_changed')) {
      scope = 'permanent';
    }
    // Step 2a honors permanent only. until_changed rows are deliberately
    // not consulted yet, even though the column exists for future use.
    if (scope !== 'permanent') continue;

    var extId = idxExtId === -1 ? '' : String(row[idxExtId] || '').trim();
    if (extId) {
      byExternalId[extId] = { scope: scope };
    }

    var inst = idxInst === -1 ? '' : row[idxInst];
    var disp = idxDisplay === -1 ? '' : row[idxDisplay];
    var last4 = idxLast4 === -1 ? '' : row[idxLast4];
    var composite = bankImportCompositeIgnoredKey_(inst, disp, last4);
    // Composite must have at least one non-blank component to be useful.
    if (composite !== '::::') {
      byComposite[composite] = { scope: scope };
    }
  }

  return { byExternalId: byExternalId, byComposite: byComposite };
}

function bankImportMatchIgnored_(ignoredEntries, normalized) {
  if (normalized.externalAccountId && ignoredEntries.byExternalId[normalized.externalAccountId]) {
    return {
      matchType: 'external_id',
      scope: ignoredEntries.byExternalId[normalized.externalAccountId].scope
    };
  }
  var composite = bankImportCompositeIgnoredKey_(
    normalized.institution,
    normalized.displayName,
    normalized.last4
  );
  if (ignoredEntries.byComposite[composite]) {
    return {
      matchType: 'composite',
      scope: ignoredEntries.byComposite[composite].scope
    };
  }
  return null;
}

/**
 * Looks up SYS - Accounts rows whose External Account Id exactly
 * matches the incoming id. Returns ALL matches (active and inactive)
 * so the caller can distinguish ambiguous / inactive / single-match
 * cases. Blank cells never match.
 */
function bankImportLookupAccountByExternalId_(ss, externalAccountId) {
  var sheet = ss.getSheetByName(getSheetNames_().ACCOUNTS);
  if (!sheet) return { matches: [] };

  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { matches: [] };

  var headers = display[0] || [];
  var idxName = headers.indexOf('Account Name');
  var idxType = headers.indexOf('Type');
  var idxActive = headers.indexOf('Active');
  var idxExt = headers.indexOf('External Account Id');

  if (idxName === -1 || idxExt === -1) return { matches: [] };

  var matches = [];
  for (var r = 1; r < display.length; r++) {
    var rowExt = String(display[r][idxExt] || '').trim();
    if (!rowExt) continue;
    if (rowExt !== externalAccountId) continue;

    var name = String(display[r][idxName] || '').trim();
    if (!name) continue;

    var rowType = idxType === -1 ? '' : String(display[r][idxType] || '').trim();
    var rawActive = idxActive === -1 ? '' : String(display[r][idxActive] || '').trim().toLowerCase();
    // Match the convention used elsewhere (getInactiveBankAccountsSet_):
    // blank/missing/unknown is treated as active.
    var inactive = (rawActive === 'no' || rawActive === 'n' || rawActive === 'false' || rawActive === 'inactive');

    matches.push({
      rowNum: r + 1,
      name: name,
      type: rowType,
      active: !inactive
    });
  }
  // For ambiguity detection we only count active rows with non-blank
  // External Account Id. An inactive duplicate should route to
  // inactive_match, not ambiguous_external_id.
  var activeMatches = matches.filter(function(m) { return m.active; });
  if (activeMatches.length >= 1) {
    return { matches: activeMatches };
  }
  // No active matches but at least one inactive match exists. Surface
  // the first inactive row so the caller can route to INACTIVE_MATCH.
  return { matches: matches };
}

function bankImportTypeConflicts_(existingType, incomingType) {
  var a = String(existingType || '').trim();
  var b = String(incomingType || '').trim();
  if (!a || !b) return false;
  return a.toLowerCase() !== b.toLowerCase();
}

/**
 * Returns true when the balance snapshot is too old or impossibly in
 * the future. In-future is always rejected (data error / clock skew).
 * Past balances older than BANK_IMPORT_STALE_BALANCE_DAYS route to
 * pending so a stale snapshot never overwrites a fresher cell on
 * SYS - Accounts.Current Balance via auto-match.
 */
function bankImportIsStaleBalance_(balanceAsOfDate) {
  if (!(balanceAsOfDate instanceof Date) || isNaN(balanceAsOfDate.getTime())) return true;
  var today = stripTime_(new Date());
  var asOf = stripTime_(balanceAsOfDate);
  if (asOf.getTime() > today.getTime()) return true;
  var ageMs = today.getTime() - asOf.getTime();
  var ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  return ageDays > BANK_IMPORT_STALE_BALANCE_DAYS;
}

function bankImportFingerprint_(externalAccountId, balance, balanceAsOf) {
  var ym = String(balanceAsOf || '').slice(0, 7); // YYYY-MM
  var balStr = round2_(toNumber_(balance)).toFixed(2);
  return (
    'bank_import::' +
    String(externalAccountId || '').trim() + '::' +
    ym + '::' +
    balStr + '::' +
    String(balanceAsOf || '').trim()
  );
}

/**
 * Stable, deterministic Staging Id keyed off externalAccountId +
 * balanceAsOf when available, with a composite fallback for rows that
 * arrived without an externalAccountId (rare in practice but possible).
 * The point of stability is that a second batch carrying the same
 * snapshot upserts onto the same staging row instead of duplicating.
 */
function bankImportStagingId_(normalized) {
  if (normalized.externalAccountId) {
    return normalized.externalAccountId + '::' + normalized.balanceAsOf;
  }
  return (
    'composite::' +
    bankImportLowerTrim_(normalized.institution) + '::' +
    bankImportLowerTrim_(normalized.displayName) + '::' +
    bankImportLowerTrim_(normalized.last4) + '::' +
    normalized.balanceAsOf
  );
}

/**
 * Routes a normalized row to pending: upserts a staging row keyed by
 * Staging Id and writes a bank_import_pending activity entry with the
 * pending reason.
 */
function bankImportRouteToPending_(ss, normalized, reason, rowIndex, source) {
  var stagingId = bankImportStagingId_(normalized);
  var upsert = bankImportUpsertPendingStagingRow_(ss, normalized, reason, stagingId);
  bankImportLogActivity_(ss, BANK_IMPORT_EVENT_PENDING, normalized, '', {
    rowIndex: rowIndex,
    pendingReason: reason,
    stagingId: stagingId,
    upsert: upsert.upsertKind,
    source: source
  });
  return {
    rowIndex: rowIndex,
    outcome: 'pending',
    reason: reason,
    stagingId: stagingId
  };
}

/**
 * Inserts (or updates Last Seen + payload fields on) a pending row in
 * SYS - Import Staging — Bank Accounts. Upsert key is Staging Id.
 *
 * @returns {{ upsertKind: 'inserted'|'updated', rowNum: number }}
 */
function bankImportUpsertPendingStagingRow_(ss, normalized, reason, stagingId) {
  var sheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
  if (!sheet) {
    sheet = ensureImportStagingBankAccountsSheet_();
  }

  var tz = Session.getScriptTimeZone();
  var nowStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var idColValues = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var r = 0; r < idColValues.length; r++) {
      if (String(idColValues[r][0] || '').trim() === stagingId) {
        var rowNum = r + 2;
        // Upsert: refresh Last Seen, latest payload fields, and reason.
        // Status is forced back to 'pending' (a reviewed/ignored status
        // would have been reflected on the ignored sheet, not here).
        sheet.getRange(rowNum, 3).setValue(nowStr); // Last Seen
        sheet.getRange(rowNum, 4).setValue(normalized.externalAccountId);
        sheet.getRange(rowNum, 5).setValue(normalized.institution);
        sheet.getRange(rowNum, 6).setValue(normalized.displayName);
        sheet.getRange(rowNum, 7).setValue(normalized.last4);
        sheet.getRange(rowNum, 8).setValue(normalized.type);
        sheet.getRange(rowNum, 9).setValue(normalized.currency);
        sheet.getRange(rowNum, 10).setValue(normalized.balance);
        sheet.getRange(rowNum, 11).setValue(normalized.balanceAsOf);
        sheet.getRange(rowNum, 12).setValue(BANK_IMPORT_STATUS_PENDING);
        sheet.getRange(rowNum, 13).setValue(reason);
        return { upsertKind: 'updated', rowNum: rowNum };
      }
    }
  }

  var newRow = [
    stagingId,
    nowStr,                       // First Seen
    nowStr,                       // Last Seen
    normalized.externalAccountId,
    normalized.institution,
    normalized.displayName,
    normalized.last4,
    normalized.type,
    normalized.currency,
    normalized.balance,
    normalized.balanceAsOf,
    BANK_IMPORT_STATUS_PENDING,
    reason
  ];
  sheet.appendRow(newRow);
  return { upsertKind: 'inserted', rowNum: sheet.getLastRow() };
}

/**
 * Auto-match writer. Uses the same proven helpers
 * updateBankAccountValueByDate uses for a manual update — month-cell
 * write on INPUT - Bank Accounts, sync to SYS - Accounts.Current
 * Balance, dashboard source touch — but deliberately does NOT trigger
 * runDebtPlanner because per-row planner runs in a batch loop are both
 * slow and misleading. The user invokes the planner via the existing
 * top-bar button when the batch is complete.
 *
 * Never touches Available Now / Min Buffer / Use Policy / Priority /
 * Active. The match was made on External Account Id alone; user-set
 * planner inputs stay user-owned.
 */
function bankImportApplyAutoMatchWrite_(accountName, balanceAsOfDate, balance) {
  var year = balanceAsOfDate.getFullYear();
  updateBankAccountsHistory_(accountName, year, balanceAsOfDate, balance);
  syncAllAccountsFromLatestCurrentYear_();
  try {
    touchDashboardSourceUpdated_('bank_accounts');
  } catch (_touchErr) {
    // Best-effort cache touch; the underlying writes already succeeded.
  }
}

/**
 * Thin wrapper around appendActivityLog_ that fills in the bank-import
 * shape consistently. Treats every event as non-monetary in spirit
 * (the dollar amount is an attribute of the snapshot, not a movement),
 * but stays compatible with the existing ledger by writing balance as
 * the Amount column. dedupeKey is empty for non-auto-matched events
 * to keep the ledger free of accidental skips.
 */
function bankImportLogActivity_(ss, eventType, normalized, dedupeKey, extraDetails) {
  try {
    var details = {
      detailsVersion: 1,
      bankImportStep: '2a'
    };
    if (normalized) {
      details.externalAccountId = normalized.externalAccountId || '';
      details.institution = normalized.institution || '';
      details.displayName = normalized.displayName || '';
      details.last4 = normalized.last4 || '';
      details.type = normalized.type || '';
      details.currency = normalized.currency || '';
      details.balance = normalized.balance;
      details.balanceAsOf = normalized.balanceAsOf || '';
    }
    if (extraDetails && typeof extraDetails === 'object') {
      Object.keys(extraDetails).forEach(function(k) {
        details[k] = extraDetails[k];
      });
    }

    var payee = '';
    var category = '';
    var accountSource = '';
    var entryDate = '';
    var amount = 0;
    if (normalized) {
      payee = normalized.displayName || normalized.institution || '';
      category = normalized.type || '';
      accountSource = normalized.institution || '';
      entryDate = normalized.balanceAsOf || '';
      amount = Math.abs(toNumber_(normalized.balance));
    }
    if (extraDetails && extraDetails.accountName) {
      // For auto-matched rows, prefer the SYS - Accounts row name as the
      // Activity payee so existing payee filters surface the row in the
      // same group as manual updates for that account.
      payee = String(extraDetails.accountName).trim() || payee;
    }

    appendActivityLog_(ss, {
      eventType: eventType,
      entryDate: entryDate,
      amount: amount,
      direction: 'expense', // matches existing bank_account_* convention
      payee: payee,
      category: category,
      accountSource: accountSource,
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: String(dedupeKey || '').trim(),
      details: JSON.stringify(details)
    });
  } catch (logErr) {
    Logger.log('bankImportLogActivity_ failed: ' + logErr);
  }
}

/* ---------------------------------------------------------------------------
 * Dev / test harness
 * ---------------------------------------------------------------------------
 * These functions are intentionally underscore-prefixed and named with
 * "_dev" so they do not appear in the dashboard UI or planner menus.
 * Invoke them from the Apps Script editor only.
 *
 * Both functions are SAFE to run on populated workbooks: the sample
 * payload below is keyed off externalAccountIds that should not exist
 * on a real user's SYS - Accounts (no auto-match), so the worst case
 * is that two pending staging rows get added (and dedupe-upsert on the
 * second run).
 * ------------------------------------------------------------------------- */

function _devRunBankImportSample() {
  return _devRunBankImportCustom_({
    source: 'dev_harness_sample',
    rows: [
      {
        externalAccountId: 'DEV-EXT-CHK-1001',
        institution: 'Demo Bank',
        displayName: 'Demo Checking',
        last4: '0001',
        type: 'CHECKING',
        currency: 'USD',
        balance: 1234.56,
        balanceAsOf: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
      },
      {
        externalAccountId: 'DEV-EXT-SAV-2002',
        institution: 'Demo Bank',
        displayName: 'Demo Savings',
        last4: '0002',
        type: 'SAVINGS',
        currency: 'USD',
        balance: 9876.54,
        balanceAsOf: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
      }
    ]
  });
}

function _devRunBankImportCustom_(payload) {
  var result = processBankImportBatch_(payload);
  Logger.log('processBankImportBatch_ result: ' + JSON.stringify(result, null, 2));
  return result;
}
