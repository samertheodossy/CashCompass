/** Read-only Conditional Formatting validation (Workbook Health Module 4). */
function validateConditionalFormatting_(ss, options) {
  var findings = [];
  var sheets = [];
  var name = 'INPUT - Cash Flow ' + (new Date()).getFullYear();
  var allowed = options && options.sheetNames ? options.sheetNames : null;
  if (!allowed || allowed.indexOf(name) !== -1) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      var signatures = validatorConditionalFormatSignatures_(sheet);
      var positive = (typeof CASH_FLOW_HEALTH_COLOR_POSITIVE_ === 'string') ? CASH_FLOW_HEALTH_COLOR_POSITIVE_.toLowerCase() : '#38761d';
      var negative = (typeof CASH_FLOW_HEALTH_COLOR_NEGATIVE_ === 'string') ? CASH_FLOW_HEALTH_COLOR_NEGATIVE_.toLowerCase() : '#cc0000';
      var required = [
        { fragments: ['="Income"'], color: positive, label: 'Income positive' },
        { fragments: ['="Expense"'], color: negative, label: 'Expense negative' },
        { fragments: ['="Summary"', '>0'], color: positive, label: 'Summary positive' },
        { fragments: ['="Summary"', '<0'], color: negative, label: 'Summary negative' }
      ];
      for (var i = 0; i < required.length; i++) {
        var found = false;
        for (var j = 0; j < signatures.length; j++) {
          var sig = signatures[j];
          var allFragments = true;
          for (var f = 0; f < required[i].fragments.length; f++) {
            if (sig.formula.indexOf(required[i].fragments[f]) === -1) { allFragments = false; break; }
          }
          if (allFragments && sig.fontColor === required[i].color) { found = true; break; }
        }
        if (!found) findings.push(validatorFinding_(VALIDATOR_SEV_WARN_, name, 'conditionalFormat',
          'Missing canonical Cash Flow rule: ' + required[i].label + ' (' + required[i].color + ').'));
      }
      if (!findings.length) findings.push(validatorFinding_(VALIDATOR_SEV_OK_, name, 'conditionalFormat', 'Canonical Cash Flow rule signatures are present.'));
      sheets.push({ name: name, status: validatorWorstSeverity_(findings), findings: findings.slice() });
    }
  }
  var counts = schemaCountFindings_(findings);
  return { type: 'conditionalFormatting', advisory: true, workbook: safeName_(ss), workbookId: safeId_(ss),
    overall: counts.warn || counts.error ? 'DRIFT' : 'PASS', counts: counts, sheets: sheets, findings: findings };
}

function validatorConditionalFormatSignatures_(sheet) {
  var rules = sheet.getConditionalFormatRules() || [];
  var out = [];
  for (var i = 0; i < rules.length; i++) {
    try {
      var bc = rules[i].getBooleanCondition();
      var vals = bc ? bc.getCriteriaValues() : [];
      var color = bc && typeof bc.getFontColor === 'function' ? String(bc.getFontColor() || '').toLowerCase() : '';
      var ranges = rules[i].getRanges() || [];
      var a1 = [];
      for (var r = 0; r < ranges.length; r++) a1.push(ranges[r].getA1Notation());
      out.push({ formula: String(vals || ''), fontColor: color, ranges: a1 });
    } catch (_e) { out.push({ formula: 'UNINSPECTABLE', fontColor: '', ranges: [] }); }
  }
  return out;
}

function validatorRunConditionalFormatting(spreadsheetIdOverride, options) {
  assertValidatorAllowed_();
  var id = String(spreadsheetIdOverride || '').trim() || getValidatorDefaultCentralWorkbookId_();
  return validateConditionalFormatting_(SpreadsheetApp.openById(id), options || {});
}
