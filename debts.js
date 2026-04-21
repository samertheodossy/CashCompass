/**
 * Debts input — canonical add / update / stop-tracking for INPUT - Debts.
 *
 * INPUT - Debts is the ONLY canonical sheet for debt accounts. There is no
 * SYS - Debts mirror. Rows are never deleted; Stop tracking soft-deactivates
 * by flipping Active=No so the account name stays reserved and historical
 * activity logs (quick_pay, etc.) still classify correctly.
 *
 * Active-state semantics:
 *   - If INPUT - Debts has an Active column (common case after self-heal):
 *       explicit 'No'/'n'/'false'/'inactive' → inactive
 *       anything else (including blank)       → active
 *   - If the column is missing (legacy workbook):
 *       every debt is treated as ACTIVE for UI / dashboard / Cash Flow
 *       readers. This matches pre-Active-column behavior so $0-balance
 *       cards still appear in the Debts dropdown and dashboard totals
 *       until the user explicitly stop-tracks them.
 *
 *       The legacy `balance > 0 || minPayment > 0` fallback still lives in
 *       `planner_core.js → normalizeDebts_` so the planner / waterfall
 *       keeps skipping dormant debts. That is a planning concern, not a
 *       dropdown-visibility concern.
 *
 * The Active column is self-healed (via ensureDebtsActiveColumn_) the first
 * time a write path needs it — users never have to manually edit the sheet.
 */

var DEBTS_RESERVED_ROW_NAMES_ = {
  'TOTAL DEBT': true
};

/* -------------------------------------------------------------------------- */
/*  Read paths                                                                */
/* -------------------------------------------------------------------------- */

function getDebtsUiData() {
  const debts = getDebtRows_();
  const typeSet = {};

  debts.forEach(function(d) {
    if (d.type) typeSet[d.type] = true;
  });

  let typeOptions = [];
  try {
    typeOptions = getDebtDistinctColumnValues_('Type');
  } catch (e) {
    Logger.log('getDebtsUiData type options: ' + e);
  }

  return {
    debts: debts,
    types: ['All'].concat(Object.keys(typeSet).sort()),
    typeOptions: typeOptions,
    editableFields: [
      'Account Balance',
      'Due Date',
      'Credit Limit',
      'Minimum Payment',
      'Credit Left',
      'Int Rate'
    ]
  };
}

/**
 * Returns active, non-summary debts for dropdowns / UI consumers. Inactive
 * debts are filtered out via the shared explicit-wins-with-fallback rule.
 */
function getDebtRows_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headerMap = getDebtsHeaderMap_(sheet);
  const debts = [];

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;

    if (isDebtRowInactive_(display[r], values[r], headerMap)) continue;

    const type = String(display[r][headerMap.typeColZero] || '').trim();
    debts.push({
      accountName: name,
      type: type
    });
  }

  return debts.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.accountName.localeCompare(b.accountName);
  });
}

function getDebtAccounts_() {
  return getDebtRows_().map(function(d) {
    return d.accountName;
  });
}

/**
 * Returns every non-summary account name on INPUT - Debts (active AND
 * inactive). Used for duplicate-name validation so stop-tracked names stay
 * reserved against reuse.
 */
function getAllDebtAccountNamesIncludingInactive_(sheet) {
  const s = sheet || getSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'DEBTS');
  const display = s.getDataRange().getDisplayValues();
  if (display.length < 2) return [];

  const headerMap = getDebtsHeaderMap_(s);
  const names = [];
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    names.push(name);
  }
  return names;
}

function getDebtFieldValue(accountName, fieldName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) throw new Error('Debts list is empty.');

  const headerMap = getDebtsHeaderMap_(sheet);
  const fieldColZero = getRequiredDebtFieldColZero_(sheet, fieldName);

  const row = findDebtRow_(sheet, accountName);
  if (row === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  return {
    accountName: accountName,
    fieldName: fieldName,
    value: values[row - 1][fieldColZero],
    displayValue: display[row - 1][fieldColZero],
    type: headerMap.typeColZero === -1 ? '' : String(display[row - 1][headerMap.typeColZero] || '').trim(),
    pctAvail: headerMap.pctAvailColZero === -1 ? '' : String(display[row - 1][headerMap.pctAvailColZero] || '').trim()
  };
}

function updateDebtField(payload) {
  validateRequired_(payload, ['accountName', 'fieldName', 'value']);

  const accountName = String(payload.accountName || '').trim();
  const fieldName = String(payload.fieldName || '').trim();
  const rawValue = payload.value;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');

  const display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) throw new Error('Debts list is empty.');

  const headerMap = getDebtsHeaderMap_(sheet);
  const targetRow = findDebtRow_(sheet, accountName);
  if (targetRow === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  const targetCol = getRequiredDebtFieldCol_(sheet, fieldName);
  const cell = sheet.getRange(targetRow, targetCol);

  const currencyFields = {
    'Account Balance': true,
    'Minimum Payment': true,
    'Credit Limit': true,
    'Credit Left': true
  };

  const percentFields = {
    'Int Rate': true
  };

  const integerFields = {
    'Due Date': true
  };

  if (currencyFields[fieldName]) {
    const num = toNumber_(rawValue);
    setCurrencyCellPreserveRowFormat_(sheet, targetRow, targetCol, num, 1);
  } else if (percentFields[fieldName]) {
    const num = round2_(toNumber_(rawValue));
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0.00');
  } else if (integerFields[fieldName]) {
    const num = parseInt(String(rawValue).trim(), 10);
    if (isNaN(num)) throw new Error(fieldName + ' must be a whole number.');
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0');
  } else {
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(rawValue);
  }

  recalcDebtPctAvailForRow_(sheet, targetRow, {
    creditLimitCol: headerMap.creditLimitColZero,
    creditLeftCol: headerMap.creditLeftColZero,
    balanceCol: headerMap.balanceColZero,
    pctAvailCol: headerMap.pctAvailColZero
  });

  touchDashboardSourceUpdated_('debts');
  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  return {
    ok: true,
    message: 'Debt updated and planner refreshed.'
  };
}

function recalcDebtPctAvailForRow_(sheet, row, cols) {
  if (
    cols.creditLimitCol === -1 ||
    cols.creditLeftCol === -1 ||
    cols.balanceCol === -1 ||
    cols.pctAvailCol === -1
  ) {
    return;
  }

  const creditLimitRaw = sheet.getRange(row, cols.creditLimitCol + 1).getValue();
  const creditLeftRaw = sheet.getRange(row, cols.creditLeftCol + 1).getValue();
  const balanceRaw = sheet.getRange(row, cols.balanceCol + 1).getValue();

  const creditLimit = toNumber_(creditLimitRaw);
  const balance = toNumber_(balanceRaw);

  // A truly blank Credit Left cell should trigger derivation from
  // Credit Limit − Balance. `toNumber_('')` coerces blank to 0, so we can't
  // distinguish "user typed 0" from "cell empty" via toNumber_ alone.
  const creditLeftIsBlank =
    creditLeftRaw === '' ||
    creditLeftRaw === null ||
    creditLeftRaw === undefined;

  let pct = '';
  if (creditLimit > 0) {
    if (creditLeftIsBlank) {
      pct = round2_(((creditLimit - balance) / creditLimit) * 100);
    } else {
      const creditLeft = toNumber_(creditLeftRaw);
      pct = round2_((creditLeft / creditLimit) * 100);
    }
  }

  const pctCell = sheet.getRange(row, cols.pctAvailCol + 1);
  copyNeighborFormatInRow_(sheet, row, cols.pctAvailCol + 1, 1);

  if (pct === '') {
    pctCell.setValue('');
  } else {
    pctCell.setValue(pct / 100);
    pctCell.setNumberFormat('0.00%');
  }
}

/* -------------------------------------------------------------------------- */
/*  Add new debt                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Distinct non-empty values from a column on INPUT - Debts (for Add Debt
 * datalists / selectors). Skips the TOTAL DEBT summary row.
 */
function getDebtDistinctColumnValues_(headerLabel) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');
  const display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return [];

  const headers = display[0] || [];
  const idx = headers.indexOf(headerLabel);
  if (idx === -1) return [];

  const headerMap = getDebtsHeaderMap_(sheet);
  const seen = {};
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    const cell = String(display[r][idx] || '').trim();
    if (cell) seen[cell] = true;
  }

  return Object.keys(seen).sort(function(a, b) {
    return a.localeCompare(b);
  });
}

/**
 * Validate a prospective new debt Account Name. Duplicate checks include
 * inactive rows so stop-tracked names stay reserved against reuse.
 * @returns {string} trimmed, validated name
 */
function validateNewDebtAccountName_(raw) {
  const name = String(raw || '').trim();
  if (!name) throw new Error('Account name is required.');
  if (name.length > 120) throw new Error('Account name is too long (max 120 characters).');
  if (isDebtReservedName_(name)) {
    throw new Error('That account name is reserved and cannot be used.');
  }

  const existing = getAllDebtAccountNamesIncludingInactive_();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].toLowerCase() === name.toLowerCase()) {
      throw new Error('A debt with that name already exists.');
    }
  }

  return name;
}

/**
 * Create a new row on INPUT - Debts with Active=Yes. Only fields already
 * present in the canonical schema are written — no invented columns.
 *
 * @param {{
 *   accountName: string,
 *   type: string,
 *   balance?: number|string,
 *   minimumPayment?: number|string,
 *   creditLimit?: number|string,
 *   creditLeft?: number|string,
 *   intRate?: number|string,
 *   dueDay?: number|string
 * }} payload
 */
function addDebtFromDashboard(payload) {
  validateRequired_(payload, [
    'accountName',
    'type',
    'balance',
    'minimumPayment',
    'creditLimit',
    'intRate',
    'dueDay'
  ]);

  const accountName = validateNewDebtAccountName_(payload.accountName);
  const typeStr = String(payload.type || '').trim();
  if (!typeStr) throw new Error('Type is required.');
  if (typeStr.length > 80) throw new Error('Type is too long (max 80 characters).');

  // Every numeric field is required. Users should enter 0 where a value does
  // not apply (for example, Credit Limit on a Loan / HELOC). Blank / null /
  // whitespace-only payloads are rejected with a field-specific error so the
  // dashboard can surface the inline message cleanly.
  function parseRequiredNonNegative_(raw, label) {
    if (raw === undefined || raw === null) throw new Error(label + ' is required.');
    const s = String(raw).trim();
    if (s === '') throw new Error(label + ' is required.');
    const n = toNumber_(s);
    if (!isFinite(n)) throw new Error(label + ' must be a valid number.');
    return round2_(Math.abs(n));
  }

  function parseRequiredPercent_(raw, label) {
    if (raw === undefined || raw === null) throw new Error(label + ' is required.');
    const s = String(raw).trim();
    if (s === '') throw new Error(label + ' is required.');
    const n = toNumber_(s);
    if (!isFinite(n)) throw new Error(label + ' must be a valid number.');
    return round2_(Math.max(0, n));
  }

  function parseRequiredDueDay_(raw) {
    if (raw === undefined || raw === null) throw new Error('Due day of month is required.');
    const s = String(raw).trim();
    if (s === '') throw new Error('Due day of month is required.');
    const n = parseInt(s, 10);
    if (isNaN(n) || n < 1 || n > 31) {
      throw new Error('Due day of month must be a whole number between 1 and 31.');
    }
    return n;
  }

  const balance = parseRequiredNonNegative_(payload.balance, 'Account balance');
  const minPayment = parseRequiredNonNegative_(payload.minimumPayment, 'Minimum payment');
  const creditLimit = parseRequiredNonNegative_(payload.creditLimit, 'Credit limit');
  const intRate = parseRequiredPercent_(payload.intRate, 'Interest rate');
  const dueDay = parseRequiredDueDay_(payload.dueDay);

  // Credit Left is derived from the user-supplied Credit Limit and Account
  // Balance. Because both are required on the form, we always pre-populate
  // it here so the new row reads like existing hand-entered rows
  // (e.g. Credit Left = $24,496.63 on a $25k limit / $503 balance card).
  // recalcDebtPctAvailForRow_ then computes the percent from the stored
  // value. For non-revolving accounts (Loan / HELOC) users enter 0 / 0
  // and Credit Left lands at 0 accordingly.
  const creditLeft = round2_(creditLimit - balance);

  // Ensure-before-write guard. Idempotent no-op on populated workbooks;
  // on fresh workbooks it seeds the canonical INPUT - Debts structure
  // that getDebtsHeaderMap_ / ensureDebtsActiveColumn_ expect a few
  // lines below. Mirrors the Bank Accounts pattern in
  // addBankAccountFromDashboard → bank_accounts.js.
  try {
    ensureOnboardingDebtsSheetFromDashboard('normal');
  } catch (ensureErr) {
    throw new Error(
      'Could not prepare INPUT - Debts: ' +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');
  const headerMap = ensureDebtsActiveColumn_(sheet);

  const headerDisplay = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  const numCols = headerDisplay.length;
  if (!numCols) throw new Error('Debts sheet has no header row.');

  const row = new Array(numCols);
  for (let c = 0; c < numCols; c++) row[c] = '';

  function setAt_(colZero, val) {
    if (colZero === -1 || colZero >= numCols) return;
    row[colZero] = val;
  }

  setAt_(headerMap.nameColZero, accountName);
  setAt_(headerMap.typeColZero, typeStr);
  setAt_(headerMap.balanceColZero, balance);
  setAt_(headerMap.minimumPaymentColZero, minPayment);
  setAt_(headerMap.creditLimitColZero, creditLimit);
  setAt_(headerMap.creditLeftColZero, creditLeft);
  setAt_(headerMap.intRateColZero, intRate);
  setAt_(headerMap.dueDateColZero, dueDay);
  if (headerMap.activeColZero !== -1) row[headerMap.activeColZero] = 'Yes';

  const templateRow = findDebtTemplateRow_(sheet, headerMap);

  // Insert the new row directly after the last non-summary data row so it
  // lands above the blank buffer + TOTAL DEBT summary (and any stop-tracked
  // rows below the summary). Fall back to appendRow when the sheet has no
  // existing data rows yet.
  let appendedRow;
  if (templateRow !== -1) {
    sheet.insertRowAfter(templateRow);
    appendedRow = templateRow + 1;
    sheet.getRange(appendedRow, 1, 1, numCols).setValues([row]);
  } else {
    sheet.appendRow(row);
    appendedRow = sheet.getLastRow();
  }

  if (templateRow !== -1 && templateRow !== appendedRow) {
    try {
      sheet.getRange(templateRow, 1, 1, numCols).copyTo(
        sheet.getRange(appendedRow, 1, 1, numCols),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sheet.setRowHeight(appendedRow, sheet.getRowHeight(templateRow));
    } catch (formatErr) {
      Logger.log('addDebtFromDashboard format copy failed: ' + formatErr);
    }
  }

  // Re-stamp Active with row-consistent formatting; the whole-row PASTE_FORMAT
  // can inherit a template cell style that defaulted to tiny text.
  if (headerMap.activeCol !== -1) {
    writeActiveCellWithRowFormat_(sheet, appendedRow, headerMap.activeCol, 'Yes');
  }

  // Compute Acct PCT Avail for the newly written row so the dashboard
  // reflects the correct utilization immediately.
  try {
    recalcDebtPctAvailForRow_(sheet, appendedRow, {
      creditLimitCol: headerMap.creditLimitColZero,
      creditLeftCol: headerMap.creditLeftColZero,
      balanceCol: headerMap.balanceColZero,
      pctAvailCol: headerMap.pctAvailColZero
    });
  } catch (pctErr) {
    Logger.log('addDebtFromDashboard recalcDebtPctAvailForRow_: ' + pctErr);
  }

  try {
    touchDashboardSourceUpdated_('debts');
  } catch (e) { /* best-effort */ }

  // Seed a corresponding Expense row on the current year's INPUT - Cash Flow
  // tab so the new debt is immediately visible everywhere that matches by
  // payee: Bills Due (getDebtBillsDueRows_), Upcoming, overdue detection,
  // buildDebtMinimumHandledMap_, planner email, etc. Without this row a
  // freshly added debt would be Active + have a Due day but still not show
  // up on the Bills Due card, because getDebtBillsDueRows_ iterates Cash
  // Flow Expense rows and joins back to INPUT - Debts by Payee.
  //
  // - Flow Source is inferred from debt Type exactly like the read-side in
  //   dashboard_data.js → getDebtBillsDueRows_: Credit Card → CREDIT_CARD,
  //   everything else (Loan / HELOC / Other) → CASH.
  // - Idempotent: if a row with Type=Expense + Payee=accountName already
  //   exists on the current year tab (e.g. the user pre-seeded it by hand,
  //   or stop-tracked + re-added the same name), we leave it alone rather
  //   than duplicating history.
  // - Month cells are left blank so Bills Due treats the payment as
  //   unhandled for the current cycle.
  // - Any failure is non-fatal — the debt row itself is already on INPUT -
  //   Debts and the user can always add a Cash Flow row manually.
  let cashFlowRowSeeded = false;
  let cashFlowSeedWarning = '';
  try {
    const currentYear = new Date().getFullYear();
    // First-run safety: on a fresh workbook the current-year Cash Flow
    // tab may not exist yet. ensureCashFlowYearSheet_ creates it with
    // the canonical header row (Type / Flow Source / Payee / Active /
    // Jan..Dec / Total) when missing and is a hard no-op when the sheet
    // already exists, so populated workbooks are unaffected. Mirrors
    // the same ensure call in bills.js; without it the seed below would
    // silently skip with "Cash Flow YYYY not found — skipped ...".
    if (typeof ensureCashFlowYearSheet_ === 'function') {
      try { ensureCashFlowYearSheet_(currentYear); } catch (_ensureErr) { /* fall through */ }
    }
    const cfSheet = tryGetCashFlowSheet_(ss, currentYear);
    if (!cfSheet) {
      cashFlowSeedWarning =
        'Cash Flow ' + currentYear + ' not found — skipped Cash Flow seed. Bills Due will pick the debt up once a Cash Flow ' + currentYear + ' exists and has an expense row for "' + accountName + '".';
    } else {
      const existing = findCashFlowRowByTypeAndPayee_(cfSheet, 'Expense', accountName);
      if (existing) {
        cashFlowRowSeeded = false;
        cashFlowSeedWarning =
          'An expense row for "' + accountName + '" already exists on Cash Flow ' + currentYear + ' — left untouched.';
      } else {
        const inferredFlowSource = isDebtCreditCardType_(typeStr) ? 'CREDIT_CARD' : 'CASH';
        insertCashFlowRow_(cfSheet, 'Expense', accountName, inferredFlowSource);
        cashFlowRowSeeded = true;
      }
    }
  } catch (cfErr) {
    Logger.log('addDebtFromDashboard cash flow seed: ' + cfErr);
    cashFlowSeedWarning =
      'Cash Flow seed skipped: ' + (cfErr && cfErr.message ? cfErr.message : String(cfErr));
  }

  // Activity log: lifecycle event. The form requires an Account balance so
  // LOG - Activity Amount always reflects the supplied opening balance
  // (mirrors bank_account_add behavior).
  try {
    const amountForLog = balance;
    appendActivityLog_(ss, {
      eventType: 'debt_add',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: amountForLog,
      direction: 'expense',
      payee: accountName,
      category: typeStr,
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        type: typeStr,
        openingBalance: balance,
        minimumPayment: minPayment,
        creditLimit: creditLimit,
        creditLeft: creditLeft,
        intRate: intRate,
        dueDay: dueDay,
        cashFlowRowSeeded: cashFlowRowSeeded
      })
    });
  } catch (logErr) {
    Logger.log('addDebtFromDashboard activity log: ' + logErr);
  }

  let message =
    'Created debt "' + accountName + '".';
  if (cashFlowRowSeeded) {
    message +=
      '\nAdded a matching expense row to Cash Flow so Bills Due and Upcoming see it right away.';
  } else if (cashFlowSeedWarning) {
    message += '\n' + cashFlowSeedWarning;
  }
  message +=
    '\nUse Run Planner + Refresh Snapshot when you want projections refreshed.';

  return {
    ok: true,
    accountName: accountName,
    cashFlowRowSeeded: cashFlowRowSeeded,
    cashFlowSeedWarning: cashFlowSeedWarning,
    message: message
  };
}

/* -------------------------------------------------------------------------- */
/*  Stop tracking (deactivate)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete a debt: flip Active=No on the matching INPUT - Debts row so
 * the account drops out of every active-debt reader (rolling payoff,
 * dashboards, dropdowns, Cash Flow matching) while the row — and every
 * historical field — stays on the sheet. The name also stays reserved
 * against future reuse.
 *
 * @param {{ accountName: string }} payload
 */
function deactivateDebtFromDashboard(payload) {
  validateRequired_(payload, ['accountName']);
  const accountName = String(payload.accountName || '').trim();
  if (!accountName) throw new Error('Account name is required.');
  if (isDebtReservedName_(accountName)) {
    throw new Error('Cannot stop tracking the reserved "' + accountName + '" row.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'DEBTS');
  const headerMap = ensureDebtsActiveColumn_(sheet);

  const display = sheet.getDataRange().getDisplayValues();
  let targetRow = -1;
  let currentActiveDisplay = '';
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (name.toLowerCase() !== accountName.toLowerCase()) continue;
    targetRow = r + 1;
    if (headerMap.activeColZero !== -1) {
      currentActiveDisplay = String(display[r][headerMap.activeColZero] || '').trim();
    }
    break;
  }

  if (targetRow === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  const alreadyInactive = isExplicitInactive_(currentActiveDisplay);

  if (!alreadyInactive) {
    writeActiveCellWithRowFormat_(sheet, targetRow, headerMap.activeCol, 'No');
  }

  try {
    touchDashboardSourceUpdated_('debts');
  } catch (e) { /* best-effort */ }

  try {
    appendActivityLog_(ss, {
      eventType: 'debt_deactivate',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      direction: 'expense',
      payee: accountName,
      category: headerMap.typeColZero === -1
        ? ''
        : String(display[targetRow - 1][headerMap.typeColZero] || '').trim(),
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        reason: 'stop_tracking',
        sheetRow: targetRow,
        alreadyInactive: alreadyInactive
      })
    });
  } catch (logErr) {
    Logger.log('deactivateDebtFromDashboard activity log: ' + logErr);
  }

  const message = alreadyInactive
    ? '"' + accountName + '" was already marked inactive. History remains.'
    : 'Stopped tracking "' + accountName + '". History is preserved.';

  return {
    ok: true,
    message: message,
    accountName: accountName,
    alreadyInactive: alreadyInactive
  };
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

function getDebtsHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];

  const nameColZero = headers.indexOf('Account Name');
  const typeColZero = headers.indexOf('Type');
  const balanceColZero = headers.indexOf('Account Balance');
  const dueDateColZero = headers.indexOf('Due Date');
  const creditLimitColZero = headers.indexOf('Credit Limit');
  const minimumPaymentColZero = headers.indexOf('Minimum Payment');
  const creditLeftColZero = headers.indexOf('Credit Left');
  const intRateColZero = headers.indexOf('Int Rate');
  const pctAvailColZero = headers.indexOf('Acct PCT Avail');
  const activeColZero = headers.indexOf('Active');

  if (nameColZero === -1) throw new Error('Debts sheet must contain Account Name.');
  if (typeColZero === -1) throw new Error('Debts sheet must contain Type.');

  return {
    nameColZero: nameColZero,
    typeColZero: typeColZero,
    balanceColZero: balanceColZero,
    dueDateColZero: dueDateColZero,
    creditLimitColZero: creditLimitColZero,
    minimumPaymentColZero: minimumPaymentColZero,
    creditLeftColZero: creditLeftColZero,
    intRateColZero: intRateColZero,
    pctAvailColZero: pctAvailColZero,
    activeColZero: activeColZero,
    nameCol: nameColZero + 1,
    typeCol: typeColZero + 1,
    balanceCol: balanceColZero === -1 ? -1 : balanceColZero + 1,
    dueDateCol: dueDateColZero === -1 ? -1 : dueDateColZero + 1,
    creditLimitCol: creditLimitColZero === -1 ? -1 : creditLimitColZero + 1,
    minimumPaymentCol: minimumPaymentColZero === -1 ? -1 : minimumPaymentColZero + 1,
    creditLeftCol: creditLeftColZero === -1 ? -1 : creditLeftColZero + 1,
    intRateCol: intRateColZero === -1 ? -1 : intRateColZero + 1,
    pctAvailCol: pctAvailColZero === -1 ? -1 : pctAvailColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
  };
}

/**
 * Self-heals INPUT - Debts by ensuring an "Active" header exists. Reuses the
 * first empty trailing header cell when available; otherwise appends a new
 * column. Existing data rows keep blank Active (treated as active by readers).
 * Returns a fresh header map.
 */
function ensureDebtsActiveColumn_(sheet) {
  const headerMap = getDebtsHeaderMap_(sheet);
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
  return getDebtsHeaderMap_(sheet);
}

function findDebtRow_(sheet, accountName) {
  const headerMap = getDebtsHeaderMap_(sheet);
  const row = findRowByName_(sheet, accountName, headerMap.nameCol, 2);
  if (row === -1) return -1;

  const name = String(sheet.getRange(row, headerMap.nameCol).getDisplayValue() || '').trim();
  if (isDebtSummaryRowName_(name)) return -1;

  return row;
}

/**
 * Returns the 1-based row of the last debt data row that sits ABOVE the
 * TOTAL DEBT summary row (or the last non-summary row on the sheet when
 * TOTAL DEBT is absent). Used as:
 *   - the neighbor template for new-row formatting inheritance, and
 *   - the anchor for `insertRowAfter` so new debts land above TOTAL DEBT
 *     instead of below it (even when orphaned rows sit past TOTAL DEBT
 *     from earlier test inserts).
 * Returns -1 when there is no existing data row.
 */
function findDebtTemplateRow_(sheet, headerMap) {
  const display = sheet.getDataRange().getDisplayValues();

  // Find the TOTAL DEBT row if present — we scan only rows above it.
  let totalDebtRow = -1;
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (isDebtSummaryRowName_(name)) {
      totalDebtRow = r;
      break;
    }
  }

  const scanEnd = totalDebtRow === -1 ? display.length - 1 : totalDebtRow - 1;
  for (let r = scanEnd; r >= 1; r--) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    return r + 1;
  }
  return -1;
}

function getRequiredDebtFieldColZero_(sheet, fieldName) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];
  const colZero = headers.indexOf(fieldName);
  if (colZero === -1) {
    throw new Error('Field not found: ' + fieldName);
  }
  return colZero;
}

function getRequiredDebtFieldCol_(sheet, fieldName) {
  return getRequiredDebtFieldColZero_(sheet, fieldName) + 1;
}

function isDebtSummaryRowName_(name) {
  const value = String(name || '').trim().toUpperCase();
  if (!value) return false;
  return !!DEBTS_RESERVED_ROW_NAMES_[value];
}

function isDebtReservedName_(name) {
  return isDebtSummaryRowName_(name);
}

/**
 * Explicit inactive test: 'no' / 'n' / 'false' / 'inactive' (case-insensitive)
 * only. Blank / missing / unknown → NOT inactive (i.e., active). Shared with
 * getInactiveDebtsSet_ and every other Debt reader so backward compatibility
 * is guaranteed.
 */
function isExplicitInactive_(rawValue) {
  const v = String(rawValue == null ? '' : rawValue).trim().toLowerCase();
  return v === 'no' || v === 'n' || v === 'false' || v === 'inactive';
}

/**
 * Row-level inactive test for direct sheet readers (UI dropdowns, dashboard
 * aggregates, Cash Flow inference). Uses the EXPLICIT-ONLY rule so legacy
 * workbooks with no Active column keep showing every debt — matching
 * pre-Active-column behavior for dropdowns and summaries:
 *   - If Active column is present on the sheet:
 *       explicit inactive → inactive; everything else (incl. blank) → active
 *   - If Active column is missing (legacy workbook):
 *       never inactive (all rows are active)
 *
 * NOTE: the legacy balance/min-payment fallback is intentionally NOT applied
 * here. It still lives in `planner_core.js → normalizeDebts_` so the planner
 * keeps dropping $0-balance / $0-min debts from waterfall math — that's a
 * planning concern, not a dropdown-visibility concern.
 *
 * @param {Array} displayRow  sheet.getDisplayValues row
 * @param {Array} valueRow    sheet.getValues row (parsed numeric) — kept for
 *                            signature compatibility; unused here.
 * @param {Object} headerMap  getDebtsHeaderMap_(sheet) result
 */
function isDebtRowInactive_(displayRow, valueRow, headerMap) {
  if (headerMap.activeColZero === -1) return false;
  return isExplicitInactive_(displayRow[headerMap.activeColZero]);
}

/**
 * Lowercased name-set of inactive debts on INPUT - Debts. Callers can use
 * this for O(1) filtering. Uses the explicit-only rule — legacy workbooks
 * with no Active column return an empty set.
 */
function getInactiveDebtsSet_() {
  const inactive = Object.create(null);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet;
  try {
    sheet = getSheet_(ss, 'DEBTS');
  } catch (e) {
    return inactive;
  }
  const display = sheet.getDataRange().getDisplayValues();
  const values = sheet.getDataRange().getValues();
  if (display.length < 2) return inactive;

  let headerMap;
  try {
    headerMap = getDebtsHeaderMap_(sheet);
  } catch (e2) {
    return inactive;
  }

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (isDebtRowInactive_(display[r], values[r], headerMap)) {
      inactive[name.toLowerCase()] = true;
    }
  }
  return inactive;
}
