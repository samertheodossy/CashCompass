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

/**
 * Canonical allow-list of the ONLY INPUT - Debts columns that the generic
 * field editor (updateDebtField) and the Update-view field picker
 * (getDebtsUiData.editableFields) are permitted to write.
 *
 * Account Name (rename has its own coordinated flow) and Active (lifecycle is
 * owned exclusively by deactivateDebtFromDashboard / reactivateDebtFromDashboard)
 * are deliberately EXCLUDED so a generic field write can never silently flip a
 * debt's tracking state or rename it. Derived columns (Acct PCT Avail) are
 * recomputed server-side and never user-written.
 */
var DEBT_EDITABLE_FIELDS_ = [
  'Account Balance',
  'Due Date',
  'Credit Limit',
  'Minimum Payment',
  'Credit Left',
  'Int Rate'
];

/* -------------------------------------------------------------------------- */
/*  Read paths                                                                */
/* -------------------------------------------------------------------------- */

function getDebtsUiData() {
  // Performance: previously this RPC made up to FOUR full reads of
  // INPUT - Debts in a row — once for getValues(), once for
  // getDisplayValues() inside getDebtRows_(), once more inside
  // getDebtsHeaderMap_(), and a fourth time inside
  // getDebtDistinctColumnValues_('Type'). On populated workbooks each
  // sheet read is a ~300–800ms round-trip, so the Debts tab took
  // ~1.5–3s just to open. We now load INPUT - Debts ONCE and derive
  // both the active-row list AND the distinct Type options from that
  // single snapshot. Behavior is identical: same rows, same sort
  // order, same Type list, same active-filter rules. The legacy
  // helpers (getDebtRows_, getDebtDistinctColumnValues_,
  // getDebtsHeaderMap_) stay available for other callers and are not
  // touched.
  const ss = getUserSpreadsheet_();
  const sheet = ss.getSheetByName(getSheetNames_().DEBTS);

  const editableFields = DEBT_EDITABLE_FIELDS_.slice();

  if (!sheet) {
    return {
      debts: [],
      types: ['All'],
      typeOptions: [],
      editableFields: editableFields
    };
  }

  let display = [];
  let values = [];
  try {
    display = sheet.getDataRange().getDisplayValues();
    values = sheet.getDataRange().getValues();
  } catch (e) {
    Logger.log('getDebtsUiData read: ' + e);
    return {
      debts: [],
      types: ['All'],
      typeOptions: [],
      editableFields: editableFields
    };
  }

  if (display.length < 2) {
    return {
      debts: [],
      types: ['All'],
      typeOptions: [],
      editableFields: editableFields
    };
  }

  let headerMap;
  try {
    headerMap = getDebtsHeaderMap_(sheet, display);
  } catch (e) {
    Logger.log('getDebtsUiData header map: ' + e);
    return {
      debts: [],
      types: ['All'],
      typeOptions: [],
      editableFields: editableFields
    };
  }

  const debts = [];
  const typeSet = Object.create(null);
  const typeOptionSet = Object.create(null);

  for (let r = 1; r < display.length; r++) {
    const displayRow = display[r] || [];
    const valueRow = values[r] || [];

    const rawType = headerMap.typeColZero === -1
      ? ''
      : String(displayRow[headerMap.typeColZero] || '').trim();
    if (rawType) typeOptionSet[rawType] = true;

    const name = String(displayRow[headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (isDebtRowInactive_(displayRow, valueRow, headerMap)) continue;

    if (rawType) typeSet[rawType] = true;

    debts.push({
      accountName: name,
      type: rawType
    });
  }

  debts.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.accountName.localeCompare(b.accountName);
  });

  return {
    debts: debts,
    types: ['All'].concat(Object.keys(typeSet).sort()),
    typeOptions: Object.keys(typeOptionSet).sort(function(a, b) {
      return a.localeCompare(b);
    }),
    editableFields: editableFields
  };
}

/**
 * Manage Debts (Phase 1) — returns every ACTIVE, non-summary debt with the
 * full set of fields the Manage table + Edit form need. Mirrors
 * getActiveBillsForManagementFromDashboard(): one read of INPUT - Debts,
 * excludes the TOTAL DEBT summary row and inactive rows, and returns the
 * 1-based `inputDebtsRow` so the client can pass it back for stale-row
 * protection on edit. Currency fields are returned as numbers (blank cells
 * become '' so the UI can show — instead of $0.00); Int Rate / Acct PCT Avail
 * are returned as display strings.
 */
function getActiveDebtsForManagementFromDashboard() {
  const ss = getUserSpreadsheet_();
  const sheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!sheet) return [];

  let display = [];
  let values = [];
  try {
    display = sheet.getDataRange().getDisplayValues();
    values = sheet.getDataRange().getValues();
  } catch (e) {
    Logger.log('getActiveDebtsForManagementFromDashboard read: ' + e);
    return [];
  }
  if (display.length < 2) return [];

  let headerMap;
  try {
    headerMap = getDebtsHeaderMap_(sheet, display);
  } catch (e) {
    Logger.log('getActiveDebtsForManagementFromDashboard header map: ' + e);
    return [];
  }

  const out = [];
  for (let r = 1; r < display.length; r++) {
    const displayRow = display[r] || [];
    const valueRow = values[r] || [];

    const name = String(displayRow[headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (isDebtRowInactive_(displayRow, valueRow, headerMap)) continue;

    const disp = function(colZero) {
      return colZero === -1 ? '' : String(displayRow[colZero] || '').trim();
    };
    // Number when the cell shows something; '' when blank so the UI renders —.
    const numOrBlank = function(colZero) {
      if (colZero === -1) return '';
      if (disp(colZero) === '') return '';
      return toNumber_(valueRow[colZero]);
    };

    out.push({
      inputDebtsRow: r + 1,
      accountName: name,
      type: disp(headerMap.typeColZero),
      accountBalance: numOrBlank(headerMap.balanceColZero),
      dueDate: disp(headerMap.dueDateColZero),
      creditLimit: numOrBlank(headerMap.creditLimitColZero),
      creditLeft: numOrBlank(headerMap.creditLeftColZero),
      minimumPayment: numOrBlank(headerMap.minimumPaymentColZero),
      intRate: disp(headerMap.intRateColZero),
      acctPctAvail: disp(headerMap.pctAvailColZero),
      active: disp(headerMap.activeColZero) || 'Yes'
    });
  }

  out.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.accountName.localeCompare(b.accountName);
  });

  return out;
}

/**
 * Manage Debts — returns every INACTIVE (stop-tracked), non-summary debt with
 * the same field shape as getActiveDebtsForManagementFromDashboard so the
 * client can render an "Inactive debts" table with a Reactivate action. The
 * 1-based `inputDebtsRow` is returned for parity (the reactivate flow matches
 * by account name, not row, but keeping the shape identical lets the client
 * reuse the same row-card renderer).
 *
 * Returns [] when there is no Active column (nothing can be explicitly
 * inactive in that case) or no inactive rows.
 */
function getInactiveDebtsForManagementFromDashboard() {
  const ss = getUserSpreadsheet_();
  const sheet = ss.getSheetByName(getSheetNames_().DEBTS);
  if (!sheet) return [];

  let display = [];
  let values = [];
  try {
    display = sheet.getDataRange().getDisplayValues();
    values = sheet.getDataRange().getValues();
  } catch (e) {
    Logger.log('getInactiveDebtsForManagementFromDashboard read: ' + e);
    return [];
  }
  if (display.length < 2) return [];

  let headerMap;
  try {
    headerMap = getDebtsHeaderMap_(sheet, display);
  } catch (e) {
    Logger.log('getInactiveDebtsForManagementFromDashboard header map: ' + e);
    return [];
  }

  // No Active column → nothing is explicitly inactive (legacy-workbook rule).
  if (headerMap.activeColZero === -1) return [];

  const out = [];
  for (let r = 1; r < display.length; r++) {
    const displayRow = display[r] || [];
    const valueRow = values[r] || [];

    const name = String(displayRow[headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (!isDebtRowInactive_(displayRow, valueRow, headerMap)) continue;

    const disp = function(colZero) {
      return colZero === -1 ? '' : String(displayRow[colZero] || '').trim();
    };
    const numOrBlank = function(colZero) {
      if (colZero === -1) return '';
      if (disp(colZero) === '') return '';
      return toNumber_(valueRow[colZero]);
    };

    out.push({
      inputDebtsRow: r + 1,
      accountName: name,
      type: disp(headerMap.typeColZero),
      accountBalance: numOrBlank(headerMap.balanceColZero),
      dueDate: disp(headerMap.dueDateColZero),
      creditLimit: numOrBlank(headerMap.creditLimitColZero),
      creditLeft: numOrBlank(headerMap.creditLeftColZero),
      minimumPayment: numOrBlank(headerMap.minimumPaymentColZero),
      intRate: disp(headerMap.intRateColZero),
      acctPctAvail: disp(headerMap.pctAvailColZero),
      active: disp(headerMap.activeColZero) || 'No'
    });
  }

  out.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.accountName.localeCompare(b.accountName);
  });

  return out;
}

/**
 * Maps a Manage-Debts field label to the activity-log fieldKind so a
 * single-field edit still renders the rich "Updated <field> to <value>"
 * label via debtUpdateActionLabel_().
 */
function debtFieldKindForLabel_(label) {
  switch (label) {
    case 'Account Balance':
    case 'Credit Limit':
    case 'Credit Left':
    case 'Minimum Payment':
      return 'currency';
    case 'Int Rate':
      return 'percent';
    case 'Due Date':
      return 'integer';
    default:
      return 'text';
  }
}

/**
 * Manage Debts (Phase 1) — in-place multi-field edit of a single debt row.
 * Mirrors updateTrackedBillFromDashboard():
 *   - identifies the row by 1-based `sheetRow` + `expectedAccountName`
 *     stale-check (refuses to write if the row moved/renamed underneath),
 *   - writes ONLY changed cells,
 *   - recomputes the derived Acct PCT Avail ONCE after all edits,
 *   - writes ONE consolidated debt_update activity row,
 *   - never touches Account Name (rename is deferred to Phase 2) and never
 *     touches Cash Flow.
 * Payload: { sheetRow, expectedAccountName, type?, accountBalance?, dueDate?,
 *            creditLimit?, creditLeft?, minimumPayment?, intRate? }
 */
function updateTrackedDebtFromDashboard(payload) {
  validateRequired_(payload, ['sheetRow', 'expectedAccountName']);

  const sheetRow = parseInt(String(payload.sheetRow), 10);
  if (isNaN(sheetRow) || sheetRow < 2) {
    throw new Error('Invalid debt row. Please refresh and try again.');
  }
  const expectedAccountName = String(payload.expectedAccountName || '').trim();
  if (!expectedAccountName) {
    throw new Error('Missing debt account. Please refresh and try again.');
  }

  const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'DEBTS');
  const headerMap = getDebtsHeaderMap_(sheet);

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (sheetRow > lastRow) {
    throw new Error('Debt has moved on the sheet. Please refresh and try again.');
  }

  const rowValues = sheet.getRange(sheetRow, 1, 1, lastCol).getValues()[0];
  const rowDisplay = sheet.getRange(sheetRow, 1, 1, lastCol).getDisplayValues()[0];

  const actualName = String(rowDisplay[headerMap.nameColZero] || '').trim();
  if (isDebtSummaryRowName_(actualName)) {
    throw new Error('Cannot edit the reserved "' + actualName + '" row.');
  }
  if (actualName !== expectedAccountName) {
    throw new Error(
      'Debt has moved on the sheet (expected "' + expectedAccountName +
      '", found "' + actualName + '"). Please refresh and try again.'
    );
  }
  if (headerMap.activeColZero !== -1 && isExplicitInactive_(rowDisplay[headerMap.activeColZero])) {
    throw new Error('This debt is not currently tracked. Restore it before editing.');
  }

  const changedFields = [];
  const previous = {};
  const next = {};

  // Currency fields: blank → 0 (matches the Add form "enter 0" convention).
  const currencyChange = function(field, label, colZero) {
    if (colZero === -1 || typeof payload[field] === 'undefined') return;
    const raw = payload[field];
    const newNum = round2_(toNumber_(raw === '' || raw === null ? 0 : raw));
    const curNum = round2_(toNumber_(rowValues[colZero]));
    if (newNum === curNum) return;
    setCurrencyCellPreserveRowFormat_(sheet, sheetRow, colZero + 1, newNum, 1);
    changedFields.push(label);
    previous[label] = String(rowDisplay[colZero] || '');
    next[label] = newNum;
  };

  const textChange = function(field, label, colZero) {
    if (colZero === -1 || typeof payload[field] === 'undefined') return;
    const newVal = String(payload[field] == null ? '' : payload[field]).trim();
    const curVal = String(rowDisplay[colZero] || '').trim();
    if (newVal === curVal) return;
    if (label === 'Type' && !newVal) return; // never blank out Type
    copyNeighborFormatInRow_(sheet, sheetRow, colZero + 1, 1);
    sheet.getRange(sheetRow, colZero + 1).setValue(newVal);
    changedFields.push(label);
    previous[label] = curVal;
    next[label] = newVal;
  };

  const intChange = function(field, label, colZero) {
    if (colZero === -1 || typeof payload[field] === 'undefined') return;
    const s = String(payload[field] == null ? '' : payload[field]).trim();
    if (s === '') return; // leave unchanged when blank
    const newNum = parseInt(s, 10);
    if (isNaN(newNum)) throw new Error(label + ' must be a whole number.');
    const curNum = parseInt(String(rowDisplay[colZero] || '').trim(), 10);
    if (!isNaN(curNum) && curNum === newNum) return;
    copyNeighborFormatInRow_(sheet, sheetRow, colZero + 1, 1);
    const cell = sheet.getRange(sheetRow, colZero + 1);
    cell.setValue(newNum);
    cell.setNumberFormat('0');
    changedFields.push(label);
    previous[label] = String(rowDisplay[colZero] || '');
    next[label] = newNum;
  };

  const percentChange = function(field, label, colZero) {
    if (colZero === -1 || typeof payload[field] === 'undefined') return;
    const s = String(payload[field] == null ? '' : payload[field]).trim();
    if (s === '') return;
    const newNum = round2_(toNumber_(s));
    const curNum = round2_(toNumber_(rowValues[colZero]));
    if (newNum === curNum) return;
    copyNeighborFormatInRow_(sheet, sheetRow, colZero + 1, 1);
    const cell = sheet.getRange(sheetRow, colZero + 1);
    cell.setValue(newNum);
    cell.setNumberFormat('0.00');
    changedFields.push(label);
    previous[label] = String(rowDisplay[colZero] || '');
    next[label] = newNum;
  };

  // Account Name is intentionally NOT editable (Phase 2 rename).
  textChange('type', 'Type', headerMap.typeColZero);
  currencyChange('accountBalance', 'Account Balance', headerMap.balanceColZero);
  intChange('dueDate', 'Due Date', headerMap.dueDateColZero);
  currencyChange('creditLimit', 'Credit Limit', headerMap.creditLimitColZero);
  currencyChange('creditLeft', 'Credit Left', headerMap.creditLeftColZero);
  currencyChange('minimumPayment', 'Minimum Payment', headerMap.minimumPaymentColZero);
  percentChange('intRate', 'Int Rate', headerMap.intRateColZero);

  if (changedFields.length === 0) {
    return { ok: true, message: 'No changes made', accountName: actualName, changedFields: [] };
  }

  // Recompute the derived Acct PCT Avail once, after all field writes.
  recalcDebtPctAvailForRow_(sheet, sheetRow, {
    creditLimitCol: headerMap.creditLimitColZero,
    creditLeftCol: headerMap.creditLeftColZero,
    balanceCol: headerMap.balanceColZero,
    pctAvailCol: headerMap.pctAvailColZero
  });

  // One consolidated debt_update activity row. When exactly one field
  // changed we also include the single-field keys so debtUpdateActionLabel_
  // renders the rich "Updated <field> to <value>" label; multi-field edits
  // render as "Updated N fields" (see debtUpdateActionLabel_).
  try {
    const typeForLog = headerMap.typeColZero === -1
      ? ''
      : String(rowDisplay[headerMap.typeColZero] || '').trim();
    const detailsObj = {
      detailsVersion: 1,
      changedFields: changedFields,
      previous: previous,
      next: next,
      sheetRow: sheetRow
    };
    if (changedFields.length === 1) {
      const only = changedFields[0];
      detailsObj.fieldName = only;
      detailsObj.fieldKind = debtFieldKindForLabel_(only);
      detailsObj.newRaw = next[only];
      detailsObj.newDisplay = String(next[only]);
    }
    appendActivityLog_(ss, {
      eventType: 'debt_update',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
      payee: actualName,
      category: typeForLog,
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify(detailsObj)
    });
  } catch (logErr) {
    Logger.log('updateTrackedDebtFromDashboard activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('debts');

  return {
    ok: true,
    message: 'Changes saved — ' + changedFields.length + ' field' +
      (changedFields.length === 1 ? '' : 's') + ' updated',
    accountName: actualName,
    changedFields: changedFields
  };
}

/**
 * Manage Debts Phase 1.5 — validate a prospective NEW name for a RENAME.
 * Like validateNewDebtAccountName_ but EXCLUDES the row being renamed (matched
 * by its old name, case-insensitively) so a pure case/spacing fix on the same
 * row is allowed, while any collision with another active OR inactive debt
 * (case-insensitive) is blocked. Never allows the reserved TOTAL DEBT name.
 * @returns {string} trimmed, validated new name
 */
function validateRenamedDebtAccountName_(rawNew, oldName) {
  const name = String(rawNew || '').trim();
  const old = String(oldName || '').trim();
  if (!name) throw new Error('New account name is required.');
  if (name.length > 120) throw new Error('Account name is too long (max 120 characters).');
  if (isDebtReservedName_(name)) {
    throw new Error('That account name is reserved and cannot be used.');
  }

  const existing = getAllDebtAccountNamesIncludingInactive_();
  for (let i = 0; i < existing.length; i++) {
    const cand = String(existing[i] || '').trim();
    // Skip the single row being renamed (match the old name case-insensitively).
    if (cand.toLowerCase() === old.toLowerCase()) continue;
    if (cand.toLowerCase() === name.toLowerCase()) {
      throw new Error('Another debt account already uses this name. Rename was not completed.');
    }
  }

  return name;
}

/**
 * Returns every INPUT - Cash Flow YYYY sheet in the workbook (name starts with
 * the Cash Flow prefix and ends in a 4-digit year). Used by the coordinated
 * debt rename to update Expense Payee cells across all years.
 */
function getAllCashFlowYearSheets_(ss) {
  const prefix = getSheetNames_().CASH_FLOW_PREFIX;
  const all = ss.getSheets();
  const out = [];
  for (let i = 0; i < all.length; i++) {
    const nm = all[i].getName();
    if (nm.indexOf(prefix) === 0 && /^\d{4}$/.test(nm.slice(prefix.length))) {
      out.push(all[i]);
    }
  }
  return out;
}

/**
 * Manage Debts Phase 1.5 — coordinated debt Account Name rename.
 *
 * Renames the INPUT - Debts row AND every matching Expense Payee cell across
 * ALL INPUT - Cash Flow YYYY sheets (Payee cell only — month values, totals and
 * formulas are never touched), then logs ONE debt_rename activity row. The row
 * is identified by sheetRow + expectedAccountName (stale guard). Duplicates are
 * blocked (active + inactive, case-insensitive) as is the reserved TOTAL DEBT
 * row. Serialized via LockService.getDocumentLock(). On a partial failure the
 * already-applied writes are best-effort reverted.
 *
 * Out of scope (by design): merging accounts, alias-map edits, Activity Log
 * history rewrites, and any Cash Flow value/formula changes.
 *
 * @param {{ sheetRow:(number|string), expectedAccountName:string, newAccountName:string }} payload
 * @returns {{ ok:boolean, message:string, oldAccountName:string, newAccountName:string,
 *             debtRowUpdated:boolean, cashFlowSheetsUpdated:Array, cashFlowRowsUpdated:number,
 *             cashFlowMatched:boolean }}
 */
function renameDebtFromDashboard(payload) {
  validateRequired_(payload, ['sheetRow', 'expectedAccountName', 'newAccountName']);

  const sheetRow = parseInt(String(payload.sheetRow), 10);
  if (isNaN(sheetRow) || sheetRow < 2) {
    throw new Error('Invalid debt row. Please refresh and try again.');
  }
  const expectedAccountName = String(payload.expectedAccountName || '').trim();
  if (!expectedAccountName) {
    throw new Error('Missing debt account. Please refresh and try again.');
  }

  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    throw new Error('Could not acquire document lock: ' + (lockErr && lockErr.message || lockErr));
  }

  try {
    const ss = getUserSpreadsheet_();
    const sheet = getSheet_(ss, 'DEBTS');
    const headerMap = getDebtsHeaderMap_(sheet);

    const lastRow = Math.max(sheet.getLastRow(), 1);
    if (sheetRow > lastRow) {
      throw new Error('Debt has moved on the sheet. Please refresh and try again.');
    }

    // Stale-row guard: the name on the target row must still match.
    const actualName = String(sheet.getRange(sheetRow, headerMap.nameCol).getDisplayValue() || '').trim();
    if (!actualName) {
      throw new Error('Debt has moved on the sheet. Please refresh and try again.');
    }
    if (isDebtSummaryRowName_(actualName)) {
      throw new Error('Cannot rename the reserved "' + actualName + '" row.');
    }
    if (actualName !== expectedAccountName) {
      throw new Error(
        'Debt has moved on the sheet (expected "' + expectedAccountName +
        '", found "' + actualName + '"). Please refresh and try again.'
      );
    }

    // Validate the new name. Throws the canonical duplicate/reserved messages.
    const newName = validateRenamedDebtAccountName_(payload.newAccountName, actualName);
    if (newName === actualName) {
      return {
        ok: true,
        message: 'No changes made — the name is unchanged.',
        oldAccountName: actualName,
        newAccountName: actualName,
        debtRowUpdated: false,
        cashFlowSheetsUpdated: [],
        cashFlowRowsUpdated: 0,
        cashFlowMatched: false
      };
    }

    // --- Apply: Debts row first, then Cash Flow rows. Track for revert. ---
    let debtRenamed = false;
    const cfApplied = []; // { sheet, row, col } for best-effort revert
    const cashFlowSheetsUpdated = [];

    try {
      // 1) Rename the INPUT - Debts Account Name cell.
      sheet.getRange(sheetRow, headerMap.nameCol).setValue(newName);
      debtRenamed = true;

      // 2) Rename matching Expense Payee cells across ALL year sheets. Only the
      //    Payee cell is written — month values, totals and formulas untouched.
      const cfSheets = getAllCashFlowYearSheets_(ss);
      for (let s = 0; s < cfSheets.length; s++) {
        const cfSheet = cfSheets[s];
        let cfHeader;
        try {
          cfHeader = getCashFlowHeaderMap_(cfSheet);
        } catch (hdrErr) {
          continue; // sheet without Type/Payee headers — skip safely
        }
        const display = cfSheet.getDataRange().getDisplayValues();
        let rowsHere = 0;
        for (let r = 1; r < display.length; r++) {
          const rowType = String(display[r][cfHeader.typeColZero] || '').trim();
          const rowPayee = String(display[r][cfHeader.payeeColZero] || '').trim();
          if (rowType === 'Expense' && rowPayee === actualName) {
            cfSheet.getRange(r + 1, cfHeader.payeeCol).setValue(newName);
            cfApplied.push({ sheet: cfSheet, row: r + 1, col: cfHeader.payeeCol });
            rowsHere++;
          }
        }
        if (rowsHere > 0) {
          cashFlowSheetsUpdated.push({ sheet: cfSheet.getName(), rows: rowsHere });
        }
      }
    } catch (applyErr) {
      // Best-effort revert of everything written so far (no cross-sheet
      // transaction is available in Apps Script).
      try {
        for (let i = 0; i < cfApplied.length; i++) {
          cfApplied[i].sheet.getRange(cfApplied[i].row, cfApplied[i].col).setValue(actualName);
        }
      } catch (_revCf) { /* best-effort */ }
      if (debtRenamed) {
        try { sheet.getRange(sheetRow, headerMap.nameCol).setValue(actualName); } catch (_revDebt) {}
      }
      throw new Error('Rename failed and was rolled back: ' + (applyErr && applyErr.message || applyErr));
    }

    const cfRowsUpdated = cfApplied.length;
    const cashFlowMatched = cfRowsUpdated > 0;

    try { touchDashboardSourceUpdated_('debts'); } catch (_e) {}
    try { touchDashboardSourceUpdated_('cash_flow'); } catch (_e) {}

    // One consolidated debt_rename activity row. History is never rewritten.
    try {
      const typeForLog = headerMap.typeColZero === -1
        ? ''
        : String(sheet.getRange(sheetRow, headerMap.typeCol).getDisplayValue() || '').trim();
      appendActivityLog_(ss, {
        eventType: 'debt_rename',
        entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        amount: 0,
        direction: '',
        payee: newName,
        category: typeForLog,
        accountSource: '',
        cashFlowSheet: '',
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({
          detailsVersion: 1,
          oldName: actualName,
          newName: newName,
          cashFlowRowsUpdated: cfRowsUpdated,
          cashFlowSheetsUpdated: cashFlowSheetsUpdated,
          sheetRow: sheetRow
        })
      });
    } catch (logErr) {
      Logger.log('renameDebtFromDashboard activity log: ' + logErr);
    }

    const message = cashFlowMatched
      ? 'Renamed "' + actualName + '" to "' + newName + '" (updated ' + cfRowsUpdated +
        ' Cash Flow row' + (cfRowsUpdated === 1 ? '' : 's') + ' across ' +
        cashFlowSheetsUpdated.length + ' year' + (cashFlowSheetsUpdated.length === 1 ? '' : 's') + ').'
      : 'Renamed "' + actualName + '" to "' + newName + '". No linked Cash Flow row was found.';

    return {
      ok: true,
      message: message,
      oldAccountName: actualName,
      newAccountName: newName,
      debtRowUpdated: true,
      cashFlowSheetsUpdated: cashFlowSheetsUpdated,
      cashFlowRowsUpdated: cfRowsUpdated,
      cashFlowMatched: cashFlowMatched
    };
  } finally {
    try { lock.releaseLock(); } catch (_e) {}
  }
}

/**
 * Returns active, non-summary debts for dropdowns / UI consumers. Inactive
 * debts are filtered out via the shared explicit-wins-with-fallback rule.
 */
function getDebtRows_() {
  const ss = getUserSpreadsheet_();
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
  const s = sheet || getSheet_(getUserSpreadsheet_(), 'DEBTS');
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
  // Performance: this RPC is fired on every Debts dropdown change and
  // every field-picker change, so a slow path here makes the page feel
  // laggy on every interaction. The previous implementation read
  // INPUT - Debts THREE times in a row (getValues + getDisplayValues +
  // getDebtsHeaderMap) plus a separate findDebtRow_() lookup. We now
  // load both snapshots once, derive the header map from the loaded
  // display, and scan the loaded display for the account row in-memory
  // instead of round-tripping again.
  const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'DEBTS');

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (display.length < 2) throw new Error('Debts list is empty.');

  const headerMap = getDebtsHeaderMap_(sheet, display);
  const fieldColZero = getRequiredDebtFieldColZero_(sheet, fieldName, display[0] || []);

  const target = String(accountName || '').trim();
  let rowIdx = -1;
  for (let r = 1; r < display.length; r++) {
    const name = String((display[r] || [])[headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (name === target) {
      rowIdx = r;
      break;
    }
  }
  if (rowIdx === -1) {
    throw new Error('Debt account not found: ' + accountName);
  }

  return {
    accountName: accountName,
    fieldName: fieldName,
    value: values[rowIdx][fieldColZero],
    displayValue: display[rowIdx][fieldColZero],
    type: headerMap.typeColZero === -1 ? '' : String(display[rowIdx][headerMap.typeColZero] || '').trim(),
    pctAvail: headerMap.pctAvailColZero === -1 ? '' : String(display[rowIdx][headerMap.pctAvailColZero] || '').trim()
  };
}

function updateDebtField(payload) {
  validateRequired_(payload, ['accountName', 'fieldName', 'value']);

  const accountName = String(payload.accountName || '').trim();
  const fieldName = String(payload.fieldName || '').trim();
  const rawValue = payload.value;

  // Allow-list guard: the generic field editor may ONLY write the approved
  // editable columns. Active is owned by deactivate/reactivate; Account Name
  // by the rename flow; derived columns are computed server-side. This blocks
  // a crafted/stale call (e.g. fieldName:'Active') from silently flipping a
  // debt's tracking state through the generic path.
  if (DEBT_EDITABLE_FIELDS_.indexOf(fieldName) === -1) {
    if (fieldName === 'Active') {
      throw new Error('Use Stop Tracking / Reactivate to change Active.');
    }
    if (fieldName === 'Account Name') {
      throw new Error('Use Rename Debt to change Account Name.');
    }
    // Derived / calculated columns (e.g. Acct PCT Avail) and anything else.
    throw new Error('This field cannot be edited here: ' + (fieldName || '(blank)'));
  }

  const ss = getUserSpreadsheet_();
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

  // Capture prior state BEFORE writing so the activity log can record the
  // transition. previousDisplay is what the user saw on the sheet; previousRaw
  // is the underlying value (number for currency/percent/integer, string
  // otherwise). Both default to '' if the row/column can't be read safely.
  let previousRaw = '';
  let previousDisplay = '';
  try {
    previousRaw = cell.getValue();
  } catch (_e) { /* best-effort */ }
  try {
    if (display[targetRow - 1] && typeof display[targetRow - 1][targetCol - 1] !== 'undefined') {
      previousDisplay = String(display[targetRow - 1][targetCol - 1] || '');
    }
  } catch (_e) { /* best-effort */ }

  let fieldKind = 'text';
  let newRawForLog = rawValue;

  if (currencyFields[fieldName]) {
    const num = toNumber_(rawValue);
    setCurrencyCellPreserveRowFormat_(sheet, targetRow, targetCol, num, 1);
    fieldKind = 'currency';
    newRawForLog = num;
  } else if (percentFields[fieldName]) {
    const num = round2_(toNumber_(rawValue));
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0.00');
    fieldKind = 'percent';
    newRawForLog = num;
  } else if (integerFields[fieldName]) {
    const num = parseInt(String(rawValue).trim(), 10);
    if (isNaN(num)) throw new Error(fieldName + ' must be a whole number.');
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(num);
    cell.setNumberFormat('0');
    fieldKind = 'integer';
    newRawForLog = num;
  } else {
    copyNeighborFormatInRow_(sheet, targetRow, targetCol, 1);
    cell.setValue(rawValue);
    fieldKind = 'text';
    newRawForLog = rawValue;
  }

  recalcDebtPctAvailForRow_(sheet, targetRow, {
    creditLimitCol: headerMap.creditLimitColZero,
    creditLeftCol: headerMap.creditLeftColZero,
    balanceCol: headerMap.balanceColZero,
    pctAvailCol: headerMap.pctAvailColZero
  });

  // Activity log: field-edit event. Non-monetary (Amount renders "—") —
  // the action label carries the new value in context (e.g. "Updated
  // Account Balance to $54,000.00"), so we don't double-count dollars
  // against the Activity totals the way a real money-movement event would.
  try {
    const typeForLog = headerMap.typeColZero === -1
      ? ''
      : String((display[targetRow - 1] || [])[headerMap.typeColZero] || '').trim();
    appendActivityLog_(ss, {
      eventType: 'debt_update',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
      payee: accountName,
      category: typeForLog,
      accountSource: '',
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        fieldName: fieldName,
        fieldKind: fieldKind,
        previousRaw: previousRaw,
        previousDisplay: previousDisplay,
        newRaw: newRawForLog,
        sheetRow: targetRow
      })
    });
  } catch (logErr) {
    Logger.log('updateDebtField activity log: ' + logErr);
  }

  touchDashboardSourceUpdated_('debts');

  // NOTE: we intentionally do NOT call runDebtPlanner() here. The row-level
  // write + Acct PCT Avail recalc + activity log + touch are all the user
  // needs to see the new value reflected in the Debts tab. The Rolling Debt
  // Payoff / Overview KPI refresh is handled by the client firing
  // runPlannerAndRefreshDashboard() as a background RPC after this save
  // returns — that way the "Saving…" status doesn't hang for the full
  // planner duration. See Dashboard_Script_PlanningDebts.html::saveDebt().
  return {
    ok: true,
    message: 'Debt saved.'
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
  const ss = getUserSpreadsheet_();
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

  // Ensure-before-validate guard. Idempotent no-op on populated workbooks;
  // on fresh workbooks it seeds the canonical INPUT - Debts structure that
  // validateNewDebtAccountName_ (which strict-reads INPUT - Debts for the
  // duplicate-name check) plus the header read / writes further below all
  // depend on. It MUST run BEFORE validateNewDebtAccountName_, because that
  // validator would otherwise throw "Missing sheet (after retry+flush):
  // INPUT - Debts" on a brand-new (e.g. Central-provisioned) workbook reached
  // via the main-menu Add path before any Setup step created the sheet.
  // Mirrors the ensure-before-validate ordering in addBankAccountFromDashboard
  // / addInvestmentAccountFromDashboard / addHouseFromDashboard.
  try {
    ensureOnboardingDebtsSheetFromDashboard('normal');
  } catch (ensureErr) {
    throw new Error(
      "Couldn't prepare debts: " +
      (ensureErr && ensureErr.message ? ensureErr.message : ensureErr)
    );
  }
  try { SpreadsheetApp.flush(); } catch (_flushErr) { /* best-effort */ }

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

  const ss = getUserSpreadsheet_();
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

  // Sorted insert by Due Day within the active region (rows 2..templateRow)
  // so the new debt lands in due-date order alongside its peers above the
  // TOTAL DEBT summary. Stop-tracked rows below the summary are
  // intentionally NOT considered — they're soft-deleted and shouldn't
  // influence active-region ordering. All debt lookups elsewhere are by
  // account name (`getDebtsHeaderMap_` / `findRowByName_` callers /
  // `normalizeDebts_`), so shifting active rows around is safe — there are
  // no row-number references to update.
  //
  // sortedInsertRow contract:
  //   * 1-based row number to `insertRowBefore()` so the new row lands
  //     ahead of the first existing same-day-or-greater row (with blanks
  //     sunk to the bottom of the active region).
  //   * `templateRow + 1` when the new debt belongs at the end of the
  //     active region (its Due Day is >= all existing rows), which keeps
  //     the legacy "insertRowAfter(templateRow)" placement and so leaves
  //     TOTAL DEBT and any stop-tracked rows below it untouched.
  //   * -1 when the sheet has no existing data rows above TOTAL DEBT
  //     (templateRow === -1) — caller falls back to appendRow.
  const sortedInsertRow = findDebtsSortedInsertRow_(sheet, headerMap, templateRow, dueDay);

  let appendedRow;
  let formatSourceRow = -1;
  if (sortedInsertRow === -1) {
    // No existing data rows in the active region. If a TOTAL DEBT summary
    // row is present (Central / seeded workbooks) we must insert ABOVE it so
    // the new debt never lands below the summary; otherwise fall back to the
    // legacy appendRow (legacy / bound workbooks that have no summary row).
    const totalDebtRow = findDebtTotalRow_(sheet, headerMap);
    if (totalDebtRow !== -1) {
      sheet.insertRowBefore(totalDebtRow);
      appendedRow = totalDebtRow;
      sheet.getRange(appendedRow, 1, 1, numCols).setValues([row]);
      // No sibling data row exists to copy formatting from, and copying the
      // green TOTAL DEBT band would be wrong — stamp a clean data-row style
      // (white, normal weight, size 14) and re-assert currency formats on the
      // four money columns. Cosmetic only; a failure must not block the add.
      try {
        sheet.getRange(appendedRow, 1, 1, numCols)
          .setBackground('#ffffff')
          .setFontWeight('normal')
          .setFontColor('#000000')
          .setFontSize(14);
        const moneyColsForFmt = [
          headerMap.balanceCol,
          headerMap.minimumPaymentCol,
          headerMap.creditLimitCol,
          headerMap.creditLeftCol
        ];
        for (let mc = 0; mc < moneyColsForFmt.length; mc++) {
          if (moneyColsForFmt[mc] !== -1) {
            sheet.getRange(appendedRow, moneyColsForFmt[mc])
              .setNumberFormat('$#,##0.00;-$#,##0.00');
          }
        }
      } catch (_stampErr) {
        Logger.log('addDebtFromDashboard empty-region stamp: ' + _stampErr);
      }
      // formatSourceRow stays -1 — we stamped directly, so the format-copy
      // block below is skipped for this path.
    } else {
      sheet.appendRow(row);
      appendedRow = sheet.getLastRow();
      // No prior data row and no summary row: nothing styled to copy from —
      // leave default formatting. The Active cell write below still re-stamps
      // row-consistent format on that one cell.
    }
  } else {
    sheet.insertRowBefore(sortedInsertRow);
    appendedRow = sortedInsertRow;
    sheet.getRange(appendedRow, 1, 1, numCols).setValues([row]);
    // Pick the closest already-styled sibling. Prefer the row immediately
    // below (it was at `appendedRow` before the insert and thus was
    // already styled like the rest of the active region). Fall back to the
    // row above when the new row was inserted at the very end of the
    // active region (templateRow + 1) and the row below would now be the
    // blank buffer / TOTAL DEBT row. Never copy from row 1 (header).
    const lastRow = sheet.getLastRow();
    let candidateBelow = appendedRow + 1;
    let candidateAbove = appendedRow - 1;
    if (sortedInsertRow === templateRow + 1) {
      // We're at the end of the active region — the row below is buffer
      // or TOTAL DEBT. Prefer the row above (which is the legacy
      // templateRow's previous occupant, now shifted up by 0 since insert
      // happened below it) for an active-row style match.
      formatSourceRow = candidateAbove >= 2 ? candidateAbove : -1;
    } else {
      formatSourceRow =
        candidateBelow <= lastRow ? candidateBelow :
        (candidateAbove >= 2 ? candidateAbove : -1);
    }
  }

  if (formatSourceRow !== -1 && formatSourceRow !== appendedRow) {
    try {
      sheet.getRange(formatSourceRow, 1, 1, numCols).copyTo(
        sheet.getRange(appendedRow, 1, 1, numCols),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sheet.setRowHeight(appendedRow, sheet.getRowHeight(formatSourceRow));
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

  // Keep the TOTAL DEBT summary row's gross =SUM ranges covering the newly
  // inserted data row (handles the SUM lower-boundary case when the new debt
  // lands at the end of the active region). No-op when the sheet has no
  // TOTAL DEBT row, and exact-shape guarded so it never clobbers a
  // hand-authored summary formula. Best-effort.
  try {
    refreshDebtsTotalRow_(sheet, headerMap);
  } catch (totalErr) {
    Logger.log('addDebtFromDashboard refreshDebtsTotalRow_: ' + totalErr);
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

  // Status line is one short sentence; the Cash-Flow-seed details remain
  // available on the returned `cashFlowRowSeeded` / `cashFlowSeedWarning`
  // fields for any caller that wants to surface them separately.
  const message = 'Debt added.';

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

  const ss = getUserSpreadsheet_();
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

/**
 * Reactivate (un-stop-track) a debt: restore Active=Yes on the EXISTING
 * INPUT - Debts row. The inverse of deactivateDebtFromDashboard. This never
 * creates a new row and never touches Account Balance, Due Date, Type,
 * Credit Limit, Credit Left, Minimum Payment, Int Rate, or any Cash Flow
 * history — it only flips the Active cell back to Yes.
 *
 * Guardrail: if ANOTHER row already carries the same Account Name and is
 * currently active, reactivation is blocked (we never want two active debts
 * sharing a name — that would double-count balances and confuse every reader
 * that joins by Payee/Account Name).
 *
 * Logs `debt_reactivate` with details { previousActive, newActive, sheetRow,
 * accountName }.
 *
 * Payload: { accountName }
 */
function reactivateDebtFromDashboard(payload) {
  validateRequired_(payload, ['accountName']);
  const accountName = String(payload.accountName || '').trim();
  if (!accountName) throw new Error('Account name is required.');
  if (isDebtReservedName_(accountName)) {
    throw new Error('Cannot reactivate the reserved "' + accountName + '" row.');
  }

  const ss = getUserSpreadsheet_();
  const sheet = getSheet_(ss, 'DEBTS');
  const headerMap = ensureDebtsActiveColumn_(sheet);

  const display = sheet.getDataRange().getDisplayValues();
  const values = sheet.getDataRange().getValues();

  // Scan all rows with this name. Deterministically prefer the FIRST inactive
  // row as the one to restore, and independently detect whether ANY row with
  // the same name is already active (the duplicate-active guardrail) regardless
  // of row order.
  let inactiveRow = -1;
  let inactiveActiveDisplay = '';
  let anyMatchingRow = false;
  let activeTwinExists = false;
  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;
    if (name.toLowerCase() !== accountName.toLowerCase()) continue;

    anyMatchingRow = true;
    const rowInactive = isDebtRowInactive_(display[r], values[r], headerMap);
    if (rowInactive) {
      if (inactiveRow === -1) {
        inactiveRow = r + 1;
        inactiveActiveDisplay = headerMap.activeColZero === -1
          ? ''
          : String(display[r][headerMap.activeColZero] || '').trim();
      }
    } else {
      activeTwinExists = true;
    }
  }

  if (!anyMatchingRow) {
    throw new Error('Debt account not found: ' + accountName);
  }

  // Nothing inactive to restore — there is already an active row with this name.
  if (inactiveRow === -1) {
    return {
      ok: true,
      message: '"' + accountName + '" is already active.',
      accountName: accountName,
      alreadyActive: true
    };
  }

  // Guardrail: never end up with two active debts sharing a name.
  if (activeTwinExists) {
    throw new Error(
      'Another active debt already uses the name "' + accountName +
      '". Rename or stop tracking that one before reactivating this row.'
    );
  }

  const targetRow = inactiveRow;
  const currentActiveDisplay = inactiveActiveDisplay;

  writeActiveCellWithRowFormat_(sheet, targetRow, headerMap.activeCol, 'Yes');

  try {
    touchDashboardSourceUpdated_('debts');
  } catch (e) { /* best-effort */ }

  try {
    appendActivityLog_(ss, {
      eventType: 'debt_reactivate',
      entryDate: Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      amount: 0,
      direction: '',
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
        reason: 'reactivate',
        previousActive: currentActiveDisplay || 'No',
        newActive: 'Yes',
        sheetRow: targetRow,
        accountName: accountName
      })
    });
  } catch (logErr) {
    Logger.log('reactivateDebtFromDashboard activity log: ' + logErr);
  }

  return {
    ok: true,
    message: 'Reactivated "' + accountName + '". It is tracked again.',
    accountName: accountName,
    alreadyActive: false
  };
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                            */
/* -------------------------------------------------------------------------- */

function getDebtsHeaderMap_(sheet, optionalDisplay) {
  // Performance: when callers (e.g. getDebtsUiData / getDebtFieldValue)
  // have already loaded the full INPUT - Debts display values, pass that
  // array in via optionalDisplay so we can read the header row from it
  // instead of doing another full-sheet round-trip just to look up
  // column indices. Behavior is identical when omitted.
  const headers = (optionalDisplay && optionalDisplay.length)
    ? (optionalDisplay[0] || [])
    : (sheet.getDataRange().getDisplayValues()[0] || []);

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

/**
 * Returns the 1-based row of the TOTAL DEBT summary row, or -1 if absent.
 * Scans the Account Name column by name using the shared summary-row
 * predicate. The header row (row 1) is never matched.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object=} headerMap  optional getDebtsHeaderMap_ result
 * @returns {number} 1-based row, or -1
 */
function findDebtTotalRow_(sheet, headerMap) {
  const hm = headerMap || getDebtsHeaderMap_(sheet);
  const lastRow = Math.max(1, sheet.getLastRow());
  const colA = sheet.getRange(1, hm.nameCol, lastRow, 1).getDisplayValues();
  for (let i = 1; i < colA.length; i++) { // skip header row 1 (i=0)
    const name = String(colA[i][0] || '').trim();
    if (isDebtSummaryRowName_(name)) return i + 1;
  }
  return -1;
}

/**
 * First-create seed of the canonical TOTAL DEBT summary row. Writes the
 * literal label "TOTAL DEBT" in the Account Name column and leaves every
 * other cell (including the four money columns) BLANK — the gross =SUM
 * formulas are materialized later by refreshDebtsTotalRow_ once at least one
 * debt data row exists. Seeding a formula on an empty sheet would be
 * self-referential (the SUM cell would sit inside its own range), so the
 * blank-then-refresh split is deliberate.
 *
 * Idempotent: if a TOTAL DEBT row already exists this is a no-op and returns
 * its 1-based row. Intended for first-create only (callers gate on a freshly
 * created sheet); it never clears or rewrites existing rows.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object=} headerMap  optional getDebtsHeaderMap_ result
 * @returns {number} 1-based row of the TOTAL DEBT row, or -1 on failure
 */
function seedDebtsTotalRow_(sheet, headerMap) {
  if (!sheet) return -1;
  const hm = headerMap || getDebtsHeaderMap_(sheet);

  const existing = findDebtTotalRow_(sheet, hm);
  if (existing !== -1) return existing;

  const numCols = Math.max(sheet.getLastColumn(), hm.nameCol);
  const row = new Array(numCols);
  for (let c = 0; c < numCols; c++) row[c] = '';
  row[hm.nameColZero] = 'TOTAL DEBT';

  sheet.appendRow(row);
  const totalRow = sheet.getLastRow();

  // Currency format on the four (currently blank) money cells so the cells —
  // and the =SUM formulas refreshDebtsTotalRow_ writes later — render
  // consistently with the data rows. Cosmetic only; never load-bearing.
  try {
    const moneyCols = [hm.balanceCol, hm.minimumPaymentCol, hm.creditLimitCol, hm.creditLeftCol];
    for (let i = 0; i < moneyCols.length; i++) {
      if (moneyCols[i] !== -1) {
        sheet.getRange(totalRow, moneyCols[i]).setNumberFormat('$#,##0.00;-$#,##0.00');
      }
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  return totalRow;
}

/**
 * Maintains the TOTAL DEBT summary row's gross =SUM ranges so they cover
 * every debt data row above the summary (rows 2..T-1). Gross by design —
 * inactive / stop-tracked rows still count, matching a plain hand-authored
 * =SUM (Phase 3.1 decision: "TOTAL DEBT = SUM of all rows above it").
 *
 * Bound-mode safety (exact-shape guard, mirrors refreshBlockSumAggregates_):
 *   - Acts only when a TOTAL DEBT row already exists; NEVER creates one here.
 *   - Touches only the four money columns (Account Balance, Minimum Payment,
 *     Credit Limit, Credit Left), resolved by header label.
 *   - Fills a money cell only when it is truly BLANK (the seeded state) or
 *     already a strict simple =SUM(<L>n:<L>m) on its own column. A literal
 *     value or any compound / cross-sheet / non-SUM formula is left
 *     untouched, so a hand-authored production summary is never clobbered.
 *
 * Best-effort: all failures are swallowed; must never block a debt save.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object=} headerMap        optional getDebtsHeaderMap_ result
 * @param {number=} optionalTotalRow optional precomputed TOTAL DEBT row
 */
function refreshDebtsTotalRow_(sheet, headerMap, optionalTotalRow) {
  try {
    if (!sheet) return;
    const hm = headerMap || getDebtsHeaderMap_(sheet);
    const totalRow = (optionalTotalRow && optionalTotalRow > 0)
      ? optionalTotalRow
      : findDebtTotalRow_(sheet, hm);
    if (totalRow === -1) return; // no summary row — never create one here

    const dataStartRow = 2;
    const dataEndRow = totalRow - 1;
    if (dataEndRow < dataStartRow) return; // no data rows — leave blanks blank

    const currency = '$#,##0.00;-$#,##0.00';
    const simpleSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*:\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;
    // Single-cell SUM, e.g. =SUM(C3). Google Sheets normalizes the degenerate
    // single-row range =SUM(C2:C2) (which refresh writes for the first debt)
    // down to =SUM(C2); a later row insert above then shifts it to =SUM(C3).
    // We must recognize this collapsed/shifted form so the second debt expands
    // it back to a real range — otherwise the simpleSum (colon-only) matcher
    // never matches and the total freezes at one cell.
    const singleCellSum = /^=SUM\(\s*\$?([A-Z]+)\$?(\d+)\s*\)$/i;
    const moneyCols = [
      hm.balanceCol,
      hm.minimumPaymentCol,
      hm.creditLimitCol,
      hm.creditLeftCol
    ];

    for (let i = 0; i < moneyCols.length; i++) {
      const col = moneyCols[i];
      if (col === -1) continue;

      const letter = columnToLetter_(col).toUpperCase();
      const canonical = '=SUM(' + letter + dataStartRow + ':' + letter + dataEndRow + ')';
      const cell = sheet.getRange(totalRow, col);

      let formula = '';
      try { formula = String(cell.getFormula() || '').trim(); } catch (_) { continue; }

      if (formula === '') {
        // No formula present. Only fill when the cell is truly blank — a
        // literal value (possible in a hand-authored bound workbook) is
        // intentionally left alone.
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

      // A formula is present — only rewrite a SUM we recognize as owning this
      // cell's own column; leave compound / cross-sheet / non-SUM formulas
      // untouched. Two accepted shapes:
      //   1. strict simple range  =SUM(<L>n:<L>m)  (both ends same column)
      //   2. single cell          =SUM(<L>n)       (the Sheets-normalized /
      //      insert-shifted form of a former single-row range)
      // Anything else is left alone.
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
    Logger.log('refreshDebtsTotalRow_: ' + e);
  }
}

/**
 * Find the 1-based row number BEFORE which a new debt row with `newDueDay`
 * should be inserted to keep INPUT - Debts sorted by Due Day ascending
 * within the active region above TOTAL DEBT.
 *
 * Active region = rows 2..templateRow (inclusive), where templateRow is
 * the last non-summary, non-empty data row above TOTAL DEBT. Stop-tracked
 * rows that sit BELOW TOTAL DEBT are intentionally skipped — they're
 * soft-deleted and shouldn't influence the ordering users see in the
 * Debts dropdowns / dashboard tables.
 *
 * Rules mirror findBillsSortedInsertRow_:
 *   - Insert before the first active-region row whose Due Day is strictly
 *     greater than `newDueDay`.
 *   - Same-day ties land AFTER existing same-day rows.
 *   - Blank Due Day rows in the active region (legacy / hand-edited)
 *     sink to the bottom of the active region — numeric rows are
 *     inserted above the first blank we encounter.
 *   - When no strictly-greater row exists, return `templateRow + 1`
 *     (the legacy "insert at end of active region" slot — keeps the
 *     blank buffer + TOTAL DEBT untouched).
 *   - Returns -1 when templateRow === -1 (no active region yet) so the
 *     caller falls back to appendRow.
 *
 * Reads INPUT - Debts once (a single bounded getValues over the active
 * region). Typical debt counts are < 30 so this is well under one frame.
 *
 * @param {Sheet} sheet         INPUT - Debts sheet.
 * @param {Object} headerMap    Output of getDebtsHeaderMap_.
 * @param {number} templateRow  Output of findDebtTemplateRow_.
 * @param {number} newDueDay    Validated Due Day of the new debt (1..31).
 * @returns {number}            1-based row number to insertBefore, or -1.
 */
function findDebtsSortedInsertRow_(sheet, headerMap, templateRow, newDueDay) {
  if (!sheet || !headerMap) return -1;
  if (templateRow === -1) return -1;
  // Defensive: when the workbook is missing the "Due Date" column we can't
  // sort by it — fall back to the legacy "append at end of active region"
  // slot. setAt_(headerMap.dueDateColZero, ...) silently no-ops in this
  // case so existing data isn't touched either.
  if (headerMap.dueDateColZero === -1) return templateRow + 1;
  // Defensive: a non-numeric Due Day should never reach here (the caller
  // validates 1..31), but if it ever does we fall back to "append at end
  // of active region" rather than crashing or scrambling existing order.
  if (!isFinite(Number(newDueDay))) return templateRow + 1;

  const startRow = 2;
  const endRow = templateRow;
  if (endRow < startRow) return templateRow + 1;

  const numCols = sheet.getLastColumn();
  if (numCols < 1) return templateRow + 1;

  const values = sheet
    .getRange(startRow, 1, endRow - startRow + 1, numCols)
    .getValues();

  for (let i = 0; i < values.length; i++) {
    const name = String(values[i][headerMap.nameColZero] || '').trim();
    // Skip empty-name buffer rows and any TOTAL DEBT summary row that
    // somehow leaks into the active region — we don't want to insert
    // ahead of a deliberate gap or the summary anchor.
    if (!name) continue;
    if (isDebtSummaryRowName_(name)) continue;

    const raw = values[i][headerMap.dueDateColZero];
    const hasValue = (raw !== '' && raw !== null && raw !== undefined);
    const n = hasValue ? Number(raw) : NaN;
    const hasNumeric = hasValue && isFinite(n);
    if (!hasNumeric) {
      // Blank Due Day row in the active region — insert numeric row here
      // so blanks stay sunken at the bottom of the active region.
      return startRow + i;
    }
    if (n > newDueDay) {
      return startRow + i;
    }
  }
  return templateRow + 1;
}

function getRequiredDebtFieldColZero_(sheet, fieldName, optionalHeaders) {
  // Performance: callers that already have the header row loaded can
  // pass it in via optionalHeaders to avoid a redundant full-sheet read
  // just for the header lookup. Behavior is unchanged when omitted.
  const headers = (optionalHeaders && optionalHeaders.length)
    ? optionalHeaders
    : (sheet.getDataRange().getDisplayValues()[0] || []);
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
 * First-create cosmetic styling for INPUT - Debts (Family Beta standard).
 *
 * INPUT - Debts is a FLAT table — a single header row (row 1) followed by
 * debt data rows — so unlike Bank Accounts there is no "Year" separator and
 * no Delta row. Styling is therefore: a warm-yellow header, a calm white
 * body carried by typography (size 14), and a green TOTAL DEBT summary band
 * ONLY when such a row already exists.
 *
 *   - body (all cells) → white background, font size 14
 *   - header (row 1)   → yellow #ffe599, bold, black, font size 16,
 *                        vertical-middle, row height 40
 *   - "TOTAL DEBT" row → green #b6d7a8, bold   (ONLY if already present)
 *
 * The body wash runs FIRST so the header (and any TOTAL DEBT band) re-applied
 * afterward always wins. This helper NEVER creates a TOTAL DEBT row, never
 * writes formulas, and never changes headers/schema. Existing currency
 * formats applied by the creator are preserved (only background + font size
 * are touched on the body).
 *
 * Column widths are widen-only (never shrink a user's manual widening).
 *
 * All failures are swallowed — cosmetic only; must never fail an ensure op on
 * a formatting glitch. Idempotent: safe to re-run on the same sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function applyDebtsSheetStyling_(sheet) {
  if (!sheet) return;

  let lastCol = 1;
  try { lastCol = Math.max(1, sheet.getLastColumn()); } catch (_) { return; }
  let lastRow = 0;
  try { lastRow = sheet.getLastRow(); } catch (_) { return; }
  if (lastRow < 1) return;

  // Body wash FIRST: calm white background + size 14 across the whole grid.
  // The header row below re-applies its own background + size, so this never
  // clobbers the header styling. Number/currency formats are untouched (we
  // only set background + size).
  try {
    const maxRows = sheet.getMaxRows();
    sheet.getRange(1, 1, maxRows, lastCol)
      .setBackground('#ffffff')
      .setFontSize(14);
  } catch (_bodyErr) { /* cosmetic only */ }

  // Header row (row 1): warm yellow, bold, large, vertically centered to
  // pair with the taller row height. Production header rows are left-aligned,
  // so horizontal alignment is left at its default.
  try {
    sheet.getRange(1, 1, 1, lastCol)
      .setBackground('#ffe599')
      .setFontWeight('bold')
      .setFontColor('#000000')
      .setFontSize(16)
      .setVerticalAlignment('middle');
    try { sheet.setRowHeight(1, 40); } catch (_) {}
  } catch (_headerErr) { /* cosmetic only */ }

  // TOTAL DEBT summary band — defensive only. Colored if such a row already
  // exists; NEVER created here. Column A carries the row name.
  try {
    const colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
    for (let i = 1; i < colA.length; i++) { // skip header row 1 (i=0)
      const name = String(colA[i][0] || '').trim();
      if (!name) continue;
      if (isDebtSummaryRowName_(name)) {
        try {
          sheet.getRange(i + 1, 1, 1, lastCol)
            .setBackground('#b6d7a8')
            .setFontWeight('bold')
            .setFontColor('#000000');
        } catch (_totErr) { /* cosmetic only */ }
      }
    }
  } catch (_scanErr) { /* cosmetic only */ }

  // Widen-only column widths (never shrink a column the user widened). Keyed
  // by canonical column position from the creator's header layout (production
  // order):
  // 1 Account Name | 2 Type | 3 Account Balance | 4 Due Date |
  // 5 Credit Limit | 6 Minimum Payment | 7 Credit Left | 8 Int Rate |
  // 9 Acct PCT Avail | 10 Active.
  const widthMins = [220, 130, 190, 110, 150, 200, 140, 110, 190, 90];
  for (let c = 1; c <= lastCol && c <= widthMins.length; c++) {
    try {
      if (sheet.getColumnWidth(c) < widthMins[c - 1]) {
        sheet.setColumnWidth(c, widthMins[c - 1]);
      }
    } catch (_) {}
  }

  // Pin the header row when scrolling. Idempotent.
  try { sheet.setFrozenRows(1); } catch (_) {}
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
  const ss = getUserSpreadsheet_();
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
