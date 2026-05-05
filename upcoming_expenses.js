function upcomingExpenseRowPayeeForLog_(row, colMap) {
  const p = String(row[colMap['Payee']] || '').trim();
  if (p) return p;
  return String(row[colMap['Expense Name']] || '').trim();
}

function upcomingExpenseDueIsoForLog_(row, colMap) {
  return parseSheetDateToIso_(row[colMap['Due Date']]);
}

function upcomingExpenseBaseDetails_(row, colMap, upcomingId) {
  return {
    detailsVersion: 1,
    upcomingId: String(upcomingId || '').trim(),
    expenseName: String(row[colMap['Expense Name']] || '').trim(),
    category: String(row[colMap['Category']] || '').trim(),
    payee: String(row[colMap['Payee']] || '').trim(),
    accountSource: String(row[colMap['Account / Source']] || '').trim(),
    amount: round2_(toNumber_(row[colMap['Amount']])),
    notes: String(row[colMap['Notes']] || '').trim()
  };
}

function appendUpcomingActivityStatus_(ss, row, colMap, upcomingId, previousStatus, newStatus, extraDetails) {
  const dueIso = upcomingExpenseDueIsoForLog_(row, colMap);
  const tz = Session.getScriptTimeZone();
  const entryDate = dueIso || Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd');
  const payee = upcomingExpenseRowPayeeForLog_(row, colMap);
  const base = upcomingExpenseBaseDetails_(row, colMap, upcomingId);
  base.previousStatus = String(previousStatus || '').trim();
  base.newStatus = String(newStatus || '').trim();
  if (extraDetails && typeof extraDetails === 'object') {
    Object.keys(extraDetails).forEach(function(k) {
      base[k] = extraDetails[k];
    });
  }

  // Lifecycle-only event: Dismiss is the only writer of upcoming_status now
  // (Paid transitions are handled by applyPaymentToUpcomingExpense via the
  // upcoming_payment event). We write Amount = 0 on the sheet to match the
  // *_deactivate convention, and the Activity UI renders upcoming_status
  // rows as "—" via activityLogIsNonMonetaryEvent_.
  appendActivityLog_(ss, {
    eventType: 'upcoming_status',
    entryDate: entryDate,
    amount: 0,
    direction: 'expense',
    payee: payee,
    category: String(row[colMap['Category']] || '').trim(),
    accountSource: String(row[colMap['Account / Source']] || '').trim(),
    cashFlowSheet: '',
    cashFlowMonth: '',
    dedupeKey: '',
    details: JSON.stringify(base)
  });
}

/**
 * Payment-applied lifecycle event for an Upcoming row. Non-monetary on the
 * Activity sheet (Amount = 0, rendered as "—"), because the actual money
 * movement lands in INPUT - Cash Flow via the normal quickAddPayment path
 * and is already logged there as a quick_pay row. The details JSON carries
 * the paid amount, previous/new remaining balance, and whether this payment
 * closed the item so the history stays reconstructable.
 */
function appendUpcomingActivityPayment_(ss, row, colMap, upcomingId, previousAmount, paidAmount, newRemaining, fullyPaid) {
  const dueIso = upcomingExpenseDueIsoForLog_(row, colMap);
  const tz = Session.getScriptTimeZone();
  const entryDate = dueIso || Utilities.formatDate(stripTime_(new Date()), tz, 'yyyy-MM-dd');
  const payee = upcomingExpenseRowPayeeForLog_(row, colMap);
  const base = upcomingExpenseBaseDetails_(row, colMap, upcomingId);
  base.previousAmount = round2_(toNumber_(previousAmount));
  base.paidAmount = round2_(toNumber_(paidAmount));
  base.remainingAfter = round2_(toNumber_(newRemaining));
  base.fullyPaid = !!fullyPaid;
  base.newStatus = fullyPaid ? 'Paid' : 'Planned';

  appendActivityLog_(ss, {
    eventType: 'upcoming_payment',
    entryDate: entryDate,
    amount: 0,
    direction: 'expense',
    payee: payee,
    category: String(row[colMap['Category']] || '').trim(),
    accountSource: String(row[colMap['Account / Source']] || '').trim(),
    cashFlowSheet: '',
    cashFlowMonth: '',
    dedupeKey: '',
    details: JSON.stringify(base)
  });
}

function getUpcomingExpensesUiData() {
  const sheet = getOrCreateUpcomingExpensesSheet_();
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) {
    return {
      expenses: [],
      summary: buildUpcomingExpensesSummary_([])
    };
  }

  const headers = display[0];
  const colMap = mapHeaders_(headers, [
    'ID',
    'Status',
    'Expense Name',
    'Category',
    'Payee',
    'Due Date',
    'Amount',
    'Account / Source',
    'Auto Add To Cash Flow',
    'Added To Cash Flow',
    'Notes'
  ]);

  const rows = [];

  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][colMap['ID']] || '').trim();
    const status = String(display[r][colMap['Status']] || '').trim() || 'Planned';
    const expenseName = String(display[r][colMap['Expense Name']] || '').trim();
    const category = String(display[r][colMap['Category']] || '').trim();
    const payee = String(display[r][colMap['Payee']] || '').trim();
    const dueDateRaw = values[r][colMap['Due Date']];
    const amount = round2_(toNumber_(values[r][colMap['Amount']]));
    const accountSource = String(display[r][colMap['Account / Source']] || '').trim();
    const autoAddToCashFlow = String(display[r][colMap['Auto Add To Cash Flow']] || '').trim() || 'No';
    const addedToCashFlow = String(display[r][colMap['Added To Cash Flow']] || '').trim() || 'No';
    const notes = String(display[r][colMap['Notes']] || '').trim();

    if (!id && !expenseName && !payee) continue;

    const dueDate = parseSheetDateToIso_(dueDateRaw);
    const dueDateObj = dueDate ? new Date(dueDate + 'T00:00:00') : null;

    rows.push({
      id: id,
      status: status,
      expenseName: expenseName,
      category: category,
      payee: payee,
      dueDate: dueDate,
      amount: amount,
      accountSource: accountSource,
      autoAddToCashFlow: autoAddToCashFlow,
      addedToCashFlow: addedToCashFlow,
      notes: notes,
      dayBucket: getUpcomingExpenseDayBucket_(dueDateObj, status)
    });
  }

  rows.sort(function(a, b) {
    const aRank = getUpcomingStatusRank_(a.status);
    const bRank = getUpcomingStatusRank_(b.status);
    if (aRank !== bRank) return aRank - bRank;

    const aBucketRank = getUpcomingBucketRank_(a.dayBucket);
    const bBucketRank = getUpcomingBucketRank_(b.dayBucket);
    if (aBucketRank !== bBucketRank) return aBucketRank - bBucketRank;

    const aTime = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    return String(a.expenseName || '').localeCompare(String(b.expenseName || ''));
  });

  return {
    expenses: rows,
    summary: buildUpcomingExpensesSummary_(rows)
  };
}

function addUpcomingExpense(payload) {
  validateRequired_(payload, ['expenseName', 'dueDate', 'amount']);

  const sheet = getOrCreateUpcomingExpensesSheet_();

  const expenseName = String(payload.expenseName || '').trim();
  const category = String(payload.category || '').trim();
  const payee = String(payload.payee || '').trim();
  const dueDate = parseIsoDateLocal_(payload.dueDate);
  const amount = round2_(toNumber_(payload.amount));
  const accountSource = String(payload.accountSource || '').trim();
  const notes = String(payload.notes || '').trim();
  const autoAddToCashFlow = payload.autoAddToCashFlow ? 'Yes' : 'No';

  if (!expenseName) throw new Error('Expense Name is required.');
  if (amount <= 0) throw new Error('Amount must be greater than 0.');

  const row = sheet.getLastRow() + 1;
  const id = 'UE-' + new Date().getTime();

  sheet.getRange(row, 1, 1, 11).setValues([[
    id,
    'Planned',
    expenseName,
    category,
    payee,
    stripTime_(dueDate),
    amount,
    accountSource,
    autoAddToCashFlow,
    'No',
    notes
  ]]);

  sheet.getRange(row, 6).setNumberFormat('yyyy-mm-dd');
  applyCurrencyFormat_(sheet.getRange(row, 7));

  touchDashboardSourceUpdated_('upcoming_expenses');

  const ss = sheet.getParent();
  const entryDateStr = Utilities.formatDate(stripTime_(dueDate), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const payeeForLog = payee || expenseName;
  const addDetails = {
    detailsVersion: 1,
    upcomingId: id,
    expenseName: expenseName,
    category: category,
    payee: payee,
    accountSource: accountSource,
    amount: amount,
    notes: notes,
    autoAddToCashFlow: autoAddToCashFlow,
    initialStatus: 'Planned'
  };

  appendActivityLog_(ss, {
    eventType: 'upcoming_add',
    entryDate: entryDateStr,
    amount: amount,
    direction: 'expense',
    payee: payeeForLog,
    category: category,
    accountSource: accountSource,
    cashFlowSheet: '',
    cashFlowMonth: '',
    dedupeKey: 'upcoming_add::' + id,
    details: JSON.stringify(addDetails)
  });

  return {
    ok: true,
    message: 'Upcoming expense added.'
  };
}

/**
 * Dismiss an Upcoming row — the soft-deactivate equivalent for Upcoming.
 * Preserves the sheet row and logs a non-monetary lifecycle event. Legacy
 * rows with Status = "Skipped" are treated as already-dismissed here so
 * repeated dismisses on historical data are a no-op instead of an error.
 */
function dismissUpcomingExpense(id) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Expense ID is required.');

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  const row = rowInfo.values;
  const colMap = rowInfo.colMap;
  const oldStatus = String(row[colMap['Status']] || '').trim() || 'Planned';

  if (oldStatus === 'Dismissed' || oldStatus === 'Skipped') {
    return {
      ok: true,
      message: 'Already dismissed.'
    };
  }

  if (oldStatus === 'Paid') {
    // Paid items are already off the active board; nothing to dismiss.
    return {
      ok: true,
      message: 'Already marked Paid — no dismiss needed.'
    };
  }

  rowInfo.sheet.getRange(rowInfo.row, colMap['Status'] + 1).setValue('Dismissed');
  touchDashboardSourceUpdated_('upcoming_expenses');

  const ss = rowInfo.sheet.getParent();
  appendUpcomingActivityStatus_(ss, row, colMap, String(row[colMap['ID']] || '').trim(), oldStatus, 'Dismissed', {});

  return {
    ok: true,
    message: 'Upcoming expense dismissed.'
  };
}

/**
 * Record a Quick Add payment against an Upcoming row. Subtracts paidAmount
 * from the row's remaining Amount (clamped at 0) and flips Status to "Paid"
 * when the row is fully covered, removing it from the active board. Partial
 * payments keep the row visible with the reduced remaining balance.
 *
 * The money movement itself is recorded by the normal quickAddPayment path
 * (quick_pay activity event). This function only updates Upcoming sheet
 * state and emits a non-monetary upcoming_payment lifecycle event so the
 * audit trail on the Activity sheet captures remaining-balance context
 * without double-counting dollars.
 */
function applyPaymentToUpcomingExpense(id, paidAmount) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Expense ID is required.');

  const paid = round2_(toNumber_(paidAmount));
  if (isNaN(paid) || paid <= 0) {
    throw new Error('Paid amount must be greater than 0.');
  }

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  const row = rowInfo.values;
  const sheet = rowInfo.sheet;
  const colMap = rowInfo.colMap;

  const currentStatus = String(row[colMap['Status']] || '').trim() || 'Planned';
  if (currentStatus !== 'Planned') {
    // Legacy Skipped / Dismissed / Paid rows should not be resurrected by a
    // stray Quick Add callback. Return a benign no-op so the Quick Add save
    // itself still completes cleanly.
    return {
      ok: true,
      message: 'Upcoming row is not active (' + currentStatus + ') — no balance change.',
      changed: false,
      fullyPaid: currentStatus === 'Paid',
      remainingAfter: round2_(toNumber_(row[colMap['Amount']]))
    };
  }

  const previousAmount = round2_(toNumber_(row[colMap['Amount']]));
  let newRemaining = round2_(previousAmount - paid);
  // Clamp sub-penny remainders to 0 so rounding drift can't leave a ghost
  // balance that would keep the row on the active board indefinitely.
  if (!isFinite(newRemaining) || newRemaining <= 0.005) newRemaining = 0;

  const fullyPaid = newRemaining <= 0;

  sheet.getRange(rowInfo.row, colMap['Amount'] + 1).setValue(newRemaining);
  applyCurrencyFormat_(sheet.getRange(rowInfo.row, colMap['Amount'] + 1));
  sheet.getRange(rowInfo.row, colMap['Added To Cash Flow'] + 1).setValue('Yes');

  if (fullyPaid) {
    sheet.getRange(rowInfo.row, colMap['Status'] + 1).setValue('Paid');
  }

  touchDashboardSourceUpdated_('upcoming_expenses');

  const ss = sheet.getParent();
  appendUpcomingActivityPayment_(
    ss,
    row,
    colMap,
    String(row[colMap['ID']] || '').trim(),
    previousAmount,
    paid,
    newRemaining,
    fullyPaid
  );

  return {
    ok: true,
    message: fullyPaid
      ? 'Upcoming expense fully paid.'
      : 'Partial payment applied. Remaining: ' + fmtMoneyForMessage_(newRemaining),
    changed: true,
    fullyPaid: fullyPaid,
    remainingAfter: newRemaining,
    previousAmount: previousAmount,
    paidAmount: paid
  };
}

/**
 * Edit a Planned Upcoming Expense from the dashboard. Mirrors
 * addUpcomingExpense's input contract but locates an existing row by ID
 * and only writes the 8 user-input columns. ID, Status, and Added To
 * Cash Flow are preserved verbatim so the existing payment-applied /
 * dismissed history stays consistent with the upcoming_payment /
 * upcoming_status lifecycle events.
 *
 * Refusal cases:
 *   - Missing ID / row not found → throws.
 *   - Status !== 'Planned'        → throws (Paid / Dismissed / Skipped
 *     rows are not editable; use the lifecycle paths to change them, or
 *     re-add a fresh upcoming row).
 *   - Validation failures (missing name / due date / amount, amount <= 0)
 *     mirror the messages addUpcomingExpense uses.
 *
 * No-change case:
 *   - When all 8 editable fields equal their existing values (after
 *     normalization), we return ok without writing the sheet, without
 *     bumping touchDashboardSourceUpdated_, and without adding a row to
 *     LOG - Activity. Saves an audit row + downstream consumer churn
 *     when the user opens Edit and clicks Save without changing
 *     anything.
 */
function updateUpcomingExpenseFromDashboard(payload) {
  validateRequired_(payload, ['id', 'expenseName', 'dueDate', 'amount']);

  const targetId = String(payload.id || '').trim();
  if (!targetId) throw new Error('Expense ID is required.');

  const expenseName = String(payload.expenseName || '').trim();
  if (!expenseName) throw new Error('Expense Name is required.');

  // Reuse the same parser the Add path uses so legacy / hand-edited
  // dueDate values still round-trip cleanly.
  const dueDateObj = parseIsoDateLocal_(payload.dueDate);

  const amount = round2_(toNumber_(payload.amount));
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0.');
  }

  const category = String(payload.category || '').trim();
  const payee = String(payload.payee || '').trim();
  const accountSource = String(payload.accountSource || '').trim();
  const notes = String(payload.notes || '').trim();
  const autoAddToCashFlow = payload.autoAddToCashFlow ? 'Yes' : 'No';

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  const row = rowInfo.values;
  const sheet = rowInfo.sheet;
  const colMap = rowInfo.colMap;

  const currentStatus = String(row[colMap['Status']] || '').trim() || 'Planned';
  if (currentStatus !== 'Planned') {
    throw new Error('Only active (Planned) upcoming expenses can be edited.');
  }

  // Snapshot previous values BEFORE we mutate. Due Date is normalized to
  // ISO so before/after string comparisons stay byte-stable regardless
  // of whether the sheet stored a Date object or a string.
  const previous = {
    expenseName: String(row[colMap['Expense Name']] || '').trim(),
    category: String(row[colMap['Category']] || '').trim(),
    payee: String(row[colMap['Payee']] || '').trim(),
    dueDate: parseSheetDateToIso_(row[colMap['Due Date']]),
    amount: round2_(toNumber_(row[colMap['Amount']])),
    accountSource: String(row[colMap['Account / Source']] || '').trim(),
    autoAddToCashFlow: String(row[colMap['Auto Add To Cash Flow']] || '').trim() || 'No',
    notes: String(row[colMap['Notes']] || '').trim()
  };

  const newDueDateIso = Utilities.formatDate(
    stripTime_(dueDateObj),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  const next = {
    expenseName: expenseName,
    category: category,
    payee: payee,
    dueDate: newDueDateIso,
    amount: amount,
    accountSource: accountSource,
    autoAddToCashFlow: autoAddToCashFlow,
    notes: notes
  };

  const changedFields = [];
  if (previous.expenseName !== next.expenseName) changedFields.push('expenseName');
  if (previous.category !== next.category) changedFields.push('category');
  if (previous.payee !== next.payee) changedFields.push('payee');
  if (previous.dueDate !== next.dueDate) changedFields.push('dueDate');
  if (previous.amount !== next.amount) changedFields.push('amount');
  if (previous.accountSource !== next.accountSource) changedFields.push('accountSource');
  if (previous.autoAddToCashFlow !== next.autoAddToCashFlow) changedFields.push('autoAddToCashFlow');
  if (previous.notes !== next.notes) changedFields.push('notes');

  if (changedFields.length === 0) {
    return {
      ok: true,
      message: 'No changes.',
      changedFields: []
    };
  }

  // Per-cell writes for the 8 editable columns. Each setValue is one
  // round-trip; for the typical 1-2 changed-field edit this is cheaper
  // than re-writing all 11 columns and avoids touching cells that didn't
  // change. ID / Status / Added To Cash Flow are intentionally never
  // written — they stay under the lifecycle paths' control.
  const sheetRow = rowInfo.row;
  if (previous.expenseName !== next.expenseName) {
    sheet.getRange(sheetRow, colMap['Expense Name'] + 1).setValue(next.expenseName);
  }
  if (previous.category !== next.category) {
    sheet.getRange(sheetRow, colMap['Category'] + 1).setValue(next.category);
  }
  if (previous.payee !== next.payee) {
    sheet.getRange(sheetRow, colMap['Payee'] + 1).setValue(next.payee);
  }
  if (previous.dueDate !== next.dueDate) {
    const dueRange = sheet.getRange(sheetRow, colMap['Due Date'] + 1);
    dueRange.setValue(stripTime_(dueDateObj));
    dueRange.setNumberFormat('yyyy-mm-dd');
  }
  if (previous.amount !== next.amount) {
    const amtRange = sheet.getRange(sheetRow, colMap['Amount'] + 1);
    amtRange.setValue(next.amount);
    applyCurrencyFormat_(amtRange);
  }
  if (previous.accountSource !== next.accountSource) {
    sheet.getRange(sheetRow, colMap['Account / Source'] + 1).setValue(next.accountSource);
  }
  if (previous.autoAddToCashFlow !== next.autoAddToCashFlow) {
    sheet.getRange(sheetRow, colMap['Auto Add To Cash Flow'] + 1).setValue(next.autoAddToCashFlow);
  }
  if (previous.notes !== next.notes) {
    sheet.getRange(sheetRow, colMap['Notes'] + 1).setValue(next.notes);
  }

  touchDashboardSourceUpdated_('upcoming_expenses');

  appendUpcomingActivityUpdate_(
    sheet.getParent(),
    targetId,
    previous,
    next,
    changedFields
  );

  return {
    ok: true,
    message: 'Upcoming expense updated.',
    changedFields: changedFields
  };
}

/**
 * Field-level edit lifecycle event for an Upcoming row. Non-monetary
 * (Amount = 0; Activity UI renders "—" via activityLogIsNonMonetaryEvent_)
 * because the edit doesn't move money — it only changes metadata on the
 * obligation. The previous + new snapshots cover all 8 editable fields
 * regardless of which actually changed, so a future undo tool can
 * reconstruct the prior state without re-deriving it from earlier rows.
 */
function appendUpcomingActivityUpdate_(ss, upcomingId, previous, next, changedFields) {
  // entryDate uses the new (post-edit) due date so the activity row
  // sorts alongside the edited obligation, mirroring addUpcomingExpense
  // / appendUpcomingActivityPayment_'s convention.
  const entryDate = String(next.dueDate || '').trim() ||
    Utilities.formatDate(stripTime_(new Date()), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  // payee on the activity row reflects the new value (or new Expense
  // Name as fallback) so the row's payee column matches what the user
  // just saved, not the pre-edit value.
  const payeeForLog =
    String(next.payee || '').trim() || String(next.expenseName || '').trim();

  const details = {
    detailsVersion: 1,
    upcomingId: String(upcomingId || '').trim(),
    expenseName: next.expenseName,
    payee: next.payee,
    changedFields: changedFields.slice(),
    previous: previous,
    new: next
  };

  appendActivityLog_(ss, {
    eventType: 'upcoming_update',
    entryDate: entryDate,
    amount: 0,
    direction: 'expense',
    payee: payeeForLog,
    category: next.category,
    accountSource: next.accountSource,
    cashFlowSheet: '',
    cashFlowMonth: '',
    dedupeKey: '',
    details: JSON.stringify(details)
  });
}

function fmtMoneyForMessage_(n) {
  const v = round2_(toNumber_(n));
  return '$' + (isNaN(v) ? '0.00' : v.toFixed(2));
}

/**
 * Prefill bundle consumed by Quick Add when launching a payment from an
 * Upcoming row. Includes the remaining balance as the suggested amount and
 * the upcomingId so Quick Add's save handler can call back into
 * applyPaymentToUpcomingExpense(). flowSource is only populated when the
 * Account / Source cell is an exact CASH / CREDIT_CARD match — free-text
 * source names are passed through as a display hint only (not a flowSource
 * value the backend would accept).
 */
function getUpcomingExpenseForQuickPayment(id) {
  const targetId = String(id || '').trim();
  if (!targetId) throw new Error('Expense ID is required.');

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  const row = rowInfo.values;
  const colMap = rowInfo.colMap;

  const payee = String(row[colMap['Payee']] || '').trim() || String(row[colMap['Expense Name']] || '').trim();
  const dueDate = row[colMap['Due Date']];
  const amount = round2_(toNumber_(row[colMap['Amount']]));
  const status = String(row[colMap['Status']] || '').trim() || 'Planned';
  const accountSource = String(row[colMap['Account / Source']] || '').trim();

  const normalizedSource = accountSource.toUpperCase().replace(/[\s-]+/g, '_');
  const flowSource =
    normalizedSource === 'CASH' ? 'CASH' :
    normalizedSource === 'CREDIT_CARD' ? 'CREDIT_CARD' :
    '';

  return {
    entryType: 'Expense',
    payee: payee,
    entryDate: dueDate ? Utilities.formatDate(new Date(dueDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    amount: amount,
    sourceStatus: status,
    accountSource: accountSource,
    flowSource: flowSource,
    upcomingId: targetId
  };
}

function getUpcomingExpenseMetrics_() {
  const data = getUpcomingExpensesUiData();
  const rows = data.expenses || [];
  const today = stripTime_(new Date());

  let overduePlannedCount = 0;
  let overduePlannedAmount = 0;
  let next7PlannedAmount = 0;
  let next30PlannedAmount = 0;
  let plannedTotalAmount = 0;

  rows.forEach(function(row) {
    if (row.status !== 'Planned') return;
    if (!row.dueDate) return;

    const due = new Date(row.dueDate + 'T00:00:00');
    const diff = daysBetween_(today, due);

    plannedTotalAmount += Number(row.amount || 0);

    if (diff < 0) {
      overduePlannedCount++;
      overduePlannedAmount += Number(row.amount || 0);
    }
    if (diff >= 0 && diff <= 7) {
      next7PlannedAmount += Number(row.amount || 0);
    }
    if (diff >= 0 && diff <= 30) {
      next30PlannedAmount += Number(row.amount || 0);
    }
  });

  return {
    overduePlannedCount: overduePlannedCount,
    overduePlannedAmount: round2_(overduePlannedAmount),
    next7PlannedAmount: round2_(next7PlannedAmount),
    next30PlannedAmount: round2_(next30PlannedAmount),
    plannedTotalAmount: round2_(plannedTotalAmount),
    rows: rows
  };
}

function getOrCreateUpcomingExpensesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'INPUT - Upcoming Expenses';
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);

  const headers = [[
    'ID',
    'Status',
    'Expense Name',
    'Category',
    'Payee',
    'Due Date',
    'Amount',
    'Account / Source',
    'Auto Add To Cash Flow',
    'Added To Cash Flow',
    'Notes'
  ]];

  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  sheet.getRange(1, 1, 1, headers[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Bounded number formats consistent with the other creators in the
  // workbook (Cash Flow, Bank Accounts, SYS - Accounts all scope
  // currency/date formats to `rows 2..maxRows`). Previously this used
  // whole-column `F:F` / `G:G` formats which produced the same visible
  // result but diverged structurally from sibling sheets. Visible
  // behavior is preserved because every row below the header gets the
  // same format.
  try {
    var maxRowsUpcoming = sheet.getMaxRows();
    if (maxRowsUpcoming > 1) {
      // Col F = Due Date, Col G = Amount (see headers array above).
      sheet.getRange(2, 6, maxRowsUpcoming - 1, 1).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(2, 7, maxRowsUpcoming - 1, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
    }
  } catch (_fmtErr) { /* cosmetic only */ }

  try {
    sheet.autoResizeColumns(1, headers[0].length);
  } catch (e) {}

  return sheet;
}

function findUpcomingExpenseRowById_(id) {
  const sheet = getOrCreateUpcomingExpensesSheet_();
  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();

  if (values.length < 2) return null;

  const headers = display[0];
  const colMap = mapHeaders_(headers, [
    'ID',
    'Status',
    'Expense Name',
    'Category',
    'Payee',
    'Due Date',
    'Amount',
    'Account / Source',
    'Auto Add To Cash Flow',
    'Added To Cash Flow',
    'Notes'
  ]);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][colMap['ID']] || '').trim() === id) {
      return {
        sheet: sheet,
        row: r + 1,
        values: values[r],
        colMap: colMap
      };
    }
  }

  return null;
}

function buildUpcomingExpensesSummary_(rows) {
  const today = stripTime_(new Date());
  let next7Count = 0;
  let next7Amount = 0;
  let next30Count = 0;
  let next30Amount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let plannedCount = 0;
  let plannedAmount = 0;

  rows.forEach(function(row) {
    if (row.status !== 'Planned') return;
    if (!row.dueDate) return;

    plannedCount++;
    plannedAmount += Number(row.amount || 0);

    const due = new Date(row.dueDate + 'T00:00:00');
    const diff = daysBetween_(today, due);

    if (diff < 0) {
      overdueCount++;
      overdueAmount += Number(row.amount || 0);
    }
    if (diff >= 0 && diff <= 7) {
      next7Count++;
      next7Amount += Number(row.amount || 0);
    }
    if (diff >= 0 && diff <= 30) {
      next30Count++;
      next30Amount += Number(row.amount || 0);
    }
  });

  return {
    next7Count: next7Count,
    next7Amount: round2_(next7Amount),
    next30Count: next30Count,
    next30Amount: round2_(next30Amount),
    overdueCount: overdueCount,
    overdueAmount: round2_(overdueAmount),
    plannedCount: plannedCount,
    plannedAmount: round2_(plannedAmount)
  };
}

function getUpcomingExpenseDayBucket_(dueDateObj, status) {
  if (!dueDateObj || isNaN(dueDateObj.getTime())) return 'No Date';
  if (status !== 'Planned') return status;

  const today = stripTime_(new Date());
  const diff = daysBetween_(today, dueDateObj);

  if (diff < 0) return 'Overdue';
  if (diff === 0) return 'Today';
  if (diff <= 7) return 'Next 7 Days';
  if (diff <= 30) return 'This Month';
  return 'Later';
}

function getUpcomingStatusRank_(status) {
  if (status === 'Planned') return 0;
  if (status === 'Paid') return 1;
  // Skipped is a legacy value; treat it identically to Dismissed for sort.
  if (status === 'Dismissed' || status === 'Skipped') return 2;
  return 9;
}

function getUpcomingBucketRank_(bucket) {
  if (bucket === 'Overdue') return 0;
  if (bucket === 'Today') return 1;
  if (bucket === 'Next 7 Days') return 2;
  if (bucket === 'This Month') return 3;
  if (bucket === 'Later') return 4;
  if (bucket === 'Paid') return 5;
  if (bucket === 'Dismissed' || bucket === 'Skipped') return 6;
  return 9;
}

function parseSheetDateToIso_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value || '').trim();
  if (!text) return '';

  const d = new Date(text);
  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function mapHeaders_(headers, requiredHeaders) {
  const map = {};
  requiredHeaders.forEach(function(h) {
    const idx = headers.indexOf(h);
    if (idx === -1) throw new Error('Missing required header: ' + h);
    map[h] = idx;
  });
  return map;
}