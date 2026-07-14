/**
 * test_harness_report.js — Test Harness · report shaping (V1).
 *
 * Pure report builders + formatters for the Test Harness. NO I/O beyond logging.
 * Owns the scenario result envelope, the PASS/FAIL gate, and the human/JSON log
 * shaping. The Harness core produces the raw inputs (workbook descriptor, actions
 * list, the three Validator reports); this module turns them into a structured,
 * loggable result.
 *
 * Gate: a scenario PASSes iff it raised no error AND Provisioning is PASS AND every
 * functional assertion (E0a, if any) passed. Schema Evolution and Workbook Drift are
 * ADVISORY — they never fail a scenario. When a scenario declares no expectedOutcome,
 * the functional section is null and does not affect the gate (backward compatible).
 *
 * Reuses the Validator severity vocabulary (VALIDATOR_SEV_*) and the chunked log
 * shaper validatorLogChunked_ (validator_report.js). Design of record:
 * TEST_HARNESS_ARCHITECTURE.md §6.
 */

/**
 * Slim summary of a Validator report ({ overall, counts }). Tolerates null.
 * @param {Object} r a validator report (provisioning/drift) or null
 * @returns {Object|null}
 */
function harnessSummarizeValidator_(r) {
  if (!r) return null;
  return { overall: r.overall, counts: r.counts };
}

/**
 * Build the functional-assertion section (E0a) from the collector results.
 * Returns null when there are no assertions (scenario declared no expectedOutcome),
 * so the gate is unaffected. Forward-compatible shape: overall + counts + results
 * (module grouping / categories are later slices; the raw results already carry the
 * `module` / `category` fields).
 *
 * @param {Array<Object>|undefined} assertions collector results (test_harness_assert.js)
 * @returns {Object|null} { overall, counts:{pass,fail}, results }
 */
function harnessBuildFunctionalSection_(assertions) {
  if (!assertions || !assertions.length) return null;
  var pass = 0, fail = 0;
  for (var i = 0; i < assertions.length; i++) {
    if (assertions[i] && assertions[i].pass) pass++; else fail++;
  }
  return {
    overall: fail === 0 ? 'PASS' : 'FAIL',
    counts: { pass: pass, fail: fail },
    results: assertions
  };
}

/**
 * Build the structured scenario result.
 *
 * @param {Object} p {
 *   scenario:  { id, category, description, expectedSheets:Array<string>|null },
 *   runId:     string,
 *   workbook:  { id, name, url },
 *   actions:   Array<string>,
 *   validators:{ provisioning, schema, drift } (raw Validator reports or null),
 *   assertions: Array<Object> (functional-assertion results, E0a) or undefined,
 *   disposition: string,
 *   error:     string|null,
 *   startedAt: number (ms), finishedAt: number (ms)
 * }
 * @returns {Object} the scenario report
 */
function buildHarnessScenarioReport_(p) {
  var prov = p.validators && p.validators.provisioning ? p.validators.provisioning : null;
  var schema = p.validators && p.validators.schema ? p.validators.schema : null;
  var drift = p.validators && p.validators.drift ? p.validators.drift : null;

  // Functional assertions (E0a). Null when the scenario declares no expectedOutcome
  // → does not affect the gate (backward compatible).
  var functional = harnessBuildFunctionalSection_(p.assertions);

  var provPass = !!(prov && prov.overall === 'PASS');
  var functionalPass = !functional || functional.overall === 'PASS';
  var overall = (!p.error && provPass && functionalPass) ? 'PASS' : 'FAIL';

  var schemaSummary = null;
  if (schema) {
    schemaSummary = {
      workbookType: schema.workbookType,
      compatibility: schema.compatibility,
      overall: (schema.schema && schema.schema.overall) || null,
      // schema.schema holds the reconciled schema section; provisioning nested is reconciled
      reconciled: (schema.schema && schema.schema.counts) ? schema.schema.counts.info : 0
    };
  }

  return {
    type: 'harnessScenario',
    scenario: p.scenario,
    runId: p.runId,
    workbook: p.workbook,
    disposition: p.disposition,
    actions: p.actions || [],
    validators: {
      provisioning: harnessSummarizeValidator_(prov),
      schema: schemaSummary,
      drift: harnessSummarizeValidator_(drift)
    },
    functional: functional,
    gate: {
      basis: 'Provisioning must PASS + all functional assertions must PASS; Schema Evolution + Workbook Drift are advisory (never fail).',
      provisioning: prov ? prov.overall : 'NOT RUN',
      functional: functional ? functional.overall : 'NOT RUN'
    },
    overall: overall,
    error: p.error || null,
    startedAt: p.startedAt ? new Date(p.startedAt).toISOString() : null,
    finishedAt: p.finishedAt ? new Date(p.finishedAt).toISOString() : null,
    durationMs: (p.startedAt && p.finishedAt) ? (p.finishedAt - p.startedAt) : null,
    // Full nested Validator reports for programmatic callers (not printed in the
    // human log; available via the JSON chunk).
    full: { provisioning: prov, schema: schema, drift: drift }
  };
}

/** Human-readable one-scenario report for the execution log. */
function formatHarnessReport_(report) {
  var v = report.validators || {};
  var lines = [];
  lines.push('===== TEST HARNESS — SCENARIO RESULT =====');
  lines.push('Scenario     : ' + report.scenario.id + '  [' + report.scenario.category + ']');
  lines.push('Description  : ' + report.scenario.description);
  lines.push('Run ID       : ' + report.runId);
  lines.push('Workbook     : ' + report.workbook.name);
  lines.push('Workbook ID  : ' + report.workbook.id);
  if (report.workbook.url) lines.push('URL          : ' + report.workbook.url);
  lines.push('Disposition  : ' + report.disposition);
  if (report.scenario.expectedSheets && report.scenario.expectedSheets.length) {
    lines.push('Validated scope: ' + report.scenario.expectedSheets.join(', ') +
      '  (scenario-scoped — sheets this scenario creates)');
  }
  lines.push('');
  lines.push('Actions run:');
  if (!report.actions.length) lines.push('  (none)');
  for (var i = 0; i < report.actions.length; i++) lines.push('  ' + (i + 1) + '. ' + report.actions[i]);
  lines.push('');
  lines.push('Validator results:');
  lines.push('  Provisioning : ' + (v.provisioning
    ? v.provisioning.overall + harnessCountsTail_(v.provisioning.counts)
    : 'not run'));
  lines.push('  Schema Evol. : ' + (v.schema
    ? v.schema.workbookType + ' / ' + v.schema.compatibility +
      ' (' + v.schema.reconciled + ' legacy reconciled)'
    : 'not run'));
  lines.push('  Workbook Drift: ' + (v.drift
    ? v.drift.overall + harnessCountsTail_(v.drift.counts)
    : 'not run'));
  var f = report.functional;
  lines.push('  Functional   : ' + (f
    ? f.overall + '  (' + f.counts.pass + ' pass, ' + f.counts.fail + ' fail)'
    : 'not run'));
  if (f && f.counts.fail > 0) {
    for (var fi = 0; fi < f.results.length; fi++) {
      var a = f.results[fi];
      if (a && !a.pass) {
        lines.push('    FAIL: ' + a.label + ' — ' + a.reason +
          (a.location ? '  @ ' + a.location : ''));
      }
    }
  }
  if (report.error) {
    lines.push('');
    lines.push('ERROR        : ' + report.error);
  }
  lines.push('');
  lines.push('Gate         : ' + report.gate.basis);
  lines.push('OVERALL      : ' + report.overall);
  lines.push('===== END SCENARIO (' + report.overall + ') =====');
  return lines.join('\n');
}

/** " (ERROR e, WARN w, INFO i, OK o)" tail for a counts object. */
function harnessCountsTail_(counts) {
  if (!counts) return '';
  return '  (ERROR ' + (counts.error || 0) + ', WARN ' + (counts.warn || 0) +
    ', INFO ' + (counts.info || 0) + ', OK ' + (counts.ok || 0) + ')';
}

/** Log a scenario report: human summary + chunked JSON (full detail). */
function harnessLogReport_(report) {
  Logger.log(formatHarnessReport_(report));
  try {
    if (typeof validatorLogChunked_ === 'function') {
      validatorLogChunked_('TEST HARNESS SCENARIO (JSON)', JSON.stringify(report, null, 2));
    }
  } catch (_e) { /* logging is best-effort */ }
}
