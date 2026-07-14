/**
 * test_harness_core.js — Test Harness · guard + disposable-workbook lifecycle
 * + run loop (Foundation V1).
 *
 * The developer-only WRITER that creates a disposable, clearly-labeled test
 * workbook, drives ONE real workflow into it, asks the read-only Validator to
 * judge it (Provisioning + Schema Evolution + Workbook Drift), and reports the
 * result. Design of record: TEST_HARNESS_ARCHITECTURE.md.
 *
 * SAFETY MODEL (fail-closed, stronger than the Validator because it writes):
 *   1. Flag gate    — TEST_HARNESS_ENABLED === "true" (default off).
 *   2. Admin gate   — isAdminUser_() (ADMIN_EMAILS / BETA_CONTACT_EMAIL).
 *   3. Disposable-target gate — assertDisposableTarget_(ss, runId) runs before
 *      EVERY write and before teardown. It requires ALL of: harness name
 *      prefix+suffix, an agreeing hidden _HARNESS_META marker sheet (run-id
 *      matched), and the target ID NOT being any protected production workbook
 *      (Golden, configured Central default, any mapped user workbook, or the
 *      active/bound workbook). Unknown/ambiguous → REFUSE.
 *   4. No runtime wiring — never called from doGet/onOpen/menu/trigger. Editor
 *      runner only: testRunSmoke().
 *
 * WRITE BOUNDARY: the Harness writes ONLY to a disposable workbook it just
 * created via SpreadsheetApp.create(). It never opens or mutates the Canonical,
 * a real user, or the bound production workbook. The Validator stays read-only.
 *
 * V1 teardown default: KEEP the workbook for inspection (clearly labeled
 * "SAFE TO DELETE"); optional trash is supported behind an explicit option.
 *
 * GAS note: Document Properties cannot be attached to a spreadsheet created by a
 * standalone script (they are scoped to the script's own container document), so
 * the durable marker uses the hidden _HARNESS_META sheet + spreadsheet-level
 * developer metadata instead — the correct, forge-resistant primitives here.
 */

/* Guard / naming / marker constants. */
var TEST_HARNESS_ENABLED_KEY_ = 'TEST_HARNESS_ENABLED';
var HARNESS_NAME_PREFIX_ = 'CASHCOMPASS TEST — ';
var HARNESS_NAME_SUFFIX_ = ' — SAFE TO DELETE';
var HARNESS_META_SHEET_NAME_ = '_HARNESS_META';
var HARNESS_MD_DISPOSABLE_KEY_ = 'HARNESS_DISPOSABLE';
var HARNESS_MD_RUN_ID_KEY_ = 'HARNESS_RUN_ID';

/* -------------------------------------------------------------------------- */
/*  Public (guarded) developer runner                                          */
/* -------------------------------------------------------------------------- */

/**
 * PUBLIC (guarded) EDITOR RUNNER — the smallest end-to-end proof:
 * create a disposable workbook → provision it + run one real workflow →
 * validate with Workbook Health → report → keep the workbook for inspection.
 *
 * @param {Object=} options - { trash: boolean } (default: keep)
 * @returns {Object} the scenario report (see test_harness_report.js)
 */
function testRunSmoke(options) {
  assertHarnessAllowed_();
  var runId = harnessGenerateRunId_();
  var report = runScenario_(getHarnessSmokeScenario_(), runId, options || {});
  harnessLogReport_(report);
  return report;
}

/**
 * PUBLIC (guarded) EDITOR RUNNER — same as testRunSmoke() but trashes the
 * disposable workbook after validation (still re-passing the disposable gate
 * before teardown). A thin convenience wrapper for the Apps Script editor so the
 * "run-and-clean-up" path is a one-click function; it adds NO logic of its own.
 * The guard, run loop, and teardown safety all live in testRunSmoke()/runScenario_.
 *
 * @returns {Object} the scenario report (see test_harness_report.js)
 */
function testRunSmokeTrash() {
  return testRunSmoke({ trash: true });
}

/* -------------------------------------------------------------------------- */
/*  Guard                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fail-closed guard: flag gate + admin gate. Throws a clear error if either
 * fails. Separate flag from the Validator (TEST_HARNESS_ENABLED, default off).
 */
function assertHarnessAllowed_() {
  var enabled;
  try {
    enabled = String(PropertiesService.getScriptProperties().getProperty(TEST_HARNESS_ENABLED_KEY_) || '').trim();
  } catch (e) {
    throw new Error('Test Harness: cannot read script properties: ' + (e && e.message ? e.message : e));
  }
  if (enabled !== 'true') {
    throw new Error('Test Harness is disabled. Set script property ' +
      TEST_HARNESS_ENABLED_KEY_ + ' = "true" (admin only) to enable.');
  }
  if (typeof isAdminUser_ !== 'function' || !isAdminUser_()) {
    throw new Error('Test Harness: admin only — your account is not in ADMIN_EMAILS / BETA_CONTACT_EMAIL.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Run loop                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Create a disposable workbook, run ONE scenario against it, validate it, and
 * return the structured report. Never throws — scenario/validator failures are
 * captured into the report (overall FAIL). Teardown honors options.trash
 * (default: keep for inspection). The workbook, if kept, is always clearly named
 * "… SAFE TO DELETE".
 *
 * @param {Object} scenario see getHarnessSmokeScenario_
 * @param {string} runId
 * @param {Object} options { trash?: boolean }
 * @returns {Object} scenario report
 */
function runScenario_(scenario, runId, options) {
  options = options || {};
  var startedAt = Date.now();
  var actions = [];
  var wb = null;
  var error = null;
  var validators = { provisioning: null, schema: null, drift: null };
  var disposition = 'KEPT_FOR_INSPECTION';
  // Functional-assertion collector (E0a). Declared outside the try so its results
  // are always available to the report builder, even if a later step throws.
  var assertions = makeAssertionCollector_();

  try {
    wb = createDisposableWorkbook_(scenario.id, runId);

    // Fail-closed: prove the freshly created target is disposable before ANY
    // scenario write touches it.
    assertDisposableTarget_(wb.ss, runId);

    var ctx = {
      ss: wb.ss,
      runId: runId,
      actions: actions,
      // Read layer (read-only) — the single home for all functional reads. See
      // test_harness_read.js. Bound to the disposable workbook.
      read: makeReadLayer_(wb.ss),
      // Functional assertions (read/compare only) — see test_harness_assert.js.
      assert: assertions,
      // Scenarios MUST call this immediately before every write.
      assertWritable: function() { assertDisposableTarget_(wb.ss, runId); }
    };

    if (typeof scenario.setup === 'function') scenario.setup(ctx);
    if (typeof scenario.actions === 'function') scenario.actions(ctx);

    // Harness bootstrap: make the disposable workbook resemble a freshly Central-
    // provisioned workbook by stamping the in-workbook SYS - Meta identity marker,
    // so Schema Evolution reports CENTRAL_CURRENT / FULLY_CURRENT (not BOUND_LEGACY)
    // for a clean fresh workbook. Skipped when a scenario INTENTIONALLY creates a
    // legacy/bound-style workbook (scenario.createsLegacyStructure === true).
    if (scenario.createsLegacyStructure !== true) {
      harnessStampIdentityMarkers_(wb.ss, runId);
      actions.push('Stamp SYS - Meta identity marker (harness bootstrap — Central-style)');
    }

    // Read-only judgment — the Validator never mutates the workbook. Scoped to the
    // sheets THIS scenario intentionally creates (scenario.expectedSheets), so a
    // SMOKE that provisions only Settings/Donation/SYS - Meta is not WARNed for
    // canonical sheets it never made. Omitted → full canonical model (unchanged).
    var scope = (scenario.expectedSheets && scenario.expectedSheets.length)
      ? { sheetNames: scenario.expectedSheets }
      : undefined;
    validators.provisioning = validateProvisioning_(wb.ss, scope);
    validators.schema = validateSchemaEvolution_(wb.ss, scope);
    validators.drift = validateDrift_(wb.ss, scope);

    // Functional correctness (E0a) — the scenario reads actual values back from the
    // disposable workbook and asserts them via ctx.assert.*. Read/compare only; a
    // thrown assertion setup error is captured like any scenario error (→ FAIL).
    if (typeof scenario.expectedOutcome === 'function') scenario.expectedOutcome(ctx);
  } catch (e) {
    error = (e && e.message) ? e.message : String(e);
  }

  // Teardown (default keep). Trash only when explicitly requested AND the target
  // still passes the disposable gate.
  if (wb && options.trash === true) {
    try {
      teardownDisposableWorkbook_(wb.ss, runId, { trash: true });
      disposition = 'TRASHED';
    } catch (te) {
      disposition = 'KEPT_FOR_INSPECTION (trash refused: ' + (te && te.message ? te.message : te) + ')';
    }
  }

  var finishedAt = Date.now();

  return buildHarnessScenarioReport_({
    scenario: {
      id: scenario.id,
      category: scenario.category,
      description: scenario.description,
      expectedSheets: (scenario.expectedSheets && scenario.expectedSheets.length)
        ? scenario.expectedSheets.slice()
        : null
    },
    runId: runId,
    workbook: wb
      ? { id: wb.id, name: wb.name, url: harnessWorkbookUrl_(wb.id) }
      : { id: null, name: null, url: null },
    actions: actions,
    validators: validators,
    assertions: assertions.results,
    disposition: disposition,
    error: error,
    startedAt: startedAt,
    finishedAt: finishedAt
  });
}

/* -------------------------------------------------------------------------- */
/*  Disposable-workbook lifecycle                                               */
/* -------------------------------------------------------------------------- */

/** runId = yyyymmdd-hhmmss-<4char> (unique per run; also the marker key). */
function harnessGenerateRunId_() {
  var tz = Session.getScriptTimeZone();
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  var rand = Utilities.getUuid().replace(/-/g, '').slice(0, 4);
  return stamp + '-' + rand;
}

/**
 * Create + mark a disposable test workbook. The create + initial marker writes
 * are the trusted bootstrap (we hold the only handle to a brand-new file);
 * assertDisposableTarget_ guards every write AFTER this.
 *
 * @param {string} scenarioId
 * @param {string} runId
 * @returns {{ ss: Object, id: string, name: string, runId: string }}
 */
function createDisposableWorkbook_(scenarioId, runId) {
  var name = HARNESS_NAME_PREFIX_ + scenarioId + ' — ' + runId + HARNESS_NAME_SUFFIX_;
  var ss = SpreadsheetApp.create(name);
  var iso = new Date().toISOString();

  // Hidden authoritative marker sheet (human-visible proof + survives property
  // edge cases). Written BEFORE any provisioning so the disposable gate holds.
  var meta = ss.insertSheet(HARNESS_META_SHEET_NAME_);
  meta.getRange(1, 1, 4, 2).setValues([
    ['harness_disposable', 'true'],
    ['harness_run_id', runId],
    ['harness_created_at', iso],
    ['harness_scenario', scenarioId]
  ]);
  try { meta.hideSheet(); } catch (_h) { /* cosmetic */ }

  // Spreadsheet-level developer metadata — queryable, forge-resistant, and the
  // correct GAS primitive for tagging a created (non-container) workbook.
  try {
    ss.addDeveloperMetadata(HARNESS_MD_DISPOSABLE_KEY_, 'true');
    ss.addDeveloperMetadata(HARNESS_MD_RUN_ID_KEY_, runId);
  } catch (_md) { /* best-effort secondary marker */ }

  // Visible human banner on the default Sheet1. Kept non-blank so the
  // provisioning cleanup (cleanupDefaultSheet1_) won't remove it.
  try {
    var s1 = ss.getSheetByName('Sheet1');
    if (s1) {
      s1.getRange(1, 1).setValue('⚠ DISPOSABLE CASHCOMPASS TEST WORKBOOK — SAFE TO DELETE — ' + runId);
    }
  } catch (_b) { /* cosmetic */ }

  return { ss: ss, id: ss.getId(), name: name, runId: runId };
}

/**
 * Stamp the in-workbook SYS - Meta identity marker on the disposable workbook so
 * it resembles a freshly Central-provisioned workbook (→ Schema Evolution reads
 * CENTRAL_CURRENT / FULLY_CURRENT instead of BOUND_LEGACY / UPGRADE_RECOMMENDED).
 *
 * Uses ONLY the ss-scoped seam ensureSysMetaMarker_(ss, email, iso) — never the
 * ensureWorkbookIdentityMarkers_ orchestrator, which additionally writes the
 * GLOBAL reverse-index script property (wbid::<id> → hash) and Drive
 * appProperties. Those are deliberately avoided because:
 *   - the reverse-index write would POLLUTE the real user→workbook mapping store,
 *     and would then make assertDisposableTarget_ REFUSE this very workbook
 *     (its wbid::<id> refusal), breaking later writes/teardown;
 *   - Drive appProperties are not needed — the Validator classifies platform from
 *     the in-workbook SYS - Meta sheet only.
 *
 * A synthetic per-run email is used purely to build the marker's value cells
 * (never read by the Validator — only the column-A key labels are checked). No
 * script property or Drive write occurs. Fail-closed: asserts the disposable
 * target before writing.
 *
 * @param {Object} ss disposable spreadsheet
 * @param {string} runId
 * @returns {boolean} true if the marker was newly written
 */
function harnessStampIdentityMarkers_(ss, runId) {
  assertDisposableTarget_(ss, runId); // fail-closed before any write
  if (typeof ensureSysMetaMarker_ !== 'function') return false;
  var email = 'harness+' + runId + '@cashcompass.test';
  return ensureSysMetaMarker_(ss, email, new Date().toISOString());
}

/**
 * Fail-closed disposable-target check. Throws unless ALL hold:
 *   1. Name starts with HARNESS_NAME_PREFIX_ and ends with HARNESS_NAME_SUFFIX_.
 *   2. Hidden _HARNESS_META marker sheet exists, says disposable=true, and its
 *      run id matches `runId`.
 *   3. The workbook ID is NOT a protected production ID:
 *      - VALIDATOR_GOLDEN_WORKBOOK_ID (Canonical)
 *      - VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID
 *      - any mapped user workbook (mapping::… value or wbid::<id> present)
 *      - the active/bound workbook (if any)
 *
 * @param {Object} ss
 * @param {string} runId
 * @returns {boolean} true (or throws)
 */
function assertDisposableTarget_(ss, runId) {
  if (!ss) throw new Error('assertDisposableTarget_ REFUSED: no spreadsheet handle.');

  var id = ss.getId();
  var name = String(ss.getName() || '');

  // (1) Name convention — both ends.
  var nameOk = name.indexOf(HARNESS_NAME_PREFIX_) === 0 &&
    name.length >= HARNESS_NAME_SUFFIX_.length &&
    name.lastIndexOf(HARNESS_NAME_SUFFIX_) === (name.length - HARNESS_NAME_SUFFIX_.length);
  if (!nameOk) {
    throw new Error('assertDisposableTarget_ REFUSED: name is not a harness disposable name ("' + name + '").');
  }

  // (2) Marker sheet agrees.
  var meta = ss.getSheetByName(HARNESS_META_SHEET_NAME_);
  if (!meta) {
    throw new Error('assertDisposableTarget_ REFUSED: missing ' + HARNESS_META_SHEET_NAME_ + ' marker sheet.');
  }
  var m = harnessReadMetaMap_(meta);
  if (m.harness_disposable !== 'true') {
    throw new Error('assertDisposableTarget_ REFUSED: marker does not declare disposable=true.');
  }
  if (runId && m.harness_run_id !== runId) {
    throw new Error('assertDisposableTarget_ REFUSED: marker run id "' + m.harness_run_id +
      '" != current run "' + runId + '".');
  }

  // (3) Refuse protected production IDs.
  if (harnessIsProtectedId_(id)) {
    throw new Error('assertDisposableTarget_ REFUSED: target ID matches a protected production workbook.');
  }

  // (4) Refuse the active/bound workbook (standalone: none).
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId() === id) {
      throw new Error('assertDisposableTarget_ REFUSED: target is the active/bound workbook.');
    }
  } catch (activeErr) {
    if (activeErr && String(activeErr.message || '').indexOf('assertDisposableTarget_') === 0) throw activeErr;
    /* no active spreadsheet in standalone context — fine */
  }

  return true;
}

/** Read a 2-column key/value marker sheet into a map. Never throws. */
function harnessReadMetaMap_(metaSheet) {
  var map = {};
  try {
    var n = Math.max(1, metaSheet.getLastRow());
    var vals = metaSheet.getRange(1, 1, n, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      map[String(vals[i][0] || '').trim()] = String(vals[i][1] || '').trim();
    }
  } catch (_e) { /* best-effort */ }
  return map;
}

/**
 * True if `id` is any protected production workbook: Canonical, configured
 * Central default, or a mapped real user workbook. Fail-closed — read errors
 * simply mean "no additional refusals from that source," never a silent allow of
 * a known ID.
 */
function harnessIsProtectedId_(id) {
  if (!id) return true; // no id → refuse
  try {
    var props = PropertiesService.getScriptProperties();

    var goldenKey = (typeof VALIDATOR_GOLDEN_WORKBOOK_ID_KEY_ === 'string')
      ? VALIDATOR_GOLDEN_WORKBOOK_ID_KEY_ : 'VALIDATOR_GOLDEN_WORKBOOK_ID';
    var centralKey = (typeof VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID_KEY_ === 'string')
      ? VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID_KEY_ : 'VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID';

    if (String(props.getProperty(goldenKey) || '').trim() === id) return true;
    if (String(props.getProperty(centralKey) || '').trim() === id) return true;

    // Direct reverse-index hit: wbid::<id> present → a mapped user workbook.
    var revPrefix = (typeof REVERSE_INDEX_KEY_PREFIX_ === 'string') ? REVERSE_INDEX_KEY_PREFIX_ : 'wbid::';
    if (props.getProperty(revPrefix + id)) return true;

    // Forward mapping scan: mapping::<hash> = <workbookId>.
    var mapPrefix = (typeof MAPPING_KEY_PREFIX_ === 'string') ? MAPPING_KEY_PREFIX_ : 'mapping::';
    var all = props.getProperties();
    for (var k in all) {
      if (all.hasOwnProperty(k) && k.indexOf(mapPrefix) === 0) {
        if (String(all[k] || '').trim() === id) return true;
      }
    }
  } catch (_e) {
    return false; // could not read extra sources; primary name+marker gate still applied
  }
  return false;
}

/**
 * Teardown: trash the disposable workbook ONLY after it re-passes the disposable
 * gate. Default V1 behavior is to KEEP (this is called with {trash:true} only on
 * explicit request).
 *
 * Soft-deletes via the Advanced Drive Service — Drive.Files.update({trashed:true})
 * — deliberately NOT DriveApp.getFileById().setTrashed(). The Central project
 * declares the narrow oauth scope drive.file (no drive / drive.readonly), under
 * which DriveApp.getFileById() is not permitted; but Drive.Files.update honors the
 * per-file drive.file grant, and harness workbooks are always script-created
 * (SpreadsheetApp.create), so they fall within that grant. No broader scope is
 * needed and none is added.
 *
 * @param {Object} ss
 * @param {string} runId
 * @param {Object} options { trash: boolean }
 */
function teardownDisposableWorkbook_(ss, runId, options) {
  options = options || {};
  if (options.trash !== true) return { trashed: false, kept: true };
  assertDisposableTarget_(ss, runId); // fail-closed before any destructive op
  Drive.Files.update({ trashed: true }, ss.getId());
  return { trashed: true, kept: false };
}

/** Best-effort edit URL for logging. */
function harnessWorkbookUrl_(id) {
  return id ? ('https://docs.google.com/spreadsheets/d/' + id + '/edit') : null;
}
