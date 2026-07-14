/**
 * validator_drift.js — Validator Phase 2B: Workbook Drift Validation (READ-ONLY, ADVISORY).
 *
 * Answers a DIFFERENT question than Provisioning (VALIDATOR_ARCHITECTURE.md §10.0a):
 *   Provisioning — "Was this workbook created correctly?"        (gating; ERROR ⇒ FAIL)
 *   Drift        — "Has this workbook diverged from the current  (advisory; NEVER FAIL)
 *                   canonical product standard?"
 *
 * Drift is ADVISORY: it reports divergence from the evolving canonical standard for
 * awareness only. Drift NEVER produces a FAIL and NEVER blocks anything — a width
 * below canonical is ambiguous read-only (first-create not applied, OR the user
 * narrowed it, OR an older canonical standard), so it belongs here, not in the
 * pass/fail Provisioning gate.
 *
 * Scope (this initial slice): canonical column widths only. Row heights, family
 * styling, product-decision colors, formula-shape drift, and conditional-format
 * drift are future Drift-class checks (not implemented here).
 *
 * Reuse, do not duplicate: this module owns NO check logic of its own. It composes
 * the same per-check functions and helpers the Provisioning runner uses —
 * getValidatorCanonicalModel_ (validator_rules.js), and checkSheetWidths_ /
 * validatorReadHeaderRow_ / validatorFinding_ / validatorWorstSeverity_ / pushAll_ /
 * safeName_ / safeId_ / the VALIDATOR_SEV_* constants (validator_provisioning.js).
 *
 * Boundary: every workbook access is a getter (getSheetByName / getRange().getValues()
 * / getColumnWidth / getLastColumn / getName / getId). No setters.
 *
 * Guard: reuses the existing Validator guard unchanged — assertValidatorAllowed_().
 */

/**
 * PUBLIC (guarded) DEVELOPER RUNNER — Workbook Drift Validation.
 *
 * Deterministic developer tooling: validates a Script Property–configured workbook
 * by default (VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID) and NEVER "whatever
 * getUserSpreadsheet_() happens to resolve". Mirrors validatorRunProvisioning:
 *   - spreadsheetIdOverride provided → validate that exact workbook (preferred for
 *     one-off diagnostics).
 *   - omitted → VALIDATOR_DEFAULT_CENTRAL_WORKBOOK_ID via
 *     getValidatorDefaultCentralWorkbookId_() (throws if unset). No silent fallback
 *     to getUserSpreadsheet_().
 *
 * Read-only. Admin-gated + flag-gated via assertValidatorAllowed_() (first guard).
 * Advisory: the returned report's `overall` is only ever 'PASS' or 'DRIFT' — never
 * 'FAIL'.
 *
 * @param {string=} spreadsheetIdOverride Optional workbook ID to validate.
 * @param {Object=} options
 *   - {string} outputMode  'log' (default) | 'json' | 'both'
 * @returns {Object} the structured drift report
 */
function validatorRunWorkbookDrift(spreadsheetIdOverride, options) {
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
    throw new Error('validatorRunWorkbookDrift: openById returned null for the supplied workbook ID.');
  }

  var report = validateDrift_(ss);

  if (outputMode === 'json' || outputMode === 'both') {
    validatorLogChunked_('WORKBOOK DRIFT REPORT (JSON)', JSON.stringify(report, null, 2));
  }
  if (outputMode === 'log' || outputMode === 'both') {
    Logger.log(validatorFormatDriftReport_(report));
  }
  return report;
}

/**
 * INTERNAL — pure read-only Workbook Drift comparison of a workbook against the
 * canonical model. Kept ss-parameterized (no resolution/guard inside) so a future
 * Workbook Health orchestrator can reuse it alongside validateProvisioning_(ss).
 *
 * This slice checks canonical column widths only, reusing checkSheetWidths_ (the
 * same function the Provisioning runner used before the split). Sheets with no
 * canonical width map, or sheets not present in the workbook (presence is
 * Provisioning's concern), are skipped. Never throws for a single bad sheet.
 *
 * Advisory: `overall` is 'PASS' (no drift) or 'DRIFT' (divergence found) — NEVER
 * 'FAIL'.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object=} options - { Array<string> sheetNames } optional allow-list to
 *   scope drift to only those canonical sheets (see validatorScopeModel_).
 *   Omitted → the full canonical model (unchanged default for all callers).
 * @returns {Object} report
 */
function validateDrift_(ss, options) {
  var model = validatorScopeModel_(getValidatorCanonicalModel_(), options);
  var findings = [];
  var sheetsOut = [];

  for (var i = 0; i < model.length; i++) {
    var rule = model[i];

    // Drift (this slice) only concerns sheets with a canonical width map.
    if (!rule.widths) continue;

    var sheetFindings = [];
    var sheet = null;

    try {
      sheet = ss.getSheetByName(rule.name);
      if (!sheet) continue; // presence is Provisioning's job, not Drift's

      var actualHeaders = validatorReadHeaderRow_(sheet, rule.headerRow);
      // Reuse the exact width check the Provisioning runner used pre-split.
      pushAll_(sheetFindings, checkSheetWidths_(sheet, rule, actualHeaders));

      if (sheetFindings.length === 0) {
        sheetFindings.push(validatorFinding_(VALIDATOR_SEV_OK_, rule.name, 'width',
          'Column widths match or exceed canonical.'));
      }
    } catch (e) {
      // Even an unexpected read error is advisory here — surfaced as WARN, never FAIL.
      sheetFindings.push(validatorFinding_(VALIDATOR_SEV_WARN_, rule.name, 'width',
        'Drift check failed: ' + (e && e.message ? e.message : e)));
    }

    sheetsOut.push({
      name: rule.name,
      presence: rule.presence,
      status: validatorWorstSeverity_(sheetFindings),
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

  // ADVISORY: never FAIL. 'DRIFT' when any divergence is found, else 'PASS'.
  var overall = (counts.error > 0 || counts.warn > 0) ? 'DRIFT' : 'PASS';

  return {
    type: 'drift',
    advisory: true,
    workbook: safeName_(ss),
    workbookId: safeId_(ss),
    overall: overall,
    counts: counts,
    sheets: sheetsOut,
    findings: findings
  };
}

/**
 * Human-readable advisory report for the execution log.
 * @param {Object} report
 * @returns {string}
 */
function validatorFormatDriftReport_(report) {
  var lines = [];
  lines.push('===== WORKBOOK DRIFT (advisory — never FAIL) =====');
  lines.push('Workbook : ' + report.workbook);
  lines.push('ID       : ' + report.workbookId);
  lines.push('Overall  : ' + report.overall +
    '   (WARN ' + report.counts.warn + ', INFO ' + report.counts.info +
    ', OK ' + report.counts.ok + ')');
  lines.push('');

  if (!report.sheets.length) {
    lines.push('(no sheets with a canonical width map were present to compare)');
  }
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
  lines.push('===== END WORKBOOK DRIFT (' + report.overall + ', advisory) =====');
  return lines.join('\n');
}
