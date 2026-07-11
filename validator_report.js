/**
 * CashCompass Validator — report shaping / logging (READ-ONLY).
 *
 * Formats snapshot + comparison output for the execution log. No workbook
 * access; pure string/logging helpers. All internal (trailing underscore).
 */

/**
 * Logs a long JSON payload to the execution log in chunks (Logger truncates
 * very long single entries).
 */
function validatorLogChunked_(label, json) {
  var CHUNK = 45000;
  Logger.log('===== ' + label + ' — ' + json.length + ' chars =====');
  for (var i = 0; i < json.length; i += CHUNK) {
    Logger.log('[' + (Math.floor(i / CHUNK) + 1) + '] ' + json.substring(i, i + CHUNK));
  }
  Logger.log('===== END ' + label + ' =====');
}

/** Human-readable grouped comparison report to the execution log. */
function validatorLogComparisonReport_(report) {
  Logger.log('===== GOLDEN WORKBOOK CONVERGENCE REPORT =====');
  Logger.log('Golden : ' + report.meta.golden.name + ' (' + report.meta.golden.id + ')');
  Logger.log('Central: ' + report.meta.central.name + ' (' + report.meta.central.id + ')');
  Logger.log(report.meta.bordersNote);

  // Recommendation summary FIRST — the headline decision counts.
  var rs = report.recommendationSummary || {};
  Logger.log('');
  Logger.log('----- RECOMMENDATION SUMMARY -----');
  Logger.log('Adopt Golden     : ' + (rs.AdoptGolden || 0));
  Logger.log('Keep Central     : ' + (rs.KeepCentral || 0));
  Logger.log('Product Decision : ' + (rs.ProductDecision || 0));
  Logger.log('Ignore Noise     : ' + (rs.IgnoreNoise || 0));
  Logger.log('Needs Review     : ' + (rs.NeedsReview || 0));

  var s = report.summary || {};
  Logger.log('');
  Logger.log('----- SUMMARY' + (report.meta.redacted ? ' (values redacted)' : '') + ' -----');
  Logger.log('Total differences               : ' + (s.totalDiffs || 0));
  Logger.log('Present-in-both formatting diffs : ' + (s.presentInBothFormattingDiffs || 0));
  Logger.log('Present-in-both structural diffs : ' + (s.presentInBothStructuralDiffs || 0));
  Logger.log('Missing-in-central sheets        : ' + (s.missingInCentralSheets || 0));
  Logger.log('Central-only sheets              : ' + (s.centralOnlySheets || 0));
  Logger.log('Ignored/expected differences     : ' + (s.ignoredExpectedDiffs || 0));

  var cl = report.classification || {};
  Logger.log('');
  Logger.log('----- CLASSIFICATION -----');
  Logger.log('1) Missing in Central (module not provisioned/used yet): ' + validatorFmtList_(cl.missingInCentral));
  Logger.log('2) Intentional Central-only system sheets (ignored)    : ' + validatorFmtList_(cl.centralOnlyExpected));
  Logger.log('   Unexpected Central-only sheets                      : ' + validatorFmtList_(cl.centralOnly));
  Logger.log('3) Formatting mismatch (present in both)               : ' + validatorFmtList_(cl.formattingMismatchSheets));
  Logger.log('4) Structural/schema mismatch (present in both)        : ' + validatorFmtList_(cl.structuralMismatchSheets));

  // Per-family summary: counts, recommendations, and owning helper(s).
  var fsum = report.familySummary || {};
  Logger.log('');
  Logger.log('----- FAMILY SUMMARY -----');
  for (var fj = 0; fj < VALIDATOR_FAMILY_ORDER_.length; fj++) {
    var famName = VALIDATOR_FAMILY_ORDER_[fj];
    var fstat = fsum[famName];
    if (!fstat) continue;
    Logger.log('');
    Logger.log('# ' + famName +
               '  (formatting: ' + fstat.formatting +
               ', structural: ' + fstat.structural +
               ', presence: ' + fstat.presence + ')');
    Logger.log('  recommendations: ' + validatorFmtReco_(fstat.recommendations));
    Logger.log('  owning helper(s): ' + validatorFmtList_(fstat.helpers));
  }

  // Focused convergence priority — only sheets present in both.
  Logger.log('');
  Logger.log('----- CONVERGENCE PRIORITY (present-in-both only) -----');
  var cp = report.convergencePriority || [];
  for (var pi = 0; pi < cp.length; pi++) {
    var item = cp[pi];
    Logger.log('');
    Logger.log('### ' + item.sheet +
               (item.presentInBoth ? '' : '  [NOT PRESENT IN BOTH — skipped]') +
               '  (formatting: ' + item.formattingCount + ', structural: ' + item.structuralCount + ')');
    for (var di = 0; di < item.diffs.length; di++) {
      var pd = item.diffs[di];
      Logger.log('  [' + (pd.recommendation || '?') + '] [' + pd.category + '] ' + pd.rowType + ' · ' + pd.property +
                 '\n      Golden : ' + pd.golden +
                 '\n      Central: ' + pd.central +
                 '\n      ⇒ ' + pd.suggestedHelper);
    }
  }

  // Full detail, grouped by design family. Noise-reduced: IgnoreNoise diffs are
  // suppressed here (rolled up into a count) so the dump surfaces actionable
  // decisions only.
  for (var f = 0; f < VALIDATOR_FAMILY_ORDER_.length; f++) {
    var fam = VALIDATOR_FAMILY_ORDER_[f];
    var diffs = report.groups[fam] || [];
    var suppressed = 0;
    Logger.log('');
    Logger.log('===== ' + fam + ' (' + diffs.length + ') =====');
    for (var i = 0; i < diffs.length; i++) {
      var d = diffs[i];
      if (d.recommendation === 'IgnoreNoise') { suppressed++; continue; }
      Logger.log('[' + (d.recommendation || '?') + '] [' + (d.category || '?') + '] [' + d.sheet + '] ' + d.rowType + ' · ' + d.property +
                 '\n    Golden : ' + d.golden +
                 '\n    Central: ' + d.central +
                 '\n    ⇒ ' + d.suggestedHelper);
    }
    if (suppressed > 0) {
      Logger.log('(+' + suppressed + ' IgnoreNoise diffs suppressed — see recommendation summary)');
    }
  }
  Logger.log('===== END REPORT =====');
}

/** Formats a recommendation counter in fixed order, omitting zeros. */
function validatorFmtReco_(counts) {
  if (!counts) return '(none)';
  var parts = [];
  for (var i = 0; i < VALIDATOR_RECO_ORDER_.length; i++) {
    var k = VALIDATOR_RECO_ORDER_[i];
    if (counts[k]) parts.push(k + ' ' + counts[k]);
  }
  return parts.length ? parts.join(', ') : '(none)';
}

/** Formats a string array for a one-line log entry; '(none)' when empty. */
function validatorFmtList_(arr) {
  if (!arr || !arr.length) return '(none)';
  return arr.join(', ');
}
