/**
 * First-run safe creator for SYS - Accounts.
 *
 * Safety contract:
 *   - Never overwrites, clears, or reorders an existing sheet. If the
 *     sheet is present under its canonical name we return it untouched,
 *     even when its header row is empty. Existing-user workbooks are
 *     therefore unaffected.
 *   - Canonical headers (same labels getAccountsHeaderMap_ /
 *     planner_core.js normalizeAccounts_ look up by string): Account
 *     Name, Current Balance, Available Now, Min Buffer, Type, Use
 *     Policy, Priority, Active. Writing all eight on create means the
 *     bank-account add path doesn't have to self-heal anything on the
 *     first save.
 *   - Benign race-safe: if another caller wins the insertSheet race,
 *     we treat the now-existing sheet as a no-op.
 *
 * Called from addBankAccountFromDashboard to unblock first-run bank
 * creation on blank workbooks (previously threw "Missing sheet:
 * SYS - Accounts" before the row could be written).
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSysAccountsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = getSheetNames_();
  var sheetName = names.ACCOUNTS;
  var existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  var sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    existing = ss.getSheetByName(sheetName);
    if (existing) return existing;
    throw e;
  }

  var headers = [
    'Account Name',
    'Current Balance',
    'Available Now',
    'Min Buffer',
    'Type',
    'Use Policy',
    'Priority',
    'Active'
  ];
  try {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } catch (_e) {
    // Header paint is structural; re-throw to surface clearly.
    throw _e;
  }

  // Cosmetic polish applied only to the fresh sheet: emphasize the
  // header row, freeze it, and format the three currency columns so
  // numeric entries render consistently with the rest of the workbook
  // (Cash Flow / Upcoming Expenses use the same currency string). All
  // wrapped in try/catch because formatting is never load-bearing —
  // readers look up columns by header label, not cell format.
  try {
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    var currencyFormat = '$#,##0.00;-$#,##0.00';
    var maxRows = sheet.getMaxRows();
    // Current Balance (B), Available Now (C), Min Buffer (D) are all
    // currency columns. Priority (G) stays as a plain integer.
    if (maxRows > 1) {
      sheet.getRange(2, 2, maxRows - 1, 3).setNumberFormat(currencyFormat);
    }

    sheet.autoResizeColumns(1, headers.length);
  } catch (_fmt) { /* cosmetic only */ }

  return sheet;
}

function syncAllAccountsFromLatestCurrentYear_() {
  // Use ensureSysAccountsSheet_() for the SYS - Accounts handle so this
  // stays working on first-run saves where the sheet was just inserted
  // earlier in the same Apps Script execution. Some runtimes do not
  // surface a freshly inserted sheet via ss.getSheetByName(...) even
  // after SpreadsheetApp.flush(), causing getSheet_(ss, 'ACCOUNTS') to
  // throw "Missing sheet: SYS - Accounts". The ensure helper returns
  // the actual Sheet object directly (and is a no-op when the sheet
  // already exists, so populated workbooks are unaffected).
  const targetSheet = ensureSysAccountsSheet_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = getSheet_(ss, 'BANK_ACCOUNTS');

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

  let inactive = Object.create(null);
  try {
    inactive = getInactiveBankAccountsSet_();
  } catch (e) {
    Logger.log('getBankAccountUiData inactive filter: ' + e);
  }

  const allAccounts = getBankAccountsFromHistory_();
  const activeAccounts = allAccounts.filter(function(name) {
    return !inactive[String(name || '').toLowerCase()];
  });

  return {
    accounts: activeAccounts,
    typeOptions: typeOpts,
    policyOptions: policyOpts
  };
}

/**
 * Returns an object map keyed by lowercase account name for bank accounts
 * whose Active column on SYS - Accounts is explicitly marked "No" / "n" /
 * "false" / "inactive". Blank, missing, or unrecognized values are treated
 * as active (backward compatibility for rows created before Active existed).
 */
function getInactiveBankAccountsSet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');
  const display = sheet.getDataRange().getDisplayValues();
  const inactive = Object.create(null);
  if (display.length < 2) return inactive;

  let headerMap;
  try {
    headerMap = getAccountsHeaderMap_(sheet);
  } catch (e) {
    return inactive;
  }
  if (headerMap.activeColZero === -1) return inactive;

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    const raw = String(display[r][headerMap.activeColZero] || '').trim().toLowerCase();
    if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
      inactive[name.toLowerCase()] = true;
    }
  }
  return inactive;
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
      throw new Error('An account with that name already exists.');
    }
  }

  if (accountExistsInAccountsSheet_(name)) {
    throw new Error('An account with that name already exists.');
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
  // Self-heal the Active column before computing lastCol so the inserted
  // row's format copy covers it and we can stamp Active=Yes below.
  const activeCol = ensureBankAccountsActiveColumnForBlock_(sheet, block);
  const lastCol = Math.max(sheet.getLastColumn(), activeCol, 2);
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

  // New bank accounts are Active = Yes. Historical rows created before the
  // Active column existed remain blank and are treated as active by readers.
  writeActiveCellWithRowFormat_(sheet, newRow, activeCol, 'Yes');

  return newRow;
}

/**
 * Returns the 1-based row of the last existing data row in SYS - Accounts (one
 * with a non-blank Account Name) so we can clone its formatting onto a newly
 * appended row. Matches the pattern used by `findAssetsTemplateRow_` in
 * investments.js.
 */
function findAccountsTemplateRow_(sheet, headerMap) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = display.length - 1; r >= 1; r--) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (name) return r + 1;
  }
  return -1;
}

function appendAccountsRowForNewBank_(sheet, accountName, typeStr, policyStr, priorityNum) {
  const headerMap = ensureAccountsActiveColumn_(sheet);
  const lastCol = Math.max(sheet.getLastColumn(), headerMap.nameCol, headerMap.activeCol);

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
  if (headerMap.priorityColZero !== -1) {
    const pri = parseInt(priorityNum, 10);
    row[headerMap.priorityColZero] = isNaN(pri) ? 9 : pri;
  }
  if (headerMap.activeColZero !== -1) row[headerMap.activeColZero] = 'Yes';

  // Identify a neighbor row BEFORE appending so we can clone visual
  // treatment (borders, background, font, alignment, number formats, row
  // height) onto the new row without touching the freshly written values.
  const templateRow = findAccountsTemplateRow_(sheet, headerMap);

  sheet.appendRow(row);
  const appendedRow = sheet.getLastRow();

  if (templateRow !== -1) {
    try {
      sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
        sheet.getRange(appendedRow, 1, 1, lastCol),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sheet.setRowHeight(appendedRow, sheet.getRowHeight(templateRow));
    } catch (formatErr) {
      Logger.log('appendAccountsRowForNewBank_ format copy failed: ' + formatErr);
    }
  }

  // Re-assert currency number formats as a safety net: the whole-row
  // PASTE_FORMAT above normally covers them, but older workbooks may have
  // a trailing row without currency formatting.
  if (headerMap.balanceCol !== -1) {
    const bc = sheet.getRange(appendedRow, headerMap.balanceCol);
    if (!String(bc.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(bc);
  }
  if (headerMap.availableCol !== -1) {
    const ac = sheet.getRange(appendedRow, headerMap.availableCol);
    if (!String(ac.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(ac);
  }
  if (headerMap.bufferCol !== -1) {
    const mc = sheet.getRange(appendedRow, headerMap.bufferCol);
    if (!String(mc.getNumberFormat() || '').match(/\$|#,##0/)) applyCurrencyFormat_(mc);
  }

  // Re-stamp Active with row-consistent formatting. The whole-row PASTE_FORMAT
  // copy above inherits the template row's Active cell style, which may
  // itself have defaulted to tiny text on older rows.
  if (headerMap.activeCol !== -1) {
    writeActiveCellWithRowFormat_(sheet, appendedRow, headerMap.activeCol, 'Yes');
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
 *   priority?: number|string,
 *   openingBalanceDate?: string,
 *   openingBalance?: number|string,
 *   setAvailableFromOpening?: boolean,
 *   setMinBufferFromOpening?: boolean
 * }} payload
 */
function addBankAccountFromDashboard(payload) {
  validateRequired_(payload, ['accountName', 'type', 'usePolicy']);

  // First-run safety: on a freshly deployed workbook neither
  // INPUT - Bank Accounts nor SYS - Accounts may exist yet. These ensure
  // calls MUST run before validateNewBankAccountName_ below, because
  // that validator calls accountExistsInAccountsSheet_() and
  // getBankAccountsFromHistory_(), both of which do getSheet_() reads
  // that throw "Missing sheet: ..." on a blank workbook. Both helpers
  // are no-ops when the sheet is already present, so populated
  // workbooks are completely unaffected.
  //
  //   ensureOnboardingBankAccountsSheetFromDashboard('normal')
  //     Live (non-test) INPUT - Bank Accounts with a Year block for the
  //     current year (Row 1: Year | <year>, Row 2: Account Name | Jan-YY
  //     ... Dec-YY | Total). Exact structure getBankAccountsYearBlock_()
  //     expects a few lines below.
  //   ensureSysAccountsSheet_()
  //     Canonical SYS - Accounts (Account Name, Current Balance,
  //     Available Now, Min Buffer, Type, Use Policy, Priority, Active).
  //     Returns the Sheet object directly so we do not re-read via
  //     getSheet_() on a potentially-stale Spreadsheet handle — some
  //     Apps Script executions leave `ss.getSheetByName(...)` returning
  //     null for a sheet that was inserted earlier in the same call.
  try {
    ensureOnboardingBankAccountsSheetFromDashboard('normal');
  } catch (ensureErr) {
    // Re-surface with a user-facing message so the dashboard banner
    // is actionable rather than just "Missing sheet: ...".
    throw new Error(
      'Could not prepare INPUT - Bank Accounts: ' +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  var accountsSheet;
  try {
    accountsSheet = ensureSysAccountsSheet_();
  } catch (sysErr) {
    throw new Error(
      'Could not prepare SYS - Accounts: ' +
      (sysErr && sysErr.message ? sysErr.message : sysErr)
    );
  }
  if (!accountsSheet) {
    // Defensive fallback — should be unreachable, but we'd rather
    // surface a clear actionable message than crash downstream.
    throw new Error('Could not prepare SYS - Accounts (helper returned no sheet).');
  }

  // Force Apps Script to flush any pending structural writes from the
  // two ensure helpers so the next getSheetByName() sees the fresh
  // state. Without this, freshly-inserted sheets can be invisible to a
  // Spreadsheet handle captured before the insert.
  SpreadsheetApp.flush();

  // Now that both sheets are guaranteed to exist, validation reads are
  // safe. validateNewBankAccountName_ calls accountExistsInAccountsSheet_
  // (reads SYS - Accounts) and getBankAccountsFromHistory_ (reads
  // INPUT - Bank Accounts) so this MUST come after the ensure+flush.
  const accountName = validateNewBankAccountName_(payload.accountName);
  const typeStr = String(payload.type || '').trim();
  const policyStr = String(payload.usePolicy || '').trim();

  if (!typeStr) throw new Error('Type is required.');
  if (!policyStr) throw new Error('Use policy is required.');
  if (typeStr.length > 80) throw new Error('Type is too long (max 80 characters).');
  if (policyStr.length > 120) throw new Error('Use policy is too long (max 120 characters).');

  // Priority: canonical SYS - Accounts column read by planner_core.js
  // (normalizeAccounts_). Default 9 to match the planner fallback.
  let priorityNum = 9;
  const priRaw = payload.priority;
  if (priRaw !== null && priRaw !== undefined && String(priRaw).trim() !== '') {
    const parsed = parseInt(String(priRaw).trim(), 10);
    if (isNaN(parsed)) throw new Error('Priority must be a whole number.');
    if (parsed < 1 || parsed > 99) throw new Error('Priority must be between 1 and 99.');
    priorityNum = parsed;
  }

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

  // Get a fresh Spreadsheet handle AFTER the inserts so bankSheet
  // resolves reliably on a brand-new workbook. ensureSysAccountsSheet_
  // already returned its sheet directly, so we do not re-fetch that one.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const currentYear = getCurrentYear_();
  const block = getBankAccountsYearBlock_(bankSheet, currentYear);

  let bankRowNum = 0;
  try {
    bankRowNum = insertNewBankAccountHistoryRow_(bankSheet, block, accountName);
  } catch (e) {
    throw new Error('Could not insert bank history row: ' + (e.message || e));
  }

  try {
    appendAccountsRowForNewBank_(accountsSheet, accountName, typeStr, policyStr, priorityNum);
  } catch (e2) {
    bankSheet.deleteRow(bankRowNum);
    throw new Error('Could not add the account (rolled back the bank sheet row): ' + (e2.message || e2));
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
        priority: priorityNum,
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
      '".\n' +
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
  // Match syncAllAccountsFromLatestCurrentYear_: use the idempotent
  // ensure helper so first-run "Create account" does not fail with
  // "Missing sheet: SYS - Accounts" when the sheet was just inserted
  // upstream in the same execution. No-op for populated workbooks.
  const sheet = ensureSysAccountsSheet_();
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
  const priorityColZero = headers.indexOf('Priority');
  const activeColZero = headers.indexOf('Active');

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
    priorityColZero: priorityColZero,
    activeColZero: activeColZero,
    nameCol: nameColZero + 1,
    balanceCol: balanceColZero === -1 ? -1 : balanceColZero + 1,
    availableCol: availableColZero === -1 ? -1 : availableColZero + 1,
    bufferCol: bufferColZero === -1 ? -1 : bufferColZero + 1,
    typeCol: typeColZero === -1 ? -1 : typeColZero + 1,
    policyCol: policyColZero === -1 ? -1 : policyColZero + 1,
    priorityCol: priorityColZero === -1 ? -1 : priorityColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
  };
}

/**
 * Self-heals SYS - Accounts by ensuring an "Active" header exists. Appends
 * "Active" to the first empty trailing header cell (or a new column if none
 * are empty) without touching existing data rows. Returns a fresh header
 * map. Blank Active in existing rows is treated as active.
 */
function ensureAccountsActiveColumn_(sheet) {
  const headerMap = getAccountsHeaderMap_(sheet);
  if (headerMap.activeColZero !== -1) return headerMap;

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRowValues = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];

  let targetCol = lastCol + 1;
  for (let c = headerRowValues.length; c >= 1; c--) {
    if (String(headerRowValues[c - 1] || '').trim() === '') {
      targetCol = c;
    } else {
      break;
    }
  }

  sheet.getRange(1, targetCol).setValue('Active');
  return getAccountsHeaderMap_(sheet);
}

/**
 * Iterates every Year block on INPUT - Bank Accounts. Callback receives the
 * parsed block (same shape as getBankAccountsYearBlock_) and the integer year.
 * Errors on individual blocks are swallowed so a malformed block can never
 * break a multi-block write pass.
 */
function forEachBankAccountsYearBlock_(sheet, callback) {
  const display = sheet.getDataRange().getDisplayValues();
  for (let r = 0; r < display.length; r++) {
    const colA = String(display[r][0] || '').trim();
    const colB = String(display[r][1] || '').trim();
    if (colA !== 'Year') continue;
    const yearNum = parseInt(colB, 10);
    if (isNaN(yearNum)) continue;

    let block = null;
    try {
      block = getBankAccountsYearBlock_(sheet, yearNum);
    } catch (blockErr) {
      Logger.log('forEachBankAccountsYearBlock_ ' + yearNum + ': ' + blockErr);
      continue;
    }
    callback(block, yearNum);
  }
}

/**
 * Self-heals a year block in INPUT - Bank Accounts by ensuring an "Active"
 * header exists. Placed at column firstMonthCol + 12 (immediately after Dec)
 * so existing month column logic — which assumes 12 contiguous months
 * starting at firstMonthCol — is not disturbed. Returns the 1-based column
 * of the Active header for this block.
 */
function ensureBankAccountsActiveColumnForBlock_(sheet, block) {
  const afterDecCol = block.firstMonthCol + 12; // typically col 14 with firstMonthCol=2
  const scanWidth = Math.max(sheet.getLastColumn(), afterDecCol + 4);
  const headerVals = sheet.getRange(block.headerRow, 1, 1, scanWidth).getDisplayValues()[0] || [];

  for (let c = 0; c < headerVals.length; c++) {
    if (String(headerVals[c] || '').trim().toLowerCase() === 'active') {
      return c + 1;
    }
  }

  try {
    sheet.getRange(block.headerRow, block.firstMonthCol + 11, 1, 1).copyTo(
      sheet.getRange(block.headerRow, afterDecCol, 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  } catch (e) {
    /* formatting is best-effort; the header value is what matters */
  }
  sheet.getRange(block.headerRow, afterDecCol).setValue('Active');
  return afterDecCol;
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

/**
 * Writes an Active value on every data row in every year block of
 * INPUT - Bank Accounts whose column A matches accountName (case-insensitive).
 * Self-heals the Active column in each block before writing.
 *
 * @returns {{ found: boolean, rowsUpdated: number, blocksScanned: number }}
 */
function setBankAccountActiveInAllBlocks_(sheet, accountName, value) {
  const target = String(accountName || '').trim().toLowerCase();
  const writeValue = String(value == null ? '' : value);
  let rowsUpdated = 0;
  let found = false;
  let blocksScanned = 0;

  forEachBankAccountsYearBlock_(sheet, function(block) {
    blocksScanned++;
    const activeCol = ensureBankAccountsActiveColumnForBlock_(sheet, block);

    for (let row = block.dataStartRow; row <= block.dataEndRow; row++) {
      const name = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
      if (!isBankAccountDataRowName_(name)) continue;
      if (name.toLowerCase() !== target) continue;

      found = true;
      const cell = sheet.getRange(row, activeCol);
      const current = String(cell.getDisplayValue() || '').trim().toLowerCase();
      if (current !== writeValue.toLowerCase()) {
        writeActiveCellWithRowFormat_(sheet, row, activeCol, writeValue);
        rowsUpdated++;
      }
    }
  });

  return {
    found: found,
    rowsUpdated: rowsUpdated,
    blocksScanned: blocksScanned
  };
}

/**
 * Writes an Active value on the matching SYS - Accounts row. Self-heals the
 * Active column first so the write always lands in a real column.
 *
 * @returns {{ found: boolean, changed: boolean }}
 */
function setAccountsActiveValue_(sheet, accountName, value) {
  const target = String(accountName || '').trim().toLowerCase();
  const writeValue = String(value == null ? '' : value);

  const headerMap = ensureAccountsActiveColumn_(sheet);
  const display = sheet.getDataRange().getDisplayValues();

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (name.toLowerCase() !== target) continue;

    const rowNum = r + 1;
    const cell = sheet.getRange(rowNum, headerMap.activeCol);
    const current = String(cell.getDisplayValue() || '').trim().toLowerCase();
    if (current === writeValue.toLowerCase()) {
      return { found: true, changed: false };
    }
    writeActiveCellWithRowFormat_(sheet, rowNum, headerMap.activeCol, writeValue);
    return { found: true, changed: true };
  }

  return { found: false, changed: false };
}

/**
 * Stop tracking a bank account: flips Active=No on every matching
 * INPUT - Bank Accounts row (across all year blocks) and on the mirror
 * SYS - Accounts row. History (month values, Current Balance, Available Now,
 * Min Buffer) is preserved; the row is not deleted or renamed, so the name
 * stays reserved against reuse.
 *
 * @param {{ accountName: string }} payload
 */
function deactivateBankAccountFromDashboard(payload) {
  validateRequired_(payload, ['accountName']);
  const accountName = String(payload.accountName || '').trim();
  if (!accountName) throw new Error('Account name is required.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const accountsSheet = getSheet_(ss, 'ACCOUNTS');

  // 1) Canonical write across every year block.
  const bankUpdate = setBankAccountActiveInAllBlocks_(bankSheet, accountName, 'No');
  if (!bankUpdate.found) {
    throw new Error('No rows found for "' + accountName + '" in Bank Accounts.');
  }

  // 2) Mirror write on SYS - Accounts.
  const accountsUpdate = setAccountsActiveValue_(accountsSheet, accountName, 'No');

  const alreadyInactive = bankUpdate.rowsUpdated === 0 && !accountsUpdate.changed;

  // 3) Activity log (best-effort).
  try {
    const tz = Session.getScriptTimeZone();
    appendActivityLog_(ss, {
      eventType: 'bank_account_deactivate',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: 'expense',
      payee: accountName,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        bankRowsUpdated: bankUpdate.rowsUpdated,
        bankBlocksScanned: bankUpdate.blocksScanned,
        accountsRowFound: accountsUpdate.found,
        alreadyInactive: alreadyInactive
      })
    });
  } catch (logErr) {
    Logger.log('deactivateBankAccountFromDashboard activity log: ' + logErr);
  }

  try {
    touchDashboardSourceUpdated_('bank_accounts');
  } catch (e) {
    /* best-effort */
  }

  const message = alreadyInactive
    ? '"' + accountName + '" was already marked inactive. History remains.'
    : 'Stopped tracking "' + accountName + '". History is preserved.';

  return {
    ok: true,
    message: message,
    accountName: accountName,
    alreadyInactive: alreadyInactive,
    rowsUpdated: bankUpdate.rowsUpdated + (accountsUpdate.changed ? 1 : 0)
  };
}
