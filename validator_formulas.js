/** Read-only targeted formula validation (Workbook Health Module 3). */
function validateFormulas_(ss, options) {
  var findings = [];
  var sheets = [];
  var allowed = options && options.sheetNames ? options.sheetNames : null;
  var names = [
    'INPUT - Cash Flow ' + (new Date()).getFullYear(),
    'INPUT - Bank Accounts',
    'INPUT - Investments',
    'INPUT - Debts'
  ];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (allowed && allowed.indexOf(name) === -1) continue;
    var sheet = ss.getSheetByName(name);
    if (!sheet) continue;
    var fs = validatorCheckSummaryFormulas_(sheet);
    if (!fs.length) fs.push(validatorFinding_(VALIDATOR_SEV_OK_, name, 'formula', 'No altered or hardcoded summary formulas detected.'));
    sheets.push({ name: name, status: validatorWorstSeverity_(fs), findings: fs });
    pushAll_(findings, fs);
  }
  var counts = schemaCountFindings_(findings);
  return {
    type: 'formulas', advisory: true, workbook: safeName_(ss), workbookId: safeId_(ss),
    overall: counts.error || counts.warn ? 'DRIFT' : 'PASS', counts: counts,
    sheets: sheets, findings: findings
  };
}

function validatorCheckSummaryFormulas_(sheet) {
  var out = [];
  var lastRow = Math.max(1, sheet.getLastRow());
  var lastCol = Math.max(1, sheet.getLastColumn());
  // Privacy/minimal-I/O: locate summary labels from only the first two columns,
  // then read formulas/display values for summary rows only.
  var labelsOnly = sheet.getRange(1, 1, lastRow, Math.min(2, lastCol)).getDisplayValues();
  var name = sheet.getName();
  var labels = { 'Cash Flow Per Month': true, 'Total Accounts': true, 'Account Totals': true, 'TOTAL DEBT': true };
  for (var r = 0; r < labelsOnly.length; r++) {
    var rowLabel = String((labelsOnly[r] && labelsOnly[r][0]) || '').trim();
    var payee = String((labelsOnly[r] && labelsOnly[r][1]) || '').trim();
    if (!labels[rowLabel] && !labels[payee]) continue;
    var rowRange = sheet.getRange(r + 1, 1, 1, lastCol);
    var formulas = rowRange.getFormulas()[0];
    var values = rowRange.getDisplayValues()[0];
    var foundFormula = false;
    for (var c = 1; c < formulas.length; c++) {
      var formula = String(formulas[c] || '').trim();
      var display = String(values[c] == null ? '' : values[c]).trim();
      if (formula) {
        foundFormula = true;
        if (!validatorFormulaShapeMatches_(name, formula, r + 1, c + 1)) {
          out.push(validatorFinding_(VALIDATOR_SEV_WARN_, name, 'formula',
            'Summary cell R' + (r + 1) + 'C' + (c + 1) + ' has an unrecognized formula shape.'));
        }
      } else if (display !== '' && /^[-+$0-9,.()% ]+$/.test(display)) {
        out.push(validatorFinding_(VALIDATOR_SEV_WARN_, name, 'formula',
          'Summary cell R' + (r + 1) + 'C' + (c + 1) + ' is a hardcoded value.'));
      }
    }
    if (!foundFormula) {
      out.push(validatorFinding_(VALIDATOR_SEV_WARN_, name, 'formula',
        'Summary row ' + (r + 1) + ' contains no formulas.'));
    }
  }
  return out;
}

function validatorFormulaShapeMatches_(sheetName, formula, summaryRow, col) {
  var normalized = String(formula || '').replace(/\s+/g, '').toUpperCase();
  var colLetter = columnToLetter_(col).toUpperCase();
  if (/^=SUMIF\(/.test(normalized)) {
    if (String(sheetName).indexOf('INPUT - Cash Flow ') !== 0) return false;
    var lastDataRow = Math.max(2, summaryRow - 1);
    var ownRange = '$' + colLetter + '$2:$' + colLetter + '$' + lastDataRow;
    return normalized.indexOf('"INCOME"') !== -1 && normalized.indexOf('"EXPENSE"') !== -1 &&
      normalized.indexOf(ownRange) !== -1 && (normalized.match(/SUMIF\(/g) || []).length === 2;
  }
  // Google Sheets normalizes a one-row range such as =SUM(H3:H3) to
  // =SUM(H3). This is still the canonical summary shape when the referenced
  // cell is in the summary cell's own column and above the summary row.
  var single = normalized.match(/^=SUM\(\$?([A-Z]+)\$?(\d+)\)$/);
  if (single) {
    return single[1] === colLetter && Number(single[2]) >= 2 && Number(single[2]) < summaryRow;
  }
  var m = normalized.match(/^=SUM\(\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)\)$/);
  if (!m) return false;
  var startCol = m[1], startRow = Number(m[2]), endCol = m[3], endRow = Number(m[4]);
  if (startCol === endCol) {
    return startCol === colLetter && startRow >= 2 && endRow < summaryRow;
  }
  // Cash Flow yearly Total is the only canonical horizontal summary SUM.
  return String(sheetName).indexOf('INPUT - Cash Flow ') === 0 &&
    startRow === summaryRow && endRow === summaryRow;
}

function validatorRunFormulaValidation(spreadsheetIdOverride, options) {
  assertValidatorAllowed_();
  var id = String(spreadsheetIdOverride || '').trim() || getValidatorDefaultCentralWorkbookId_();
  return validateFormulas_(SpreadsheetApp.openById(id), options || {});
}
