/** Read-only Named Range validation (Workbook Health Module 5). */
function validateNamedRanges_(ss) {
  var findings = [];
  var ranges = ss.getNamedRanges() || [];
  for (var i = 0; i < ranges.length; i++) {
    var name = '';
    try { name = ranges[i].getName(); } catch (_e) { name = '(unreadable)'; }
    findings.push(validatorFinding_(VALIDATOR_SEV_WARN_, '(workbook)', 'namedRange',
      'Unexpected named range: ' + name + '. CashCompass currently defines no canonical named ranges.'));
  }
  if (!findings.length) findings.push(validatorFinding_(VALIDATOR_SEV_OK_, '(workbook)', 'namedRange', 'No unexpected named ranges.'));
  var counts = schemaCountFindings_(findings);
  return { type: 'namedRanges', advisory: true, workbook: safeName_(ss), workbookId: safeId_(ss),
    overall: counts.warn || counts.error ? 'DRIFT' : 'PASS', counts: counts, findings: findings };
}

function validatorRunNamedRanges(spreadsheetIdOverride) {
  assertValidatorAllowed_();
  var id = String(spreadsheetIdOverride || '').trim() || getValidatorDefaultCentralWorkbookId_();
  return validateNamedRanges_(SpreadsheetApp.openById(id));
}
