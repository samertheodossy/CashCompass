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
 * scaffold. As of Step 2d the pipeline is strict-approval: it never
 * writes balances — every actionable row lands on the staging sheet
 * and the user explicitly clicks Apply balance in the Review imports
 * panel before INPUT - Bank Accounts is touched.
 *
 *   1. Ignored check (permanent only) — exact non-blank External Account
 *      Id, otherwise composite (institution + displayName + last4).
 *   2. Pre-flight — currency, stale-balance, and external-id presence
 *      route to pending without consulting SYS - Accounts.
 *   3. SYS - Accounts lookup — ambiguous / inactive / type-conflict
 *      rows route to pending. A single active match with a fresh
 *      snapshot routes to pending with auto_match_awaiting_apply (the
 *      account is already linked but the user still has to approve the
 *      balance write — Step 2d).
 *   4. Pending staging — everything lands in
 *      SYS - Import Staging — Bank Accounts with Status=pending and a
 *      pending_reason from the approved allow-list.
 *   5. Apply-balance fingerprint dedupe — re-imports of an exact
 *      snapshot that was already Applied are silently skipped (no
 *      staging upsert, no log row) so a periodic poller can re-fetch
 *      without spamming.
 *   6. Activity log events — bank_import_pending,
 *      bank_import_ignored_hit, bank_import_row_error,
 *      bank_import_apply_balance (emitted by the Apply path, not by
 *      ingestion).
 *
 * Out of scope for Step 2a (do not introduce here):
 *   - UI surfaces, suggestion scoring, until_changed ignore behavior,
 *     external sync, planner/snapshot integration, schema beyond the
 *     Step 1 scaffold, External Institution column on SYS - Accounts.
 *
 * Per-row planner runs are intentionally avoided here AND in the
 * Step 2d Apply path. Apply uses the same helpers
 * updateBankAccountValueByDate uses (updateBankAccountsHistory_ +
 * syncAllAccountsFromLatestCurrentYear_ + touchDashboardSourceUpdated_)
 * minus runDebtPlanner — the user invokes the planner via the existing
 * top-bar button when a batch is finished.
 * ========================================================================= */

var BANK_IMPORT_STATUS_PENDING = 'pending';

var BANK_IMPORT_PENDING_REASONS = {
  NO_EXACT_ID_MATCH: 'no_exact_id_match',
  CURRENCY_MISMATCH: 'currency_mismatch',
  TYPE_CONFLICT: 'type_conflict',
  INACTIVE_MATCH: 'inactive_match',
  AMBIGUOUS_EXTERNAL_ID: 'ambiguous_external_id',
  STALE_BALANCE: 'stale_balance',
  // Step 2d strict-approval mode. When ingestion finds a single active
  // SYS - Accounts row with matching External Account Id, currency USD,
  // no type conflict, and a fresh balance, we no longer write silently
  // — we route to staging with this reason so the user must explicitly
  // click Apply balance from the Review imports panel. The link itself
  // already exists (the stamped External Account Id), so the review UI
  // skips the Add/Match picker for these rows and shows Apply directly.
  AUTO_MATCH_AWAITING_APPLY: 'auto_match_awaiting_apply'
};

// Pending reasons that block Apply outright. Stale snapshots, currency
// mismatches, and type conflicts must be corrected at the source (or
// the row Ignored) before any balance write touches INPUT - Bank
// Accounts. Listed centrally so the UI banner copy and the server
// refusal stay in sync.
var BANK_IMPORT_APPLY_BLOCKING_REASONS_ = {};
BANK_IMPORT_APPLY_BLOCKING_REASONS_[BANK_IMPORT_PENDING_REASONS.STALE_BALANCE] = true;
BANK_IMPORT_APPLY_BLOCKING_REASONS_[BANK_IMPORT_PENDING_REASONS.CURRENCY_MISMATCH] = true;
BANK_IMPORT_APPLY_BLOCKING_REASONS_[BANK_IMPORT_PENDING_REASONS.TYPE_CONFLICT] = true;

var BANK_IMPORT_EVENT_AUTO_MATCHED = 'bank_import_auto_matched';
var BANK_IMPORT_EVENT_PENDING = 'bank_import_pending';
var BANK_IMPORT_EVENT_IGNORED_HIT = 'bank_import_ignored_hit';
var BANK_IMPORT_EVENT_ROW_ERROR = 'bank_import_row_error';
var BANK_IMPORT_EVENT_APPLY_BALANCE = 'bank_import_apply_balance';

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

  // 4) Balance fingerprint dedupe — same snapshot has already been
  // applied (bank_import_apply_balance carries the same fingerprint as
  // the dedupeKey since Step 2d). When found, we do nothing: no
  // staging upsert, no balance write, no log row. Subsequent re-imports
  // of the identical snapshot stay silent so a periodic poller can hit
  // this code path repeatedly without spamming the staging sheet or
  // the activity ledger.
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

  // 5) Step 2d strict approval. Ingestion never writes balances. Even
  // when External Id matches a single active SYS - Accounts row with
  // matching currency, no type conflict, and a fresh snapshot, we
  // route to pending with reason auto_match_awaiting_apply so the user
  // must explicitly click Apply balance in the Review imports panel.
  // The link itself is already in place (External Account Id is on
  // SYS - Accounts), so the review UI will skip the Add/Match picker
  // for this row and offer Apply directly.
  return bankImportRouteToPending_(
    ss,
    normalized,
    BANK_IMPORT_PENDING_REASONS.AUTO_MATCH_AWAITING_APPLY,
    rowIndex,
    source
  );
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

/* ===========================================================================
 * Step 2b — Review UI server entry points
 * ---------------------------------------------------------------------------
 * Server-side functions backing the Bank panel's "Review imports" segment.
 * Three resolution paths, all idempotent within a single Apps Script run
 * via LockService.getDocumentLock(). Pending staged rows have Status =
 * 'pending'; resolution flips Status to one of the values below, which
 * the review reader filters out. Once a staged External Account Id is
 * either linked to a SYS - Accounts row or appended to the Ignored
 * sheet, the next ingestion's auto-match / ignored-check happens before
 * the staging upsert path, so resolved rows stay resolved without a
 * dedicated "is_resolved" column.
 *
 * Out of scope (do not introduce here): until_changed ignore handling,
 * external sync, planner/snapshot integration, automated polling,
 * SYS - Accounts schema additions beyond the existing External Account
 * Id column.
 * ========================================================================= */

// Step 2d lifecycle. Add-as-new and Match are link-only operations:
// they leave the staged row visible in the Review panel under one of
// the linked_* statuses so the user must explicitly click Apply
// balance before any month cell is touched. Apply flips the row to
// resolved_applied. Ignore still flips to resolved_ignored. The legacy
// resolved_added / resolved_matched values are retained as terminal
// statuses so any pre-Step-2d staged rows on a populated workbook are
// treated as already resolved (they're either harmless drafts or
// already had the snapshot applied as an opening balance).
var BANK_IMPORT_STATUS_LINKED_ADDED = 'linked_added';
var BANK_IMPORT_STATUS_LINKED_MATCHED = 'linked_matched';
var BANK_IMPORT_STATUS_RESOLVED_APPLIED = 'resolved_applied';
var BANK_IMPORT_STATUS_RESOLVED_ADDED = 'resolved_added';
var BANK_IMPORT_STATUS_RESOLVED_MATCHED = 'resolved_matched';
var BANK_IMPORT_STATUS_RESOLVED_IGNORED = 'resolved_ignored';

// Statuses the Review imports panel should display. These are the
// rows the user still has work to do on (pending = needs Link or
// awaits Apply for auto-pending; linked_* = already linked, awaits
// Apply). Anything else is terminal and stays out of the list.
var BANK_IMPORT_REVIEW_VISIBLE_STATUSES_ = [
  BANK_IMPORT_STATUS_PENDING,
  BANK_IMPORT_STATUS_LINKED_ADDED,
  BANK_IMPORT_STATUS_LINKED_MATCHED
];

var BANK_IMPORT_EVENT_REVIEW_ADD_NEW = 'bank_import_review_add_new';
var BANK_IMPORT_EVENT_REVIEW_MATCH = 'bank_import_review_match';
var BANK_IMPORT_EVENT_REVIEW_UNLINK_MATCH = 'bank_import_review_unlink_match';
var BANK_IMPORT_EVENT_REVIEW_IGNORE = 'bank_import_review_ignore';

var BANK_IMPORT_REVIEW_FRIENDLY_ALREADY_RESOLVED_ =
  'Staged row is no longer pending. It may have been resolved in another tab.';
var BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_ =
  'Staged row not found. It may have been removed from the staging sheet.';
var BANK_IMPORT_REVIEW_FRIENDLY_DIFFERENT_EXT_ID_ =
  'That account is already linked to a different external id. Match aborted.';
var BANK_IMPORT_UNMATCH_FRIENDLY_NOT_LINKED_MATCHED_ =
  'Only Match-linked rows can be unlinked. Add-as-new rows must be Applied or Ignored.';
var BANK_IMPORT_UNMATCH_FRIENDLY_NO_TARGET_ =
  'Could not find a SYS - Accounts row with this External Account Id to unlink.';

// Step 2d Apply refusal messages. Each is shown verbatim to the user
// in the bank_status row when Apply is blocked; staged rows are not
// mutated on refusal so the user can either correct the underlying
// issue (reactivate account, fix year block, re-import a fresh
// snapshot) or click Ignore to dismiss the row.
var BANK_IMPORT_APPLY_FRIENDLY_NOT_PENDING_ =
  'This row is no longer pending. Refresh the review list.';
var BANK_IMPORT_APPLY_FRIENDLY_NOT_LINKED_ =
  'This row is not linked to an account yet. Use Add as new or Match first.';
var BANK_IMPORT_APPLY_FRIENDLY_INACTIVE_ =
  'Cannot apply: linked account is marked inactive. Reactivate it on SYS - Accounts or Ignore this row.';
var BANK_IMPORT_APPLY_FRIENDLY_LINK_LOST_ =
  'Cannot apply: External Account Id no longer matches an active SYS - Accounts row. Re-link via Match.';
var BANK_IMPORT_APPLY_FRIENDLY_NO_YEAR_BLOCK_ =
  'Cannot apply: no Year block exists on INPUT - Bank Accounts for the balance year.';
var BANK_IMPORT_APPLY_FRIENDLY_NO_MONTH_COL_ =
  'Cannot apply: month column is missing in the year block on INPUT - Bank Accounts.';
var BANK_IMPORT_APPLY_FRIENDLY_BLOCKED_REASON_ =
  'Cannot apply while pending reason is unresolved. Re-import a fresh snapshot or Ignore this row.';
var BANK_IMPORT_APPLY_FRIENDLY_INVALID_DATE_ =
  'Cannot apply: balance date is missing or invalid on the staged row.';

/**
 * Read-only payload for the Review imports segment. Returns pending
 * staged rows (Status === 'pending') sorted by Last Seen desc + a
 * compact list of active SYS - Accounts rows for the match dropdown.
 *
 * Pending rows are intentionally never used by planner / overview /
 * snapshot — this reader is the only consumer of the staging sheet
 * outside processBankImportBatch_. No mutation here except the
 * additive ensure helpers (cheap on populated workbooks).
 */
function getBankImportReviewData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureImportStagingBankAccountsSheet_();
  ensureImportIgnoredBankAccountsSheet_();
  var accountsSheet = ensureSysAccountsSheet_();
  ensureAccountsExternalIdColumn_(accountsSheet);

  // Step 2d: pass accountsSheet so the listing can compute the link
  // state (linkedAccountName + linkedAccountActive) and decide whether
  // Apply is enabled per row. Single SYS - Accounts read shared across
  // all staged rows.
  var pending = bankImportListPendingStagedRows_(ss, accountsSheet);
  var existing = bankImportListExistingAccountSummaries_(accountsSheet);

  return {
    ok: true,
    pending: pending,
    existingAccounts: existing
  };
}

/**
 * Resolution (Step 2d, link-only): create a new bank account from a
 * staged pending row WITHOUT applying the imported balance. Reuses
 * addBankAccountFromDashboard for validation + row inserts, then stamps
 * the staged External Account Id onto the new SYS - Accounts row so
 * the staged row is "linked" (and Apply balance is unlocked).
 *
 *   1. Creates rows on INPUT - Bank Accounts (current Year block) and
 *      SYS - Accounts. No opening balance is forwarded — the imported
 *      snapshot is applied separately by applyStagedBankAccountBalance.
 *   2. Stamps the staged External Account Id onto the new SYS row.
 *   3. Flips staging Status to 'linked_added' (still visible in the
 *      Review imports list, now with Apply balance enabled).
 *   4. Logs a bank_import_review_add_new activity entry.
 *
 * Payload: {
 *   stagingId,
 *   accountName, type, usePolicy,    // required
 *   priority?                         // 1..99, default 9
 * }
 *
 * No opening-balance fields. Available Now / Min Buffer are
 * intentionally not set here either — Apply will mirror Current
 * Balance, but those user-owned planner inputs stay user-owned (same
 * rule as the Step 2a auto-match writer).
 */
function addStagedBankAccountAsNew(payload) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing review payload.');
    }
    var stagingId = String(payload.stagingId || '').trim();
    if (!stagingId) throw new Error('stagingId is required.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportStagingBankAccountsSheet_();
    var accountsSheet = ensureSysAccountsSheet_();
    ensureAccountsExternalIdColumn_(accountsSheet);

    var stagingSheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
    var stagingHeaderMap = bankImportLoadStagingHeaderMap_(stagingSheet);
    var stagedRow = bankImportFindStagingRowByStagingId_(stagingSheet, stagingId, stagingHeaderMap);
    if (!stagedRow) throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_);
    if (stagedRow.status !== BANK_IMPORT_STATUS_PENDING) {
      throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_ALREADY_RESOLVED_);
    }

    var addPayload = {
      accountName: String(payload.accountName || stagedRow.displayName || '').trim(),
      type: String(payload.type || stagedRow.type || '').trim(),
      usePolicy: String(payload.usePolicy || '').trim(),
      priority: payload.priority
      // Step 2d: do NOT forward the staged balance or its date. The
      // imported snapshot is applied separately via Apply balance —
      // this resolution is link-only. setAvailableFromOpening /
      // setMinBufferFromOpening are intentionally omitted as well;
      // there is no opening balance for them to mirror.
    };
    if (!addPayload.accountName) throw new Error('Account name is required.');
    if (!addPayload.type) throw new Error('Type is required.');
    if (!addPayload.usePolicy) throw new Error('Use policy is required.');

    var addResult = addBankAccountFromDashboard(addPayload);
    var createdName = (addResult && addResult.accountName) || addPayload.accountName;

    // Stamp the External Account Id onto the freshly-created row. Best-
    // effort: a failure here does not roll back the new account (the
    // user can re-link via Match), but we surface the error so the user
    // knows the link did not happen.
    var linkErr = null;
    try {
      bankImportSetAccountExternalId_(accountsSheet, createdName, stagedRow.externalAccountId, false);
    } catch (e) {
      linkErr = e;
    }

    // Step 2d: link-only. The account exists and (best-effort) carries
    // the External Id, but no balance was applied. Flip staging Status
    // to linked_added so the row stays in the Review list with Apply
    // balance enabled. The next ingestion will see the External Id on
    // SYS - Accounts and re-stage as auto_match_awaiting_apply, which
    // is the same review surface — re-link via Add will not happen.
    bankImportSetStagingRowStatus_(stagingSheet, stagedRow.row, stagingHeaderMap, BANK_IMPORT_STATUS_LINKED_ADDED);

    bankImportLogReviewActivity_(ss, BANK_IMPORT_EVENT_REVIEW_ADD_NEW, stagedRow, {
      accountName: createdName,
      pendingReason: stagedRow.pendingReason,
      linked: true,
      balanceApplied: false,
      linkExternalIdSucceeded: !linkErr,
      linkExternalIdError: linkErr ? String(linkErr && linkErr.message || linkErr) : ''
    });

    var msg = 'Account created from import. Click Apply balance to write the snapshot.';
    if (linkErr) {
      msg += ' Note: could not stamp external id (' +
        String(linkErr && linkErr.message || linkErr) + ').';
    }
    return {
      ok: true,
      message: msg,
      accountName: createdName,
      stagingId: stagingId,
      linkState: BANK_IMPORT_STATUS_LINKED_ADDED
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* best-effort */ }
  }
}

/**
 * Resolution: link a staged pending row to an existing active
 * SYS - Accounts row by writing the staged External Account Id into
 * that account's External Account Id cell. Refuses the link when the
 * target account already has a different non-blank External Account Id
 * (no overwrite, no confirmation). Does not touch balances, planner
 * fields, or any column other than External Account Id.
 *
 * Payload: { stagingId, accountName }
 */
function matchStagedBankAccountToExisting(payload) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing review payload.');
    }
    var stagingId = String(payload.stagingId || '').trim();
    var accountName = String(payload.accountName || '').trim();
    if (!stagingId) throw new Error('stagingId is required.');
    if (!accountName) throw new Error('accountName is required.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportStagingBankAccountsSheet_();
    var accountsSheet = ensureSysAccountsSheet_();
    ensureAccountsExternalIdColumn_(accountsSheet);

    var stagingSheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
    var stagingHeaderMap = bankImportLoadStagingHeaderMap_(stagingSheet);
    var stagedRow = bankImportFindStagingRowByStagingId_(stagingSheet, stagingId, stagingHeaderMap);
    if (!stagedRow) throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_);
    if (stagedRow.status !== BANK_IMPORT_STATUS_PENDING) {
      throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_ALREADY_RESOLVED_);
    }
    if (!stagedRow.externalAccountId) {
      throw new Error('Staged row has no external id; cannot match. Use Add as new instead.');
    }

    bankImportSetAccountExternalId_(accountsSheet, accountName, stagedRow.externalAccountId, true);

    // Step 2d: link-only. Status flips to linked_matched (still
    // visible in Review imports) and the user must click Apply balance
    // to write the snapshot. Balance is never written here.
    bankImportSetStagingRowStatus_(stagingSheet, stagedRow.row, stagingHeaderMap, BANK_IMPORT_STATUS_LINKED_MATCHED);

    try {
      touchDashboardSourceUpdated_('bank_accounts');
    } catch (_touchErr) { /* best-effort */ }

    bankImportLogReviewActivity_(ss, BANK_IMPORT_EVENT_REVIEW_MATCH, stagedRow, {
      accountName: accountName,
      pendingReason: stagedRow.pendingReason,
      linked: true,
      balanceApplied: false
    });

    return {
      ok: true,
      message: 'Linked to ' + accountName + '. Click Apply balance to write the snapshot.',
      accountName: accountName,
      stagingId: stagingId,
      linkState: BANK_IMPORT_STATUS_LINKED_MATCHED
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* best-effort */ }
  }
}

/**
 * Resolution: undo a Match. Clears the External Account Id cell on the
 * SYS - Accounts row that currently carries the staged id, flips the
 * staging row Status back to 'pending' with Pending Reason
 * 'no_exact_id_match', and writes a bank_import_review_unlink_match
 * activity row. Strictly scoped:
 *
 *   - Only acts on linked_matched rows. linked_added rows (which
 *     created their own SYS - Accounts row + INPUT - Bank Accounts
 *     row) are intentionally NOT eligible for Unlink in this step —
 *     their cleanup is owned by Apply or Ignore.
 *   - Never touches balances on INPUT - Bank Accounts.
 *   - Never touches Available Now / Min Buffer / Use Policy /
 *     Priority / Active / any column other than External Account Id.
 *
 * Payload: { stagingId }
 */
function unlinkMatchedStagedBankAccount(payload) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing review payload.');
    }
    var stagingId = String(payload.stagingId || '').trim();
    if (!stagingId) throw new Error('stagingId is required.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportStagingBankAccountsSheet_();
    var accountsSheet = ensureSysAccountsSheet_();
    ensureAccountsExternalIdColumn_(accountsSheet);

    var stagingSheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
    var stagingHeaderMap = bankImportLoadStagingHeaderMap_(stagingSheet);
    var stagedRow = bankImportFindStagingRowByStagingId_(stagingSheet, stagingId, stagingHeaderMap);
    if (!stagedRow) throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_);
    if (stagedRow.status !== BANK_IMPORT_STATUS_LINKED_MATCHED) {
      throw new Error(BANK_IMPORT_UNMATCH_FRIENDLY_NOT_LINKED_MATCHED_);
    }

    var externalId = String(stagedRow.externalAccountId || '').trim();
    if (!externalId) {
      // Defensive: a linked_matched row should always carry the staged
      // external id, but if someone hand-edited the cell empty we fall
      // through to a clean refusal rather than mutate nothing.
      throw new Error(BANK_IMPORT_UNMATCH_FRIENDLY_NO_TARGET_);
    }

    var linkedAccount = bankImportFindAccountByExternalId_(accountsSheet, externalId);
    if (!linkedAccount) {
      throw new Error(BANK_IMPORT_UNMATCH_FRIENDLY_NO_TARGET_);
    }

    var clearedAccountName = linkedAccount.accountName;
    bankImportClearAccountExternalId_(accountsSheet, clearedAccountName, externalId);

    // Flip staging row back to pending with the canonical "no match"
    // reason. The row will re-render in Review imports as a vanilla
    // unlinked row offering Add as new / Match to existing / Ignore.
    bankImportSetStagingRowStatus_(stagingSheet, stagedRow.row, stagingHeaderMap, BANK_IMPORT_STATUS_PENDING);
    if (stagingHeaderMap['Pending Reason']) {
      stagingSheet.getRange(stagedRow.row, stagingHeaderMap['Pending Reason'])
        .setValue(BANK_IMPORT_PENDING_REASONS.NO_EXACT_ID_MATCH);
    }

    try {
      touchDashboardSourceUpdated_('bank_accounts');
    } catch (_touchErr) { /* best-effort */ }

    bankImportLogReviewActivity_(ss, BANK_IMPORT_EVENT_REVIEW_UNLINK_MATCH, stagedRow, {
      // accountName is consumed by bankImportLogReviewActivity_ as
      // the activity row's Payee — keeps the audit trail readable
      // ("Unlinked match" -> "<account that lost the External Id>").
      accountName: clearedAccountName,
      previousAccountName: clearedAccountName,
      previousLinkState: BANK_IMPORT_STATUS_LINKED_MATCHED,
      pendingReasonAfter: BANK_IMPORT_PENDING_REASONS.NO_EXACT_ID_MATCH
    });

    return {
      ok: true,
      message:
        'Unlinked from ' + clearedAccountName +
        '. Pick a different match, Add as new, or Ignore.',
      previousAccountName: clearedAccountName,
      stagingId: stagingId
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* best-effort */ }
  }
}

/**
 * Resolution: append the staged fingerprint to SYS - Import Ignored —
 * Bank Accounts (scope = 'permanent') so future ingestions skip it
 * before reaching the staging upsert path. Idempotent: if the same
 * external id already exists in the ignored sheet, the append is
 * skipped. Step 2a only honors permanent scope, so we deliberately do
 * not expose until_changed yet.
 *
 * Payload: { stagingId }
 */
function ignoreStagedBankAccount(payload) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing review payload.');
    }
    var stagingId = String(payload.stagingId || '').trim();
    if (!stagingId) throw new Error('stagingId is required.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportStagingBankAccountsSheet_();
    var ignoredSheet = ensureImportIgnoredBankAccountsSheet_();

    var stagingSheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
    var stagingHeaderMap = bankImportLoadStagingHeaderMap_(stagingSheet);
    var stagedRow = bankImportFindStagingRowByStagingId_(stagingSheet, stagingId, stagingHeaderMap);
    if (!stagedRow) throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_);
    // Step 2d: also accept linked-but-not-yet-applied statuses so the
    // user can dismiss a row even after they've clicked Add or Match.
    // Only refuse on terminal statuses (resolved_*).
    if (!bankImportIsReviewVisibleStatus_(stagedRow.status)) {
      throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_ALREADY_RESOLVED_);
    }

    var alreadyIgnored = bankImportIgnoredEntryExists_(ignoredSheet, stagedRow);
    if (!alreadyIgnored) {
      bankImportAppendIgnoredEntry_(ignoredSheet, stagedRow);
    }

    bankImportSetStagingRowStatus_(stagingSheet, stagedRow.row, stagingHeaderMap, BANK_IMPORT_STATUS_RESOLVED_IGNORED);

    bankImportLogReviewActivity_(ss, BANK_IMPORT_EVENT_REVIEW_IGNORE, stagedRow, {
      scope: 'permanent',
      pendingReason: stagedRow.pendingReason,
      alreadyIgnored: alreadyIgnored
    });

    return {
      ok: true,
      message: alreadyIgnored ? 'Already ignored. Marked staged row resolved.' : 'Ignored.',
      stagingId: stagingId
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* best-effort */ }
  }
}

/* ===========================================================================
 * Step 2d — Apply balance (explicit, separate, idempotent)
 * ---------------------------------------------------------------------------
 * Writes the staged snapshot into the linked SYS - Accounts row's
 * matching INPUT - Bank Accounts month cell. The single point in the
 * Bank Import flow where INPUT - Bank Accounts is mutated as of
 * Step 2d (ingestion never writes; Add / Match are link-only).
 *
 * Refusal-without-mutation is the entire contract for the safety
 * checks below — every refusal returns a clear error and leaves the
 * staged row exactly where it was so the user can either fix the
 * underlying data and click Apply again, or click Ignore to dismiss.
 *
 * Reuses bankImportApplyAutoMatchWrite_ for the actual cell write so
 * the write path is byte-for-byte the same one Bank → Update uses
 * (updateBankAccountsHistory_ + syncAllAccountsFromLatestCurrentYear_
 * + touchDashboardSourceUpdated_). runDebtPlanner is intentionally not
 * called here — same reasoning as Step 2a / manual Bank Update.
 * ========================================================================= */

/**
 * Apply the staged balance to the linked SYS - Accounts row.
 *
 * Refuses on:
 *   - status not in {pending, linked_added, linked_matched}
 *   - pending reason in {stale_balance, currency_mismatch, type_conflict}
 *   - external id missing or no longer matches an active SYS row
 *   - target account is inactive
 *   - balance date missing/invalid
 *   - INPUT - Bank Accounts has no Year block for the balance year
 *   - INPUT - Bank Accounts has no month column for the balance month
 *
 * On success, writes the cell, mirrors Current Balance via
 * syncAllAccountsFromLatestCurrentYear_, flips staging Status to
 * resolved_applied, and emits a single bank_import_apply_balance
 * activity row keyed off bankImportFingerprint_ so identical
 * re-imports never trigger a duplicate Apply via ingestion dedupe.
 *
 * Payload: { stagingId }
 */
function applyStagedBankAccountBalance(payload) {
  var lock = LockService.getDocumentLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing apply payload.');
    }
    var stagingId = String(payload.stagingId || '').trim();
    if (!stagingId) throw new Error('stagingId is required.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportStagingBankAccountsSheet_();
    var accountsSheet = ensureSysAccountsSheet_();
    ensureAccountsExternalIdColumn_(accountsSheet);

    var stagingSheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
    var stagingHeaderMap = bankImportLoadStagingHeaderMap_(stagingSheet);
    var stagedRow = bankImportFindStagingRowByStagingId_(stagingSheet, stagingId, stagingHeaderMap);
    if (!stagedRow) throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_NOT_FOUND_);
    if (!bankImportIsReviewVisibleStatus_(stagedRow.status)) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_NOT_PENDING_);
    }

    // Pending-reason gate. Stale / currency / type rows must NOT be
    // applied — the user has to re-import a fresh snapshot or Ignore.
    var reasonKey = String(stagedRow.pendingReason || '').trim();
    if (BANK_IMPORT_APPLY_BLOCKING_REASONS_[reasonKey]) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_BLOCKED_REASON_);
    }

    // External Id gate. Add-as-new and Match both stamp the External
    // Id onto SYS - Accounts; auto_match_awaiting_apply rows already
    // had it pre-stamped. If the cell has been cleared between link
    // and apply we refuse — the user can re-link via Match.
    var externalId = String(stagedRow.externalAccountId || '').trim();
    if (!externalId) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_NOT_LINKED_);
    }
    var linkedAccount = bankImportFindAccountByExternalId_(accountsSheet, externalId);
    if (!linkedAccount) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_LINK_LOST_);
    }
    if (!linkedAccount.active) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_INACTIVE_);
    }

    // Balance date. balanceAsOf is stored as a yyyy-MM-dd string by
    // the staging writer; defensive parse in case the cell was hand-
    // edited.
    var balanceAsOfRaw = String(stagedRow.balanceAsOf || '').trim();
    if (!balanceAsOfRaw) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_INVALID_DATE_);
    }
    var balanceAsOfDate;
    try {
      balanceAsOfDate = parseIsoDateLocal_(balanceAsOfRaw);
    } catch (_dateErr) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_INVALID_DATE_);
    }
    if (!(balanceAsOfDate instanceof Date) || isNaN(balanceAsOfDate.getTime())) {
      throw new Error(BANK_IMPORT_APPLY_FRIENDLY_INVALID_DATE_);
    }

    // Pre-check the year block + month column BEFORE writing so we can
    // produce a friendly refusal message instead of letting
    // updateBankAccountsHistory_'s low-level "Could not find Year
    // block for ..." escape to the user. Also captures the previous
    // cell value for the activity log.
    var bankSheet = getSheet_(ss, 'BANK_ACCOUNTS');
    var year = balanceAsOfDate.getFullYear();
    var preCheck = bankImportPreCheckMonthCell_(bankSheet, linkedAccount.accountName, year, balanceAsOfDate);
    if (!preCheck.ok) {
      throw new Error(preCheck.error);
    }

    var newRaw = round2_(toNumber_(stagedRow.balance));
    var fingerprint = bankImportFingerprint_(externalId, newRaw, balanceAsOfRaw);

    // Actual write — same path Bank → Update uses, minus runDebtPlanner.
    bankImportApplyAutoMatchWrite_(linkedAccount.accountName, balanceAsOfDate, newRaw);

    // Mark staged row terminal so it leaves the Review imports list.
    bankImportSetStagingRowStatus_(stagingSheet, stagedRow.row, stagingHeaderMap, BANK_IMPORT_STATUS_RESOLVED_APPLIED);

    var tz = Session.getScriptTimeZone();
    var monthLabel = Utilities.formatDate(balanceAsOfDate, tz, 'MMM-yy');

    bankImportLogApplyBalanceActivity_(ss, stagedRow, linkedAccount.accountName, {
      monthLabel: monthLabel,
      previousRaw: preCheck.previousRaw,
      previousDisplay: preCheck.previousDisplay,
      newRaw: newRaw,
      pendingReasonAtApply: reasonKey,
      linkStateAtApply: stagedRow.status
    }, fingerprint);

    return {
      ok: true,
      message:
        'Applied ' + fmtCurrency_(newRaw) +
        ' to ' + linkedAccount.accountName +
        ' (' + monthLabel + ').' +
        (preCheck.previousDisplay
          ? ' Previous: ' + preCheck.previousDisplay + '.'
          : ''),
      accountName: linkedAccount.accountName,
      stagingId: stagingId,
      monthLabel: monthLabel,
      previousRaw: preCheck.previousRaw,
      newRaw: newRaw
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) { /* best-effort */ }
  }
}

/**
 * Pre-flight read for Apply. Returns either { ok: true, previousRaw,
 * previousDisplay } or { ok: false, error: <friendly message> } so
 * the caller can refuse Apply with a clean message rather than let
 * updateBankAccountsHistory_'s low-level errors leak. Best-effort:
 * any unexpected throw inside the year-block/month-column lookups
 * collapses to the matching friendly message.
 */
function bankImportPreCheckMonthCell_(bankSheet, accountName, year, balanceAsOfDate) {
  var block;
  try {
    block = getBankAccountsYearBlock_(bankSheet, year);
  } catch (_blockErr) {
    return { ok: false, error: BANK_IMPORT_APPLY_FRIENDLY_NO_YEAR_BLOCK_ };
  }

  var rowNum = findBankAccountRowInBlock_(bankSheet, block, accountName);
  if (rowNum === -1) {
    // The account exists on SYS - Accounts (we already validated that)
    // but has no row in this Year block yet. Treat as "no Year block"
    // for the user — same fix path: extend INPUT - Bank Accounts.
    return { ok: false, error: BANK_IMPORT_APPLY_FRIENDLY_NO_YEAR_BLOCK_ };
  }

  var monthCol;
  try {
    monthCol = getMonthColumnByDate_(bankSheet, balanceAsOfDate, block.headerRow);
  } catch (_monthErr) {
    return { ok: false, error: BANK_IMPORT_APPLY_FRIENDLY_NO_MONTH_COL_ };
  }

  var prevRaw = null;
  var prevDisplay = '';
  try {
    var prevCell = bankSheet.getRange(rowNum, monthCol);
    var rawVal = prevCell.getValue();
    if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
      prevRaw = round2_(toNumber_(rawVal));
    }
    prevDisplay = String(prevCell.getDisplayValue() || '').trim();
  } catch (_readErr) {
    // Non-fatal — a missing previous-value just means the activity log
    // shows the new balance only.
  }

  return { ok: true, previousRaw: prevRaw, previousDisplay: prevDisplay };
}

/**
 * Reverse-lookup helper. Finds the SYS - Accounts row whose
 * External Account Id matches the staged id. Returns the canonical
 * account name and an active flag so the Apply path can refuse
 * inactive targets without re-reading the sheet. Empty external ids
 * never match. Returns null when no row matches.
 *
 * Tolerates multiple matches by preferring the first active row found
 * (mirrors bankImportLookupAccountByExternalId_'s convention) — if all
 * matches are inactive, the first inactive row is returned so the
 * caller can produce a precise inactive refusal.
 */
function bankImportFindAccountByExternalId_(accountsSheet, externalAccountId) {
  if (!accountsSheet) return null;
  var ext = String(externalAccountId || '').trim();
  if (!ext) return null;

  var display = accountsSheet.getDataRange().getDisplayValues();
  if (display.length < 2) return null;

  var headers = display[0] || [];
  var idxName = headers.indexOf('Account Name');
  var idxActive = headers.indexOf('Active');
  var idxExt = headers.indexOf('External Account Id');
  if (idxName === -1 || idxExt === -1) return null;

  var firstInactive = null;
  for (var r = 1; r < display.length; r++) {
    var rowExt = String(display[r][idxExt] || '').trim();
    if (!rowExt || rowExt !== ext) continue;
    var name = String(display[r][idxName] || '').trim();
    if (!name) continue;

    var rawActive = idxActive === -1 ? '' : String(display[r][idxActive] || '').trim().toLowerCase();
    var inactive = (rawActive === 'no' || rawActive === 'n' || rawActive === 'false' || rawActive === 'inactive');
    if (!inactive) {
      return { accountName: name, active: true };
    }
    if (!firstInactive) firstInactive = { accountName: name, active: false };
  }
  return firstInactive;
}

function bankImportIsReviewVisibleStatus_(status) {
  var s = String(status || '').trim().toLowerCase();
  for (var i = 0; i < BANK_IMPORT_REVIEW_VISIBLE_STATUSES_.length; i++) {
    if (s === BANK_IMPORT_REVIEW_VISIBLE_STATUSES_[i]) return true;
  }
  return false;
}

/**
 * Activity log wrapper for the Step 2d Apply event. Non-monetary
 * (Amount column renders "—" via activityLogIsNonMonetaryEvent_) so
 * the snapshot doesn't double-count against Activity totals; the
 * action label carries the month + balance for context. Reuses the
 * Step 2a fingerprint as the dedupeKey so an exact re-import of the
 * same snapshot is a no-op at ingestion time
 * (activityLogDedupeKeyExists_ inside processBankImportBatch_).
 */
function bankImportLogApplyBalanceActivity_(ss, stagedRow, accountName, applyDetails, dedupeKey) {
  try {
    var details = {
      detailsVersion: 1,
      bankImportStep: '2d',
      stagingId: stagedRow.stagingId || '',
      externalAccountId: stagedRow.externalAccountId || '',
      institution: stagedRow.institution || '',
      displayName: stagedRow.displayName || '',
      last4: stagedRow.last4 || '',
      type: stagedRow.type || '',
      currency: stagedRow.currency || '',
      balance: stagedRow.balance,
      balanceAsOf: stagedRow.balanceAsOf || ''
    };
    if (applyDetails && typeof applyDetails === 'object') {
      Object.keys(applyDetails).forEach(function(k) { details[k] = applyDetails[k]; });
    }

    appendActivityLog_(ss, {
      eventType: BANK_IMPORT_EVENT_APPLY_BALANCE,
      entryDate: stagedRow.balanceAsOf || '',
      amount: 0,
      direction: '',
      payee: String(accountName || '').trim() || stagedRow.displayName || stagedRow.institution || '',
      category: stagedRow.type || '',
      accountSource: stagedRow.institution || '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: String(dedupeKey || '').trim(),
      details: JSON.stringify(details)
    });
  } catch (logErr) {
    Logger.log('bankImportLogApplyBalanceActivity_ failed: ' + logErr);
  }
}

/* ---------- Step 2b helpers ---------- */

/**
 * Header → 1-based column lookup for SYS - Import Staging — Bank
 * Accounts. Header names come from the Step 1 scaffold and are looked
 * up by exact display string so a future column reorder (or an
 * additive new column) does not shift any cell address downstream.
 */
function bankImportLoadStagingHeaderMap_(sheet) {
  if (!sheet) throw new Error('Missing staging sheet.');
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];
  var map = {};
  for (var c = 0; c < headers.length; c++) {
    var name = String(headers[c] || '').trim();
    if (!name) continue;
    map[name] = c + 1;
  }
  // Step 2b only touches Status; everything else is read-only here.
  if (!map['Staging Id'] || !map['Status']) {
    throw new Error('Staging sheet headers are malformed (missing Staging Id or Status).');
  }
  return map;
}

/**
 * Reads pending (Status === 'pending') staged rows into a UI-friendly
 * array. Sorted by Last Seen desc with a deterministic Staging Id
 * tie-breaker so two rows touched in the same second do not flicker
 * between renders.
 */
function bankImportListPendingStagedRows_(ss, accountsSheetOpt) {
  var sheet = ss.getSheetByName(getSheetNames_().IMPORT_STAGING_BANK);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var headerMap = bankImportLoadStagingHeaderMap_(sheet);
  var lastCol = Math.max(sheet.getLastColumn(), 13);
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  var idCol = headerMap['Staging Id'] - 1;
  var firstCol = headerMap['First Seen'] ? headerMap['First Seen'] - 1 : -1;
  var lastSeenCol = headerMap['Last Seen'] ? headerMap['Last Seen'] - 1 : -1;
  var extCol = headerMap['External Account Id'] ? headerMap['External Account Id'] - 1 : -1;
  var instCol = headerMap['External Institution'] ? headerMap['External Institution'] - 1 : -1;
  var dispCol = headerMap['Display Name'] ? headerMap['Display Name'] - 1 : -1;
  var last4Col = headerMap['Last 4'] ? headerMap['Last 4'] - 1 : -1;
  var typeCol = headerMap['Type'] ? headerMap['Type'] - 1 : -1;
  var ccyCol = headerMap['Currency'] ? headerMap['Currency'] - 1 : -1;
  var balCol = headerMap['Latest Balance'] ? headerMap['Latest Balance'] - 1 : -1;
  var balAsOfCol = headerMap['Latest Balance As Of'] ? headerMap['Latest Balance As Of'] - 1 : -1;
  var statusCol = headerMap['Status'] - 1;
  var reasonCol = headerMap['Pending Reason'] ? headerMap['Pending Reason'] - 1 : -1;

  // Snapshot SYS - Accounts once so the per-row reverse lookup
  // (External Id → account name + active flag) doesn't re-read for
  // every staged row. Falls back to a fresh handle if not provided
  // (caller convenience for any future internal use).
  var accountsSheet = accountsSheetOpt || (function() {
    try { return ensureSysAccountsSheet_(); } catch (_e) { return null; }
  })();

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var status = String(row[statusCol] || '').trim().toLowerCase();
    // Step 2d: surface pending + linked-but-not-applied rows. Terminal
    // statuses (resolved_*) stay hidden.
    if (!bankImportIsReviewVisibleStatus_(status)) continue;
    var stagingId = String(row[idCol] || '').trim();
    if (!stagingId) continue;

    var externalAccountId = extCol === -1 ? '' : String(row[extCol] || '').trim();
    var pendingReason = reasonCol === -1 ? '' : String(row[reasonCol] || '').trim();

    // Resolve link state. Pending rows with an external id may already
    // be linked on SYS - Accounts (auto_match_awaiting_apply) or not
    // yet linked (unmatched, ambiguous, type_conflict, etc.). Linked
    // statuses (linked_added / linked_matched) are by definition
    // already linked.
    var linked = null;
    if (externalAccountId && accountsSheet) {
      try {
        linked = bankImportFindAccountByExternalId_(accountsSheet, externalAccountId);
      } catch (_lookupErr) {
        linked = null;
      }
    }
    var linkedAccountName = linked ? linked.accountName : '';
    var linkedAccountActive = linked ? !!linked.active : false;

    var linkState;
    if (status === BANK_IMPORT_STATUS_LINKED_ADDED) {
      linkState = 'linked_added';
    } else if (status === BANK_IMPORT_STATUS_LINKED_MATCHED) {
      linkState = 'linked_matched';
    } else if (linkedAccountName) {
      linkState = 'auto_pending'; // pending status + already linked on SYS
    } else {
      linkState = 'unlinked';
    }

    var applyAllowed = false;
    var applyBlockedReason = '';
    if (linkState === 'unlinked') {
      applyBlockedReason = 'Link this row first via Add as new or Match.';
    } else if (BANK_IMPORT_APPLY_BLOCKING_REASONS_[pendingReason]) {
      applyBlockedReason =
        'Apply is blocked while pending reason is "' + pendingReason +
        '". Re-import a fresh snapshot or Ignore this row.';
    } else if (!linkedAccountActive) {
      applyBlockedReason =
        'Linked account is marked inactive. Reactivate it on SYS - Accounts or Ignore this row.';
    } else {
      applyAllowed = true;
    }

    out.push({
      stagingId: stagingId,
      status: status,
      firstSeen: firstCol === -1 ? '' : String(row[firstCol] || '').trim(),
      lastSeen: lastSeenCol === -1 ? '' : String(row[lastSeenCol] || '').trim(),
      externalAccountId: externalAccountId,
      institution: instCol === -1 ? '' : String(row[instCol] || '').trim(),
      displayName: dispCol === -1 ? '' : String(row[dispCol] || '').trim(),
      last4: last4Col === -1 ? '' : String(row[last4Col] || '').trim(),
      type: typeCol === -1 ? '' : String(row[typeCol] || '').trim(),
      currency: ccyCol === -1 ? '' : String(row[ccyCol] || '').trim(),
      balance: balCol === -1 ? 0 : round2_(toNumber_(row[balCol])),
      balanceAsOf: balAsOfCol === -1 ? '' : String(row[balAsOfCol] || '').trim(),
      pendingReason: pendingReason,
      linkState: linkState,
      linkedAccountName: linkedAccountName,
      linkedAccountActive: linkedAccountActive,
      applyAllowed: applyAllowed,
      applyBlockedReason: applyBlockedReason
    });
  }

  out.sort(function(a, b) {
    if (a.lastSeen < b.lastSeen) return 1;
    if (a.lastSeen > b.lastSeen) return -1;
    if (a.stagingId < b.stagingId) return -1;
    if (a.stagingId > b.stagingId) return 1;
    return 0;
  });
  return out;
}

/**
 * Locate a staged row by exact Staging Id (column 1). Returns the same
 * shape bankImportListPendingStagedRows_ emits, plus 1-based row
 * number and current Status (so callers can decide between "not pending"
 * and "not found" without a second round-trip).
 */
function bankImportFindStagingRowByStagingId_(sheet, stagingId, headerMap) {
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var lastCol = Math.max(sheet.getLastColumn(), 13);
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  var idCol = headerMap['Staging Id'] - 1;
  var firstCol = headerMap['First Seen'] ? headerMap['First Seen'] - 1 : -1;
  var lastSeenCol = headerMap['Last Seen'] ? headerMap['Last Seen'] - 1 : -1;
  var extCol = headerMap['External Account Id'] ? headerMap['External Account Id'] - 1 : -1;
  var instCol = headerMap['External Institution'] ? headerMap['External Institution'] - 1 : -1;
  var dispCol = headerMap['Display Name'] ? headerMap['Display Name'] - 1 : -1;
  var last4Col = headerMap['Last 4'] ? headerMap['Last 4'] - 1 : -1;
  var typeCol = headerMap['Type'] ? headerMap['Type'] - 1 : -1;
  var ccyCol = headerMap['Currency'] ? headerMap['Currency'] - 1 : -1;
  var balCol = headerMap['Latest Balance'] ? headerMap['Latest Balance'] - 1 : -1;
  var balAsOfCol = headerMap['Latest Balance As Of'] ? headerMap['Latest Balance As Of'] - 1 : -1;
  var statusCol = headerMap['Status'] - 1;
  var reasonCol = headerMap['Pending Reason'] ? headerMap['Pending Reason'] - 1 : -1;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[idCol] || '').trim() !== stagingId) continue;
    return {
      row: r + 1,
      status: String(row[statusCol] || '').trim().toLowerCase(),
      stagingId: stagingId,
      firstSeen: firstCol === -1 ? '' : String(row[firstCol] || '').trim(),
      lastSeen: lastSeenCol === -1 ? '' : String(row[lastSeenCol] || '').trim(),
      externalAccountId: extCol === -1 ? '' : String(row[extCol] || '').trim(),
      institution: instCol === -1 ? '' : String(row[instCol] || '').trim(),
      displayName: dispCol === -1 ? '' : String(row[dispCol] || '').trim(),
      last4: last4Col === -1 ? '' : String(row[last4Col] || '').trim(),
      type: typeCol === -1 ? '' : String(row[typeCol] || '').trim(),
      currency: ccyCol === -1 ? '' : String(row[ccyCol] || '').trim(),
      balance: balCol === -1 ? 0 : round2_(toNumber_(row[balCol])),
      balanceAsOf: balAsOfCol === -1 ? '' : String(row[balAsOfCol] || '').trim(),
      pendingReason: reasonCol === -1 ? '' : String(row[reasonCol] || '').trim()
    };
  }
  return null;
}

function bankImportSetStagingRowStatus_(sheet, rowNum, headerMap, newStatus) {
  if (!sheet || !rowNum || !headerMap || !headerMap['Status']) return;
  sheet.getRange(rowNum, headerMap['Status']).setValue(String(newStatus || '').trim());
}

/**
 * Active SYS - Accounts rows in display form, with the existing
 * External Account Id flagged so the UI can pre-warn the user before
 * they pick a row that's already linked. Active = blank/yes/y/true
 * (matches getInactiveBankAccountsSet_'s convention).
 */
function bankImportListExistingAccountSummaries_(accountsSheet) {
  if (!accountsSheet) return [];
  var display = accountsSheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  var headers = display[0] || [];
  var idxName = headers.indexOf('Account Name');
  var idxType = headers.indexOf('Type');
  var idxActive = headers.indexOf('Active');
  var idxExt = headers.indexOf('External Account Id');
  if (idxName === -1) return [];

  var out = [];
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][idxName] || '').trim();
    if (!name) continue;
    var rawActive = idxActive === -1 ? '' : String(display[r][idxActive] || '').trim().toLowerCase();
    var inactive = (rawActive === 'no' || rawActive === 'n' || rawActive === 'false' || rawActive === 'inactive');
    if (inactive) continue;
    var existingExt = idxExt === -1 ? '' : String(display[r][idxExt] || '').trim();
    out.push({
      accountName: name,
      type: idxType === -1 ? '' : String(display[r][idxType] || '').trim(),
      hasExternalId: !!existingExt,
      externalAccountId: existingExt
    });
  }
  out.sort(function(a, b) { return a.accountName.localeCompare(b.accountName); });
  return out;
}

/**
 * Writes an external id into the External Account Id cell of the row
 * whose Account Name matches exactly. When refuseIfDifferent is true,
 * a non-blank existing value that differs from the new one throws
 * BANK_IMPORT_REVIEW_FRIENDLY_DIFFERENT_EXT_ID_ rather than overwriting.
 * Skips writing when the cell already holds the same value (idempotent).
 */
function bankImportSetAccountExternalId_(accountsSheet, accountName, externalId, refuseIfDifferent) {
  if (!accountsSheet) throw new Error('Missing SYS - Accounts.');
  var nameTrim = String(accountName || '').trim();
  if (!nameTrim) throw new Error('Account name is required.');
  var extTrim = String(externalId || '').trim();
  if (!extTrim) throw new Error('External Account Id is required.');

  var display = accountsSheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var idxName = headers.indexOf('Account Name');
  var idxExt = headers.indexOf('External Account Id');
  if (idxName === -1) throw new Error('SYS - Accounts must contain Account Name.');
  if (idxExt === -1) throw new Error('SYS - Accounts must contain External Account Id.');

  for (var r = 1; r < display.length; r++) {
    if (String(display[r][idxName] || '').trim() !== nameTrim) continue;
    var existing = String(display[r][idxExt] || '').trim();
    if (existing === extTrim) return; // already linked, no-op
    if (existing && refuseIfDifferent) {
      throw new Error(BANK_IMPORT_REVIEW_FRIENDLY_DIFFERENT_EXT_ID_);
    }
    accountsSheet.getRange(r + 1, idxExt + 1).setValue(extTrim);
    return;
  }
  throw new Error('Account "' + nameTrim + '" not found on SYS - Accounts.');
}

/**
 * Clears the External Account Id cell on the SYS - Accounts row whose
 * Account Name matches exactly. Idempotent (already-blank cell is a
 * no-op). When expectedExternalId is provided, refuses to clear if
 * the cell holds a different non-blank value — defensive guard so a
 * stale Unlink click after the user manually re-linked the row to a
 * different external id can never blow that re-link away.
 */
function bankImportClearAccountExternalId_(accountsSheet, accountName, expectedExternalId) {
  if (!accountsSheet) throw new Error('Missing SYS - Accounts.');
  var nameTrim = String(accountName || '').trim();
  if (!nameTrim) throw new Error('Account name is required.');
  var expected = String(expectedExternalId || '').trim();

  var display = accountsSheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var idxName = headers.indexOf('Account Name');
  var idxExt = headers.indexOf('External Account Id');
  if (idxName === -1) throw new Error('SYS - Accounts must contain Account Name.');
  if (idxExt === -1) throw new Error('SYS - Accounts must contain External Account Id.');

  for (var r = 1; r < display.length; r++) {
    if (String(display[r][idxName] || '').trim() !== nameTrim) continue;
    var existing = String(display[r][idxExt] || '').trim();
    if (!existing) return; // already blank, no-op
    if (expected && existing !== expected) {
      throw new Error(BANK_IMPORT_UNMATCH_FRIENDLY_NO_TARGET_);
    }
    accountsSheet.getRange(r + 1, idxExt + 1).setValue('');
    return;
  }
  throw new Error('Account "' + nameTrim + '" not found on SYS - Accounts.');
}

function bankImportIgnoredEntryExists_(ignoredSheet, stagedRow) {
  if (!ignoredSheet) return false;
  var lastRow = ignoredSheet.getLastRow();
  if (lastRow < 2) return false;
  var lastCol = Math.max(ignoredSheet.getLastColumn(), 7);
  var values = ignoredSheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headers = values[0] || [];
  var idxExt = headers.indexOf('External Account Id');
  var idxScope = headers.indexOf('Scope');

  for (var r = 1; r < values.length; r++) {
    var ext = idxExt === -1 ? '' : String(values[r][idxExt] || '').trim();
    var scope = idxScope === -1 ? '' : String(values[r][idxScope] || '').trim().toLowerCase();
    if (scope && scope !== 'permanent') continue;
    if (stagedRow.externalAccountId && ext === stagedRow.externalAccountId) return true;
  }
  return false;
}

function bankImportAppendIgnoredEntry_(ignoredSheet, stagedRow) {
  var tz = Session.getScriptTimeZone();
  var nowStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  var ignoredBy = '';
  try {
    ignoredBy = String(Session.getActiveUser().getEmail() || '').trim();
  } catch (_e) {
    ignoredBy = '';
  }
  ignoredSheet.appendRow([
    stagedRow.externalAccountId || '',
    stagedRow.institution || '',
    stagedRow.displayName || '',
    stagedRow.last4 || '',
    nowStr,
    ignoredBy,
    'permanent'
  ]);
}

/**
 * Activity log wrapper for Step 2b review events. Mirrors
 * bankImportLogActivity_ shape so the LOG - Activity row layout is
 * consistent with Step 2a entries (same payee/category/source rules,
 * empty dedupeKey, identical detailsVersion). Marks bankImportStep
 * '2b' so a later observability pass can distinguish ingestion vs
 * review events without inspecting eventType prefixes.
 */
function bankImportLogReviewActivity_(ss, eventType, stagedRow, extraDetails) {
  try {
    var details = {
      detailsVersion: 1,
      bankImportStep: '2b',
      stagingId: stagedRow.stagingId || '',
      externalAccountId: stagedRow.externalAccountId || '',
      institution: stagedRow.institution || '',
      displayName: stagedRow.displayName || '',
      last4: stagedRow.last4 || '',
      type: stagedRow.type || '',
      currency: stagedRow.currency || '',
      balance: stagedRow.balance,
      balanceAsOf: stagedRow.balanceAsOf || ''
    };
    if (extraDetails && typeof extraDetails === 'object') {
      Object.keys(extraDetails).forEach(function(k) { details[k] = extraDetails[k]; });
    }

    var payee = stagedRow.displayName || stagedRow.institution || '';
    if (extraDetails && extraDetails.accountName) {
      payee = String(extraDetails.accountName).trim() || payee;
    }

    appendActivityLog_(ss, {
      eventType: eventType,
      entryDate: stagedRow.balanceAsOf || '',
      amount: 0,
      direction: 'expense',
      payee: payee,
      category: stagedRow.type || '',
      accountSource: stagedRow.institution || '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify(details)
    });
  } catch (logErr) {
    Logger.log('bankImportLogReviewActivity_ failed: ' + logErr);
  }
}

/* ---------------------------------------------------------------------------
 * Step 2c — UI-driven sample import trigger
 * ---------------------------------------------------------------------------
 * Public dashboard wrapper around the dev harness so the Review imports
 * panel can seed the same two demo rows _devRunBankImportSample()
 * produces without forcing the user into the Apps Script editor. Kept
 * deliberately tiny: this function does NOTHING the underscore-prefixed
 * harness does not already do — it only exists to be a clearly-named,
 * non-underscore callable surface for google.script.run.
 *
 * Pending-rows-do-not-count is preserved because the harness routes
 * everything through processBankImportBatch_, which is the same code
 * path Step 2a uses. No new sample-data path was introduced.
 * ------------------------------------------------------------------------- */

function devRunBankImportSampleFromDashboard() {
  return _devRunBankImportSample();
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
