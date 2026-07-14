/**
 * validator_schema.js — Validator Phase 2 · Schema Evolution V1 (READ-ONLY, advisory).
 *
 * Answers the third Workbook Health question (VALIDATOR_ARCHITECTURE.md §10.0b):
 *   "Is this workbook using a supported legacy schema?"
 * — distinct from Provisioning ("created correctly?") and Drift ("diverged
 * cosmetically?"). This is an ADVISORY, VERSION-AWARE reconciliation LENS over the
 * existing Provisioning report. It NEVER FAILs on its own, NEVER repairs, NEVER
 * migrates, and NEVER changes workbook state. It only re-labels findings and
 * derives a Workbook Type + Compatibility verdict.
 *
 * How it works (no new checks, no new I/O beyond validateProvisioning_):
 *   1. Run validateProvisioning_(ss) (the structural gate).
 *   2. classifyWorkbook_(provReport) — infer platform (Central/Bound) + generation
 *      (Current/Legacy) from structural signals, then a Compatibility verdict.
 *   3. reclassifySchemaFindings_(...) — for the three supported legacy differences
 *      (missing SYS - Meta, legacy header ORDERING, legacy frozen-pane conventions)
 *      MOVE the finding out of the Provisioning section and re-emit it under Schema
 *      Evolution as INFO ("Supported legacy schema — …"). All other findings are
 *      left exactly as-is.
 *
 * Boundary: read-only. Reuses validator_provisioning.js helpers (validatorFinding_,
 * pushAll_, validatorWorstSeverity_, safeName_, safeId_, VALIDATOR_SEV_*). Guard is
 * the shared assertValidatorAllowed_() (VALIDATOR_ENABLED + isAdminUser_).
 *
 * NOT here: any repair/migration; Formula/Conditional-Formatting validation;
 * Workbook Health scoring; Test Harness. V1 reclassifies only the three legacy
 * differences already observed — it invents no new rules.
 */

/* Platform / generation / compatibility vocabulary (see §10.0b). */
var SCHEMA_PLATFORM_CENTRAL_ = 'CENTRAL';
var SCHEMA_PLATFORM_BOUND_ = 'BOUND';
var SCHEMA_GEN_CURRENT_ = 'CURRENT';
var SCHEMA_GEN_LEGACY_ = 'LEGACY';
var SCHEMA_COMPAT_FULLY_CURRENT_ = 'FULLY_CURRENT';
var SCHEMA_COMPAT_COMPATIBLE_LEGACY_ = 'COMPATIBLE_LEGACY';
var SCHEMA_COMPAT_UPGRADE_RECOMMENDED_ = 'UPGRADE_RECOMMENDED';
var SCHEMA_COMPAT_UPGRADE_REQUIRED_ = 'UPGRADE_REQUIRED';

/**
 * PUBLIC (guarded) DEVELOPER RUNNER — Schema Evolution.
 *
 * Deterministic, read-only. Same resolution rules as validatorRunProvisioning:
 * explicit spreadsheetIdOverride, else VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID
 * (throws if unset); never getUserSpreadsheet_(). Opens READ-ONLY via openById.
 *
 * @param {string=} spreadsheetIdOverride Optional workbook ID to validate.
 * @param {Object=} options - {string} outputMode 'log' (default) | 'json' | 'both'
 * @returns {Object} the structured schema-evolution report
 */
function validatorRunSchemaEvolution(spreadsheetIdOverride, options) {
  assertValidatorAllowed_();

  options = options || {};
  var outputMode = options.outputMode || 'log';

  var override = (spreadsheetIdOverride && String(spreadsheetIdOverride).trim())
    ? String(spreadsheetIdOverride).trim()
    : '';
  var id = override || getValidatorDefaultCentralWorkbookId_();

  var ss = SpreadsheetApp.openById(id);
  if (!ss) {
    throw new Error('validatorRunSchemaEvolution: openById returned null for the supplied workbook ID.');
  }

  var report = validateSchemaEvolution_(ss);

  if (outputMode === 'json' || outputMode === 'both') {
    validatorLogChunked_('SCHEMA EVOLUTION REPORT (JSON)', JSON.stringify(report, null, 2));
  }
  if (outputMode === 'log' || outputMode === 'both') {
    Logger.log(validatorFormatSchemaEvolutionReport_(report));
  }
  return report;
}

/**
 * INTERNAL — pure, ss-parameterized Schema Evolution seam (no guard/resolution
 * inside) so a future Workbook Health orchestrator can reuse it. Runs the
 * Provisioning gate, classifies the workbook, and reconciles the supported legacy
 * differences.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object=} options - { Array<string> sheetNames } optional allow-list,
 *   forwarded to validateProvisioning_ so classification is scoped to only the
 *   sheets a caller intentionally provisions (see validatorScopeModel_).
 * @returns {Object} { type:'schemaEvolution', workbook, workbookId, platform,
 *   generation, workbookType, compatibility, signals, provisioning, schema }
 */
function validateSchemaEvolution_(ss, options) {
  var prov = validateProvisioning_(ss, options);
  var signals = classifyWorkbook_(prov);
  var split = reclassifySchemaFindings_(prov, signals);
  return {
    type: 'schemaEvolution',
    workbook: prov.workbook,
    workbookId: prov.workbookId,
    platform: signals.platform,
    generation: signals.generation,
    workbookType: signals.workbookType,
    compatibility: signals.compatibility,
    signals: signals,
    provisioning: split.provisioning,
    schema: split.schema
  };
}

/* -------------------------------------------------------------------------- */
/*  Classification (pure, derived from the provisioning report)                */
/* -------------------------------------------------------------------------- */

/**
 * Infer Workbook Type + Compatibility from a provisioning report's structural
 * findings. Read-only and pure (no I/O — the provisioning run already did the
 * reads). Signals used (all structural, never cell values):
 *   - missing SYS - Meta        → the SYS - Meta rule reported a missing-sheet WARN
 *   - legacy header ordering     → any header WARN "…canonical column…"
 *   - legacy frozen-pane conv.   → any frozenRows/frozenColumns finding
 *   - residual errors            → any ERROR (a true, unexplained provisioning defect)
 *
 * Platform: CENTRAL iff the hidden SYS - Meta identity sheet is present (only
 * Central provisioning writes it); else BOUND. Generation: LEGACY iff any of the
 * three supported legacy differences is present; else CURRENT.
 *
 * Compatibility precedence:
 *   residual ERROR                    → UPGRADE_REQUIRED (true defect; provisioning FAIL)
 *   else missing SYS - Meta           → UPGRADE_RECOMMENDED (works; identity upgrade available)
 *   else header-ordering / frozen-pane→ COMPATIBLE_LEGACY (works; benign version delta)
 *   else                              → FULLY_CURRENT
 *
 * @param {Object} prov provisioning report from validateProvisioning_
 * @returns {Object} classification signals
 */
function classifyWorkbook_(prov) {
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  var missingSysMeta = false;
  var legacyHeaderOrdering = false;
  var legacyFrozenPanes = false;
  var residualErrors = 0;
  var sysMetaSeen = false;

  var sheets = prov.sheets || [];
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    if (s.name === sysMetaName) sysMetaSeen = true;
    var findings = s.findings || [];
    for (var j = 0; j < findings.length; j++) {
      var f = findings[j];
      if (f.severity === VALIDATOR_SEV_ERROR_) residualErrors++;
      if (f.kind === 'sheet' && s.name === sysMetaName &&
          f.severity === VALIDATOR_SEV_WARN_ && /missing/i.test(String(f.message))) {
        missingSysMeta = true;
      }
      if (f.kind === 'header' && f.severity === VALIDATOR_SEV_WARN_ &&
          String(f.message).indexOf('canonical column') !== -1) {
        legacyHeaderOrdering = true;
      }
      if (f.kind === 'frozenRows' || f.kind === 'frozenColumns') {
        legacyFrozenPanes = true;
      }
    }
  }

  var hasSysMeta = sysMetaSeen && !missingSysMeta;
  var platform = hasSysMeta ? SCHEMA_PLATFORM_CENTRAL_ : SCHEMA_PLATFORM_BOUND_;
  var isLegacy = missingSysMeta || legacyHeaderOrdering || legacyFrozenPanes;
  var generation = isLegacy ? SCHEMA_GEN_LEGACY_ : SCHEMA_GEN_CURRENT_;
  var workbookType = platform + '_' + generation;

  var compatibility;
  if (residualErrors > 0) compatibility = SCHEMA_COMPAT_UPGRADE_REQUIRED_;
  else if (missingSysMeta) compatibility = SCHEMA_COMPAT_UPGRADE_RECOMMENDED_;
  else if (legacyHeaderOrdering || legacyFrozenPanes) compatibility = SCHEMA_COMPAT_COMPATIBLE_LEGACY_;
  else compatibility = SCHEMA_COMPAT_FULLY_CURRENT_;

  return {
    platform: platform,
    generation: generation,
    workbookType: workbookType,
    compatibility: compatibility,
    hasSysMeta: hasSysMeta,
    missingSysMeta: missingSysMeta,
    legacyHeaderOrdering: legacyHeaderOrdering,
    legacyFrozenPanes: legacyFrozenPanes,
    residualErrors: residualErrors
  };
}

/* -------------------------------------------------------------------------- */
/*  Reconciliation (pure)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * True iff a finding is one of the three V1 supported legacy differences that a
 * legacy classification explains: missing SYS - Meta, legacy header ORDERING (not
 * a missing header, which stays a real defect), or legacy frozen-pane conventions.
 */
function isSchemaEvolutionFinding_(sheetName, f, sysMetaName) {
  if (f.kind === 'sheet' && sheetName === sysMetaName && f.severity === VALIDATOR_SEV_WARN_) return true;
  if (f.kind === 'header' && f.severity === VALIDATOR_SEV_WARN_ &&
      String(f.message).indexOf('canonical column') !== -1) return true;
  if (f.kind === 'frozenRows' || f.kind === 'frozenColumns') return true;
  return false;
}

/**
 * Split a provisioning report into (a) a provisioning report with the supported
 * legacy differences REMOVED and (b) a schema report holding those same
 * differences re-emitted as INFO ("Supported legacy schema — …"). Pure; builds
 * new objects and never mutates the input.
 *
 * @param {Object} prov provisioning report from validateProvisioning_
 * @param {Object} signals classifyWorkbook_ output
 * @returns {{ provisioning: Object, schema: Object }}
 */
function reclassifySchemaFindings_(prov, signals) {
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  var newProvSheets = [];
  var newProvFindings = [];
  var schemaBySheet = {};
  var schemaOrder = [];

  var sheets = prov.sheets || [];
  for (var i = 0; i < sheets.length; i++) {
    var s = sheets[i];
    var keep = [];
    var findings = s.findings || [];
    for (var j = 0; j < findings.length; j++) {
      var f = findings[j];
      if (isSchemaEvolutionFinding_(s.name, f, sysMetaName)) {
        var info = validatorFinding_(VALIDATOR_SEV_INFO_, s.name, f.kind,
          'Supported legacy schema — ' + f.message);
        if (!schemaBySheet[s.name]) { schemaBySheet[s.name] = []; schemaOrder.push(s.name); }
        schemaBySheet[s.name].push(info);
      } else {
        keep.push(f);
      }
    }

    // If every original finding was reclassified, the sheet has no provisioning
    // defect left — say so plainly (NOT "matches canonical", which would be false
    // for e.g. a missing SYS - Meta).
    if (keep.length === 0) {
      keep.push(validatorFinding_(VALIDATOR_SEV_OK_, s.name, 'schema',
        'No provisioning defect — differences are supported legacy schema (see Schema Evolution).'));
    }

    newProvSheets.push({
      name: s.name,
      presence: s.presence,
      status: validatorWorstSeverity_(keep),
      findings: keep
    });
    pushAll_(newProvFindings, keep);
  }

  var provCounts = schemaCountFindings_(newProvFindings);
  var newProv = {
    type: 'provisioning',
    workbook: prov.workbook,
    workbookId: prov.workbookId,
    overall: provCounts.error > 0 ? 'FAIL' : 'PASS',
    counts: provCounts,
    sheets: newProvSheets,
    findings: newProvFindings
  };

  var schemaSheets = [];
  var schemaFindings = [];
  for (var k = 0; k < schemaOrder.length; k++) {
    var nm = schemaOrder[k];
    var fs = schemaBySheet[nm];
    schemaSheets.push({ name: nm, presence: 'legacy', status: VALIDATOR_SEV_INFO_, findings: fs });
    pushAll_(schemaFindings, fs);
  }

  var schema = {
    type: 'schema',
    workbook: prov.workbook,
    workbookId: prov.workbookId,
    platform: signals.platform,
    generation: signals.generation,
    workbookType: signals.workbookType,
    compatibility: signals.compatibility,
    // Advisory status — never FAIL. LEGACY when any supported legacy delta was
    // reconciled; CURRENT otherwise.
    overall: schemaFindings.length ? 'LEGACY' : 'CURRENT',
    counts: schemaCountFindings_(schemaFindings),
    summary: buildSchemaSummary_(signals, schemaFindings.length),
    sheets: schemaSheets,
    findings: schemaFindings
  };

  return { provisioning: newProv, schema: schema };
}

/** Count findings by severity. Local to this module. */
function schemaCountFindings_(findings) {
  var c = { error: 0, warn: 0, info: 0, ok: 0 };
  for (var i = 0; i < findings.length; i++) {
    var sev = findings[i].severity;
    if (sev === VALIDATOR_SEV_ERROR_) c.error++;
    else if (sev === VALIDATOR_SEV_WARN_) c.warn++;
    else if (sev === VALIDATOR_SEV_INFO_) c.info++;
    else c.ok++;
  }
  return c;
}

/** Human one-liner for the schema section header. */
function buildSchemaSummary_(signals, reconciledCount) {
  var tail = (reconciledCount === 0)
    ? 'No legacy-schema differences detected.'
    : (reconciledCount + ' supported legacy-schema difference' +
       (reconciledCount === 1 ? '' : 's') + ' reconciled.');
  return 'Workbook type: ' + signals.workbookType +
    ' · Compatibility: ' + signals.compatibility + ' · ' + tail;
}

/* -------------------------------------------------------------------------- */
/*  Log formatter                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Human-readable Schema Evolution report for the execution log (advisory).
 * @param {Object} report validateSchemaEvolution_ output
 * @returns {string}
 */
function validatorFormatSchemaEvolutionReport_(report) {
  var lines = [];
  lines.push('===== SCHEMA EVOLUTION (advisory — never FAIL) =====');
  lines.push('Workbook      : ' + report.workbook);
  lines.push('ID            : ' + report.workbookId);
  lines.push('Workbook type : ' + report.workbookType);
  lines.push('Compatibility : ' + report.compatibility);
  lines.push('Schema        : ' + report.schema.overall + '   (' + report.schema.summary + ')');
  lines.push('Provisioning  : ' + report.provisioning.overall +
    '   (ERROR ' + report.provisioning.counts.error + ', WARN ' + report.provisioning.counts.warn +
    ', INFO ' + report.provisioning.counts.info + ', OK ' + report.provisioning.counts.ok + ')');
  lines.push('');

  if (report.schema.findings.length === 0) {
    lines.push('No supported legacy-schema differences to reconcile.');
  } else {
    lines.push('Reconciled as supported legacy schema:');
    for (var i = 0; i < report.schema.sheets.length; i++) {
      var s = report.schema.sheets[i];
      lines.push('[INFO] ' + s.name);
      for (var j = 0; j < s.findings.length; j++) {
        lines.push('    - ' + s.findings[j].kind + ': ' + s.findings[j].message);
      }
    }
  }

  lines.push('');
  lines.push('===== END SCHEMA EVOLUTION (' + report.compatibility + ') =====');
  return lines.join('\n');
}
