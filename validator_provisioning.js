/**
 * validator_provisioning.js — Validator Phase 2A: Provisioning Validation (READ-ONLY).
 *
 * Answers one question: "Does a live workbook match the canonical CashCompass
 * structure?" It compares the workbook against the canonical model in
 * validator_rules.js (getValidatorCanonicalModel_) and emits a PASS/FAIL report.
 *
 * Boundary (VALIDATOR_ARCHITECTURE.md): the Validator VALIDATES provisioning — it
 * NEVER provisions, mutates, or repairs. Every workbook access below is a getter
 * (getSheetByName / getSheets / getRange().getValues() / getColumnWidth /
 * getFrozenRows / getFrozenColumns / getLastColumn / getName). No setters.
 *
 * Guard: reuses the existing Validator guard unchanged — assertValidatorAllowed_()
 * (VALIDATOR_ENABLED === "true" AND isAdminUser_()). Disabled by default.
 *
 * Checks performed (Provisioning gate — STRUCTURAL only; VALIDATOR_ARCHITECTURE.md §10.0a):
 *   1. required sheets    — presence, severity by presence class
 *   2. required headers   — header row matches the referenced canonical list
 *   3. frozen panes       — frozen rows/columns match the canonical model
 *   4. hidden state       — asserted only where canonical (hidden SYS - Meta)
 *   5. identity markers    — required column-A marker KEYS on SYS - Meta (never
 *                            reads column-B values, which hold an email hash)
 *
 * NOT here (moved to the advisory Workbook Drift runner, validator_drift.js):
 *   - canonical column widths — advisory divergence, never a provisioning FAIL.
 *     checkSheetWidths_ still lives in this file and is reused by validateDrift_.
 *
 * Public entry point (DEVELOPER RUNNER):
 *   validatorRunProvisioning(spreadsheetIdOverride?, options?)
 *     — guarded; deterministic. Validates the workbook named by the
 *       spreadsheetIdOverride argument, else the VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID
 *       script property (throws if unset). Opens READ-ONLY via openById; never
 *       getUserSpreadsheet_(). Runs the checks, logs, and returns the report.
 *
 * Engineering rule: developer runners operate on Script Property–configured
 * resources; runtime/app APIs operate on getUserSpreadsheet_(). Future runtime
 * Workbook Health reuses the pure seam validateProvisioning_(ss).
 */

/** Finding severities (ordered by seriousness). */
var VALIDATOR_SEV_ERROR_ = 'ERROR';
var VALIDATOR_SEV_WARN_ = 'WARN';
var VALIDATOR_SEV_INFO_ = 'INFO';
var VALIDATOR_SEV_OK_ = 'OK';

/**
 * PUBLIC (guarded) DEVELOPER RUNNER — Provisioning Validation.
 *
 * Deterministic developer tooling: it validates a Script Property–configured
 * workbook by default and NEVER "whatever getUserSpreadsheet_() happens to
 * resolve". (In Central editor mode getUserSpreadsheet_() can resolve — and even
 * provision — the OPERATOR's own mapped workbook, not the workbook under test.)
 *
 * Engineering rule (VALIDATOR_ARCHITECTURE.md): developer runners operate on
 * Script Property–configured resources; runtime/user-facing APIs operate on
 * getUserSpreadsheet_(). This runner is developer tooling, so it uses Script
 * Properties. Future runtime Workbook Health inside the application must NOT call
 * this runner — it should call the pure seam validateProvisioning_(ss) with
 * getUserSpreadsheet_().
 *
 * Workbook resolution (both paths open READ-ONLY via SpreadsheetApp.openById,
 * the same read-only usage as validatorSnapshotById_):
 *   - spreadsheetIdOverride provided → validate that exact workbook (preferred
 *     for one-off diagnostics / investigating a specific Central test workbook).
 *   - omitted → VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID via
 *     getValidatorDefaultCentralWorkbookId_(), which throws a clear error if the
 *     property is unset. There is NO silent fallback to getUserSpreadsheet_().
 *
 * Read-only. Admin-gated + flag-gated via assertValidatorAllowed_() (first guard,
 * always).
 *
 * @param {string=} spreadsheetIdOverride Optional workbook ID to validate. When
 *   present, this exact workbook is opened read-only and validated; otherwise the
 *   VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID script property is used.
 * @param {Object=} options
 *   - {string} outputMode  'log' (default) | 'json' | 'both'
 * @returns {Object} the structured provisioning report
 */
function validatorRunProvisioning(spreadsheetIdOverride, options) {
  assertValidatorAllowed_();

  options = options || {};
  var outputMode = options.outputMode || 'log';

  var override = (spreadsheetIdOverride && String(spreadsheetIdOverride).trim())
    ? String(spreadsheetIdOverride).trim()
    : '';
  // Deterministic: explicit override, else Script Property (throws if unset).
  // Never getUserSpreadsheet_() — this is a developer runner.
  var id = override || getValidatorDefaultCentralWorkbookId_();

  var ss = SpreadsheetApp.openById(id);
  if (!ss) {
    throw new Error('validatorRunProvisioning: openById returned null for the supplied workbook ID.');
  }

  var report = validateProvisioning_(ss);

  if (outputMode === 'json' || outputMode === 'both') {
    validatorLogChunked_('PROVISIONING REPORT (JSON)', JSON.stringify(report, null, 2));
  }
  if (outputMode === 'log' || outputMode === 'both') {
    Logger.log(validatorFormatProvisioningReport_(report));
  }
  return report;
}

/**
 * INTERNAL — pure read-only comparison of a workbook against the canonical model.
 * Kept ss-parameterized (no resolution/guard inside) so a future Workbook Health
 * orchestrator can reuse it. Never throws for a single bad sheet; per-sheet
 * failures are captured as ERROR findings.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object=} options - { Array<string> sheetNames } optional allow-list to
 *   scope validation to only those canonical sheets (see validatorScopeModel_).
 *   Omitted → the full canonical model (unchanged default for all callers).
 * @returns {Object} report
 */
function validateProvisioning_(ss, options) {
  var model = validatorScopeModel_(getValidatorCanonicalModel_(), options);
  var findings = [];
  var sheetsOut = [];

  for (var i = 0; i < model.length; i++) {
    var rule = model[i];
    var sheetFindings = [];
    var sheet = null;

    try {
      sheet = ss.getSheetByName(rule.name);

      if (!sheet) {
        sheetFindings.push(validatorProvisioningMissingSheetFinding_(rule));
      } else {
        // Sheet present — check its structure.
        var actualHeaders = validatorReadHeaderRow_(sheet, rule.headerRow);

        pushAll_(sheetFindings, checkSheetHeaders_(rule, actualHeaders));
        pushAll_(sheetFindings, checkSheetFrozen_(sheet, rule));
        pushAll_(sheetFindings, checkSheetHidden_(sheet, rule));
        pushAll_(sheetFindings, checkSheetMarkerKeys_(sheet, rule));
        // Canonical WIDTH drift is ADVISORY, not a provisioning failure — it moved
        // to the Workbook Drift runner (validator_drift.js → validateDrift_). See
        // VALIDATOR_ARCHITECTURE.md §10.0a. checkSheetWidths_ still lives in this
        // file (reused by Drift); the Provisioning gate simply no longer calls it.

        if (sheetFindings.length === 0) {
          sheetFindings.push(validatorFinding_(VALIDATOR_SEV_OK_, rule.name, 'sheet',
            'Present and matches canonical structure.'));
        }
      }
    } catch (e) {
      sheetFindings.push(validatorFinding_(VALIDATOR_SEV_ERROR_, rule.name, 'sheet',
        'Check failed: ' + (e && e.message ? e.message : e)));
    }

    var sheetStatus = validatorWorstSeverity_(sheetFindings);
    sheetsOut.push({
      name: rule.name,
      presence: rule.presence,
      status: sheetStatus,
      findings: sheetFindings
    });
    pushAll_(findings, sheetFindings);
  }

  var counts = { error: 0, warn: 0, info: 0, ok: 0 };
  for (var f = 0; f < findings.length; f++) {
    if (findings[f].severity === VALIDATOR_SEV_ERROR_) counts.error++;
    else if (findings[f].severity === VALIDATOR_SEV_WARN_) counts.warn++;
    else if (findings[f].severity === VALIDATOR_SEV_INFO_) counts.info++;
    else counts.ok++;
  }

  return {
    type: 'provisioning',
    workbook: safeName_(ss),
    workbookId: safeId_(ss),
    overall: counts.error > 0 ? 'FAIL' : 'PASS',
    counts: counts,
    sheets: sheetsOut,
    findings: findings
  };
}

/**
 * Optionally scope the canonical model to an allow-list of sheet names.
 *
 * When options.sheetNames is a non-empty array, only rules whose name is in that
 * set are kept (canonical order preserved); otherwise the full model is returned
 * unchanged. This lets a caller validate ONLY the sheets it intentionally
 * provisions — e.g. a Test Harness scenario that creates just INPUT - Settings,
 * INPUT - Donation, and SYS - Meta — instead of WARNing on canonical sheets that
 * the scenario never creates. It does NOT change global canonical rules and never
 * mutates the input model. Names not present in the model are simply ignored.
 *
 * @param {Array<Object>} model  canonical model from getValidatorCanonicalModel_()
 * @param {Object=} options      { Array<string> sheetNames }
 * @returns {Array<Object>} scoped (or original) model
 */
function validatorScopeModel_(model, options) {
  var names = options && options.sheetNames;
  if (!names || !names.length) return model;
  var allow = {};
  for (var i = 0; i < names.length; i++) {
    allow[String(names[i])] = true;
  }
  var out = [];
  for (var j = 0; j < model.length; j++) {
    if (allow[model[j].name]) out.push(model[j]);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Individual checks (all read-only)                                          */
/* -------------------------------------------------------------------------- */

/** Missing-sheet finding, with severity mapped from the presence class. */
function validatorProvisioningMissingSheetFinding_(rule) {
  var sev = (rule.presence === VALIDATOR_PRESENCE_REQUIRED_) ? VALIDATOR_SEV_ERROR_
    : (rule.presence === VALIDATOR_PRESENCE_EXPECTED_) ? VALIDATOR_SEV_WARN_
    : VALIDATOR_SEV_INFO_;
  return validatorFinding_(sev, rule.name, 'sheet',
    'Missing (' + rule.presence + ' sheet).');
}

/**
 * Required-header check. Compares the referenced canonical header list against
 * the actual header row. Skipped (returns []) when the rule has no shared header
 * constant yet (headers === null) — never guesses.
 *
 * A canonical header absent from the row → ERROR (missing).
 * A canonical header present at the wrong column index → WARN (misordered).
 */
function checkSheetHeaders_(rule, actualHeaders) {
  if (!rule.headers || !rule.headers.length) return [];
  var out = [];

  // Map actual header text → 0-based index (first occurrence).
  var actualIndex = {};
  for (var c = 0; c < actualHeaders.length; c++) {
    var t = String(actualHeaders[c] == null ? '' : actualHeaders[c]).trim();
    if (t !== '' && !actualIndex.hasOwnProperty(t)) actualIndex[t] = c;
  }

  for (var i = 0; i < rule.headers.length; i++) {
    var expected = String(rule.headers[i]).trim();
    var count = 0;
    for (var countIdx = 0; countIdx < actualHeaders.length; countIdx++) {
      if (String(actualHeaders[countIdx] == null ? '' : actualHeaders[countIdx]).trim() === expected) count++;
    }
    if (rule.uniqueHeaders && rule.uniqueHeaders.indexOf(expected) !== -1 && count > 1) {
      out.push(validatorFinding_(VALIDATOR_SEV_ERROR_, rule.name, 'header',
        'Duplicate header "' + expected + '" found ' + count + ' times.'));
      continue;
    }
    if (!actualIndex.hasOwnProperty(expected)) {
      out.push(validatorFinding_(VALIDATOR_SEV_ERROR_, rule.name, 'header',
        'Missing header "' + expected + '" (expected at column ' + (i + 1) + ').'));
    } else if (actualIndex[expected] !== i) {
      var orderSeverity = rule.strictHeaderOrder && rule.strictHeaderOrder.indexOf(expected) !== -1
        ? VALIDATOR_SEV_ERROR_ : VALIDATOR_SEV_WARN_;
      out.push(validatorFinding_(orderSeverity, rule.name, 'header',
        'Header "' + expected + '" at column ' + (actualIndex[expected] + 1) +
        ', canonical column ' + (i + 1) + '.'));
    }
  }
  return out;
}

/**
 * Frozen-pane check. Only asserts values the model specifies (non-null).
 * Mismatch → WARN (structural but non-data-critical).
 */
function checkSheetFrozen_(sheet, rule) {
  var out = [];
  if (rule.frozenRows != null) {
    var fr = sheet.getFrozenRows();
    if (fr !== rule.frozenRows) {
      out.push(validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'frozenRows',
        'Frozen rows = ' + fr + ', canonical ' + rule.frozenRows + '.'));
    }
  }
  if (rule.frozenColumns != null) {
    var fc = sheet.getFrozenColumns();
    if (fc !== rule.frozenColumns) {
      out.push(validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'frozenColumns',
        'Frozen columns = ' + fc + ', canonical ' + rule.frozenColumns + '.'));
    }
  }
  return out;
}

/**
 * Canonical-width check (widen-only semantics). ADVISORY — consumed by the Workbook
 * Drift runner (validator_drift.js → validateDrift_), not by the Provisioning gate
 * (see VALIDATOR_ARCHITECTURE.md §10.0a). It lives in this file because it shares
 * the header-index helpers here; the Provisioning runner deliberately does not call
 * it. For each header in the referenced width map, find its actual column and
 * compare its width. Canonical widths are applied widen-only at first-create, so:
 *   actual >= canonical → OK (a user may legitimately widen further),
 *   actual  < canonical → WARN (first-create widths likely not applied).
 * Headers absent from the row are skipped (covered by the header check / INFO).
 * Skipped entirely when the rule has no shared width constant (widths === null).
 */
function checkSheetWidths_(sheet, rule, actualHeaders) {
  if (!rule.widths) return [];
  var out = [];

  var actualIndex = {};
  for (var c = 0; c < actualHeaders.length; c++) {
    var t = String(actualHeaders[c] == null ? '' : actualHeaders[c]).trim();
    if (t !== '' && !actualIndex.hasOwnProperty(t)) actualIndex[t] = c;
  }

  for (var header in rule.widths) {
    if (!rule.widths.hasOwnProperty(header)) continue;
    var key = String(header).trim();
    if (!actualIndex.hasOwnProperty(key)) continue; // header not present — skip
    var col = actualIndex[key] + 1; // 1-based
    var canonical = rule.widths[header];
    var actual = sheet.getColumnWidth(col);
    if (actual < canonical) {
      out.push(validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'width',
        'Column "' + key + '" width ' + actual + 'px, below canonical ' + canonical + 'px.'));
    }
  }
  return out;
}

/**
 * Hidden-state check. Only asserts sheets the model marks with an explicit
 * boolean `hidden` (currently just the SYS - Meta marker sheet); all other rules
 * leave it undefined/null and are skipped, so a user hiding an app sheet never
 * produces a false positive. Mismatch → WARN (structural, non-data-critical, and
 * Central-provisioning-specific). Read-only (isSheetHidden).
 */
function checkSheetHidden_(sheet, rule) {
  if (rule.hidden == null) return [];
  var actual = sheet.isSheetHidden();
  if (actual === rule.hidden) return [];
  return [validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'hidden',
    'Sheet hidden = ' + actual + ', canonical ' + rule.hidden + '.')];
}

/**
 * Identity-marker key check for a key/value marker sheet (SYS - Meta). Verifies
 * each canonical marker KEY label in rule.markerKeys is present in column A.
 * Only column A (labels) is read — column B holds an email hash and is never
 * read or logged. A missing marker key → WARN (the marker is stamped best-effort
 * during provisioning and lazily back-filled on open, so pre-marker beta
 * workbooks should not FAIL). Skipped when the rule has no markerKeys. Read-only.
 */
function checkSheetMarkerKeys_(sheet, rule) {
  if (!rule.markerKeys || !rule.markerKeys.length) return [];
  var out = [];

  var lastRow = sheet.getLastRow();
  var present = {};
  if (lastRow >= 1) {
    var colA = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var r = 0; r < colA.length; r++) {
      var label = String(colA[r][0] == null ? '' : colA[r][0]).trim();
      if (label !== '') present[label] = true;
    }
  }

  for (var i = 0; i < rule.markerKeys.length; i++) {
    var key = String(rule.markerKeys[i]).trim();
    if (!present.hasOwnProperty(key)) {
      out.push(validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'marker',
        'Missing identity-marker key "' + key + '".'));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Read helpers (read-only) + finding/report utilities                        */
/* -------------------------------------------------------------------------- */

/**
 * Read a sheet's header row as a trimmed string array, spanning every used
 * column. Returns [] when headerRow is null (header check not modeled) or the
 * sheet has no columns. Read-only.
 */
function validatorReadHeaderRow_(sheet, headerRow) {
  if (headerRow == null) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  var row = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  var out = [];
  for (var i = 0; i < row.length; i++) {
    out.push(String(row[i] == null ? '' : row[i]).trim());
  }
  return out;
}

/** Build a Finding. Structural only — never carries user cell values. */
function validatorFinding_(severity, sheetName, kind, message) {
  return { severity: severity, sheet: sheetName, kind: kind, message: message };
}

/** Worst (most serious) severity among a list of findings. */
function validatorWorstSeverity_(findings) {
  var worst = VALIDATOR_SEV_OK_;
  for (var i = 0; i < findings.length; i++) {
    var s = findings[i].severity;
    if (s === VALIDATOR_SEV_ERROR_) return VALIDATOR_SEV_ERROR_;
    if (s === VALIDATOR_SEV_WARN_ && worst !== VALIDATOR_SEV_ERROR_) worst = VALIDATOR_SEV_WARN_;
    else if (s === VALIDATOR_SEV_INFO_ && worst === VALIDATOR_SEV_OK_) worst = VALIDATOR_SEV_INFO_;
  }
  return worst;
}

/** Append every element of src onto dest (in place). */
function pushAll_(dest, src) {
  for (var i = 0; i < src.length; i++) dest.push(src[i]);
}

/** Spreadsheet name, defensively. */
function safeName_(ss) {
  try { return ss.getName(); } catch (_e) { return '(unknown workbook)'; }
}

/** Spreadsheet ID, defensively (read-only getter). */
function safeId_(ss) {
  try { return ss.getId(); } catch (_e) { return '(unknown id)'; }
}

/**
 * Human-readable PASS/FAIL report for the execution log.
 * @param {Object} report
 * @returns {string}
 */
function validatorFormatProvisioningReport_(report) {
  var lines = [];
  lines.push('===== PROVISIONING VALIDATION =====');
  lines.push('Workbook : ' + report.workbook);
  lines.push('ID       : ' + report.workbookId);
  lines.push('Overall  : ' + report.overall +
    '   (ERROR ' + report.counts.error + ', WARN ' + report.counts.warn +
    ', INFO ' + report.counts.info + ', OK ' + report.counts.ok + ')');
  lines.push('');

  for (var i = 0; i < report.sheets.length; i++) {
    var s = report.sheets[i];
    lines.push('[' + s.status + '] ' + s.name + '  (' + s.presence + ')');
    for (var j = 0; j < s.findings.length; j++) {
      var f = s.findings[j];
      if (f.severity === VALIDATOR_SEV_OK_ && s.findings.length === 1) continue;
      lines.push('    - ' + f.severity + ' [' + f.kind + '] ' + f.message);
    }
  }

  lines.push('');
  lines.push('===== END PROVISIONING VALIDATION (' + report.overall + ') =====');
  return lines.join('\n');
}
