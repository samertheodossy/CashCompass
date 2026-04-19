/** Payee string used when posting a house expense to INPUT - Cash Flow (must match quickAddPayment). */
function buildHouseExpenseCashFlowPayee_(payload) {
  const payeeParts = [];
  payeeParts.push('House: ' + getHouseExpenseLocationName_(payload.house));
  if (payload.type) payeeParts.push(payload.type);
  if (payload.item) payeeParts.push(payload.item);
  return payeeParts.join(' - ');
}

function getHouseExpenseUiData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // HOUSES - * sheets stay forever (history). The picker only surfaces
  // houses that are currently active per SYS - House Assets. Blank Active
  // is treated as active for backward compatibility.
  let inactive = Object.create(null);
  try {
    inactive = getInactiveHousesSet_();
  } catch (e) {
    Logger.log('getHouseExpenseUiData inactive filter: ' + e);
  }

  const houseSheets = ss.getSheets()
    .map(function(sheet) { return sheet.getName(); })
    .filter(function(name) {
      if (String(name || '').toUpperCase().indexOf('HOUSES - ') !== 0) return false;
      const location = getHouseExpenseLocationName_(name);
      return !inactive[String(location || '').toLowerCase()];
    })
    .sort();

  return {
    houses: houseSheets.map(function(sheetName) {
      return {
        sheetName: sheetName,
        locationName: getHouseExpenseLocationName_(sheetName)
      };
    })
  };
}

function addHouseExpense(payload) {
  if (!payload || !payload.house) throw new Error('House is required.');
  if (!payload.date) throw new Error('Date is required.');
  if (!payload.item) throw new Error('Item is required.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(payload.house);
  if (!sheet) throw new Error('House sheet not found: ' + payload.house);

  const parsedDate = parseIsoDateLocal_(payload.date);

  const year = parsedDate.getFullYear();
  const yearInfo = findOrCreateHouseExpenseYearBlock_(sheet, year);
  const insertRow = findNextOpenHouseExpenseRow_(sheet, yearInfo.headerRow + 1);
  const locationValue = (payload.location || '').trim() || getHouseExpenseLocationName_(payload.house);

  const templateDataRow = findHouseExpenseTemplateDataRow_(sheet, yearInfo.headerRow + 1, insertRow);
  if (templateDataRow) {
    copyHouseExpenseRowLook_(sheet, templateDataRow, insertRow);
  }

  const cost = toNumber_(payload.cost);
  const serviceFees = toNumber_(payload.serviceFees);
  const netAmount = round2_(cost + serviceFees);

  sheet.getRange(insertRow, 1, 1, 9).setValues([[
    payload.item || '',
    payload.type || '',
    payload.date || '',
    locationValue,
    cost,
    serviceFees,
    payload.insurance || '',
    payload.paymentLinks || '',
    payload.notes || ''
  ]]);

  finalizeHouseExpenseDataRow_(sheet, insertRow);
  SpreadsheetApp.flush();

  let cashFlowMessage = '';
  let cashFlowUpdated = false;
  if (payload.autoAddToCashFlow) {
    const cf = addHouseExpenseToCashFlow_(payload, cost, serviceFees);
    cashFlowMessage = cf.message;
    cashFlowUpdated = cf.updated;
  }

  const tz = Session.getScriptTimeZone();
  const entryDateStr = Utilities.formatDate(parsedDate, tz, 'yyyy-MM-dd');
  const payeeForLog = buildHouseExpenseCashFlowPayee_(payload);
  let cashFlowSheet = '';
  let cashFlowMonth = '';
  if (cashFlowUpdated) {
    const cfSh = getCashFlowSheetForYear_(ss, parsedDate.getFullYear());
    cashFlowSheet = cfSh.getName();
    cashFlowMonth = Utilities.formatDate(parsedDate, tz, 'MMM-yy');
  }

  appendActivityLog_(ss, {
    eventType: 'house_expense',
    entryDate: entryDateStr,
    amount: Math.abs(netAmount),
    direction: netAmount < 0 ? 'income' : 'expense',
    payee: payeeForLog,
    category: String(payload.type || '').trim(),
    accountSource: String(payload.house || '').trim(),
    cashFlowSheet: cashFlowSheet,
    cashFlowMonth: cashFlowMonth,
    dedupeKey: '',
    details: JSON.stringify({
      houseSheet: payload.house,
      houseRow: insertRow,
      location: locationValue,
      item: String(payload.item || ''),
      expenseType: String(payload.type || '').trim(),
      cost: round2_(cost),
      serviceFees: round2_(serviceFees),
      autoAddToCashFlow: !!payload.autoAddToCashFlow,
      cashFlowUpdated: cashFlowUpdated
    })
  });

  return {
    message:
      'Added "' + payload.item + '" to ' + payload.house + ' under year ' + year + ' on row ' + insertRow + '.' +
      (cashFlowMessage ? ' ' + cashFlowMessage : '')
  };
}

/**
 * @returns {{ message: string, updated: boolean }}
 *
 * `payload.flowSource` is optional and forwarded verbatim to quickAddPayment,
 * which validates it against the allow-list (CASH / CREDIT_CARD / blank). When
 * the caller leaves it blank, Quick Add leaves the Flow Source cell untouched
 * so legacy year tabs (without the column) keep working unchanged.
 */
function addHouseExpenseToCashFlow_(payload, cost, serviceFees) {
  const netAmount = round2_(cost + serviceFees);

  if (netAmount === 0) {
    return { message: 'Cash Flow not updated because net amount was $0.00.', updated: false };
  }

  const entryType = netAmount > 0 ? 'Expense' : 'Income';
  const amount = Math.abs(netAmount);

  const payee = buildHouseExpenseCashFlowPayee_(payload);

  quickAddPayment({
    entryType: entryType,
    payee: payee,
    entryDate: payload.date,
    amount: amount,
    createIfMissing: true,
    suppressActivityLog: true,
    flowSource: payload.flowSource
  });

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    message: 'Also added to Cash Flow as ' + entryType + ' for ' + fmtCurrency_(amount) + '.',
    updated: true
  };
}

function getRecentHouseExpenses(limit) {
  const maxRows = Math.max(1, Number(limit || 20));
  const rows = getAllHouseExpenseRows_();

  rows.sort(function(a, b) {
    const aTime = a.sortDate ? a.sortDate.getTime() : 0;
    const bTime = b.sortDate ? b.sortDate.getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return String(a.item || '').localeCompare(String(b.item || ''));
  });

  const trimmed = rows.slice(0, maxRows);

  return {
    expenses: trimmed,
    groups: groupHouseExpenseRowsByKey_(trimmed, function(row) {
      return row.house || 'Unknown House';
    })
  };
}

function getHouseExpenseSummaryData() {
  const rows = getAllHouseExpenseRows_();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const thisMonthRows = rows.filter(function(row) {
    return row.sortDate &&
      row.sortDate.getFullYear() === currentYear &&
      row.sortDate.getMonth() === currentMonth;
  });

  const ytdRows = rows.filter(function(row) {
    return row.sortDate &&
      row.sortDate.getFullYear() === currentYear &&
      row.sortDate.getMonth() <= currentMonth;
  });

  return {
    currentMonthLabel: Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy'),
    ytdLabel: String(currentYear),
    thisMonthByHouse: buildHouseExpenseSummaryArray_(thisMonthRows, function(row) {
      return row.house || 'Unknown House';
    }),
    ytdByHouse: buildHouseExpenseSummaryArray_(ytdRows, function(row) {
      return row.house || 'Unknown House';
    }),
    ytdByType: buildHouseExpenseSummaryArray_(ytdRows, function(row) {
      return row.type || 'Unknown Type';
    })
  };
}

function getAllHouseExpenseRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const houseSheets = ss.getSheets().filter(function(sheet) {
    return String(sheet.getName() || '').toUpperCase().indexOf('HOUSES - ') === 0;
  });

  let rows = [];
  houseSheets.forEach(function(sheet) {
    rows = rows.concat(readHouseExpensesFromSheet_(sheet));
  });
  return rows;
}

function buildHouseExpenseSummaryArray_(rows, keyFn) {
  const map = {};

  (rows || []).forEach(function(row) {
    const key = keyFn(row);
    if (!map[key]) {
      map[key] = {
        key: key,
        costTotal: 0,
        serviceFeesTotal: 0,
        netTotal: 0,
        itemCount: 0
      };
    }

    map[key].costTotal += toNumber_(row.cost);
    map[key].serviceFeesTotal += toNumber_(row.serviceFees);
    map[key].netTotal += round2_(toNumber_(row.cost) + toNumber_(row.serviceFees));
    map[key].itemCount += 1;
  });

  return Object.keys(map)
    .map(function(key) {
      const x = map[key];
      x.costTotal = round2_(x.costTotal);
      x.serviceFeesTotal = round2_(x.serviceFeesTotal);
      x.netTotal = round2_(x.netTotal);
      return x;
    })
    .sort(function(a, b) {
      if (b.netTotal !== a.netTotal) return b.netTotal - a.netTotal;
      return String(a.key).localeCompare(String(b.key));
    });
}

function groupHouseExpenseRowsByKey_(rows, keyFn) {
  const groupedMap = {};

  (rows || []).forEach(function(row) {
    const key = keyFn(row);
    if (!groupedMap[key]) groupedMap[key] = [];
    groupedMap[key].push({
      houseSheet: row.houseSheet,
      house: row.house,
      date: row.dateDisplay,
      item: row.item,
      type: row.type,
      location: row.location,
      cost: row.cost,
      serviceFees: row.serviceFees,
      insurance: row.insurance,
      paymentLinks: row.paymentLinks,
      notes: row.notes,
      year: row.year
    });
  });

  return Object.keys(groupedMap)
    .sort()
    .map(function(key) {
      return {
        house: key,
        expenses: groupedMap[key]
      };
    });
}

function readHouseExpensesFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(9, sheet.getLastColumn());
  if (lastRow < 3) return [];

  const values = sheet.getRange(1, 1, lastRow, Math.min(lastCol, 9)).getValues();
  const displayValues = sheet.getRange(1, 1, lastRow, Math.min(lastCol, 9)).getDisplayValues();

  const out = [];
  let currentYear = '';

  for (let r = 0; r < values.length; r++) {
    const colA = String(displayValues[r][0] || '').trim();
    const colB = String(displayValues[r][1] || '').trim();

    if (colA.toLowerCase() === 'year') {
      currentYear = colB;
      continue;
    }

    if (colA.toLowerCase() === 'item' && colB.toLowerCase() === 'type') {
      continue;
    }

    const item = String(displayValues[r][0] || '').trim();
    const type = String(displayValues[r][1] || '').trim();
    const dateRaw = values[r][2];
    const dateDisplay = String(displayValues[r][2] || '').trim();
    const location = String(displayValues[r][3] || '').trim();
    const cost = toNumber_(values[r][4]);
    const serviceFees = toNumber_(values[r][5]);
    const insurance = String(displayValues[r][6] || '').trim();
    const paymentLinks = String(displayValues[r][7] || '').trim();
    const notes = String(displayValues[r][8] || '').trim();

    if (!item && !type && !dateDisplay && !location && !cost && !serviceFees && !insurance && !paymentLinks && !notes) {
      continue;
    }

    const parsed = parseHouseExpenseDate_(dateRaw, dateDisplay, currentYear);

    out.push({
      houseSheet: sheet.getName(),
      house: getHouseExpenseLocationName_(sheet.getName()),
      year: currentYear || '',
      item: item,
      type: type,
      dateDisplay: parsed.display,
      sortDate: parsed.sortDate,
      location: location,
      cost: cost,
      serviceFees: serviceFees,
      insurance: insurance,
      paymentLinks: paymentLinks,
      notes: notes
    });
  }

  return out;
}

function parseHouseExpenseDate_(rawValue, displayValue, fallbackYear) {
  if (Object.prototype.toString.call(rawValue) === '[object Date]' && !isNaN(rawValue.getTime())) {
    return {
      sortDate: rawValue,
      display: Utilities.formatDate(rawValue, Session.getScriptTimeZone(), 'M/d/yyyy')
    };
  }

  const text = String(displayValue || '').trim();
  if (!text || text.toLowerCase() === 'tbd') {
    return {
      sortDate: buildFallbackSortDate_(fallbackYear),
      display: text || ''
    };
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return {
      sortDate: parsed,
      display: text
    };
  }

  return {
    sortDate: buildFallbackSortDate_(fallbackYear),
    display: text
  };
}

function buildFallbackSortDate_(yearText) {
  const yearNum = Number(yearText || 0);
  if (yearNum > 1900) return new Date(yearNum, 0, 1);
  return new Date(1900, 0, 1);
}

function getHouseExpenseLocationName_(sheetName) {
  return String(sheetName || '')
    .replace(/^HOUSES\s*-\s*/i, '')
    .trim();
}

function findOrCreateHouseExpenseYearBlock_(sheet, year) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const scanCols = Math.min(Math.max(sheet.getLastColumn(), 9), 9);
  const values = sheet.getRange(1, 1, lastRow, scanCols).getValues();

  for (let r = 0; r < values.length; r++) {
    const a = String(values[r][0] || '').trim().toLowerCase();
    const b = String(values[r][1] || '').trim();
    if (a === 'year' && Number(b) === Number(year)) {
      return {
        yearRow: r + 1,
        headerRow: r + 2
      };
    }
  }

  const startRow = Math.max(sheet.getLastRow() + 2, 1);

  sheet.getRange(startRow, 1, 1, 2).setValues([['Year', year]]);
  sheet.getRange(startRow + 1, 1, 1, 9).setValues([[
    'Item',
    'Type',
    'Date',
    'Location',
    'Cost',
    'Service Fees Paid',
    'Insurance covered',
    'Payments Links',
    'Notes'
  ]]);

  const template = findHouseExpenseFormattingTemplates_(sheet);

  if (template.yearRow) {
    copyFullRowLook_(sheet, template.yearRow, startRow);
  } else {
    formatHouseExpenseYearRowFallback_(sheet, startRow);
  }

  if (template.headerRow) {
    copyFullRowLook_(sheet, template.headerRow, startRow + 1);
  } else {
    formatHouseExpenseHeaderRowFallback_(sheet, startRow + 1);
  }

  return {
    yearRow: startRow,
    headerRow: startRow + 1
  };
}

function findNextOpenHouseExpenseRow_(sheet, firstDataRow) {
  let row = firstDataRow;

  while (true) {
    const a = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    const b = String(sheet.getRange(row, 2).getDisplayValue() || '').trim();

    if (!a && !b) return row;
    if (a.toLowerCase() === 'year') return row;
    row++;
  }
}

function findHouseExpenseFormattingTemplates_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();

  let yearRow = null;
  let headerRow = null;
  let dataRow = null;

  for (let i = 0; i < values.length; i++) {
    const a = String(values[i][0] || '').trim().toLowerCase();
    const b = String(values[i][1] || '').trim().toLowerCase();

    if (!yearRow && a === 'year') {
      yearRow = i + 1;
      continue;
    }

    if (!headerRow && a === 'item' && b === 'type') {
      headerRow = i + 1;
      continue;
    }

    if (!dataRow && a && a !== 'year' && a !== 'item') {
      dataRow = i + 1;
    }

    if (yearRow && headerRow && dataRow) break;
  }

  return {
    yearRow: yearRow,
    headerRow: headerRow,
    dataRow: dataRow
  };
}

function findHouseExpenseTemplateDataRow_(sheet, dataStartRow, insertRow) {
  for (let row = insertRow - 1; row >= dataStartRow; row--) {
    const a = String(sheet.getRange(row, 1).getDisplayValue() || '').trim().toLowerCase();
    if (a && a !== 'year' && a !== 'item') {
      return row;
    }
  }

  const template = findHouseExpenseFormattingTemplates_(sheet);
  return template.dataRow || null;
}

function copyFullRowLook_(sheet, sourceRow, targetRow) {
  const maxCols = Math.max(sheet.getMaxColumns(), 9);
  sheet.getRange(sourceRow, 1, 1, maxCols).copyTo(sheet.getRange(targetRow, 1, 1, maxCols), { formatOnly: true });
  sheet.setRowHeight(targetRow, sheet.getRowHeight(sourceRow));
}

function copyHouseExpenseRowLook_(sheet, sourceRow, targetRow) {
  copyFullRowLook_(sheet, sourceRow, targetRow);
}

function finalizeHouseExpenseDataRow_(sheet, row) {
  sheet.getRange(row, 5).setNumberFormat('$#,##0.00');
  sheet.getRange(row, 6).setNumberFormat('$#,##0.00');
  sheet.getRange(row, 3).setNumberFormat('m/d/yyyy');
}

function formatHouseExpenseYearRowFallback_(sheet, row) {
  sheet.getRange(row, 1, 1, 9)
    .setBackground('#f4a300')
    .setFontWeight('bold')
    .setFontColor('#000000');
}

function formatHouseExpenseHeaderRowFallback_(sheet, row) {
  sheet.getRange(row, 1, 1, 9)
    .setBackground('#fff200')
    .setFontWeight('bold')
    .setFontColor('#000000');
}