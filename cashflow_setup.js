function createNextYearCashFlowSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const sourceSheet = getCashFlowSheet_(ss, currentYear);
  const targetName = getCashFlowSheetName_(nextYear);

  if (ss.getSheetByName(targetName)) {
    SpreadsheetApp.getUi().alert('Sheet already exists: ' + targetName + '. Delete it first, then run again.');
    return;
  }

  const sourceRange = sourceSheet.getDataRange();
  const sourceValues = sourceRange.getValues();
  const numRows = sourceValues.length;
  const numCols = sourceValues[0].length;

  const newSheet = ss.insertSheet(targetName);

  sourceRange.copyTo(
    newSheet.getRange(1, 1),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );

  for (let r = 1; r <= numRows; r++) {
    newSheet.setRowHeight(r, sourceSheet.getRowHeight(r));
  }

  for (let c = 1; c <= numCols; c++) {
    newSheet.setColumnWidth(c, sourceSheet.getColumnWidth(c));
  }

  const newValues = [];
  const headerRow = buildCashFlowHeaderRow_(numCols, nextYear);
  newValues.push(headerRow);

  for (let r = 1; r < numRows; r++) {
    const row = [];

    const type = String(sourceValues[r][0] || '').trim();
    const payee = String(sourceValues[r][1] || '').trim();

    for (let c = 0; c < numCols; c++) {
      if (isCashFlowMonthColumnIndex_(c)) {
        row.push('');
      } else if (type === 'Summary' && payee === 'Cash Flow Per Month' && c === numCols - 1) {
        row.push('');
      } else {
        row.push(sourceValues[r][c]);
      }
    }

    newValues.push(row);
  }

  newSheet.getRange(1, 1, numRows, numCols).setValues(newValues);

  // Force header month cells to plain text so Jan-27 stays Jan-27
  for (let c = 3; c <= Math.min(14, numCols); c++) {
    const cell = newSheet.getRange(1, c);
    cell.setNumberFormat('@STRING@');
    cell.setValue(headerRow[c - 1]);
  }

  // Re-apply currency format to month columns below header
  for (let c = 3; c <= Math.min(14, numCols); c++) {
    newSheet.getRange(2, c, Math.max(1, numRows - 1), 1)
      .setNumberFormat('$#,##0.00;-$#,##0.00');
  }

  const summaryRow = findCashFlowSummaryRow_(newSheet, numRows);
  if (summaryRow > 0) {
    writeCashFlowSummaryFormulas_(newSheet, summaryRow, numRows, numCols);
  }

  newSheet.setFrozenRows(sourceSheet.getFrozenRows());
  newSheet.setFrozenColumns(sourceSheet.getFrozenColumns());

  ss.setActiveSheet(newSheet);
  SpreadsheetApp.getUi().alert('Created clean sheet: ' + targetName);
}

function buildCashFlowHeaderRow_(numCols, year) {
  const suffix = String(year).slice(-2);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const row = new Array(numCols).fill('');
  if (numCols >= 1) row[0] = 'Type';
  if (numCols >= 2) row[1] = 'Payee';

  for (let i = 0; i < months.length && (i + 2) < numCols; i++) {
    row[i + 2] = months[i] + '-' + suffix;
  }

  return row;
}

function isCashFlowMonthColumnIndex_(zeroBasedColIndex) {
  return zeroBasedColIndex >= 2 && zeroBasedColIndex <= 13;
}

function findCashFlowSummaryRow_(sheet, numRows) {
  const values = sheet.getRange(2, 1, Math.max(1, numRows - 1), 2).getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    const type = String(values[i][0] || '').trim();
    const payee = String(values[i][1] || '').trim();

    if (type === 'Summary' && payee === 'Cash Flow Per Month') {
      return i + 2;
    }
  }

  return -1;
}

function writeCashFlowSummaryFormulas_(sheet, summaryRow, numRows, numCols) {
  const firstDataRow = 2;
  const lastDataRow = summaryRow - 1;

  // Month summary formulas for C:N
  for (let c = 3; c <= Math.min(14, numCols); c++) {
    const colLetter = columnToLetter_(c);

    // Sum all Income and Expense rows above summary row for this month
    const formula =
      '=SUMIF($A$' + firstDataRow + ':$A$' + lastDataRow + ',"Income",' + colLetter + '$' + firstDataRow + ':' + colLetter + '$' + lastDataRow + ')' +
      '+SUMIF($A$' + firstDataRow + ':$A$' + lastDataRow + ',"Expense",' + colLetter + '$' + firstDataRow + ':' + colLetter + '$' + lastDataRow + ')';

    const cell = sheet.getRange(summaryRow, c);
    cell.setFormula(formula);
    cell.setNumberFormat('$#,##0.00;-$#,##0.00');
  }

  // Final yearly total cell = sum of summary month cells
  if (numCols >= 16) {
    const totalCell = sheet.getRange(summaryRow, numCols);
    totalCell.setFormula('=SUM(C' + summaryRow + ':N' + summaryRow + ')');
    totalCell.setNumberFormat('$#,##0.00;-$#,##0.00');
  }
}

function columnToLetter_(column) {
  let temp = '';
  let letter = '';

  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }

  return letter;
}