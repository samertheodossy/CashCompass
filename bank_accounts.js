function syncAllAccountsFromLatestCurrentYear_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const targetSheet = getSheet_(ss, 'ACCOUNTS');

  const targetDisplay = targetSheet.getDataRange().getDisplayValues();
  if (targetDisplay.length < 2) {
    throw new Error('Accounts sheet is empty.');
  }

  const targetHeaderMap = getAccountsHeaderMap_(targetSheet);
  const latestMap = getLatestBankAccountValuesForYear_(sourceSheet, getCurrentYear_());

  for (let r = 1; r < targetDisplay.length; r++) {
    const name = String(targetDisplay[r][targetHeaderMap.nameColZero] || '').trim();
    if (!name) continue;

    if (Object.prototype.hasOwnProperty.call(latestMap, name)) {
      setCurrencyCellPreserveRowFormat_(
        targetSheet,
        r + 1,
        targetHeaderMap.balanceCol,
        latestMap[name],
        1
      );
    }
  }
}

function getLatestBankAccountValuesForYear_(sheet, year) {
  const block = getBankAccountsYearBlock_(sheet, year);
  const result = {};

  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;

    const latestCol = getLatestNonEmptyMonthColumnForRow_(
      sheet,
      row,
      year,
      block.firstMonthCol,
      block.headerRow
    );

    if (latestCol !== -1) {
      result[name] = round2_(toNumber_(sheet.getRange(row, latestCol).getValue()));
    }
  }

  return result;
}

function getBankAccountUiData() {
  var typeOpts = [];
  var policyOpts = [];
  try {
    typeOpts = getAccountsDistinctColumnValues_('Type');
    policyOpts = getAccountsDistinctColumnValues_('Use Policy');
  } catch (e) {
    Logger.log('getBankAccountUiData type/policy options: ' + e);
  }

  return {
    accounts: getBankAccountsFromHistory_(),
    typeOptions: typeOpts,
    policyOptions: policyOpts
  };
}

/**
 * Distinct non-empty values from a column on SYS - Accounts (for Add bank datalists).
 * @param {string} headerLabel e.g. "Type", "Use Policy"
 * @returns {string[]}
 */
function getAccountsDistinctColumnValues_(headerLabel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');
  const display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return [];

  const headers = display[0];
  const idx = headers.indexOf(headerLabel);
  if (idx === -1) return [];

  const found = {};
  for (let r = 1; r < display.length; r++) {
    const cell = String(display[r][idx] || '').trim();
    if (cell) found[cell] = true;
  }

  return Object.keys(found).sort(function(a, b) {
    return a.localeCompare(b);
  });
}

function accountExistsInAccountsSheet_(accountName) {
  const name = String(accountName || '').trim();
  if (!name) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');
  const display = sheet.getDataRange().getDisplayValues();
  const headerMap = getAccountsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === name) return true;
  }
  return false;
}

/**
 * @param {string} raw
 * @returns {string} trimmed name
 */
function validateNewBankAccountName_(raw) {
  const name = String(raw || '').trim();
  if (!name) throw new Error('Account name is required.');
  if (name.length > 120) throw new Error('Account name is too long (max 120 characters).');
  if (!isBankAccountDataRowName_(name)) {
    throw new Error('That account name is not allowed (reserved label or invalid).');
  }

  const existing = getBankAccountsFromHistory_();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] === name) {
      throw new Error('An account with that name already exists on INPUT - Bank Accounts.');
    }
  }

  if (accountExistsInAccountsSheet_(name)) {
    throw new Error('An account with that name already exists on SYS - Accounts.');
  }

  return name;
}

/**
 * Last row in the year block whose column A is a real account name (not blank spacer rows
 * before "Total Accounts"). dataEndRow from getBankAccountsYearBlock_ can include blanks.
 * @returns {number} 1-based row, or -1 if none
 */
function findLastBankAccountDataRowInBlock_(sheet, block) {
  let last = -1;
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (isBankAccountDataRowName_(name)) {
      last = row;
    }
  }
  return last;
}

/**
 * Inserts a data row in the year block before Total Accounts / directly after last real account row.
 * @returns {number} 1-based row number of the new row
 */
function insertNewBankAccountHistoryRow_(sheet, block, accountName) {
  const lastCol = Math.max(sheet.getLastColumn(), 2);
  const lastAccountRow = findLastBankAccountDataRowInBlock_(sheet, block);
  let newRow;
  let insertBeforeRow;
  let templateRow;

  if (lastAccountRow === -1) {
    if (block.dataEndRow < block.dataStartRow) {
      insertBeforeRow = block.dataStartRow;
    } else {
      insertBeforeRow = block.dataEndRow + 1;
    }
    sheet.insertRowBefore(insertBeforeRow);
    newRow = insertBeforeRow;
    if (newRow + 1 <= sheet.getLastRow()) {
      templateRow = newRow + 1;
    } else {
      templateRow = block.headerRow;
    }
  } else {
    sheet.insertRowAfter(lastAccountRow);
    newRow = lastAccountRow + 1;
    templateRow = lastAccountRow;
  }

  sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
    sheet.getRange(newRow, 1, 1, lastCol),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );
  sheet.getRange(newRow, 1, 1, lastCol).clearContent();
  sheet.getRange(newRow, 1).setValue(accountName);

  return newRow;
}

function appendAccountsRowForNewBank_(sheet, accountName, typeStr, policyStr) {
  const headerMap = getAccountsHeaderMap_(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), headerMap.nameCol);

  const row = [];
  for (let c = 0; c < lastCol; c++) {
    row[c] = '';
  }

  row[headerMap.nameColZero] = accountName;
  if (headerMap.balanceColZero !== -1) row[headerMap.balanceColZero] = 0;
  if (headerMap.availableColZero !== -1) row[headerMap.availableColZero] = 0;
  if (headerMap.bufferColZero !== -1) row[headerMap.bufferColZero] = 0;
  if (headerMap.typeColZero !== -1) row[headerMap.typeColZero] = typeStr;
  if (headerMap.policyColZero !== -1) row[headerMap.policyColZero] = policyStr;

  sheet.appendRow(row);
  const appendedRow = sheet.getLastRow();

  if (headerMap.balanceCol !== -1) {
    applyCurrencyFormat_(sheet.getRange(appendedRow, headerMap.balanceCol));
  }
  if (headerMap.availableCol !== -1) {
    applyCurrencyFormat_(sheet.getRange(appendedRow, headerMap.availableCol));
  }
  if (headerMap.bufferCol !== -1) {
    applyCurrencyFormat_(sheet.getRange(appendedRow, headerMap.bufferCol));
  }
}

function deleteAccountsRowByExactName_(sheet, accountName) {
  const target = String(accountName || '').trim();
  if (!target) return;

  const headerMap = getAccountsHeaderMap_(sheet);
  const display = sheet.getDataRange().getDisplayValues();

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === target) {
      sheet.deleteRow(r + 1);
      return;
    }
  }
}

/**
 * Creates INPUT - Bank Accounts row (current year block) + SYS - Accounts row.
 * Optional opening balance for the current calendar year only.
 * @param {{
 *   accountName: string,
 *   type: string,
 *   usePolicy: string,
 *   openingBalanceDate?: string,
 *   openingBalance?: number|string,
 *   setAvailableFromOpening?: boolean,
 *   setMinBufferFromOpening?: boolean
 * }} payload
 */
function addBankAccountFromDashboard(payload) {
  validateRequired_(payload, ['accountName', 'type', 'usePolicy']);

  const accountName = validateNewBankAccountName_(payload.accountName);
  const typeStr = String(payload.type || '').trim();
  const policyStr = String(payload.usePolicy || '').trim();

  if (!typeStr) throw new Error('Type is required.');
  if (!policyStr) throw new Error('Use policy is required.');
  if (typeStr.length > 80) throw new Error('Type is too long (max 80 characters).');
  if (policyStr.length > 120) throw new Error('Use policy is too long (max 120 characters).');

  const openingDateStr = String(payload.openingBalanceDate || '').trim();
  const obRaw = payload.openingBalance;
  const hasOpeningDate = !!openingDateStr;
  const hasOpeningAmount =
    obRaw !== '' && obRaw !== null && obRaw !== undefined && String(obRaw).trim() !== '';

  let openingDate = null;
  let openingAmount = null;

  if (hasOpeningDate || hasOpeningAmount) {
    if (!hasOpeningDate || !hasOpeningAmount) {
      throw new Error('For an opening balance, provide both date and amount.');
    }
    openingDate = parseIsoDateLocal_(openingDateStr);
    if (isNaN(openingDate.getTime())) throw new Error('Invalid opening balance date.');
    openingAmount = round2_(toNumber_(obRaw));
    if (isNaN(openingAmount)) throw new Error('Opening balance must be a valid number.');

    const cy = getCurrentYear_();
    if (openingDate.getFullYear() !== cy) {
      throw new Error('Opening balance date must be in ' + cy + ' (same year as the bank block you are extending).');
    }
  }

  const setAvail = !!payload.setAvailableFromOpening;
  const setMin = !!payload.setMinBufferFromOpening;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const accountsSheet = getSheet_(ss, 'ACCOUNTS');
  const currentYear = getCurrentYear_();
  const block = getBankAccountsYearBlock_(bankSheet, currentYear);

  let bankRowNum = 0;
  try {
    bankRowNum = insertNewBankAccountHistoryRow_(bankSheet, block, accountName);
  } catch (e) {
    throw new Error('Could not insert bank history row: ' + (e.message || e));
  }

  try {
    appendAccountsRowForNewBank_(accountsSheet, accountName, typeStr, policyStr);
  } catch (e2) {
    bankSheet.deleteRow(bankRowNum);
    throw new Error('Could not add SYS - Accounts row (rolled back bank sheet row): ' + (e2.message || e2));
  }

  try {
    if (openingDate && openingAmount !== null) {
      updateBankAccountsHistory_(accountName, currentYear, openingDate, openingAmount);
    }

    syncAllAccountsFromLatestCurrentYear_();

    if (openingDate && openingAmount !== null && (setAvail || setMin)) {
      const opt = {};
      if (setAvail) opt.availableNow = openingAmount;
      if (setMin) opt.minBuffer = openingAmount;
      updateAccountsSheetFields_(accountName, opt);
    }

    touchDashboardSourceUpdated_('bank_accounts');
    // Do not call runDebtPlanner() here — it can take a long time and keeps the web UI on
    // "Loading…" until it finishes. Sync + SYS - Accounts are already updated; user can
    // Run Planner + Refresh Snapshot from the top bar when they want projections refreshed.
  } catch (e3) {
    deleteAccountsRowByExactName_(accountsSheet, accountName);
    bankSheet.deleteRow(bankRowNum);
    throw e3;
  }

  try {
    appendActivityLog_(ss, {
      eventType: 'bank_account_add',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: openingAmount !== null ? Math.abs(openingAmount) : 0,
      direction: 'expense',
      payee: accountName,
      category: typeStr,
      accountSource: policyStr,
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        year: currentYear,
        openingBalanceDate: openingDateStr,
        openingBalance: openingAmount,
        setAvailableFromOpening: setAvail,
        setMinBufferFromOpening: setMin
      })
    });
  } catch (logErr) {
    Logger.log('addBankAccountFromDashboard activity log: ' + logErr);
  }

  return {
    ok: true,
    accountName: accountName,
    message:
      'Created bank account "' +
      accountName +
      '" on INPUT - Bank Accounts and SYS - Accounts.\n' +
      'Use Run Planner + Refresh Snapshot when you want projections and the overview snapshot updated.'
  };
}

function getBankAccountsFromHistory_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');

  const values = sheet.getDataRange().getDisplayValues();
  const accounts = new Set();

  for (let r = 0; r < values.length; r++) {
    const name = String(values[r][0] || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;
    accounts.add(name);
  }

  return Array.from(accounts).sort();
}

function getBankAccountValueForDate(accountName, balanceDate) {
  const name = String(accountName || '').trim();
  if (!name) throw new Error('Account name is required.');

  const d = parseIsoDateLocal_(balanceDate);

  const year = d.getFullYear();
  const monthValue = getBankAccountHistoryValueForMonth_(name, year, d);
  const accountInfo = getAccountsRowData_(name);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getBankAccountHistoryValueForMonth_(name, priorYear, prior);
    previousMonthLabel = Utilities.formatDate(prior, Session.getScriptTimeZone(), 'MMM-yy');
    const cur = Number(monthValue);
    const prev = Number(previousMonthValue);
    if (!isNaN(cur) && !isNaN(prev)) {
      deltaFromPreviousMonth = round2_(cur - prev);
    }
  } catch (e) {
    /* prior month block/column unavailable */
  }

  return {
    accountName: name,
    selectedMonth: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM-yy'),
    selectedMonthValue: monthValue,
    currentBalance: accountInfo ? accountInfo.currentBalance : '',
    availableNow: accountInfo ? accountInfo.availableNow : '',
    minBuffer: accountInfo ? accountInfo.minBuffer : '',
    type: accountInfo ? accountInfo.type : '',
    usePolicy: accountInfo ? accountInfo.usePolicy : '',
    previousMonthLabel: previousMonthLabel,
    deltaFromPreviousMonth: deltaFromPreviousMonth
  };
}

function getBankAccountHistoryValueForMonth_(accountName, year, balanceDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const block = getBankAccountsYearBlock_(sheet, year);

  const accountRow = findBankAccountRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find account "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(accountRow, monthCol).getValue()));
}

function updateBankAccountValueByDate(payload) {
  validateRequired_(payload, ['accountName', 'balanceDate', 'currentValue']);

  const accountName = String(payload.accountName || '').trim();
  const balanceDate = parseIsoDateLocal_(payload.balanceDate);
  const currentValue = toNumber_(payload.currentValue);

  const updateAvailableNow = !!payload.updateAvailableNow;
  const updateMinBuffer = !!payload.updateMinBuffer;

  if (!accountName) throw new Error('Account name is required.');

  const year = balanceDate.getFullYear();

  updateBankAccountsHistory_(accountName, year, balanceDate, currentValue);
  syncAllAccountsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('bank_accounts');

  if (updateAvailableNow || updateMinBuffer) {
    updateAccountsSheetFields_(accountName, {
      availableNow: updateAvailableNow ? currentValue : null,
      minBuffer: updateMinBuffer ? currentValue : null
    });
  }

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message:
      'Bank account updated and synced.\n' +
      'Available Now updated: ' + (updateAvailableNow ? 'Yes' : 'No') + '\n' +
      'Min Buffer updated: ' + (updateMinBuffer ? 'Yes' : 'No')
  };
}

function updateBankAccountsHistory_(accountName, year, balanceDate, currentValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const block = getBankAccountsYearBlock_(sheet, year);

  const accountRow = findBankAccountRowInBlock_(sheet, block, accountName);
  if (accountRow === -1) {
    throw new Error('Could not find account "' + accountName + '" inside Year ' + year + ' block.');
  }

  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  setCurrencyCellPreserveRowFormat_(sheet, accountRow, monthCol, currentValue, block.firstMonthCol);
}

function getAccountsRowData_(accountName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) return null;

  const headerMap = getAccountsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === accountName) {
      return {
        currentBalance: headerMap.balanceColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.balanceColZero])),
        availableNow: headerMap.availableColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.availableColZero])),
        minBuffer: headerMap.bufferColZero === -1 ? '' : round2_(toNumber_(values[r][headerMap.bufferColZero])),
        type: headerMap.typeColZero === -1 ? '' : String(display[r][headerMap.typeColZero] || '').trim(),
        usePolicy: headerMap.policyColZero === -1 ? '' : String(display[r][headerMap.policyColZero] || '').trim()
      };
    }
  }

  return null;
}

function updateAccountsSheetFields_(accountName, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');
  const display = sheet.getDataRange().getDisplayValues();
  const headerMap = getAccountsHeaderMap_(sheet);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][headerMap.nameColZero] || '').trim() === accountName) {
      if (options.availableNow !== null && options.availableNow !== undefined) {
        if (headerMap.availableCol === -1) {
          throw new Error('Accounts sheet must contain Available Now.');
        }
        setCurrencyCellPreserveRowFormat_(sheet, r + 1, headerMap.availableCol, options.availableNow, 1);
      }

      if (options.minBuffer !== null && options.minBuffer !== undefined) {
        if (headerMap.bufferCol === -1) {
          throw new Error('Accounts sheet must contain Min Buffer.');
        }
        setCurrencyCellPreserveRowFormat_(sheet, r + 1, headerMap.bufferCol, options.minBuffer, 1);
      }

      return;
    }
  }

  throw new Error('Could not find account "' + accountName + '" in Accounts sheet.');
}

function getBankAccountsYearBlock_(sheet, year) {
  const display = sheet.getDataRange().getDisplayValues();

  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const colA = String(display[r][0] || '').trim();
    const colB = String(display[r][1] || '').trim();

    if (colA === 'Year' && colB === String(year)) {
      yearRow = r + 1;
      break;
    }
  }

  if (yearRow === -1) {
    throw new Error('Could not find Year block for ' + year + ' in Bank Accounts.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(sheet.getRange(headerRow, 1).getDisplayValue() || '').trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in Bank Accounts.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = sheet.getLastRow();

  for (let row = dataStartRow; row <= sheet.getLastRow(); row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();

    if (name === 'Total Accounts' || name === 'Delta' || name === 'Year') {
      dataEndRow = row - 1;
      break;
    }
  }

  return {
    yearRow: yearRow,
    headerRow: headerRow,
    dataStartRow: dataStartRow,
    dataEndRow: dataEndRow,
    firstMonthCol: 2
  };
}

function findBankAccountRowInBlock_(sheet, block, accountName) {
  for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
    const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;
    if (name === accountName) return row;
  }
  return -1;
}

function isBankAccountDataRowName_(name) {
  const value = String(name || '').trim();
  if (!value) return false;
  if (value === 'Year') return false;
  if (value === 'Account Name') return false;
  if (value === 'Total Accounts') return false;
  if (value === 'Delta') return false;
  return true;
}

function getAccountsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const nameColZero = headers.indexOf('Account Name');
  const balanceColZero = headers.indexOf('Current Balance');
  const availableColZero = headers.indexOf('Available Now');
  const bufferColZero = headers.indexOf('Min Buffer');
  const typeColZero = headers.indexOf('Type');
  const policyColZero = headers.indexOf('Use Policy');

  if (nameColZero === -1) {
    throw new Error('Accounts sheet must contain Account Name.');
  }

  return {
    nameColZero: nameColZero,
    balanceColZero: balanceColZero,
    availableColZero: availableColZero,
    bufferColZero: bufferColZero,
    typeColZero: typeColZero,
    policyColZero: policyColZero,
    nameCol: nameColZero + 1,
    balanceCol: balanceColZero === -1 ? -1 : balanceColZero + 1,
    availableCol: availableColZero === -1 ? -1 : availableColZero + 1,
    bufferCol: bufferColZero === -1 ? -1 : bufferColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    policyCol: policyColZero === -1 ? -1 : policyColZero + 1
  };
}

/**
 * Sums INPUT - Bank Accounts for the prior calendar month (script timezone) for all data rows.
 * Used for dashboard "Total cash" change vs prior month (same pattern as investments).
 */
function getPriorMonthCashTotalFromBankInput_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const parts = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-');
  const curY = parseInt(parts[0], 10);
  const curM = parseInt(parts[1], 10);
  var prevY = curY;
  var prevM = curM - 1;
  if (prevM < 1) {
    prevM = 12;
    prevY -= 1;
  }
  const monthIndexZero = prevM - 1;
  const year = prevY;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss, 'BANK_ACCOUNTS');
    const block = getBankAccountsYearBlock_(sheet, year);
    const refDate = new Date(year, monthIndexZero, 15);
    const monthCol = getMonthColumnByDate_(sheet, refDate, block.headerRow);
    var sum = 0;
    for (var row = block.dataStartRow; row <= block.dataEndRow; row++) {
      var name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      if (!isBankAccountDataRowName_(name)) continue;
      sum += toNumber_(sheet.getRange(row, monthCol).getValue());
    }
    var label = Utilities.formatDate(new Date(year, monthIndexZero, 1), tz, 'MMM yyyy');
    return { total: round2_(sum), label: label };
  } catch (e) {
    return { total: null, label: '' };
  }
}
