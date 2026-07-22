/**
 * Property investment summary: SYS - House Assets + INPUT - Cash Flow (Rent*) + HOUSES - * expenses.
 * Localized; does not change planner or debt logic.
 *
 * Rent from Cash Flow is summed only when SYS - House Assets **Type** is rental
 * (`Rental` or common typo `Renal`). Empty Type keeps legacy behavior (still sum rent).
 */

function isHouseAssetsRentalForCashFlow_(typeStr) {
  const t = String(typeStr || '').trim().toLowerCase();
  if (!t) return true;
  return t === 'rental' || t === 'renal';
}

function getPropertyPerformanceData(payload) {
  const ss = getUserSpreadsheet_();
  return getPropertyPerformanceDataForSpreadsheet_(ss, payload);
}

/**
 * Explicit-workbook Property Performance seam used by production and the
 * guarded disposable harness. It never resolves a user/bounded workbook.
 */
function getPropertyPerformanceDataForSpreadsheet_(ss, payload) {
  const year = getCurrentOrSelectedYear_(payload && payload.year);

  // Blank-workbook safety: on a fresh sheet SYS - House Assets does not
  // exist yet and getHouseNamesFromHouseAssets_() -> getSheet_() would
  // throw a red banner on Property Performance. Return the same shape
  // with empty rows and zeroed portfolio totals so the page renders
  // clean ("No houses yet."). The populated path below is
  // unchanged.
  if (!ss.getSheetByName(getSheetNames_().HOUSE_ASSETS)) {
    const cyEarly = getCurrentYear_();
    return {
      year: year,
      yearOptions: [cyEarly - 2, cyEarly - 1, cyEarly, cyEarly + 1],
      rows: [],
      portfolio: {
        equity: 0,
        rent: 0,
        expenses: 0,
        netCash: 0,
        operatingExpenses: 0,
        operatingNet: 0,
        loanPayments: 0,
        netCashFlow: 0
      },
      message: ''
    };
  }

  const assetResult = getActiveHouseAssetRowsForPerformance_(ss);
  const houseAssets = assetResult.rows;
  const cfSheet = tryGetCashFlowSheet_(ss, year);
  let messages = assetResult.advisories.slice();
  if (!cfSheet) {
    messages.push('Cash Flow information for ' + year +
      ' is not available yet; rent and loan-payment totals are $0.');
  }

  const allExpenseRows = getAllHouseExpenseRowsForSpreadsheet_(ss);
  const financing = getPropertyFinancingForYear_(ss, year, houseAssets, cfSheet);
  messages = messages.concat(financing.advisories || []);

  const rows = houseAssets.map(function(assets) {
    const name = assets.house;
    const cv = Number(assets.currentValue || 0);
    const loan = Number(assets.loanAmountLeft || 0);
    const equity = round2_(cv - loan);

    const rent =
      cfSheet && isHouseAssetsRentalForCashFlow_(assets.propertyType)
        ? sumCashFlowRentForHouse_(cfSheet, year, name)
        : 0;

    const housesSheetName = findHousesSheetNameForAssetHouse_(ss, name);
    const expenseHouseKey = housesSheetName
      ? getHouseExpenseLocationName_(housesSheetName)
      : name;
    const operatingExpenses = sumHouseExpensesForYear_(allExpenseRows, expenseHouseKey, year);
    const operatingNet = round2_(rent - operatingExpenses);
    const financingRow = financing.byProperty[normalizeHouseKeyForMatch_(name)] || {
      loanPayments: 0,
      linkedLoanCount: 0,
      matchedLoanCount: 0,
      advisories: []
    };
    const loanPayments = round2_(financingRow.loanPayments || 0);
    const netCashFlow = round2_(operatingNet - loanPayments);
    let financingMessage = '';
    if (financingRow.linkedLoanCount > 0 && financingRow.matchedLoanCount === 0) {
      financingMessage = financingRow.advisories.length
        ? financingRow.advisories[0]
        : 'No loan payments recorded for this year.';
    } else if (financingRow.advisories.length) {
      financingMessage = financingRow.advisories[0];
    }

    return {
      house: name,
      propertyType: assets.propertyType,
      currentValue: round2_(cv),
      loanAmount: round2_(loan),
      equity: equity,
      rent: rent,
      // Legacy aliases remain during the additive transition.
      expenses: operatingExpenses,
      netCash: operatingNet,
      operatingExpenses: operatingExpenses,
      operatingNet: operatingNet,
      loanPayments: loanPayments,
      netCashFlow: netCashFlow,
      linkedLoanCount: financingRow.linkedLoanCount,
      matchedLoanCount: financingRow.matchedLoanCount,
      financingMessage: financingMessage
    };
  });

  let pEq = 0;
  let pRent = 0;
  let pExp = 0;
  let pOperatingNet = 0;
  let pLoanPayments = 0;
  let pNetCashFlow = 0;
  rows.forEach(function(row) {
    pEq += row.equity;
    pRent += row.rent;
    pExp += row.operatingExpenses;
    pOperatingNet += row.operatingNet;
    pLoanPayments += row.loanPayments;
    pNetCashFlow += row.netCashFlow;
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
      netCash: round2_(pOperatingNet),
      operatingExpenses: round2_(pExp),
      operatingNet: round2_(pOperatingNet),
      loanPayments: round2_(pLoanPayments),
      netCashFlow: round2_(pNetCashFlow)
    },
    message: uniquePropertyPerformanceMessages_(messages).join(' ')
  };
}

function getHouseNamesFromHouseAssets_() {
  const ss = getUserSpreadsheet_();
  return getActiveHouseAssetRowsForPerformance_(ss).rows.map(function(row) {
    return row.house;
  });
}

/** Read active property rows once for Property Performance. */
function getActiveHouseAssetRowsForPerformance_(ss) {
  const sheet = ss && ss.getSheetByName(getSheetNames_().HOUSE_ASSETS);
  if (!sheet) return { rows: [], advisories: [] };
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { rows: [], advisories: [] };

  const headerMap = getHouseAssetsHeaderMap_(sheet);
  const grouped = Object.create(null);
  for (let r = 1; r < display.length; r++) {
    const h = String(display[r][headerMap.houseColZero] || '').trim();
    if (!h) continue;
    const activeRaw = headerMap.activeColZero === -1
      ? '' : String(display[r][headerMap.activeColZero] || '').trim();
    if (isExplicitInactive_(activeRaw)) continue;
    const key = normalizeHouseKeyForMatch_(h);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      house: h,
      propertyType: headerMap.typeColZero === -1
        ? '' : String(display[r][headerMap.typeColZero] || '').trim(),
      loanAmountLeft: headerMap.loanColZero === -1
        ? 0 : round2_(toNumber_(values[r][headerMap.loanColZero])),
      currentValue: headerMap.valueColZero === -1
        ? 0 : round2_(toNumber_(values[r][headerMap.valueColZero]))
    });
  }

  const rows = [];
  const advisories = [];
  Object.keys(grouped).forEach(function(key) {
    if (grouped[key].length !== 1) {
      advisories.push('A duplicate active property name was excluded until it can be reviewed.');
      return;
    }
    rows.push(grouped[key][0]);
  });
  rows.sort(function(a, b) { return a.house.localeCompare(b.house); });
  return { rows: rows, advisories: advisories };
}

/**
 * Sum actual selected-year Cash Flow payments for active linked Loan/HELOC
 * debts. Duplicate debt names or duplicate matching Expense rows fail closed.
 */
function getPropertyFinancingForYear_(ss, year, activeHouseRows, optionalCashFlowSheet) {
  const result = { byProperty: Object.create(null), totalLoanPayments: 0, advisories: [] };
  const activeProperties = Object.create(null);
  (activeHouseRows || []).forEach(function(row) {
    const key = normalizeHouseKeyForMatch_(row.house);
    activeProperties[key] = row.house;
    result.byProperty[key] = {
      loanPayments: 0,
      linkedLoanCount: 0,
      matchedLoanCount: 0,
      advisories: []
    };
  });

  const debtSheet = ss && ss.getSheetByName(getSheetNames_().DEBTS);
  if (!debtSheet || debtSheet.getLastRow() < 2) return result;
  const debtValues = debtSheet.getDataRange().getValues();
  const debtDisplay = debtSheet.getDataRange().getDisplayValues();
  const debtMap = getDebtsHeaderMap_(debtSheet, debtDisplay);
  if (debtMap.linkedPropertyColZero === -1) return result;

  const debtsByName = Object.create(null);
  for (let r = 1; r < debtDisplay.length; r++) {
    const name = String(debtDisplay[r][debtMap.nameColZero] || '').trim();
    if (!name || isDebtSummaryRowName_(name)) continue;
    if (isDebtRowInactive_(debtDisplay[r], debtValues[r], debtMap)) continue;
    const type = String(debtDisplay[r][debtMap.typeColZero] || '').trim();
    if (!isDebtTypeLoanOrHeloc_(type)) continue;
    const linked = String(debtDisplay[r][debtMap.linkedPropertyColZero] || '').trim();
    if (!linked) continue;
    const propertyKey = normalizeHouseKeyForMatch_(linked);
    if (!activeProperties[propertyKey]) {
      result.advisories.push('A linked loan was excluded because its property is inactive or unavailable.');
      continue;
    }
    const nameKey = normalizeBillName_(name);
    if (!debtsByName[nameKey]) debtsByName[nameKey] = [];
    debtsByName[nameKey].push({ name: name, propertyKey: propertyKey });
    result.byProperty[propertyKey].linkedLoanCount++;
  }

  const cfSheet = optionalCashFlowSheet || tryGetCashFlowSheet_(ss, year);
  if (!cfSheet) {
    Object.keys(result.byProperty).forEach(function(key) {
      if (result.byProperty[key].linkedLoanCount) {
        result.byProperty[key].advisories.push('No loan payments recorded for this year.');
      }
    });
    return result;
  }

  const cfValues = cfSheet.getDataRange().getValues();
  const cfDisplay = cfSheet.getDataRange().getDisplayValues();
  const cfHeaders = cfDisplay[0] || [];
  const cfHeaderMap = getCashFlowHeaderMap_(cfSheet);
  const monthCols = [];
  for (let c = 0; c < cfHeaders.length; c++) {
    const parsed = parseMonthHeader_(cfHeaders[c]);
    if (parsed && parsed.getFullYear() === Number(year)) monthCols.push(c);
  }

  const expenseRowsByPayee = Object.create(null);
  for (let row = 1; row < cfDisplay.length; row++) {
    const type = String(cfDisplay[row][cfHeaderMap.typeColZero] || '').trim();
    if (type !== 'Expense') continue;
    const payee = String(cfDisplay[row][cfHeaderMap.payeeColZero] || '').trim();
    const key = normalizeBillName_(payee);
    if (!key) continue;
    if (!expenseRowsByPayee[key]) expenseRowsByPayee[key] = [];
    expenseRowsByPayee[key].push(row);
  }

  Object.keys(debtsByName).forEach(function(debtKey) {
    const debtRows = debtsByName[debtKey];
    if (debtRows.length !== 1) {
      debtRows.forEach(function(debt) {
        result.byProperty[debt.propertyKey].advisories.push(
          'A duplicate linked debt name must be reviewed before payments can be calculated.');
      });
      result.advisories.push('Duplicate linked debt names were excluded to prevent double counting.');
      return;
    }

    const debt = debtRows[0];
    const matches = expenseRowsByPayee[debtKey] || [];
    if (matches.length > 1) {
      result.byProperty[debt.propertyKey].advisories.push(
        'Multiple matching Cash Flow rows must be reviewed before payments can be calculated.');
      result.advisories.push('Ambiguous loan-payment rows were excluded to prevent double counting.');
      return;
    }
    if (matches.length === 0 || !monthCols.length) {
      result.byProperty[debt.propertyKey].advisories.push('No loan payments recorded for this year.');
      return;
    }

    let paid = 0;
    monthCols.forEach(function(col) {
      paid += Math.abs(toNumber_(cfValues[matches[0]][col]));
    });
    paid = round2_(paid);
    result.byProperty[debt.propertyKey].loanPayments = round2_(
      result.byProperty[debt.propertyKey].loanPayments + paid);
    result.byProperty[debt.propertyKey].matchedLoanCount++;
    result.totalLoanPayments = round2_(result.totalLoanPayments + paid);
  });

  return result;
}

function uniquePropertyPerformanceMessages_(messages) {
  const out = [];
  const seen = Object.create(null);
  (messages || []).forEach(function(message) {
    const text = String(message || '').trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    out.push(text);
  });
  return out;
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
