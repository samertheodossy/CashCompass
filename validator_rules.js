/**
 * validator_rules.js — the Validator's CANONICAL MODEL (READ-ONLY).
 *
 * Part of Validator Phase 2 (Workbook Health). See VALIDATOR_ARCHITECTURE.md
 * §10 (Phase 2 architecture) and §10.0 (the canonical model). This file describes
 * "what a correctly provisioned workbook should contain" as data, so the
 * single-workbook checks in validator_provisioning.js can compare a live workbook
 * against it.
 *
 * SOURCE-OF-TRUTH RULE (non-negotiable, VALIDATOR_ARCHITECTURE.md §10.0):
 *   The model REFERENCES the same production constants provisioning uses — it must
 *   never COPY them. To make that safe against Apps Script file load order (const
 *   temporal-dead-zone), the model is built INSIDE getValidatorCanonicalModel_()
 *   and reads the live globals at CALL TIME (when every file is loaded), e.g.:
 *     - sheet names ....... getSheetNames_() / PROFILE_SETTINGS_SHEET_NAME_ /
 *                           ACTIVITY_LOG_SHEET_NAME / DONATION_SHEET_NAME_ /
 *                           getCashFlowSheetName_(year)
 *     - required headers .. ACTIVITY_LOG_HEADERS, DONATION_REQUIRED_HEADERS_,
 *                           PROFILE_SETTINGS_REQUIRED_HEADERS_,
 *                           CASH_FLOW_REQUIRED_HEADERS_ (leading structural cols),
 *                           SYS_ACCOUNTS_REQUIRED_HEADERS_,
 *                           UPCOMING_EXPENSES_REQUIRED_HEADERS_
 *     - canonical widths .. *_CANONICAL_WIDTHS_ (Upcoming Expenses, Cash Flow,
 *                           SYS Accounts, Donation, Activity Log)
 *
 * What is DECLARED here (not a copy of any existing named symbol):
 *   - the required/expected/optional PRESENCE classification per sheet,
 *   - frozen-row/column expectations (there is no shared frozen-pane constant to
 *     reference today; these literals are centralized here for the first time), and
 *   - the hidden SYS - Meta support sheet: its expected hidden state plus its
 *     identity-marker KEY labels (the labels are DERIVED from the production
 *     stamp helper buildWorkbookAppProperties_, not copied; values are never read).
 *   Where a sheet's headers/widths are not yet a shared constant, that attribute
 *   is left NULL and the corresponding check is skipped (never guessed). The
 *   Phase 2A header-constant extraction is complete for INPUT - Settings,
 *   INPUT - Cash Flow, SYS - Accounts, and INPUT - Upcoming Expenses (all now
 *   referenced above). Still NULL / future work: INPUT - Bank Accounts headers,
 *   and canonical width constants for INPUT - Settings and INPUT - Bank Accounts.
 *
 * READ-ONLY: this file defines data + a pure builder. It performs no I/O and
 * never writes to a workbook.
 */

/**
 * Presence classes for a canonical sheet:
 *   'required' — must exist in any provisioned workbook (missing → ERROR / FAIL).
 *   'expected' — canonical core, but may be first-created lazily as the user
 *                progresses through Setup/Review (missing → WARN).
 *   'optional' — module/feature-conditional (missing → INFO).
 */
var VALIDATOR_PRESENCE_REQUIRED_ = 'required';
var VALIDATOR_PRESENCE_EXPECTED_ = 'expected';
var VALIDATOR_PRESENCE_OPTIONAL_ = 'optional';

/**
 * Build the canonical model at call time so it references live production
 * constants rather than copying them. Returns an array of sheet-rule objects:
 *
 *   {
 *     name:          {string}   canonical sheet name,
 *     presence:      {string}   VALIDATOR_PRESENCE_*,
 *     headerRow:     {number}   1-based row holding the column headers,
 *     headers:       {string[]|null}  required header list (referenced constant)
 *                                     or null when not yet centralized (skip),
 *     widths:        {Object|null}    header→px canonical widths (referenced
 *                                     constant) or null (skip),
 *     frozenRows:    {number|null}    expected frozen rows or null (skip),
 *     frozenColumns: {number|null}    expected frozen columns or null (skip),
 *     hidden:        {boolean=}       expected sheet-hidden state; omit/null to
 *                                     skip (only asserted where canonical, e.g.
 *                                     the hidden SYS - Meta marker sheet),
 *     markerKeys:    {string[]=}      required column-A key labels for a key/value
 *                                     marker sheet (keys only — never values);
 *                                     omit/null to skip
 *   }
 *
 * @returns {Array<Object>}
 */
function getValidatorCanonicalModel_() {
  var year = (new Date()).getFullYear();

  // Sheet-name sources (referenced, not copied). Guarded so a future rename can
  // never make the model throw during construction.
  var names = (typeof getSheetNames_ === 'function') ? getSheetNames_() : {};
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var activityName = (typeof ACTIVITY_LOG_SHEET_NAME === 'string') ? ACTIVITY_LOG_SHEET_NAME : 'LOG - Activity';
  var donationName = (typeof DONATION_SHEET_NAME_ === 'string') ? DONATION_SHEET_NAME_ : 'INPUT - Donation';
  var cashFlowName = (typeof getCashFlowSheetName_ === 'function')
    ? getCashFlowSheetName_(year)
    : ('INPUT - Cash Flow ' + year);

  // Header + width constants (referenced, not copied).
  var activityHeaders = (typeof ACTIVITY_LOG_HEADERS !== 'undefined') ? ACTIVITY_LOG_HEADERS : null;
  var donationHeaders = (typeof DONATION_REQUIRED_HEADERS_ !== 'undefined') ? DONATION_REQUIRED_HEADERS_ : null;
  var settingsHeaders = (typeof PROFILE_SETTINGS_REQUIRED_HEADERS_ !== 'undefined') ? PROFILE_SETTINGS_REQUIRED_HEADERS_ : null;
  var cashFlowHeaders = (typeof CASH_FLOW_REQUIRED_HEADERS_ !== 'undefined') ? CASH_FLOW_REQUIRED_HEADERS_ : null;
  var sysAccountsHeaders = (typeof SYS_ACCOUNTS_REQUIRED_HEADERS_ !== 'undefined') ? SYS_ACCOUNTS_REQUIRED_HEADERS_ : null;
  var upcomingHeaders = (typeof UPCOMING_EXPENSES_REQUIRED_HEADERS_ !== 'undefined') ? UPCOMING_EXPENSES_REQUIRED_HEADERS_ : null;

  var upcomingWidths = (typeof UPCOMING_EXPENSES_CANONICAL_WIDTHS_ !== 'undefined') ? UPCOMING_EXPENSES_CANONICAL_WIDTHS_ : null;

  // Canonical identity-marker key labels for the hidden SYS - Meta sheet, derived
  // from the SAME production definition that stamps them
  // (buildWorkbookAppProperties_, central_diagnostics.js) — no duplication. Pure
  // (no I/O); a dummy email is required only so the function returns its shape.
  // Only the KEY labels (column A) are ever checked — never the values (column B
  // holds an email hash), so no sensitive data is read or logged.
  var metaMarkerKeys = null;
  try {
    if (typeof buildWorkbookAppProperties_ === 'function') {
      metaMarkerKeys = Object.keys(
        buildWorkbookAppProperties_('validator-model@cashcompass.local', '1970-01-01T00:00:00Z'));
    }
  } catch (_metaErr) {
    metaMarkerKeys = null;
  }
  var cashFlowWidths = (typeof CASH_FLOW_CANONICAL_WIDTHS_ !== 'undefined') ? CASH_FLOW_CANONICAL_WIDTHS_ : null;
  var sysAccountsWidths = (typeof SYS_ACCOUNTS_CANONICAL_WIDTHS_ !== 'undefined') ? SYS_ACCOUNTS_CANONICAL_WIDTHS_ : null;
  var donationWidths = (typeof DONATION_CANONICAL_WIDTHS_ !== 'undefined') ? DONATION_CANONICAL_WIDTHS_ : null;
  var activityWidths = (typeof ACTIVITY_LOG_CANONICAL_WIDTHS_ !== 'undefined') ? ACTIVITY_LOG_CANONICAL_WIDTHS_ : null;

  return [
    // INPUT - Settings — the one sheet the minimal Central bootstrap always
    // creates (central_provisioning.js runMinimalBootstrap_ → ensureInputSettingsSheet_).
    {
      name: settingsName,
      presence: VALIDATOR_PRESENCE_REQUIRED_,
      headerRow: 1,
      headers: settingsHeaders,   // PROFILE_SETTINGS_REQUIRED_HEADERS_ (referenced)
      widths: null,           // Settings widths are inline literals (Key 240 / Value 385) — extract before checking
      frozenRows: 1,          // ensureInputSettingsSheet_ sets setFrozenRows(1)
      frozenColumns: 0
    },

    // LOG - Activity — created on first dashboard/bill load.
    {
      name: activityName,
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: 1,
      headers: activityHeaders,   // ACTIVITY_LOG_HEADERS (referenced)
      widths: activityWidths,     // ACTIVITY_LOG_CANONICAL_WIDTHS_ (referenced)
      frozenRows: 1,              // ensureActivityLogSheet_ sets setFrozenRows(1)
      frozenColumns: 0
    },

    // INPUT - Cash Flow <currentYear> — clone-from-previous-year; may be absent
    // on a fresh workbook (no canonical from-scratch creator), hence 'expected'.
    {
      name: cashFlowName,
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: 1,
      headers: cashFlowHeaders, // CASH_FLOW_REQUIRED_HEADERS_ (leading structural columns; months + Total are dynamic/positional)
      widths: cashFlowWidths, // CASH_FLOW_CANONICAL_WIDTHS_ (referenced)
      frozenRows: 1,          // applyCashFlowSheetStyling_ / clone set setFrozenRows(1)
      frozenColumns: 0
    },

    // SYS - Accounts
    {
      name: (names && names.ACCOUNTS) ? names.ACCOUNTS : 'SYS - Accounts',
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: 1,
      headers: sysAccountsHeaders, // SYS_ACCOUNTS_REQUIRED_HEADERS_ (referenced)
      widths: sysAccountsWidths, // SYS_ACCOUNTS_CANONICAL_WIDTHS_ (referenced)
      frozenRows: 1,             // applySysSheetBaseStyle_ sets setFrozenRows(1)
      frozenColumns: 1           // SYS - Accounts freezes column 1 (KeepCentral per SYS convergence)
    },

    // INPUT - Bank Accounts (presence only for now — no shared header/width constant)
    {
      name: (names && names.BANK_ACCOUNTS) ? names.BANK_ACCOUNTS : 'INPUT - Bank Accounts',
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: null,
      headers: null,
      widths: null,
      frozenRows: null,
      frozenColumns: null
    },

    // INPUT - Upcoming Expenses
    {
      name: 'INPUT - Upcoming Expenses',
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: 1,
      headers: upcomingHeaders, // UPCOMING_EXPENSES_REQUIRED_HEADERS_ (referenced)
      widths: upcomingWidths,   // UPCOMING_EXPENSES_CANONICAL_WIDTHS_ (referenced)
      frozenRows: 1,            // getOrCreateUpcomingExpensesSheet_ sets setFrozenRows(1)
      frozenColumns: 0
    },

    // INPUT - Donation — year-block sheet (header on row 2), module/feature sheet.
    {
      name: donationName,
      presence: VALIDATOR_PRESENCE_OPTIONAL_,
      headerRow: 2,
      headers: donationHeaders, // DONATION_REQUIRED_HEADERS_ (referenced)
      widths: donationWidths,   // DONATION_CANONICAL_WIDTHS_ (referenced)
      frozenRows: 2,            // applyDonationSheetStyling_ freezeRows: 2
      frozenColumns: 1          // applyDonationSheetStyling_ freezeColumns: 1
    },

    // SYS - Meta — the hidden Central identity/version marker sheet stamped during
    // provisioning (ensureWorkbookIdentityMarkers_). 'expected' (not required) so
    // bound / pre-marker beta workbooks that haven't been re-opened only WARN.
    // Value cells (column B, which holds an email hash) are never read — only the
    // marker KEY labels in column A are checked.
    {
      name: (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta',
      presence: VALIDATOR_PRESENCE_EXPECTED_,
      headerRow: null,          // key/value sheet — no column-header row
      headers: null,
      widths: null,
      frozenRows: null,
      frozenColumns: null,
      hidden: true,             // ensureWorkbookIdentityMarkers_ calls hideSheet()
      markerKeys: metaMarkerKeys // column-A identity-marker labels (keys only)
    }
  ];
}
