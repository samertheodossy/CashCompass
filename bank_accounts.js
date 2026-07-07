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
  var ss = getUserSpreadsheet_();
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
  //
  // Performance: previously this function did ~4 sheet round-trips PER
  // BANK ACCOUNT inside getLatestBankAccountValuesForYear_, then ~2-3
  // more round-trips PER SYS - Accounts ROW writing through
  // setCurrencyCellPreserveRowFormat_ even when the value hadn't
  // changed. Now we (1) compute the latest map with 2 round-trips total
  // via a batched read and (2) skip the format-preserving write when
  // the new value equals the existing value.
  const targetSheet = ensureSysAccountsSheet_();
  const ss = getUserSpreadsheet_();
  const sourceSheet = getSheet_(ss, 'BANK_ACCOUNTS');

  const targetDisplay = targetSheet.getDataRange().getDisplayValues();
  const targetRaw = targetSheet.getDataRange().getValues();
  if (targetDisplay.length < 2) {
    throw new Error('Accounts sheet is empty.');
  }

  const targetHeaderMap = getAccountsHeaderMap_(targetSheet, targetDisplay);
  const latestMap = getLatestBankAccountValuesForYear_(sourceSheet, getCurrentYear_());

  for (let r = 1; r < targetDisplay.length; r++) {
    const name = String(targetDisplay[r][targetHeaderMap.nameColZero] || '').trim();
    if (!name) continue;
    if (!Object.prototype.hasOwnProperty.call(latestMap, name)) continue;

    const newValue = latestMap[name];
    const existing = targetHeaderMap.balanceColZero === -1
      ? null
      : round2_(toNumber_(targetRaw[r][targetHeaderMap.balanceColZero]));
    if (existing !== null && existing === round2_(toNumber_(newValue))) continue;

    setCurrencyCellPreserveRowFormat_(
      targetSheet,
      r + 1,
      targetHeaderMap.balanceCol,
      newValue,
      1
    );
  }
}

function getLatestBankAccountValuesForYear_(sheet, year) {
  // Performance: same fix as getLatestInvestmentValuesForYear_. Read
  // the year block in 2 batched calls (display once, values once) and
  // resolve the latest non-empty month entirely in memory instead of
  // calling getRange() per row.
  const display = sheet.getDataRange().getDisplayValues();
  const block = getBankAccountsYearBlock_(sheet, year, display);
  const result = {};

  if (block.dataEndRow < block.dataStartRow) return result;

  const headerRow = display[block.headerRow - 1] || [];
  const lastCol = sheet.getLastColumn();
  if (lastCol < block.firstMonthCol) return result;

  const numRows = block.dataEndRow - block.dataStartRow + 1;
  const values = sheet.getRange(block.dataStartRow, 1, numRows, lastCol).getValues();

  const yearNum = Number(year);
  const headerLen = headerRow.length;

  for (let i = 0; i < values.length; i++) {
    const dispRow = display[block.dataStartRow - 1 + i] || [];
    const name = String(dispRow[0] || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;

    let bestColIdx = -1;
    let bestTime = -1;

    for (let c = block.firstMonthCol - 1; c < lastCol && c < headerLen; c++) {
      const parsed = parseMonthHeader_(headerRow[c]);
      if (!parsed) continue;
      if (parsed.getFullYear() !== yearNum) continue;

      const v = values[i][c];
      if (v === '' || v === null || v === undefined) continue;

      const time = parsed.getTime();
      if (time > bestTime) {
        bestTime = time;
        bestColIdx = c;
      }
    }

    if (bestColIdx !== -1) {
      result[name] = round2_(toNumber_(values[i][bestColIdx]));
    }
  }

  return result;
}

function getBankAccountUiData() {
  // Performance: the previous implementation read SYS - Accounts THREE
  // times in a row — once for distinct Type values, once for distinct
  // Use Policy values, and once for the inactive set. Each read is a
  // ~300–800ms round-trip on populated workbooks, so opening the Bank
  // Accounts tab spent ~1.5–2s before the page could even render. We
  // now load SYS - Accounts once and derive all three from that single
  // snapshot. Behavior is identical: same Type list, same Use Policy
  // list, same inactive filter. The BANK_ACCOUNTS history read (1
  // round-trip) is unchanged — that's already minimal.
  var typeOpts = [];
  var policyOpts = [];
  let inactive = Object.create(null);

  try {
    const ss = getUserSpreadsheet_();
    const accountsSheet = ss.getSheetByName(getSheetNames_().ACCOUNTS);
    if (accountsSheet) {
      const accountsDisplay = accountsSheet.getDataRange().getDisplayValues();
      if (accountsDisplay.length >= 1) {
        const headers = accountsDisplay[0] || [];
        const typeIdx = headers.indexOf('Type');
        const policyIdx = headers.indexOf('Use Policy');
        const nameIdx = headers.indexOf('Account Name');
        const activeIdx = headers.indexOf('Active');

        const typeSet = Object.create(null);
        const policySet = Object.create(null);

        for (let r = 1; r < accountsDisplay.length; r++) {
          const row = accountsDisplay[r] || [];

          if (typeIdx !== -1) {
            const t = String(row[typeIdx] || '').trim();
            if (t) typeSet[t] = true;
          }
          if (policyIdx !== -1) {
            const p = String(row[policyIdx] || '').trim();
            if (p) policySet[p] = true;
          }
          if (nameIdx !== -1 && activeIdx !== -1) {
            const name = String(row[nameIdx] || '').trim();
            if (name) {
              const raw = String(row[activeIdx] || '').trim().toLowerCase();
              if (raw === 'no' || raw === 'n' || raw === 'false' || raw === 'inactive') {
                inactive[name.toLowerCase()] = true;
              }
            }
          }
        }

        typeOpts = Object.keys(typeSet).sort(function(a, b) { return a.localeCompare(b); });
        policyOpts = Object.keys(policySet).sort(function(a, b) { return a.localeCompare(b); });
      }
    }
  } catch (e) {
    Logger.log('getBankAccountUiData accounts read: ' + e);
  }

  // First-run safety: on a blank workbook INPUT - Bank Accounts does
  // not exist yet, so getBankAccountsFromHistory_() would throw
  // "Missing sheet: INPUT - Bank Accounts" and surface a red error in
  // the Bank Accounts setup UI even though the flow is not actually
  // blocked (the first save runs ensureInputBankAccountsSheet_ before
  // writing). Treat missing as "no existing accounts yet" so the UI
  // can render its empty/create state cleanly. Populated workbooks are
  // unaffected because the sheet exists and the read succeeds.
  let allAccounts = [];
  try {
    allAccounts = getBankAccountsFromHistory_();
  } catch (e) {
    Logger.log('getBankAccountUiData history read: ' + e);
  }
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
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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

  const ss = getUserSpreadsheet_();
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

  // When the only candidate template is the year-block header row (an empty
  // block getting its very first account), cloning its format would stamp the
  // yellow header look (bg, bold, 16pt) onto the data row. We detect that case
  // and stamp a clean data-row style instead of cloning. Cloning a REAL
  // account row (the common case) is unchanged.
  let templateIsHeader = false;

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
      // If the row directly below is a reserved aggregate/marker row (e.g. a
      // seeded "Total Accounts" / "Delta"), cloning its format would stamp the
      // green/tan summary band onto a data row. Fall back to the clean
      // data-row stamp used for the header-only case instead.
      const belowName = String(sheet.getRange(templateRow, 1).getDisplayValue() || '').trim();
      if (!isBankAccountDataRowName_(belowName)) {
        templateRow = block.headerRow;
        templateIsHeader = true;
      }
    } else {
      templateRow = block.headerRow;
      templateIsHeader = true;
    }
  } else {
    sheet.insertRowAfter(lastAccountRow);
    newRow = lastAccountRow + 1;
    templateRow = lastAccountRow;
  }

  if (templateIsHeader) {
    // Empty-block first account: do NOT inherit the header's styling. Stamp
    // the canonical data-row look (white, normal weight, 14pt) and re-apply
    // currency formats to the month + Total columns, matching the format the
    // onboarding creator set on the data region. The Active cell is corrected
    // to plain text by writeActiveCellWithRowFormat_ below. Cosmetic only —
    // a failure here must not block adding the account.
    try {
      sheet.getRange(newRow, 1, 1, lastCol)
        .setBackground('#ffffff')
        .setFontWeight('normal')
        .setFontColor('#000000')
        .setFontSize(14);
      const firstMonthCol = block.firstMonthCol || 2;
      if (lastCol >= firstMonthCol) {
        sheet.getRange(newRow, firstMonthCol, 1, lastCol - firstMonthCol + 1)
          .setNumberFormat('$#,##0.00;-$#,##0.00');
      }
    } catch (_stampErr) {
      Logger.log('insertNewBankAccountHistoryRow_ data-row stamp: ' + _stampErr);
    }
  } else {
    sheet.getRange(templateRow, 1, 1, lastCol).copyTo(
      sheet.getRange(newRow, 1, 1, lastCol),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
  }
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
      "Couldn't prepare bank accounts: " +
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
  const ss = getUserSpreadsheet_();
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

  // Keep the current-year "Total Accounts" summary row's gross =SUM ranges
  // covering the newly inserted account row (handles the SUM lower-boundary
  // case + the single-row normalization). No-op when the block has no Total
  // Accounts row, exact-shape guarded so it never clobbers a hand-authored
  // summary, and scoped to the current year block. Best-effort — a failure
  // here must never undo an account that is already saved.
  try {
    refreshBankAccountsTotalAccountsRow_(bankSheet, currentYear);
  } catch (totalErr) {
    Logger.log('addBankAccountFromDashboard refreshBankAccountsTotalAccountsRow_: ' + totalErr);
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
    message: 'Bank account added.'
  };
}

function getBankAccountsFromHistory_() {
  const ss = getUserSpreadsheet_();
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

  // Performance: previously this RPC ran getBankAccountHistoryValueForMonth_
  // twice (current + prior month), and each call did a fresh full read of
  // BANK_ACCOUNTS plus a per-row range read inside findBankAccountRowInBlock_.
  // Plus getAccountsRowData_ did its own SYS - Accounts read. On populated
  // workbooks that's ~6 round-trips for one account/date selection, making
  // the right-side panel feel laggy on every dropdown change.
  //
  // We now load BANK_ACCOUNTS once up front and pass the snapshot into the
  // year-block + row-find helpers so both months reuse it. The same year
  // block usually serves both months; the prior-month case crosses a year
  // boundary cleanly because the helpers accept the same display snapshot
  // (the whole sheet, including all year blocks, is in memory). Behavior is
  // identical for callers — the response shape, currency rounding, and
  // error messages are unchanged.
  const ss = getUserSpreadsheet_();
  const bankSheet = getSheet_(ss, 'BANK_ACCOUNTS');
  const bankDisplay = bankSheet.getDataRange().getDisplayValues();

  const year = d.getFullYear();
  const monthValue = getBankAccountHistoryValueForMonthFromDisplay_(
    bankSheet, bankDisplay, name, year, d
  );
  const accountInfo = getAccountsRowData_(name);

  var previousMonthLabel = '';
  var deltaFromPreviousMonth = null;
  try {
    const prior = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const priorYear = prior.getFullYear();
    const previousMonthValue = getBankAccountHistoryValueForMonthFromDisplay_(
      bankSheet, bankDisplay, name, priorYear, prior
    );
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

/**
 * Internal twin of getBankAccountHistoryValueForMonth_ that takes a
 * pre-loaded BANK_ACCOUNTS display-values snapshot so callers reading
 * multiple months in a single RPC don't re-fetch the same sheet for
 * each lookup. Used by getBankAccountValueForDate for the
 * current-month + prior-month delta panel; the monthly cell value
 * itself is still read with sheet.getRange(...).getValue() so we
 * preserve the exact numeric path the existing code was tested
 * against (rounding behavior identical).
 */
function getBankAccountHistoryValueForMonthFromDisplay_(sheet, display, accountName, year, balanceDate) {
  const block = getBankAccountsYearBlock_(sheet, year, display);
  const accountRow = findBankAccountRowInBlock_(sheet, block, accountName, display);
  if (accountRow === -1) {
    throw new Error('Could not find account "' + accountName + '" inside Year ' + year + ' block.');
  }
  const monthCol = getMonthColumnByDate_(sheet, balanceDate, block.headerRow);
  return round2_(toNumber_(sheet.getRange(accountRow, monthCol).getValue()));
}

function getBankAccountHistoryValueForMonth_(accountName, year, balanceDate) {
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();

  // Capture the prior month-cell value BEFORE the overwrite so the activity
  // log row can show both the previous and new balance. Best-effort — a
  // failed read here (missing year block, malformed sheet, etc.) just
  // leaves previousRaw null and the action label falls back to a balance-
  // only form ("Updated May-26 balance to $1,234.56" without the delta).
  // The duplicated lookup against block / row / month col is intentionally
  // local to this function so updateBankAccountsHistory_'s contract stays
  // unchanged for the other callers (addBankAccountFromDashboard,
  // bankImportApplyAutoMatchWrite_) — neither needs a prior-value read.
  let previousRaw = null;
  let previousDisplay = '';
  try {
    const prevSheet = getSheet_(ss, 'BANK_ACCOUNTS');
    const prevBlock = getBankAccountsYearBlock_(prevSheet, year);
    const prevRow = findBankAccountRowInBlock_(prevSheet, prevBlock, accountName);
    if (prevRow !== -1) {
      const prevCol = getMonthColumnByDate_(prevSheet, balanceDate, prevBlock.headerRow);
      const prevCell = prevSheet.getRange(prevRow, prevCol);
      previousRaw = round2_(toNumber_(prevCell.getValue()));
      previousDisplay = String(prevCell.getDisplayValue() || '').trim();
    }
  } catch (prevErr) {
    Logger.log('updateBankAccountValueByDate previous-read: ' + prevErr);
  }

  updateBankAccountsHistory_(accountName, year, balanceDate, currentValue);
  syncAllAccountsFromLatestCurrentYear_();
  touchDashboardSourceUpdated_('bank_accounts');

  if (updateAvailableNow || updateMinBuffer) {
    updateAccountsSheetFields_(accountName, {
      availableNow: updateAvailableNow ? currentValue : null,
      minBuffer: updateMinBuffer ? currentValue : null
    });
  }

  // Activity log: balance-update event. Mirrors the debt_update pattern
  // (debts.js::updateDebtField) — non-monetary (Amount renders "—") so a
  // balance snapshot doesn't double-count as a money movement against the
  // Activity totals; the action label carries the month + new balance for
  // context, e.g. "Updated May-26 balance to $1,234.56". Side updates
  // (Available Now / Min Buffer) ride along on the same row's details
  // JSON rather than spawning extra log lines for one user action.
  // Logged BEFORE runDebtPlanner so the row is still captured if the
  // planner trips on bad data downstream.
  try {
    const tz = Session.getScriptTimeZone();
    const monthLabel = Utilities.formatDate(balanceDate, tz, 'MMM-yy');
    const newRaw = round2_(toNumber_(currentValue));
    appendActivityLog_(ss, {
      eventType: 'bank_account_update',
      entryDate: Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
      payee: accountName,
      category: '',
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        fieldName: 'Balance',
        fieldKind: 'currency',
        monthLabel: monthLabel,
        balanceDate: Utilities.formatDate(balanceDate, tz, 'yyyy-MM-dd'),
        previousRaw: previousRaw,
        previousDisplay: previousDisplay,
        newRaw: newRaw,
        availableNowSet: updateAvailableNow,
        minBufferSet: updateMinBuffer
      })
    });
  } catch (logErr) {
    Logger.log('updateBankAccountValueByDate activity log: ' + logErr);
  }

  // NOTE: we intentionally do NOT call runDebtPlanner() here. The
  // sheet write + SYS - Accounts sync + activity log row are everything
  // the user needs to see the new balance reflected. Rolling Debt Payoff
  // and other planner-derived dashboard panels are refreshed by the main
  // dashboard firing runPlannerAndRefreshDashboard() as a silent
  // background RPC after this save returns — same pattern Planning →
  // Debts (saveDebt) and Quick Add (savePayment) already use, so the UI
  // doesn't hang on "Saving…" while the planner runs for several seconds
  // on big workbooks. See Dashboard_Script_AssetsBankInvestments.html::
  // saveBank().
  return {
    ok: true,
    message: 'Bank account saved.'
  };
}

function updateBankAccountsHistory_(accountName, year, balanceDate, currentValue) {
  const ss = getUserSpreadsheet_();
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
  const ss = getUserSpreadsheet_();
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

function getBankAccountsYearBlock_(sheet, year, optionalDisplay) {
  // Performance: previously this helper read the full sheet display
  // values, then re-read column A one cell at a time both to validate
  // the header row and to find the dataEndRow boundary. The full read
  // already contains all of column A — re-fetching per row was pure
  // round-trip overhead. We now reuse that one snapshot. Callers that
  // already loaded the full display (e.g. getBankAccountValueForDate)
  // can pass it in via optionalDisplay so we don't re-read at all.
  const display = (optionalDisplay && optionalDisplay.length)
    ? optionalDisplay
    : sheet.getDataRange().getDisplayValues();

  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const colA = String((display[r] && display[r][0]) || '').trim();
    const colB = String((display[r] && display[r][1]) || '').trim();

    if (colA === 'Year' && colB === String(year)) {
      yearRow = r + 1;
      break;
    }
  }

  if (yearRow === -1) {
    throw new Error('Could not find Year block for ' + year + ' in Bank Accounts.');
  }

  const headerRow = yearRow + 1;
  const headerName = String(
    (display[headerRow - 1] && display[headerRow - 1][0]) || ''
  ).trim();
  if (headerName !== 'Account Name') {
    throw new Error('Expected Account Name header row for Year ' + year + ' in Bank Accounts.');
  }

  const dataStartRow = headerRow + 1;
  let dataEndRow = display.length; // last row of the loaded sheet snapshot

  for (let r = dataStartRow - 1; r < display.length; r++) {
    const name = String((display[r] && display[r][0]) || '').trim();
    if (name === 'Total Accounts' || name === 'Delta' || name === 'Year') {
      dataEndRow = r; // r is the 0-based index, which equals the 1-based row above
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

function findBankAccountRowInBlock_(sheet, block, accountName, optionalDisplay) {
  if (block.dataEndRow < block.dataStartRow) return -1;

  // Performance: previously this helper did one
  //   sheet.getRange(row, 1).getDisplayValue()
  // call per row in the year block. With ~30 accounts that is ~30
  // round-trips to Sheets — easily 0.5–1.5s before the read path could
  // even compute a value. Batch into a single range read of column A
  // across the block, or reuse the caller's already-loaded full-sheet
  // display array when one is provided. Behavior is otherwise identical.
  let names;
  if (optionalDisplay && optionalDisplay.length) {
    names = [];
    for (let r = block.dataStartRow - 1; r <= block.dataEndRow - 1 && r < optionalDisplay.length; r++) {
      names.push((optionalDisplay[r] && optionalDisplay[r][0] !== undefined)
        ? optionalDisplay[r][0]
        : '');
    }
  } else {
    const numRows = block.dataEndRow - block.dataStartRow + 1;
    names = sheet.getRange(block.dataStartRow, 1, numRows, 1).getDisplayValues().map(function(row) {
      return row[0];
    });
  }

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || '').trim();
    if (!isBankAccountDataRowName_(name)) continue;
    if (name === accountName) return block.dataStartRow + i;
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

/**
 * First-create seed of a label-only "Total Accounts" summary row.
 *
 * Writes the literal "Total Accounts" in column A on the row immediately
 * after the last content row and leaves every money cell BLANK — the gross
 * =SUM formulas are materialized later by refreshBankAccountsTotalAccountsRow_
 * once at least one account row exists. Seeding a formula on an empty block
 * would be self-referential (the SUM would sit inside its own range), so the
 * blank-then-refresh split is deliberate (mirrors seedDebtsTotalRow_).
 *
 * Idempotent: if any "Total Accounts" row already exists this is a no-op and
 * returns its 1-based row. Intended for FIRST-CREATE only (callers gate on a
 * freshly created sheet); never clears or rewrites existing rows.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} 1-based row of the Total Accounts row, or -1 on failure
 */
function seedBankAccountsTotalAccountsRow_(sheet) {
  if (!sheet) return -1;

  const lastRow = Math.max(1, sheet.getLastRow());
  const colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0] || '').trim() === 'Total Accounts') return i + 1;
  }

  const totalRow = sheet.getLastRow() + 1;
  sheet.getRange(totalRow, 1).setValue('Total Accounts');

  // Currency-format the (currently blank) money cells so the cells — and the
  // =SUM formulas refreshBankAccountsTotalAccountsRow_ writes later — render
  // consistently with the data rows. On a fresh sheet the last column is the
  // "Total" column (no Active column yet), so cols 2..lastCol are exactly the
  // month columns + Total. Cosmetic only; never load-bearing.
  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol >= 2) {
      sheet.getRange(totalRow, 2, 1, lastCol - 1)
        .setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  return totalRow;
}

/**
 * Read-only: locate the December "Total Accounts" cell of a given year block
 * so a subsequent year's January Delta can chain across the year boundary.
 *
 * Operates on a pre-loaded full-sheet display snapshot (no Sheets reads).
 * Returns { row, col } (both 1-based) for the prior block's Total Accounts
 * row × its Dec-YY column, or null when the year banner, its Account Name
 * header, its Dec month column, or its Total Accounts row is not found.
 * Columns are resolved by header label (parseMonthHeader_), never by
 * position, so an Active column never confuses the Dec lookup.
 *
 * @param {string[][]} display  getDataRange().getDisplayValues() snapshot
 * @param {number} year         the block year to locate (e.g. blockYear - 1)
 * @returns {{row:number, col:number}|null}
 */
function findBankAccountsDecTotalAccountsCell_(display, year) {
  let yearRow = -1;
  for (let r = 0; r < display.length; r++) {
    const a = String((display[r] && display[r][0]) || '').trim();
    const b = String((display[r] && display[r][1]) || '').trim();
    if (a === 'Year' && b === String(year)) { yearRow = r + 1; break; }
  }
  if (yearRow === -1) return null;

  const headerRow = yearRow + 1;
  if (String((display[headerRow - 1] && display[headerRow - 1][0]) || '').trim() !== 'Account Name') {
    return null;
  }

  // Dec column from THIS block's header row (by label).
  const headerVals = display[headerRow - 1] || [];
  let decCol = -1;
  for (let c = 2; c <= headerVals.length; c++) {
    const d = parseMonthHeader_(String(headerVals[c - 1] || '').trim());
    if (d && d.getMonth() === 11) { decCol = c; break; }
  }
  if (decCol === -1) return null;

  // Total Accounts row within this block (stop at the next Year banner).
  let taRow = -1;
  for (let r = headerRow; r < display.length; r++) {
    const name = String((display[r] && display[r][0]) || '').trim();
    if (r + 1 > headerRow && name === 'Year') break;
    if (name === 'Total Accounts') { taRow = r + 1; break; }
  }
  if (taRow === -1) return null;

  return { row: taRow, col: decCol };
}

/**
 * First-create seed of the "Delta" month-over-month change row, placed
 * directly below the "Total Accounts" summary row of the same year block.
 *
 * Production parity (confirmed against the live workbook):
 *   - Jan of the FIRST year block     → literal 0
 *   - Jan of a SUBSEQUENT year block  → Jan Total Accounts − prior-year Dec
 *                                       Total Accounts (cross-block)
 *   - Feb … Dec                       → this month's Total Accounts −
 *                                       previous month's Total Accounts
 *   - Total column                    → SUM of this Delta row's month cells
 *                                       (telescopes to the net change for the
 *                                       year)
 *
 * Seed-only by design — NO refresh hook is required:
 *   - The Jan / Feb…Dec formulas reference the Total Accounts row by fixed
 *     cells. When a new account row is inserted above Total Accounts, Sheets
 *     shifts the Total Accounts + Delta rows down together and auto-adjusts
 *     those references. There is no data-row RANGE to grow (unlike the Total
 *     Accounts gross =SUM), so nothing can freeze stale.
 *   - The Total cell is a HORIZONTAL same-row =SUM(<firstMonth>:<Dec>) — row
 *     inserts never alter a same-row column range, and it can never collapse
 *     to the single-cell shape that forced the Total Accounts matcher fix.
 *
 * Idempotent: if any "Delta" row already exists this is a no-op and returns
 * its 1-based row. Requires a "Total Accounts" row to exist first; returns -1
 * when none is present (Delta is meaningless without it). Columns resolved by
 * HEADER LABEL (parseMonthHeader_ for MMM-YY, /^total$/i for the roll-up),
 * never positionally, so an Active column is skipped. Best-effort: month/
 * Total writes are wrapped so a formatting hiccup never blocks creation.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} 1-based row of the Delta row, or -1 on no-op-miss/failure
 */
function seedBankAccountsDeltaRow_(sheet) {
  if (!sheet) return -1;

  const display = sheet.getDataRange().getDisplayValues();

  // Idempotent: any existing Delta row → no-op.
  for (let i = 0; i < display.length; i++) {
    if (String((display[i] && display[i][0]) || '').trim() === 'Delta') return i + 1;
  }

  // Delta sits directly below the first Total Accounts row; never create one
  // without it.
  let totalRow = -1;
  for (let i = 0; i < display.length; i++) {
    if (String((display[i] && display[i][0]) || '').trim() === 'Total Accounts') {
      totalRow = i + 1;
      break;
    }
  }
  if (totalRow === -1) return -1;

  // Header row = nearest "Account Name" above Total Accounts (read its month
  // headers + derive the block year from the Jan-YY header).
  let headerRow = -1;
  for (let r = totalRow - 1; r >= 1; r--) {
    const name = String((display[r - 1] && display[r - 1][0]) || '').trim();
    if (name === 'Account Name') { headerRow = r; break; }
    if (name === 'Year') break;
  }
  if (headerRow === -1) return -1;

  const headerVals = display[headerRow - 1] || [];
  const lastCol = sheet.getLastColumn();

  // Catalog month columns (by label) + the Total column; derive the block
  // year from the January header so we can chain across years.
  const months = []; // { col, monthIndex }  monthIndex: 0=Jan … 11=Dec
  let totalCol = -1;
  let blockYear = -1;
  for (let c = 2; c <= lastCol; c++) {
    const header = String(headerVals[c - 1] !== undefined ? headerVals[c - 1] : '').trim();
    if (!header) continue;
    if (/^total$/i.test(header)) { totalCol = c; continue; }
    const d = parseMonthHeader_(header);
    if (!d) continue; // skip Active / unrelated columns
    months.push({ col: c, monthIndex: d.getMonth() });
    if (d.getMonth() === 0) blockYear = d.getFullYear();
  }
  if (months.length === 0) return -1;
  months.sort(function(a, b) { return a.col - b.col; });

  // Prior-year Dec Total Accounts (pre-insert coordinates); null → first-year
  // semantics (Jan = 0).
  let priorDec = (blockYear > 0)
    ? findBankAccountsDecTotalAccountsCell_(display, blockYear - 1)
    : null;

  // Place Delta directly below Total Accounts. Insert a physical row only when
  // content follows (e.g. another year block) so nothing is overwritten;
  // append when Total Accounts is the last row (the fresh-create case).
  let deltaRow = totalRow + 1;
  const inserted = totalRow < sheet.getLastRow();
  if (inserted) {
    sheet.insertRowAfter(totalRow);
    deltaRow = totalRow + 1;
    // A prior block sitting BELOW the insertion point shifts down by one.
    if (priorDec && priorDec.row > totalRow) priorDec.row += 1;
  }
  sheet.getRange(deltaRow, 1).setValue('Delta');

  const currency = '$#,##0.00;-$#,##0.00';
  const firstMonthCol = months[0].col;
  const lastMonthCol = months[months.length - 1].col;

  for (let idx = 0; idx < months.length; idx++) {
    const m = months[idx];
    const letter = columnToLetter_(m.col).toUpperCase();
    let formula = null;
    if (idx === 0) {
      // Leftmost month of the block (January in the canonical layout).
      if (m.monthIndex === 0 && priorDec) {
        formula = '=' + letter + totalRow + '-' +
          columnToLetter_(priorDec.col).toUpperCase() + priorDec.row;
      }
      // else: first-year Jan (or no prior block) → literal 0 below.
    } else {
      const prevLetter = columnToLetter_(months[idx - 1].col).toUpperCase();
      formula = '=' + letter + totalRow + '-' + prevLetter + totalRow;
    }
    try {
      const cell = sheet.getRange(deltaRow, m.col);
      if (formula) cell.setFormula(formula);
      else cell.setValue(0);
      cell.setNumberFormat(currency);
    } catch (_mErr) { /* non-fatal */ }
  }

  // Total column = SUM of this Delta row's own month cells.
  if (totalCol !== -1) {
    try {
      const fL = columnToLetter_(firstMonthCol).toUpperCase();
      const lL = columnToLetter_(lastMonthCol).toUpperCase();
      const cell = sheet.getRange(deltaRow, totalCol);
      cell.setFormula('=SUM(' + fL + deltaRow + ':' + lL + deltaRow + ')');
      cell.setNumberFormat(currency);
    } catch (_tErr) { /* non-fatal */ }
  }

  return deltaRow;
}

/**
 * Maintains the current-year block's "Total Accounts" summary row so each
 * money column's gross =SUM range covers every account data row above the
 * summary. Gross by design — inactive accounts still count, matching a plain
 * hand-authored =SUM (mirrors the Phase 3.1 TOTAL DEBT decision).
 *
 * Why a Bank-local helper instead of refreshBlockSumAggregates_:
 *   - The seeded Total Accounts row starts BLANK; the shared helper only
 *     rewrites cells that ALREADY hold a simple SUM and never fills blanks.
 *   - The block can carry an "Active" column whose Total Accounts cell must
 *     NOT receive a currency =SUM. We therefore scope strictly to columns
 *     whose header is a MMM-YY month (parseMonthHeader_) or the literal
 *     "Total" column, resolved by header label — never positional.
 *
 * Bound-mode safety (exact-shape guard, mirrors refreshDebtsTotalRow_):
 *   - Acts only when a Total Accounts row already exists; NEVER creates one.
 *   - Fills a money cell only when it is truly BLANK (the seeded state) or it
 *     already holds a strict simple =SUM(<L>n:<L>m) / single-cell =SUM(<L>n)
 *     on its OWN column. Literals and any compound / cross-sheet / non-SUM /
 *     Delta-style formula are left untouched.
 *   - Scoped to a single Year block (bails at the next "Year" marker), so
 *     other years' summary rows are never modified.
 *
 * Best-effort: all failures are swallowed; must never block an account save.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number|string} year  the Year block to refresh (e.g. current year)
 */
function refreshBankAccountsTotalAccountsRow_(sheet, year) {
  try {
    if (!sheet) return;

    const display = sheet.getDataRange().getDisplayValues();
    const block = getBankAccountsYearBlock_(sheet, year, display);

    const dataStart = block.dataStartRow;
    const dataEnd = findLastBankAccountDataRowInBlock_(sheet, block);
    if (dataEnd === -1 || dataEnd < dataStart) return; // no account rows yet

    // Locate THIS block's Total Accounts row: the first such labelled row at
    // or after the header, bailing at the next Year marker so we never touch
    // a different year's summary.
    let totalRow = -1;
    for (let r = block.headerRow; r < display.length; r++) {
      const name = String((display[r] && display[r][0]) || '').trim();
      if (r + 1 > block.headerRow && name === 'Year') break;
      if (name === 'Total Accounts') { totalRow = r + 1; break; }
    }
    if (totalRow === -1) return; // no summary row — never create one here

    const headerRowVals = display[block.headerRow - 1] || [];
    const lastCol = sheet.getLastColumn();
    const currency = '$#,##0.00;-$#,##0.00';
    const simpleSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*:\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;
    const singleCellSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;

    for (let c = block.firstMonthCol; c <= lastCol; c++) {
      const header = String((headerRowVals[c - 1] !== undefined ? headerRowVals[c - 1] : '')).trim();
      const isMonth = !!parseMonthHeader_(header);
      const isTotal = /^total$/i.test(header);
      if (!isMonth && !isTotal) continue; // skip Active / unrelated columns

      const letter = columnToLetter_(c).toUpperCase();
      const canonical = '=SUM(' + letter + dataStart + ':' + letter + dataEnd + ')';
      const cell = sheet.getRange(totalRow, c);

      let formula = '';
      try { formula = String(cell.getFormula() || '').trim(); } catch (_) { continue; }

      if (formula === '') {
        // No formula present. Only fill a truly blank cell — a literal value
        // (possible in a hand-authored bound workbook) is left alone.
        let val = '';
        try { val = cell.getValue(); } catch (_) { continue; }
        const isBlank = (val === '' || val === null || val === undefined);
        if (!isBlank) continue;
        try {
          cell.setFormula(canonical);
          cell.setNumberFormat(currency);
        } catch (_setErr) { /* non-fatal */ }
        continue;
      }

      // A formula is present — accept only a SUM we own on this column, in
      // either the range or single-cell (normalized/shifted) shape.
      const m = formula.match(simpleSum);
      if (m) {
        if (m[1].toUpperCase() !== m[3].toUpperCase()) continue;
        if (m[1].toUpperCase() !== letter) continue;
      } else {
        const s = formula.match(singleCellSum);
        if (!s) continue;
        if (s[1].toUpperCase() !== letter) continue;
      }
      if (formula === canonical) continue;
      try {
        cell.setFormula(canonical);
        cell.setNumberFormat(currency);
      } catch (_setErr2) { /* non-fatal */ }
    }
  } catch (e) {
    Logger.log('refreshBankAccountsTotalAccountsRow_: ' + e);
  }
}

/**
 * First-create cosmetic styling for INPUT - Bank Accounts year blocks.
 *
 * Golden Workbook Convergence (2026-07-06): Bank Accounts belongs to the
 * Financial Ledger design family (Cash Flow, Bank Accounts, Investments,
 * House Values). The production/Golden reference — encoded in the sibling
 * helpers applyInvestmentsSheetStyling_ / applyHouseValuesSheetStyling_ —
 * uses a shared warm palette (orange Year banner, bright-yellow header,
 * green totals, pink delta). This helper previously applied a divergent
 * gray/muted "Family Beta" palette; the marker colors below are converged
 * to the Financial Ledger family standard so a freshly provisioned
 * workbook matches the Golden Workbook. Readable typography (size 16
 * header/year, size 14 body) and the widen-only widths are retained.
 *
 *   - body (all cells)  → white background, font size 14 (calm, legible)
 *   - "Year" row        → orange #f4a300 banner, bottom border #999999, bold,
 *                         font size 16, row height 34
 *   - "Account Name"    → bright yellow #fff200, bold, font size 16,
 *                         left-aligned, vertical-middle, row height 40
 *   - "Total Accounts"  → green #b6d7a8, bold   (ONLY if the row exists)
 *   - "Delta"           → pink  #f4cccc, bold   (ONLY if the row exists)
 *
 * The body wash runs FIRST so the marker rows (year/header/total/delta)
 * re-applied afterward always win — that keeps Total/Delta green/pink even
 * though they sit inside the washed range.
 *
 * IMPORTANT: this helper NEVER creates Total Accounts / Delta rows, never
 * writes formulas, and never changes headers/schema. No code generates
 * those rows today; they are colored only when already present so a
 * workbook that has them authored picks up the canonical look. Existing
 * number/currency formats applied by the creator are preserved (only
 * background + font size are touched on the body).
 *
 * Column widths are widen-only (never shrink a user's manual widening):
 * Account Name 260, month columns 110, Total 120.
 *
 * All failures are swallowed — cosmetic only; must never fail an ensure
 * op on a formatting glitch.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function applyBankAccountsSheetStyling_(sheet) {
  if (!sheet) return;

  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }
  let lastRow = 0;
  try { lastRow = sheet.getLastRow(); } catch (_) { return; }
  if (lastRow < 1) return;

  // Body wash FIRST: calm white background + size 14 across the whole
  // sheet grid. Marker rows below re-apply their own background + sizes,
  // so this never clobbers the header/year/total/delta styling. Number
  // and currency formats are untouched (we only set background + size).
  try {
    const maxRows = sheet.getMaxRows();
    sheet.getRange(1, 1, maxRows, lastCol)
      .setBackground('#ffffff')
      .setFontSize(14);
  } catch (_bodyErr) { /* cosmetic only */ }

  let colA;
  try {
    colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  } catch (_) { return; }

  for (let i = 0; i < colA.length; i++) {
    const marker = String(colA[i][0] || '').trim();
    if (!marker) continue;
    const row1 = i + 1;
    try {
      if (marker === 'Year') {
        // Financial Ledger family Year banner: warm orange (#f4a300) matches
        // the production Investments / House Values year rows. A #999999
        // bottom border keeps the crisp section-divider. Hierarchy: bold +
        // size 16 (Bank Accounts' larger, more legible header typography).
        const yearRange = sheet.getRange(row1, 1, 1, lastCol);
        yearRange
          .setBackground('#f4a300')
          .setFontWeight('bold')
          .setFontColor('#000000')
          .setFontSize(16);
        try {
          yearRange.setBorder(
            false, false, true, false, false, false,
            '#999999', SpreadsheetApp.BorderStyle.SOLID
          );
        } catch (_) {}
        try { sheet.setRowHeight(row1, 34); } catch (_) {}
      } else if (marker === 'Account Name') {
        // Financial Ledger family header: bright yellow (#fff200) matches the
        // production Investments / House Values header rows. Bank Accounts
        // header rows are LEFT-aligned, so horizontal alignment is left at
        // its default; vertical-middle pairs with the taller row height.
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#fff200')
          .setFontWeight('bold')
          .setFontColor('#000000')
          .setFontSize(16)
          .setVerticalAlignment('middle');
        try { sheet.setRowHeight(row1, 40); } catch (_) {}
      } else if (marker === 'Total Accounts') {
        // Defensive: only fires if such a row already exists. Not created here.
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#b6d7a8')
          .setFontWeight('bold')
          .setFontColor('#000000');
      } else if (marker === 'Delta') {
        // Financial Ledger family Delta band: pink (#f4cccc) matches the
        // production Investments / House Values delta rows. Defensive: only
        // fires if such a row already exists. Not created here.
        sheet.getRange(row1, 1, 1, lastCol)
          .setBackground('#f4cccc')
          .setFontWeight('bold')
          .setFontColor('#000000');
      }
    } catch (_styleErr) { /* cosmetic only */ }
  }

  // Widen-only column widths. Account Name is col 1, Total is the last
  // column, month columns are everything in between. Never shrink a column
  // the user widened manually (matches applyCashFlowSheetStyling_).
  try {
    if (sheet.getColumnWidth(1) < 260) sheet.setColumnWidth(1, 260);
  } catch (_) {}
  for (let c = 2; c < lastCol; c++) {
    try {
      if (sheet.getColumnWidth(c) < 110) sheet.setColumnWidth(c, 110);
    } catch (_) {}
  }
  if (lastCol >= 2) {
    try {
      if (sheet.getColumnWidth(lastCol) < 120) sheet.setColumnWidth(lastCol, 120);
    } catch (_) {}
  }

  // Pin the two header rows (Year + Account Name) and the Account Name
  // column when scrolling across the 12 month columns. Idempotent.
  try { sheet.setFrozenRows(2); } catch (_) {}
  try { sheet.setFrozenColumns(1); } catch (_) {}
}

function getAccountsHeaderMap_(sheet, optionalDisplay) {
  // Performance: when the caller has already loaded the SYS - Accounts
  // sheet's full display values (e.g. getBankAccountUiData), pass that
  // array in via optionalDisplay to avoid a second full-sheet read just
  // to look up the header row. Behavior is unchanged when omitted.
  const headers = (optionalDisplay && optionalDisplay.length)
    ? (optionalDisplay[0] || [])
    : (sheet.getDataRange().getDisplayValues()[0] || []);

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
    const ss = getUserSpreadsheet_();
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

  const ss = getUserSpreadsheet_();
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
