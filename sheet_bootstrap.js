/**
 * Zero-sheet onboarding — centralized bootstrap foundation.
 *
 * Purpose
 *   First-run users should be able to open a nearly blank workbook and
 *   have the required input sheets materialize safely as they progress
 *   through Setup / Review. This module is the single, well-defined
 *   entry point for that.
 *
 * Design contract (non-negotiable safety guarantees)
 *   - Normal mode only. Test-mode bootstrap remains owned by
 *     ensureOnboardingTestSheetsFromDashboard in onboarding.js.
 *   - NEVER deletes a sheet.
 *   - NEVER renames an existing sheet.
 *   - NEVER replaces or clears an existing sheet.
 *   - NEVER rewrites headers on a sheet that already has user data.
 *   - Only creates a sheet if it is truly missing.
 *   - Creators are the existing canonical helpers living next to each
 *     entity's domain module. This registry never duplicates their
 *     schema; it merely delegates. If a sheet has no canonical safe
 *     creator, the registry reports `unsupported: true` and the caller
 *     must treat the missing sheet as a blocker rather than guess.
 *   - Idempotent and rerunnable: a sheet that already exists is a
 *     no-op and returns `ok: true, created: false`.
 *
 * Relationship to existing helpers
 *   Per-entity safeguards already exist and are deliberately kept:
 *     - ensureInputSettingsSheet_               (profile.js)
 *     - ensureOnboardingBankAccountsSheetFromDashboard  (onboarding.js)
 *     - ensureOnboardingDebtsSheetFromDashboard         (onboarding.js)
 *     - ensureOnboardingBillsSheetFromDashboard         (onboarding.js)
 *     - ensureOnboardingUpcomingSheetFromDashboard      (onboarding.js,
 *       itself delegating to getOrCreateUpcomingExpensesSheet_)
 *   The client already calls the per-entity ensures directly when
 *   handing off to an editor. This module adds a coarse-grained
 *   "ensure all core first-run sheets" entry point for future
 *   progressive rollout, without changing the existing per-entity
 *   behavior or surface area.
 *
 * Known blocker
 *   INPUT - Cash Flow <year> has no canonical from-scratch creator in
 *   the codebase today. `createNextYearCashFlowSheet` in cashflow_setup
 *   is clone-from-previous-year only. The registry intentionally
 *   surfaces this as `unsupported` so callers can report it clearly
 *   instead of writing a guessed layout that would drift from the
 *   real schema.
 */

/* -------------------------------------------------------------------------- */
/*  Registry                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Canonical keys the bootstrap foundation knows about. Using string
 * constants (not the existing ONBOARDING_LIVE_SHEET_NAMES_ keys) so
 * this layer is independent of onboarding.js internals and can be
 * extended without broadening onboarding's jurisdiction.
 */
var BOOTSTRAP_KEY_SETTINGS_ = 'SETTINGS';
var BOOTSTRAP_KEY_BANK_ACCOUNTS_ = 'BANK_ACCOUNTS';
var BOOTSTRAP_KEY_DEBTS_ = 'DEBTS';
var BOOTSTRAP_KEY_BILLS_ = 'BILLS';
var BOOTSTRAP_KEY_UPCOMING_ = 'UPCOMING';
var BOOTSTRAP_KEY_CASH_FLOW_YEAR_ = 'CASH_FLOW_YEAR';

/**
 * The core first-run key set. Cash Flow is included so callers can see
 * that it exists in the contract, but it will always report
 * `unsupported: true` until a safe canonical creator lands.
 */
var BOOTSTRAP_CORE_KEYS_ = [
  BOOTSTRAP_KEY_SETTINGS_,
  BOOTSTRAP_KEY_BANK_ACCOUNTS_,
  BOOTSTRAP_KEY_DEBTS_,
  BOOTSTRAP_KEY_BILLS_,
  BOOTSTRAP_KEY_UPCOMING_,
  BOOTSTRAP_KEY_CASH_FLOW_YEAR_
];

/**
 * Build the bootstrap registry fresh on every call. Returning a fresh
 * object avoids any risk of a cached closure holding stale references
 * to the delegated creator functions if the script is reloaded between
 * invocations.
 *
 * Each entry:
 *   - required:   boolean — is this sheet needed for first-run flow
 *   - resolveName: () => string  canonical sheet name (may throw)
 *   - supported:  boolean  true if a safe canonical creator exists
 *   - creator:    (mode) => {ok, created, reason?} | undefined
 *                 Called only when the sheet is missing and supported.
 *   - blockerReason: string  why a missing sheet cannot be auto-created
 */
function getBootstrapSheetRegistry_() {
  var registry = {};

  registry[BOOTSTRAP_KEY_SETTINGS_] = {
    required: true,
    resolveName: function() {
      // PROFILE_SETTINGS_SHEET_NAME_ lives in profile.js. Using a string
      // fallback here guards against load order surprises, but in the
      // deployed environment the constant is always defined.
      return (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string'
        && PROFILE_SETTINGS_SHEET_NAME_)
        ? PROFILE_SETTINGS_SHEET_NAME_
        : 'INPUT - Settings';
    },
    supported: typeof ensureInputSettingsSheet_ === 'function',
    creator: function(_mode) {
      ensureInputSettingsSheet_();
      return { ok: true, created: true };
    },
    blockerReason: 'Settings safe-creator ensureInputSettingsSheet_ is not available.'
  };

  registry[BOOTSTRAP_KEY_BANK_ACCOUNTS_] = {
    required: true,
    resolveName: function() {
      return resolveOnboardingSheetName_('normal', 'BANK_ACCOUNTS');
    },
    supported: typeof ensureOnboardingBankAccountsSheetFromDashboard === 'function',
    creator: function(mode) {
      return ensureOnboardingBankAccountsSheetFromDashboard(mode);
    },
    blockerReason: 'Bank Accounts safe-creator ensureOnboardingBankAccountsSheetFromDashboard is not available.'
  };

  registry[BOOTSTRAP_KEY_DEBTS_] = {
    required: true,
    resolveName: function() {
      return resolveOnboardingSheetName_('normal', 'DEBTS');
    },
    supported: typeof ensureOnboardingDebtsSheetFromDashboard === 'function',
    creator: function(mode) {
      return ensureOnboardingDebtsSheetFromDashboard(mode);
    },
    blockerReason: 'Debts safe-creator ensureOnboardingDebtsSheetFromDashboard is not available.'
  };

  registry[BOOTSTRAP_KEY_BILLS_] = {
    required: true,
    resolveName: function() {
      return resolveOnboardingSheetName_('normal', 'BILLS');
    },
    supported: typeof ensureOnboardingBillsSheetFromDashboard === 'function',
    creator: function(mode) {
      return ensureOnboardingBillsSheetFromDashboard(mode);
    },
    blockerReason: 'Bills safe-creator ensureOnboardingBillsSheetFromDashboard is not available.'
  };

  registry[BOOTSTRAP_KEY_UPCOMING_] = {
    required: true,
    resolveName: function() {
      return resolveOnboardingSheetName_('normal', 'UPCOMING');
    },
    supported: typeof ensureOnboardingUpcomingSheetFromDashboard === 'function',
    creator: function(mode) {
      return ensureOnboardingUpcomingSheetFromDashboard(mode);
    },
    blockerReason: 'Upcoming Expenses safe-creator ensureOnboardingUpcomingSheetFromDashboard is not available.'
  };

  registry[BOOTSTRAP_KEY_CASH_FLOW_YEAR_] = {
    required: true,
    resolveName: function() {
      // getCurrentYear_() and resolveOnboardingSheetName_ both live in
      // onboarding.js / planner_helpers.js; fall back to a literal if
      // they're unavailable at load time.
      var year = (typeof getCurrentYear_ === 'function')
        ? getCurrentYear_()
        : new Date().getFullYear();
      return resolveOnboardingSheetName_('normal', 'CASH_FLOW_PREFIX', year);
    },
    // Safe canonical from-scratch creator landed in cashflow_setup.js.
    // ensureOnboardingCashFlowYearSheetFromDashboard is a thin wrapper
    // around ensureCashFlowYearSheet_ that keeps the same {ok, created,
    // sheetName, mode, reason?} shape as the other bootstrap creators.
    supported: typeof ensureOnboardingCashFlowYearSheetFromDashboard === 'function',
    creator: function(mode) {
      return ensureOnboardingCashFlowYearSheetFromDashboard(mode);
    },
    blockerReason:
      'Cash Flow year safe-creator ensureOnboardingCashFlowYearSheet' +
      'FromDashboard is not available.'
  };

  return registry;
}

/* -------------------------------------------------------------------------- */
/*  Single-sheet resolver                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ensure a single bootstrap sheet exists. Pure inspection + create.
 * Never clears, never overwrites. Returns a stable shape:
 *
 *   {
 *     ok: boolean,
 *     created: boolean,        true only if this call created the sheet
 *     key: string,             the registry key
 *     sheetName: string,       canonical resolved name (empty if unknown)
 *     mode: 'normal' | 'test',
 *     unsupported?: boolean,   true when no safe canonical creator exists
 *     reason?: string          diagnostic on failure / unsupported
 *   }
 */
function ensureBootstrapSheet_(key, mode) {
  // Test mode routes through a dedicated helper. This module stays
  // strictly normal-mode to prevent accidental cross-contamination.
  var m;
  if (typeof normalizeOnboardingMode_ === 'function') {
    m = normalizeOnboardingMode_(mode);
  } else {
    m = (String(mode || '').toLowerCase() === 'test') ? 'test' : 'normal';
  }
  if (m === 'test') {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: '',
      mode: m,
      reason: 'Bootstrap foundation is normal-mode only. Use ensureOnboardingTestSheetsFromDashboard for test sheets.'
    };
  }

  var registry = getBootstrapSheetRegistry_();
  var entry = registry[key];
  if (!entry) {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: '',
      mode: m,
      reason: 'Unknown bootstrap key: ' + String(key)
    };
  }

  var sheetName = '';
  try {
    sheetName = entry.resolveName();
  } catch (e) {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: '',
      mode: m,
      reason: 'Could not resolve sheet name: ' + (e && e.message ? e.message : e)
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(sheetName)) {
    // Sheet already exists — hands-off no-op. This is the load-bearing
    // safety guarantee: existing users get zero side effects.
    return { ok: true, created: false, key: key, sheetName: sheetName, mode: m };
  }

  if (!entry.supported || typeof entry.creator !== 'function') {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: sheetName,
      mode: m,
      unsupported: true,
      reason: entry.blockerReason
        || ('No safe canonical creator for ' + sheetName + '.')
    };
  }

  var result;
  try {
    result = entry.creator(m) || {};
  } catch (e) {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: sheetName,
      mode: m,
      reason: 'Safe creator threw: ' + (e && e.message ? e.message : e)
    };
  }

  if (result.ok === false) {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: sheetName,
      mode: m,
      reason: result.reason || 'Safe creator reported failure.'
    };
  }

  // Verify the sheet materialized. Defense in depth in case a creator
  // returned ok but silently no-oped on an unexpected edge case.
  var finalExists = !!ss.getSheetByName(sheetName);
  if (!finalExists) {
    return {
      ok: false,
      created: false,
      key: key,
      sheetName: sheetName,
      mode: m,
      reason: 'Safe creator returned ok but sheet is still missing.'
    };
  }

  return {
    ok: true,
    created: (result.created !== false),
    key: key,
    sheetName: sheetName,
    mode: m
  };
}

/* -------------------------------------------------------------------------- */
/*  Core bulk resolver                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Ensure every first-run required sheet that has a safe canonical
 * creator exists. Normal mode only. Sheets that are already present
 * are reported under `existed` untouched. Sheets with no safe creator
 * (currently only INPUT - Cash Flow <year>) are reported under
 * `unsupported` so the caller can surface them as a blocker rather
 * than silently fabricate a schema.
 *
 * This entry point exists so a future Setup / Review page load can
 * invoke it once to bootstrap a nearly blank workbook. It is NOT
 * auto-wired anywhere today — existing behavior is unchanged for all
 * populated workbooks. The client must call it explicitly when it is
 * ready to roll out zero-sheet onboarding.
 *
 * Shape:
 *   {
 *     ok: boolean,                    true if no outright failures
 *     mode: 'normal',
 *     created:    [{ key, sheetName }],
 *     existed:    [{ key, sheetName }],
 *     unsupported:[{ key, sheetName, reason }],
 *     failed:     [{ key, sheetName, reason }]
 *   }
 */
function ensureOnboardingCoreSheetsFromDashboard(mode) {
  var m = (typeof normalizeOnboardingMode_ === 'function')
    ? normalizeOnboardingMode_(mode)
    : ((String(mode || '').toLowerCase() === 'test') ? 'test' : 'normal');

  if (m === 'test') {
    return {
      ok: false,
      mode: m,
      created: [],
      existed: [],
      unsupported: [],
      failed: [],
      reason: 'Test mode uses ensureOnboardingTestSheetsFromDashboard.'
    };
  }

  var created = [];
  var existed = [];
  var unsupported = [];
  var failed = [];

  for (var i = 0; i < BOOTSTRAP_CORE_KEYS_.length; i++) {
    var key = BOOTSTRAP_CORE_KEYS_[i];
    var r = ensureBootstrapSheet_(key, 'normal');

    if (r.unsupported) {
      unsupported.push({
        key: key,
        sheetName: r.sheetName,
        reason: r.reason || ''
      });
      continue;
    }

    if (r.ok && r.created) {
      created.push({ key: key, sheetName: r.sheetName });
      continue;
    }

    if (r.ok && !r.created) {
      existed.push({ key: key, sheetName: r.sheetName });
      continue;
    }

    failed.push({
      key: key,
      sheetName: r.sheetName,
      reason: r.reason || 'Unknown failure.'
    });
  }

  return {
    ok: failed.length === 0,
    mode: 'normal',
    created: created,
    existed: existed,
    unsupported: unsupported,
    failed: failed
  };
}

/**
 * Small read-only probe for diagnostics / future UI. Returns the
 * bootstrap status of every core sheet without creating anything.
 *
 * Shape:
 *   {
 *     mode: 'normal',
 *     sheets: [{ key, sheetName, exists, supported, blockerReason? }]
 *   }
 */
function getOnboardingBootstrapStatusFromDashboard() {
  // Central App seam: resolve the caller's own workbook. getUserSpreadsheet_()
  // returns SpreadsheetApp.getActiveSpreadsheet() in bound mode (byte-for-byte
  // unchanged behavior) and the user's provisioned workbook in central mode.
  // Calling getActiveSpreadsheet() directly here returned null in a standalone
  // Central deployment, which made the ss.getSheetByName(...) below throw
  // "Cannot read properties of null (reading 'getSheetByName')".
  var ss = getUserSpreadsheet_();
  if (!ss) {
    // Fail with a clear, explicit message rather than a null dereference.
    // getStartupRoutingFromDashboard()'s catch turns this into a clean
    // ok:false result instead of an opaque TypeError.
    throw new Error('Bootstrap status probe: no spreadsheet resolved (getUserSpreadsheet_ returned null).');
  }
  var registry = getBootstrapSheetRegistry_();
  var sheets = [];

  for (var i = 0; i < BOOTSTRAP_CORE_KEYS_.length; i++) {
    var key = BOOTSTRAP_CORE_KEYS_[i];
    var entry = registry[key];
    var name = '';
    try { name = entry.resolveName(); } catch (_e) { name = ''; }
    var row = {
      key: key,
      sheetName: name,
      exists: !!(name && ss.getSheetByName(name)),
      supported: !!entry.supported
    };
    if (!entry.supported && entry.blockerReason) {
      row.blockerReason = entry.blockerReason;
    }
    sheets.push(row);
  }

  return { mode: 'normal', sheets: sheets };
}

/* -------------------------------------------------------------------------- */
/*  First-run startup routing probe                                           */
/* -------------------------------------------------------------------------- */

/**
 * Prefixes used to identify app-owned sheets in any existing workbook.
 * Any sheet whose name begins with one of these — regardless of year,
 * canonical naming, or current onboarding schema — counts as evidence
 * that the workbook is NOT a first-run blank workbook.
 *
 * This is intentionally broader than BOOTSTRAP_CORE_KEYS_: we want the
 * blank-detection rule to respect any prior CashCompass state, not
 * just the specific canonical onboarding sheet names that happen to
 * match the current version of the registry. A workbook created by an
 * older build, or one that predates the Settings / Upcoming schema,
 * can still have dozens of populated INPUT / SYS / OUT / LOG sheets
 * and must not be treated as blank.
 */
var STARTUP_APP_SHEET_PREFIXES_ = ['INPUT - ', 'SYS - ', 'OUT - ', 'LOG - '];

/**
 * Sheet names that, on their own, must NOT mark a workbook as populated.
 *
 * A freshly provisioned Central App workbook is seeded with two scaffolding
 * sheets before any real financial data exists:
 *   - INPUT - Settings  (seed-only settings sheet)
 *   - SYS - Meta        (Phase 6B workbook identity marker)
 * Both names match an app-sheet prefix above (`INPUT - ` / `SYS - `), so
 * without this exclusion they would be treated as evidence of a populated
 * workbook and trap a brand-new user on the normal dashboard (Overview)
 * instead of routing to Welcome / Setup.
 *
 * SYS - Meta in particular is an identity marker stamped during provisioning
 * (ensureWorkbookIdentityMarkers_), not user app data, so it must never on
 * its own count as a populated workbook. The literal name is used here
 * rather than the SYS_META_SHEET_NAME_ constant because this is a top-level
 * var initialized at load time and that constant lives in another file
 * (central_provisioning.js); referencing it here would create a cross-file
 * load-order dependency.
 *
 * Every other INPUT-/SYS-/OUT-/LOG- sheet (Cash Flow, Bank Accounts,
 * Debts, Bills, Upcoming Expenses, snapshots, logs, ...) still counts as
 * real user data, so a genuine bound/production workbook continues to be
 * classified as populated and lands on Overview.
 */
var STARTUP_IGNORED_APP_SHEET_NAMES_ = ['INPUT - Settings', 'SYS - Meta'];

/**
 * Returns true when the spreadsheet contains any sheet whose name starts
 * with one of the recognised app prefixes, EXCLUDING the names listed in
 * STARTUP_IGNORED_APP_SHEET_NAMES_ (currently just the seed-only
 * INPUT - Settings sheet). Pure inspection — never writes. Uses the cheap
 * `getSheets()` / `getName()` pair and short-circuits on the first match
 * so even large workbooks resolve in a single pass.
 */
function workbookHasAnyAppSheet_(ss) {
  try {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var name = '';
      try { name = sheets[i].getName() || ''; } catch (_e) { name = ''; }
      if (STARTUP_IGNORED_APP_SHEET_NAMES_.indexOf(name) !== -1) continue;
      for (var p = 0; p < STARTUP_APP_SHEET_PREFIXES_.length; p++) {
        if (name.indexOf(STARTUP_APP_SHEET_PREFIXES_[p]) === 0) return true;
      }
    }
  } catch (_err) {
    // On any inspection error, fall through to the caller. The caller
    // must fail closed (treat as populated) so a populated workbook
    // never regresses onto Welcome because of a probe hiccup.
  }
  return false;
}

/**
 * Read-only probe used by the web app client at startup to decide
 * whether to load the normal dashboard or route the user directly to
 * Setup / Review → Welcome.
 *
 * A workbook is considered "blank" for first-run purposes only when it
 * contains NO recognised app sheets at all — i.e. no sheet whose name
 * begins with `INPUT - `, `SYS - `, `OUT - `, or `LOG - `. This is a
 * broader rule than checking the current onboarding canonical sheet
 * set alone: older workbooks that predate today's Settings / Upcoming
 * schema, or that use a past-year Cash Flow tab, still have real user
 * data and must land on the normal dashboard instead of Welcome.
 *
 * Safety
 *   - Pure inspection. Never creates, never modifies, never clears any
 *     sheet. Safe to call unconditionally at page load.
 *   - Fails closed: on any error we report not-blank so the caller
 *     falls through to the normal dashboard init path. A populated
 *     workbook must never be trapped on Welcome because of a probe
 *     hiccup.
 *
 * Shape:
 *   {
 *     ok: boolean,                // true if the probe completed
 *     isBlankWorkbook: boolean,   // true only when the workbook has no app sheets
 *     mode: 'normal',
 *     coreSheetCount: number,     // total core sheets probed
 *     existingCoreSheetCount: number,
 *     hasAnyAppSheet: boolean,    // broader populated-workbook signal
 *     reason?: string             // populated only when ok === false
 *   }
 */
function getStartupRoutingFromDashboard() {
  // Central App seam: resolve the caller's own workbook (central mode) or
  // the active bound spreadsheet (bound mode). Previously this used
  // SpreadsheetApp.getActiveSpreadsheet() directly, which is null in a
  // standalone Central deployment and made the downstream probe throw.
  //
  // Phase 6D.1: workbook resolution is wrapped in its own try/catch so a
  // known recovery state (stale mapping / ambiguous workbook / generic
  // unavailable) returns a recovery descriptor the client can render as a
  // calm, non-technical recovery screen — instead of being swallowed into
  // the normal fail-closed path, where the dashboard loaders would then
  // fire against an unresolved workbook and leak raw errors into the UI.
  var ss;
  try {
    ss = getUserSpreadsheet_();
  } catch (resolveErr) {
    return buildRecoveryRouting_(resolveErr);
  }

  try {
    if (!ss) {
      // No resolvable workbook (e.g., a standalone Central deployment with
      // no mapping yet). Fail closed to the normal dashboard rather than
      // dereferencing null, matching this probe's existing safety posture.
      return {
        ok: false,
        isBlankWorkbook: false,
        mode: 'normal',
        coreSheetCount: 0,
        existingCoreSheetCount: 0,
        hasAnyAppSheet: false,
        reason: 'Startup routing probe failed: getUserSpreadsheet_ returned null.'
      };
    }

    var status = getOnboardingBootstrapStatusFromDashboard();
    var sheets = (status && Array.isArray(status.sheets)) ? status.sheets : [];
    var existing = 0;
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i] && sheets[i].exists) existing++;
    }

    // Broader populated-workbook check: any INPUT/SYS/OUT/LOG sheet
    // anywhere in the workbook counts as real user data, even if none
    // of today's six canonical onboarding sheet names match. This is
    // the load-bearing guard that prevents existing populated
    // workbooks from being misclassified as first-run / blank.
    //
    // NOTE: workbookHasAnyAppSheet_ deliberately ignores the seed-only
    // INPUT - Settings sheet (see STARTUP_IGNORED_APP_SHEET_NAMES_), so a
    // freshly provisioned Central workbook whose only app sheet is Settings
    // reports hasAnyAppSheet === false and is correctly classified blank.
    var hasAnyAppSheet = workbookHasAnyAppSheet_(ss);

    return {
      ok: true,
      // Blank == no real app data sheets. We key off hasAnyAppSheet (which
      // already excludes the seed-only Settings sheet) rather than the
      // narrow core-sheet `existing === 0` count, because that count treats
      // INPUT - Settings as an existing core sheet and would otherwise keep
      // a fresh Settings-only Central workbook off Welcome. A real bound /
      // production workbook always has at least one non-Settings app sheet
      // (e.g. INPUT - Cash Flow <year>), so it still reports not-blank and
      // routes to Overview.
      isBlankWorkbook: (sheets.length > 0 && !hasAnyAppSheet),
      mode: 'normal',
      coreSheetCount: sheets.length,
      existingCoreSheetCount: existing,
      hasAnyAppSheet: hasAnyAppSheet
    };
  } catch (e) {
    // Fail closed: on any error, report not-blank so the client falls
    // back to the existing dashboard init path. We would rather show
    // the current (pre-gate) behavior than accidentally trap a
    // populated workbook on the Welcome screen.
    return {
      ok: false,
      isBlankWorkbook: false,
      mode: 'normal',
      coreSheetCount: 0,
      existingCoreSheetCount: 0,
      hasAnyAppSheet: false,
      reason: 'Startup routing probe failed: ' + (e && e.message ? e.message : e)
    };
  }
}

/**
 * Phase 6D.1 — builds the recovery routing descriptor returned by
 * getStartupRoutingFromDashboard() when central-mode workbook resolution
 * fails. The client maps `recovery.type` to a calm, non-technical screen
 * and never renders raw spreadsheet IDs, stack traces, or internal error
 * names.
 *
 * Recovery types:
 *   - 'stale'       : a mapped workbook could not be opened
 *                     (StaleMappingError).
 *   - 'ambiguous'   : multiple candidate workbooks and none linked; we
 *                     refused to auto-pick (AmbiguousWorkbookError).
 *                     Only reachable when CENTRAL_AUTO_ADOPT is on.
 *   - 'unavailable' : any other resolution/provisioning failure
 *                     (e.g., no identified user, transient Drive error).
 *
 * The optional BETA_CONTACT_EMAIL script property is included so the
 * recovery screen can offer a support contact; it is read defensively and
 * defaults to empty (the client simply hides the contact line). This is a
 * read-only classifier — it performs no mapping writes and no Drive writes.
 */
function buildRecoveryRouting_(err) {
  var name = (err && err.name) ? String(err.name) : '';
  var type;
  if (name === 'StaleMappingError') {
    type = 'stale';
  } else if (name === 'AmbiguousWorkbookError') {
    type = 'ambiguous';
  } else {
    type = 'unavailable';
  }

  var contactEmail = '';
  try {
    contactEmail = String(PropertiesService.getScriptProperties()
      .getProperty('BETA_CONTACT_EMAIL') || '').trim();
  } catch (_e) {
    contactEmail = '';
  }

  // Phase 6D.2a: whether self-service recovery actions (currently just
  // "Reconnect existing workbook") should render. Driven by the
  // CENTRAL_RECOVERY_ACTIONS flag, read defensively — when OFF (or the reader
  // is unavailable, e.g. bound project), the recovery page stays display-only.
  var actionsEnabled = false;
  try {
    actionsEnabled = (typeof isRecoveryActionsEnabled_ === 'function') &&
      isRecoveryActionsEnabled_();
  } catch (_a) {
    actionsEnabled = false;
  }

  return {
    ok: false,
    isBlankWorkbook: false,
    mode: 'recovery',
    recovery: {
      type: type,
      contactEmail: contactEmail,
      actionsEnabled: actionsEnabled
    }
  };
}

/**
 * Shared readability helper — apply canonical column widths by header name.
 *
 * Purpose
 *   Encodes the Canonical Width + Readability Standards
 *   (ENGINEERING_STANDARDS.md) once so sheets stop fixing clipped/cramped
 *   headers one at a time with duplicated per-sheet width logic. Given a
 *   map of exact header text → canonical width, it widens each matching
 *   column so its header and values read comfortably. Deliberately minimal:
 *   a width utility, NOT a style engine.
 *
 * Contract (safety guarantees)
 *   - WIDEN-ONLY: each column is set to max(current width, canonical width).
 *     A column already at/above canonical (e.g. one the user widened) is
 *     left untouched. Never shrinks a column.
 *   - HEADER-ADDRESSED: columns are located by exact header text on
 *     `headerRow`, matched case-insensitively and trimmed. Robust to column
 *     reordering and to sheets that lack some configured headers.
 *   - MISSING HEADERS SKIP SAFELY: a configured header not present on the
 *     sheet is a no-op (no error, no errant write).
 *   - WIDTH ONLY: sets column width and nothing else — no cell values, no
 *     fonts/colors/alignment/number formats/borders. Preserves all user
 *     data and formatting.
 *   - IDEMPOTENT: re-running yields the same widths. Safe to call from
 *     first-create styling and from approved additive schema-evolution
 *     paths.
 *   - COSMETIC-ONLY: every failure is swallowed (and logged); a width
 *     glitch must never fail the caller's ensure/create operation.
 *
 * Intended call sites: first-create sheet styling and schema self-heal
 * (on an actual column-add) ONLY. Do NOT call on every read of a populated
 * sheet — that would be a broad runtime restyle (ENGINEERING_STANDARDS.md
 * §9/§10 "Runtime helpers must not style").
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} headerRow  1-based row holding the header labels (usually 1).
 * @param {!Object<string, number>} widthByHeader  exact header text →
 *     canonical width in px.
 * @return {number} count of columns actually widened (0 when all matching
 *     columns were already ≥ canonical, or none matched). Useful for logging.
 */
function applyCanonicalColumnWidthsByHeader_(sheet, headerRow, widthByHeader) {
  if (!sheet || !widthByHeader) return 0;
  var row = (headerRow && headerRow > 0) ? headerRow : 1;

  var lastCol;
  try { lastCol = sheet.getLastColumn(); } catch (_lc) { return 0; }
  if (!lastCol || lastCol < 1) return 0;

  // Read the header row once; build a case-insensitive, trimmed map of
  // header text -> 1-based column index. First occurrence wins (canonical
  // sheets never duplicate a header).
  var headers;
  try { headers = sheet.getRange(row, 1, 1, lastCol).getValues()[0]; }
  catch (_hr) { return 0; }

  var colByHeader = {};
  for (var i = 0; i < headers.length; i++) {
    var label = String(headers[i] == null ? '' : headers[i]).trim().toLowerCase();
    if (label && !Object.prototype.hasOwnProperty.call(colByHeader, label)) {
      colByHeader[label] = i + 1;
    }
  }

  var widened = 0;
  for (var header in widthByHeader) {
    if (!Object.prototype.hasOwnProperty.call(widthByHeader, header)) continue;
    var key = String(header).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(colByHeader, key)) continue; // missing → skip

    var want = Number(widthByHeader[header]);
    if (!(want > 0)) continue;

    var col = colByHeader[key];
    try {
      if (sheet.getColumnWidth(col) < want) {
        sheet.setColumnWidth(col, want);
        widened++;
      }
    } catch (_w) { /* cosmetic only */ }
  }

  return widened;
}
