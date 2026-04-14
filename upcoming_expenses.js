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
  const amt = round2_(toNumber_(row[colMap['Amount']]));
  const base = upcomingExpenseBaseDetails_(row, colMap, upcomingId);
  base.previousStatus = String(previousStatus || '').trim();
  base.newStatus = String(newStatus || '').trim();
  if (extraDetails && typeof extraDetails === 'object') {
    Object.keys(extraDetails).forEach(function(k) {
      base[k] = extraDetails[k];
    });
  }

  appendActivityLog_(ss, {
    eventType: 'upcoming_status',
    entryDate: entryDate,
    amount: amt,
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

function updateUpcomingExpenseStatus(id, status) {
  const targetId = String(id || '').trim();
  const newStatus = String(status || '').trim();

  if (!targetId) throw new Error('Expense ID is required.');
  if (['Planned', 'Paid', 'Skipped'].indexOf(newStatus) === -1) {
    throw new Error('Status must be Planned, Paid, or Skipped.');
  }

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  const row = rowInfo.values;
  const colMap = rowInfo.colMap;
  const oldStatus = String(row[colMap['Status']] || '').trim() || 'Planned';
  if (oldStatus === newStatus) {
    return {
      ok: true,
      message: 'Status is already ' + newStatus + '.'
    };
  }

  if (newStatus === 'Paid') {
    return markUpcomingExpensePaid_(rowInfo);
  }

  rowInfo.sheet.getRange(rowInfo.row, rowInfo.colMap['Status'] + 1).setValue(newStatus);
  touchDashboardSourceUpdated_('upcoming_expenses');

  const ss = rowInfo.sheet.getParent();
  appendUpcomingActivityStatus_(ss, row, colMap, String(row[colMap['ID']] || '').trim(), oldStatus, newStatus, {});

  return {
    ok: true,
    message: 'Upcoming expense status updated to ' + newStatus + '.'
  };
}

function markUpcomingExpensePaid_(rowInfo) {
  const row = rowInfo.values;
  const sheet = rowInfo.sheet;
  const colMap = rowInfo.colMap;

  const currentStatus = String(row[colMap['Status']] || '').trim() || 'Planned';
  const addedToCashFlow = String(row[colMap['Added To Cash Flow']] || '').trim() || 'No';

  if (currentStatus === 'Skipped') {
    throw new Error('Skipped expense cannot be marked paid.');
  }

  if (currentStatus === 'Paid') {
    return {
      ok: true,
      message: 'Already marked Paid.'
    };
  }

  let cashFlowMessage = '';
  let pushedToCashFlowThisAction = false;

  if (addedToCashFlow !== 'Yes') {
    const result = addUpcomingExpenseRowToCashFlow_(rowInfo);
    cashFlowMessage = result && result.message ? result.message : '';
    pushedToCashFlowThisAction = !!(result && result.wroteCashFlow);
  }

  sheet.getRange(rowInfo.row, colMap['Status'] + 1).setValue('Paid');
  touchDashboardSourceUpdated_('upcoming_expenses');

  const ss = sheet.getParent();
  appendUpcomingActivityStatus_(ss, row, colMap, String(row[colMap['ID']] || '').trim(), currentStatus, 'Paid', {
    pushedToCashFlowThisAction: pushedToCashFlowThisAction
  });

  return {
    ok: true,
    message: cashFlowMessage
      ? 'Upcoming expense marked Paid.\n' + cashFlowMessage
      : 'Upcoming expense marked Paid.'
  };
}

function addUpcomingExpenseToCashFlow(expenseId) {
  const targetId = String(expenseId || '').trim();
  if (!targetId) throw new Error('Expense ID is required.');

  const rowInfo = findUpcomingExpenseRowById_(targetId);
  if (!rowInfo) throw new Error('Upcoming expense not found: ' + targetId);

  return addUpcomingExpenseRowToCashFlow_(rowInfo);
}

function addUpcomingExpenseRowToCashFlow_(rowInfo) {
  const row = rowInfo.values;
  const sheet = rowInfo.sheet;
  const colMap = rowInfo.colMap;

  const status = String(row[colMap['Status']] || '').trim() || 'Planned';
  const payee = String(row[colMap['Payee']] || '').trim() || String(row[colMap['Expense Name']] || '').trim();
  const dueDate = row[colMap['Due Date']];
  const amount = round2_(toNumber_(row[colMap['Amount']]));
  const addedToCashFlow = String(row[colMap['Added To Cash Flow']] || '').trim() || 'No';

  if (!payee) throw new Error('Upcoming expense must have a Payee or Expense Name.');
  if (status === 'Skipped') throw new Error('Skipped expense cannot be added to cash flow.');
  if (addedToCashFlow === 'Yes') {
    return {
      ok: true,
      message: 'Already added to cash flow.',
      wroteCashFlow: false
    };
  }
  if (!dueDate || isNaN(new Date(dueDate).getTime())) throw new Error('Upcoming expense has invalid Due Date.');
  if (amount <= 0) throw new Error('Upcoming expense amount must be greater than 0.');

  const ss = sheet.getParent();
  const upcomingId = String(row[colMap['ID']] || '').trim();

  const result = quickAddPayment({
    entryType: 'Expense',
    payee: payee,
    entryDate: Utilities.formatDate(new Date(dueDate), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    amount: amount,
    createIfMissing: true,
    suppressActivityLog: true
  });

  const snap = result && result.activitySnapshot;
  if (!snap) {
    throw new Error('Quick add did not return activity data for the activity log.');
  }

  sheet.getRange(rowInfo.row, colMap['Added To Cash Flow'] + 1).setValue('Yes');
  touchDashboardSourceUpdated_('upcoming_expenses');

  if (typeof runDebtPlanner === 'function') runDebtPlanner();

  const cfDetails = {
    detailsVersion: 1,
    upcomingId: upcomingId,
    expenseName: String(row[colMap['Expense Name']] || '').trim(),
    source: 'INPUT - Upcoming Expenses',
    previousValue: snap.previousValue,
    newValue: snap.newValue,
    signedAmount: snap.signedAmount,
    createIfMissing: snap.createIfMissing,
    debtBalanceNote: snap.debtBalanceNote
  };

  appendActivityLog_(ss, {
    eventType: 'upcoming_cashflow',
    entryDate: snap.entryDate,
    amount: snap.amount,
    direction: 'expense',
    payee: snap.payee,
    category: String(row[colMap['Category']] || '').trim(),
    accountSource: String(row[colMap['Account / Source']] || '').trim(),
    cashFlowSheet: snap.cashFlowSheet,
    cashFlowMonth: snap.cashFlowMonth,
    dedupeKey: 'upcoming_cf::' + upcomingId + '::' + String(snap.entryDate || '').trim(),
    details: JSON.stringify(cfDetails)
  });

  return {
    ok: true,
    message: 'Added to cash flow.\n' + (result && result.message ? result.message : ''),
    wroteCashFlow: true
  };
}

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

  return {
    entryType: 'Expense',
    payee: payee,
    entryDate: dueDate ? Utilities.formatDate(new Date(dueDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    amount: amount,
    sourceStatus: status
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
  sheet.getRange('F:F').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('G:G').setNumberFormat('$#,##0.00;-$#,##0.00');

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
  if (status === 'Skipped') return 2;
  return 9;
}

function getUpcomingBucketRank_(bucket) {
  if (bucket === 'Overdue') return 0;
  if (bucket === 'Today') return 1;
  if (bucket === 'Next 7 Days') return 2;
  if (bucket === 'This Month') return 3;
  if (bucket === 'Later') return 4;
  if (bucket === 'Paid') return 5;
  if (bucket === 'Skipped') return 6;
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