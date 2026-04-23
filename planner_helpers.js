function findLabelValueCell_(sheet, label) {
  const values = sheet.getDataRange().getValues();
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === label) {
      return sheet.getRange(r + 1, 2);
    }
  }
  return null;
}

function readSheetAsObjects_(ss, sheetKey) {
  const sheet = getSheet_(ss, sheetKey);

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();

  if (values.length < 2) return [];

  const headers = displayValues[0].map(function(h) {
    return String(h || '').trim();
  });

  return values.slice(1).map(function(row, rowIndex) {
    const obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i];
      obj['__display__' + h] = displayValues[rowIndex + 1][i];
    });
    return obj;
  });
}

// Single raw read of the current-year Cash Flow sheet. Returns the
// raw 2D values + display arrays plus the parsed header row, so
// downstream consumers that need the full grid (readCashFlowSheetAs-
// Objects_ for the planner; getDebtBillsDueRows_ for the overdue-bills
// email pass) can share one getDataRange() fetch instead of each
// function re-reading the whole sheet. Keep this helper side-effect
// free and narrow — consumers add their own shape conversions on top.
function readCashFlowSheetRaw_(ss, year) {
  const sheet = getCashFlowSheet_(ss, year);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();
  const headers = (display[0] || []).map(function(h) {
    return String(h || '').trim();
  });
  return {
    year: year,
    sheet: sheet,
    values: values,
    display: display,
    headers: headers
  };
}

// Convert a raw Cash Flow snapshot (from readCashFlowSheetRaw_) into
// the header-keyed objects the planner has historically consumed.
// Preserves the exact output shape of readCashFlowSheetAsObjects_,
// including the `__display__<header>` mirror fields so downstream
// normalizers that rely on display strings keep working byte-for-byte.
function cashFlowRawToObjects_(raw) {
  if (!raw || !raw.values || raw.values.length < 2) return [];
  const headers = raw.headers;
  const values = raw.values;
  const display = raw.display;
  return values.slice(1).map(function(row, rowIndex) {
    const obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i];
      obj['__display__' + h] = display[rowIndex + 1][i];
    });
    return obj;
  });
}

function readCashFlowSheetAsObjects_(ss, year) {
  // Thin wrapper: preserve the long-standing external contract while
  // sharing the raw read path with callers that also want the raw 2D
  // arrays (see runDebtPlanner's single-read + bills-due reuse).
  return cashFlowRawToObjects_(readCashFlowSheetRaw_(ss, year));
}

function getCurrentMonthHeader_(date, tz) {
  return Utilities.formatDate(date, tz, 'MMM-yy');
}

function getPreviousMonthHeader_(date, tz) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return Utilities.formatDate(d, tz, 'MMM-yy');
}

function getNextDueDate_(today, dueDay) {
  const current = stripTime_(today);
  let due = new Date(current.getFullYear(), current.getMonth(), dueDay);
  if (due < current) {
    due = new Date(current.getFullYear(), current.getMonth() + 1, dueDay);
  }
  return stripTime_(due);
}

function stripTime_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Last calendar day of the month containing `d` (time stripped). */
function endOfMonthContainingDate_(d) {
  const s = stripTime_(d);
  return stripTime_(new Date(s.getFullYear(), s.getMonth() + 1, 0));
}

/** `d` (date-only) plus `days` calendar days. */
function addCalendarDays_(d, days) {
  const s = stripTime_(d);
  return stripTime_(new Date(s.getFullYear(), s.getMonth(), s.getDate() + days));
}

function daysBetween_(d1, d2) {
  return Math.round(
    (stripTime_(d2).getTime() - stripTime_(d1).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function parseMonthHeader_(monthHeader) {
  const text = String(monthHeader || '').trim();
  const match = text.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!match) return null;

  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const mon = monthMap[match[1]];
  if (mon === undefined) return null;

  const yr = 2000 + Number(match[2]);
  return new Date(yr, mon, 1);
}

function validateRequired_(obj, fields) {
  fields.forEach(function(field) {
    if (obj[field] === '' || obj[field] === null || obj[field] === undefined) {
      throw new Error('Missing required field: ' + field);
    }
  });
}

function toNumber_(value) {
  if (typeof value === 'number') return value;

  const s = String(value || '').trim();
  if (!s) return 0;

  if (/^\(.*\)$/.test(s)) {
    return -toNumber_(s.replace(/[()]/g, ''));
  }

  return Number(
    s.replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/%/g, '')
      .trim()
  ) || 0;
}

function fmtCurrency_(n) {
  const value = Number(n || 0);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return sign + '$' + abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtPercent_(n) {
  return String(round2_(n)) + '%';
}

function round2_(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function getReserveByMode_(mode) {
  if (mode === 'AGGRESSIVE') return 10000;
  if (mode === 'BALANCED') return 25000;
  return 50000;
}

function findMonthColumnIndex_(headers, targetDate) {
  const idx = findMonthColumnIndexZeroBased_(headers, targetDate);
  return idx === -1 ? -1 : idx + 1;
}

function findMonthColumnIndexZeroBased_(headers, targetDate) {
  const candidates = getMonthHeaderCandidates_(targetDate);

  for (let c = 0; c < headers.length; c++) {
    const raw = headers[c];
    const normalized = normalizeHeaderText_(raw);
    if (candidates.indexOf(normalized) !== -1) {
      return c;
    }
  }

  return -1;
}

function getMonthHeaderCandidates_(dateObj) {
  const tz = Session.getScriptTimeZone();

  return [
    Utilities.formatDate(dateObj, tz, 'MMM-yy'),
    Utilities.formatDate(dateObj, tz, 'yy-MMM'),
    Utilities.formatDate(dateObj, tz, 'MMM yy'),
    Utilities.formatDate(dateObj, tz, 'yy MMM')
  ].map(function(x) {
    return normalizeHeaderText_(x);
  });
}

function normalizeHeaderText_(value) {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/*
 * Helpers to display $ value correctly in the cells
 */
function applyCurrencyFormat_(range) {
  range.setNumberFormat('$#,##0.00;-$#,##0.00');
}

function copyNeighborFormatInRow_(sheet, row, col, firstDataCol) {
  const lastCol = sheet.getLastColumn();

  for (let c = col - 1; c >= firstDataCol; c--) {
    const source = sheet.getRange(row, c);
    const fmt = source.getNumberFormat();
    if (fmt) {
      source.copyTo(sheet.getRange(row, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      return true;
    }
  }

  for (let c = col + 1; c <= lastCol; c++) {
    const source = sheet.getRange(row, c);
    const fmt = source.getNumberFormat();
    if (fmt) {
      source.copyTo(sheet.getRange(row, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      return true;
    }
  }

  return false;
}

function setCurrencyCellWithNeighborFormat_(sheet, row, col, value, firstDataCol) {
  copyNeighborFormatInRow_(sheet, row, col, firstDataCol);
  const cell = sheet.getRange(row, col);
  cell.setValue(round2_(value));
  applyCurrencyFormat_(cell);
}

/*
 * Shared year / month / row / write helpers
 */

function getCurrentYear_() {
  return new Date().getFullYear();
}

function getCurrentOrSelectedYear_(selectedYear) {
  const year = Number(selectedYear);
  return year || getCurrentYear_();
}

function getCashFlowSheetForYear_(ss, year) {
  return getCashFlowSheet_(ss, getCurrentOrSelectedYear_(year));
}

function getMonthColumnByDate_(sheet, date, headerRow) {
  const targetDate = date instanceof Date ? date : new Date(date);
  const rowNum = headerRow || 1;
  const headers = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const col = findMonthColumnIndex_(headers, targetDate);

  if (col === -1) {
    throw new Error(
      'Could not find month column for ' +
      Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'MMM-yyyy') +
      ' on sheet "' + sheet.getName() + '"'
    );
  }

  return col;
}

function findRowByName_(sheet, name, col, startRow) {
  const target = String(name || '').trim();
  if (!target) return -1;

  const colNum = col || 1;
  const firstRow = startRow || 2;
  const lastRow = sheet.getLastRow();
  if (lastRow < firstRow) return -1;

  const values = sheet.getRange(firstRow, colNum, lastRow - firstRow + 1, 1).getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === target) {
      return firstRow + i;
    }
  }

  return -1;
}

function ensureRowByName_(sheet, name, col, startRow) {
  const row = findRowByName_(sheet, name, col, startRow);
  if (row !== -1) return row;

  const rowNum = Math.max(sheet.getLastRow() + 1, startRow || 2);
  sheet.getRange(rowNum, col || 1).setValue(String(name || '').trim());
  return rowNum;
}

function setCurrencyPreserveFormat_(range, value) {
  range.setValue(round2_(value));
  applyCurrencyFormat_(range);
}

function addCurrencyToCell_(range, amount) {
  const currentValue = toNumber_(range.getValue());
  const addValue = toNumber_(amount);
  range.setValue(round2_(currentValue + addValue));
  applyCurrencyFormat_(range);
}

function setCurrencyCellPreserveRowFormat_(sheet, row, col, value, firstDataCol) {
  copyNeighborFormatInRow_(sheet, row, col, firstDataCol || col);
  setCurrencyPreserveFormat_(sheet.getRange(row, col), value);
}

function addCurrencyToCellPreserveRowFormat_(sheet, row, col, amount, firstDataCol) {
  copyNeighborFormatInRow_(sheet, row, col, firstDataCol || col);
  addCurrencyToCell_(sheet.getRange(row, col), amount);
}

function getLatestMonthColumnIndexFromHeaders_(headers, year) {
  const targetYear = Number(year);
  let bestIdx = -1;
  let bestTime = -1;

  for (let i = 0; i < headers.length; i++) {
    const parsed = parseMonthHeader_(headers[i]);
    if (!parsed) continue;
    if (parsed.getFullYear() !== targetYear) continue;

    const time = parsed.getTime();
    if (time > bestTime) {
      bestTime = time;
      bestIdx = i;
    }
  }

  return bestIdx;
}

function getLatestNonEmptyMonthColumnForRow_(sheet, row, year, firstDataCol, headerRow) {
  const headerRowNum = headerRow || 1;
  const firstCol = firstDataCol || 1;
  const lastCol = sheet.getLastColumn();

  if (lastCol < firstCol) return -1;

  const headers = sheet.getRange(headerRowNum, firstCol, 1, lastCol - firstCol + 1).getDisplayValues()[0];
  const values = sheet.getRange(row, firstCol, 1, lastCol - firstCol + 1).getValues()[0];

  let bestCol = -1;
  let bestTime = -1;

  for (let i = 0; i < headers.length; i++) {
    const parsed = parseMonthHeader_(headers[i]);
    if (!parsed) continue;
    if (parsed.getFullYear() !== Number(year)) continue;

    const value = values[i];
    const hasValue = value !== '' && value !== null;
    if (!hasValue) continue;

    const time = parsed.getTime();
    if (time > bestTime) {
      bestTime = time;
      bestCol = firstCol + i;
    }
  }

  return bestCol;
}

function getLatestMonthValueMap_(inputSheet, currentYear, keyCol, firstDataCol, headerRow, startRow) {
  const keyColumn = keyCol || 1;
  const firstMonthCol = firstDataCol || 2;
  const headerRowNum = headerRow || 1;
  const firstRow = startRow || 2;
  const lastRow = inputSheet.getLastRow();
  const lastCol = inputSheet.getLastColumn();

  const result = {};
  if (lastRow < firstRow || lastCol < firstMonthCol) return result;

  const headers = inputSheet.getRange(
    headerRowNum,
    firstMonthCol,
    1,
    lastCol - firstMonthCol + 1
  ).getDisplayValues()[0];

  const keyValues = inputSheet.getRange(
    firstRow,
    keyColumn,
    lastRow - firstRow + 1,
    1
  ).getDisplayValues();

  const rowValues = inputSheet.getRange(
    firstRow,
    firstMonthCol,
    lastRow - firstRow + 1,
    lastCol - firstMonthCol + 1
  ).getValues();

  for (let r = 0; r < keyValues.length; r++) {
    const key = String(keyValues[r][0] || '').trim();
    if (!key) continue;

    let bestIdx = -1;
    let bestTime = -1;

    for (let c = 0; c < headers.length; c++) {
      const parsed = parseMonthHeader_(headers[c]);
      if (!parsed) continue;
      if (parsed.getFullYear() !== Number(currentYear)) continue;

      const value = rowValues[r][c];
      const hasValue = value !== '' && value !== null;
      if (!hasValue) continue;

      const time = parsed.getTime();
      if (time > bestTime) {
        bestTime = time;
        bestIdx = c;
      }
    }

    if (bestIdx !== -1) {
      result[key] = {
        value: rowValues[r][bestIdx],
        monthHeader: headers[bestIdx],
        column: firstMonthCol + bestIdx
      };
    }
  }

  return result;
}

function touchDashboardSourceUpdated_(sourceKey) {
  const props = PropertiesService.getScriptProperties();
  const map = getDashboardSourceUpdatedMap_();
  map[sourceKey] = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
  props.setProperty('DASHBOARD_SOURCE_UPDATED_MAP', JSON.stringify(map));
}

function getDashboardSourceUpdatedMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty('DASHBOARD_SOURCE_UPDATED_MAP');
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}