/**
 * CashCompass Validator — core orchestrator + guard (READ-ONLY).
 *
 * This is the first module of the long-term Validator subsystem
 * (see VALIDATOR_ARCHITECTURE.md). It exposes ONE guarded public entry point:
 *
 *     validateGoldenParityReport(options)
 *
 * which snapshots two workbooks by ID (read-only) and reports the formatting
 * differences grouped by design family. It is DISABLED BY DEFAULT and
 * ADMIN-GATED, is never wired into any runtime/provisioning flow, installs no
 * triggers, and never writes to a workbook.
 *
 * Run it MANUALLY from the Apps Script editor (see "How to run" in
 * VALIDATOR_ARCHITECTURE.md / this file's docs). All other Validator functions
 * are internal (trailing underscore).
 */

/** Script-property key that must equal the literal "true" to enable the Validator. */
var VALIDATOR_ENABLED_KEY_ = 'VALIDATOR_ENABLED';

/**
 * Script-property keys for the developer runners (§ "Developer runners" below).
 * Centralized here so property names live in exactly one place.
 *   - VALIDATOR_GOLDEN_WORKBOOK_ID          the reference / Golden workbook ID.
 *   - VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID  optional default Central workbook to
 *                                            compare when no override is passed.
 */
var VALIDATOR_GOLDEN_WORKBOOK_ID_KEY_ = 'VALIDATOR_GOLDEN_WORKBOOK_ID';
var VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID_KEY_ = 'VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID';

/**
 * Returns true only when the VALIDATOR_ENABLED script property is the literal
 * string "true". Any other value (including unset) returns false. Fail-closed;
 * never throws. Mirrors isCentralModeEnabled_ / isAdminRepairEnabled_.
 */
function isValidatorEnabled_() {
  try {
    return PropertiesService.getScriptProperties().getProperty(VALIDATOR_ENABLED_KEY_) === 'true';
  } catch (_e) {
    return false;
  }
}

/**
 * Guard for every Validator entry point. Throws unless BOTH:
 *   1. VALIDATOR_ENABLED === "true"  (feature flag, default off), and
 *   2. the caller is an admin        (isAdminUser_ from central_diagnostics.js).
 * The messages leak nothing beyond the enable/permission distinction.
 */
function assertValidatorAllowed_() {
  if (!isValidatorEnabled_()) {
    throw new Error('Validator is disabled. Set script property VALIDATOR_ENABLED="true" to enable.');
  }
  if (!isAdminUser_()) {
    throw new Error('Admin access required.');
  }
}

/**
 * PUBLIC (guarded) — snapshot two workbooks by ID and report their formatting
 * differences grouped by design family. Read-only. Values are redacted by
 * default (opt out with redactValues:false).
 *
 * @param {Object} options
 *   - {string}  goldenSpreadsheetId   reference / Golden workbook ID  (required)
 *   - {string}  centralSpreadsheetId  Central-generated workbook ID   (required)
 *   - {boolean} redactValues          default TRUE — log shape tokens, not values
 *   - {string}  outputMode            'log' (default) | 'json' | 'both'
 *   - {Object}  snapshotOptions       extra options for the snapshotter
 *                                      (rowCap, colCap, sheetFilter, sheetNames,
 *                                       allSheets, includeHidden)
 * @returns {Object} the structured comparison report
 */
function validateGoldenParityReport(options) {
  assertValidatorAllowed_();

  options = options || {};
  if (!options.goldenSpreadsheetId || !options.centralSpreadsheetId) {
    throw new Error('validateGoldenParityReport: goldenSpreadsheetId and centralSpreadsheetId are required.');
  }

  var outputMode = options.outputMode || 'log';

  // redactValues DEFAULTS TO TRUE (only false when explicitly set to false).
  var redact = options.redactValues !== false;

  var snapOpts = {};
  var base = options.snapshotOptions || {};
  for (var k in base) if (base.hasOwnProperty(k)) snapOpts[k] = base[k];
  snapOpts.redactValues = redact;

  var golden = validatorSnapshotById_(options.goldenSpreadsheetId, snapOpts);
  var central = validatorSnapshotById_(options.centralSpreadsheetId, snapOpts);

  var report = validatorCompareSnapshots_(golden, central);

  if (outputMode === 'json' || outputMode === 'both') {
    validatorLogChunked_('CONVERGENCE REPORT (JSON)', JSON.stringify(report, null, 2));
  }
  if (outputMode === 'log' || outputMode === 'both') {
    validatorLogComparisonReport_(report);
  }
  return report;
}

/* -------------------------------------------------------------------------- */
/*  Script-property accessors (centralized; fail-closed with clear errors)     */
/* -------------------------------------------------------------------------- */

/**
 * Returns the Golden / reference workbook ID from the
 * VALIDATOR_GOLDEN_WORKBOOK_ID script property. Throws a clear error if unset so
 * a developer knows exactly what to configure. Read-only.
 * @returns {string}
 */
function getValidatorGoldenWorkbookId_() {
  var id;
  try {
    id = String(PropertiesService.getScriptProperties().getProperty(VALIDATOR_GOLDEN_WORKBOOK_ID_KEY_) || '').trim();
  } catch (_e) {
    id = '';
  }
  if (!id) {
    throw new Error('Set the script property ' + VALIDATOR_GOLDEN_WORKBOOK_ID_KEY_ +
      ' to the Golden (reference) workbook spreadsheet ID.');
  }
  return id;
}

/**
 * Returns the optional default Central workbook ID from the
 * VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID script property. Throws a clear error if
 * unset AND no override was supplied to the runner. Read-only.
 * @returns {string}
 */
function getValidatorDefaultCentralWorkbookId_() {
  var id;
  try {
    id = String(PropertiesService.getScriptProperties().getProperty(VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID_KEY_) || '').trim();
  } catch (_e) {
    id = '';
  }
  if (!id) {
    throw new Error('Set the script property ' + VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID_KEY_ +
      ' to a default Central workbook ID, or pass a centralSpreadsheetId override to the runner.');
  }
  return id;
}

/* -------------------------------------------------------------------------- */
/*  Developer runners — run directly from the Apps Script editor               */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/*  These are permanent, internal (trailing-underscore) entry points that     */
/*  take NO required arguments, so they can be selected and Run from the       */
/*  editor without any temporary wrapper file. They read workbook IDs from     */
/*  Script Properties (never hardcoded) and delegate to the guarded public     */
/*  entry points, so the VALIDATOR_ENABLED + admin guard still applies.        */
/*                                                                            */
/*  Future runners fit the same shape, e.g.:                                   */
/*    - validatorRunWorkbookValidation_()   (single-workbook, rules-based)     */
/*    - validatorRunSchemaValidation_()                                        */
/*  Each: read config from properties → call a guarded validate* entry point.  */
/* -------------------------------------------------------------------------- */

/**
 * DEVELOPER RUNNER — Golden Workbook parity comparison.
 *
 * Reads the Golden workbook ID from VALIDATOR_GOLDEN_WORKBOOK_ID and the Central
 * workbook ID from VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID (or the optional
 * override argument), then runs validateGoldenParityReport with the developer
 * defaults (redactValues = true, outputMode = 'log').
 *
 * Remains admin-gated + flag-gated: it calls validateGoldenParityReport, which
 * calls assertValidatorAllowed_() first. Read-only.
 *
 * Run it from the editor: select `validatorRunGoldenParity_` and click Run.
 *
 * @param {string=} centralSpreadsheetIdOverride Optional Central workbook ID to
 *   compare instead of VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID.
 * @returns {Object} the structured comparison report
 */
function validatorRunGoldenParity_(centralSpreadsheetIdOverride) {
  var goldenId = getValidatorGoldenWorkbookId_();
  var centralId = (centralSpreadsheetIdOverride && String(centralSpreadsheetIdOverride).trim())
    ? String(centralSpreadsheetIdOverride).trim()
    : getValidatorDefaultCentralWorkbookId_();

  return validateGoldenParityReport({
    goldenSpreadsheetId: goldenId,
    centralSpreadsheetId: centralId,
    redactValues: true,
    outputMode: 'log'
  });
}

/**
 * PUBLIC EDITOR SHIM — exists solely so the Apps Script editor's Run dropdown
 * can execute the guarded runner (some editor versions hide trailing-underscore
 * functions from the dropdown). It takes no arguments and simply delegates to
 * validatorRunGoldenParity_(), so the full guard path still applies
 * (validateGoldenParityReport → assertValidatorAllowed_: VALIDATOR_ENABLED + admin).
 *
 * NOT an API surface: do not call from runtime code, client HTML, menus, or
 * doGet. It is a manual developer convenience only.
 *
 * @returns {Object} the structured comparison report
 */
function validatorRunGoldenParity() {
  return validatorRunGoldenParity_();
}

/* -------------------------------------------------------------------------- */
/*  Scoped developer runners — one design family at a time                     */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/*  The full validatorRunGoldenParity() scans every INPUT/SYS/OUT/HOUSES/LOG   */
/*  sheet in BOTH workbooks and can approach the 6-minute execution limit on   */
/*  a mature Golden workbook. These scoped runners pass snapshotOptions.       */
/*  sheetNames so only the family's convergence-priority sheets are scanned    */
/*  (present in both workbooks), keeping each run fast and timeout-safe.       */
/*                                                                            */
/*  All four are PUBLIC (no trailing underscore) so they appear in the Apps    */
/*  Script editor Run dropdown. Each takes NO arguments, reads workbook IDs    */
/*  from Script Properties, and delegates to the guarded public entry point    */
/*  validateGoldenParityReport (VALIDATOR_ENABLED + admin still enforced).     */
/*  Read-only; redactValues = true; outputMode = 'log'.                        */
/* -------------------------------------------------------------------------- */

/** Convergence-priority sheets per family (present in BOTH workbooks). */
var VALIDATOR_SCOPE_FINANCIAL_LEDGER_ = ['INPUT - Bank Accounts', 'INPUT - Cash Flow 2026'];
var VALIDATOR_SCOPE_OPERATIONAL_ = ['INPUT - Upcoming Expenses', 'LOG - Activity'];
var VALIDATOR_SCOPE_SYS_ = ['SYS - Accounts'];
var VALIDATOR_SCOPE_SPECIAL_ = ['INPUT - Settings', 'INPUT - Donation'];

/**
 * Internal — run a Golden parity comparison scoped to an explicit set of exact
 * sheet names. Reads Golden + default Central IDs from Script Properties and
 * limits BOTH snapshots to `sheetNames` (validatorIncludesSheet_ honors
 * snapshotOptions.sheetNames as an exact-name allow-list). Read-only.
 *
 * @param {string[]} sheetNames exact sheet names to scan in both workbooks
 * @returns {Object} the structured comparison report
 */
function validatorRunGoldenParityScoped_(sheetNames) {
  var goldenId = getValidatorGoldenWorkbookId_();
  var centralId = getValidatorDefaultCentralWorkbookId_();
  return validateGoldenParityReport({
    goldenSpreadsheetId: goldenId,
    centralSpreadsheetId: centralId,
    redactValues: true,
    outputMode: 'log',
    snapshotOptions: { sheetNames: sheetNames }
  });
}

/** DEVELOPER RUNNER — Financial Ledger scope (Bank Accounts, Cash Flow 2026). */
function validatorRunGoldenParityFinancialLedger() {
  return validatorRunGoldenParityScoped_(VALIDATOR_SCOPE_FINANCIAL_LEDGER_);
}

/** DEVELOPER RUNNER — Operational scope (Upcoming Expenses, LOG - Activity). */
function validatorRunGoldenParityOperational() {
  return validatorRunGoldenParityScoped_(VALIDATOR_SCOPE_OPERATIONAL_);
}

/** DEVELOPER RUNNER — SYS scope (SYS - Accounts). */
function validatorRunGoldenParitySys() {
  return validatorRunGoldenParityScoped_(VALIDATOR_SCOPE_SYS_);
}

/** DEVELOPER RUNNER — Special scope (INPUT - Settings, INPUT - Donation). */
function validatorRunGoldenParitySpecial() {
  return validatorRunGoldenParityScoped_(VALIDATOR_SCOPE_SPECIAL_);
}
