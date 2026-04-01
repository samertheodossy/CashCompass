/**
 * Property investment summary: SYS - House Assets + INPUT - Cash Flow (Rent*) + HOUSES - * expenses.
 * Localized; does not change planner or debt logic.
 */

function getPropertyPerformanceData(payload) {
  const year = getCurrentOrSelectedYear_(payload && payload.year);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const houseNames = getHouseNamesFromHouseAssets_();
  const cfSheet = tryGetCashFlowSheet_(ss, year);
  const message = cfSheet
    ? ''
    : 'Cash Flow sheet "' + getCashFlowSheetName_(year) + '" not found; rent totals are $0.';

  const allExpenseRows = getAllHouseExpenseRows_();

  const rows = houseNames.map(function(name) {
    const assets = getHouseAssetRowData_(name);
    const cv = assets && assets.currentValue !== '' ? Number(assets.currentValue) : 0;
    const loan = assets && assets.loanAmountLeft !== '' ? Number(assets.loanAmountLeft) : 0;
    const equity = round2_(cv - loan);

    const rent = cfSheet ? sumCashFlowRentForHouse_(cfSheet, year, name) : 0;

    const housesSheetName = findHousesSheetNameForAssetHouse_(ss, name);
    const expenseHouseKey = housesSheetName
      ? getHouseExpenseLocationName_(housesSheetName)
      : name;
    const expenses = sumHouseExpensesForYear_(allExpenseRows, expenseHouseKey, year);
    const netCash = round2_(rent - expenses);

    return {
      house: name,
      currentValue: round2_(cv),
      loanAmount: round2_(loan),
      equity: equity,
      rent: rent,
      expenses: expenses,
      netCash: netCash,
      hasHousesSheet: housesSheetName !== null
    };
  });

  let pEq = 0;
  let pRent = 0;
  let pExp = 0;
  let pNet = 0;
  rows.forEach(function(row) {
    pEq += row.equity;
    pRent += row.rent;
    pExp += row.expenses;
    pNet += row.netCash;
  });

  const cy = getCurrentYear_();

  return {
    year: year,
    yearOptions: [cy - 2, cy - 1, cy, cy + 1],
    rows: rows,
    portfolio: {
      equity: round2_(pEq),
      rent: round2_(pRent),
      expenses: round2_(pExp),
      netCash: round2_(pNet)
    },
    message: message
  };
}

function getHouseNamesFromHouseAssets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'HOUSE_ASSETS');
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headerMap = getHouseAssetsHeaderMap_(sheet);
  const names = [];

  for (let r = 1; r < display.length; r++) {
    const h = String(display[r][headerMap.houseColZero] || '').trim();
    if (h) names.push(h);
  }

  return names.sort();
}

function tryGetCashFlowSheet_(ss, year) {
  try {
    return getCashFlowSheet_(ss, year);
  } catch (e) {
    return null;
  }
}

/**
 * Match SYS - House Assets "House" to a tab: exact "HOUSES - {name}" first, then case/space-tolerant
 * match on the location suffix (getSheetByName is case-sensitive in Apps Script).
 * Returns the real sheet name or null.
 */
function findHousesSheetNameForAssetHouse_(ss, houseName) {
  const h = String(houseName || '').trim();
  if (!h) return null;

  const exact = 'HOUSES - ' + h;
  if (ss.getSheetByName(exact)) return exact;

  const target = normalizeHouseKeyForMatch_(h);
  const sheets = ss.getSheets();

  for (let i = 0; i < sheets.length; i++) {
    const fullName = sheets[i].getName();
    if (String(fullName || '').toUpperCase().indexOf('HOUSES - ') !== 0) continue;
    const loc = getHouseExpenseLocationName_(fullName);
    if (normalizeHouseKeyForMatch_(loc) === target) {
      return fullName;
    }
  }

  return null;
}

function normalizeHouseKeyForMatch_(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sumCashFlowRentForHouse_(sheet, year, houseName) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 2) return 0;

  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const monthColZero = [];
  for (let c = 0; c < headers.length; c++) {
    const parsed = parseMonthHeader_(headers[c]);
    if (parsed && parsed.getFullYear() === Number(year)) {
      monthColZero.push(c);
    }
  }
  if (!monthColZero.length) return 0;

  const headerMap = getCashFlowHeaderMap_(sheet);
  const values = sheet.getDataRange().getValues();
  let total = 0;

  for (let r = 1; r < values.length; r++) {
    const type = String(values[r][headerMap.typeColZero] || '').trim();
    const payee = String(values[r][headerMap.payeeColZero] || '').trim();
    if (type !== 'Income') continue;
    if (!isRentPayeeForHouse_(payee, houseName)) continue;

    monthColZero.forEach(function(c) {
      total += toNumber_(values[r][c]);
    });
  }

  return round2_(total);
}

function isRentPayeeForHouse_(payee, houseName) {
  const p = String(payee || '').trim();
  const h = String(houseName || '').trim();
  if (!p || !h) return false;

  if (/^deposit\s+/i.test(p)) return false;

  const prefix = 'Rent ' + h;
  if (p.length < prefix.length) return false;
  if (p.substring(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return false;

  if (p.length === prefix.length) return true;
  const next = p.charAt(prefix.length);
  return next === ' ' || next === '-';
}

function sumHouseExpensesForYear_(allRows, houseName, year) {
  const key = normalizeHouseKeyForMatch_(houseName);
  let total = 0;
  (allRows || []).forEach(function(row) {
    if (normalizeHouseKeyForMatch_(row.house) !== key) return;
    if (!row.sortDate) return;
    if (row.sortDate.getFullYear() !== Number(year)) return;
    total += round2_(toNumber_(row.cost) + toNumber_(row.serviceFees));
  });
  return round2_(total);
}
