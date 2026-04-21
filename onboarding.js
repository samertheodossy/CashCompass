/**
 * Onboarding Phase 1 — shared step shell + status readers.
 *
 * Design contract:
 *   - Read-first. Opening any step MUST NOT mutate sheets, write SYS rows,
 *     write to Activity, or touch Cash Flow. Pure inspection.
 *   - Two paths: "normal" (live sheets) and "test" (TEST - * sheets only).
 *   - Sheet names are resolved centrally through `resolveOnboardingSheetName_`
 *     so the onboarding flow never issues hardcoded `getSheetByName` against
 *     live names in test mode.
 *   - Income continues to be Cash Flow-driven. There is NO
 *     INPUT - Income Sources sheet and the probe must never re-introduce it.
 *   - Existing users who never open onboarding see no behavior change:
 *     nothing here is invoked at dashboard init, the Setup page is on-demand.
 */

/* -------------------------------------------------------------------------- */
/*  Sheet-name routing layer                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Canonical *live* names for sheets onboarding cares about. This is a local
 * copy of the subset of `getSheetNames_()` that onboarding touches, plus the
 * two names (Upcoming Expenses, LOG - Activity) that are owned outside
 * `config.js`. Keeping this map local and narrow is deliberate — we do not
 * want onboarding to accidentally grow jurisdiction over sheets it was never
 * designed to handle (OUT - Dashboard, SYS - Accounts, HOUSES - ...).
 */
var ONBOARDING_LIVE_SHEET_NAMES_ = {
  BANK_ACCOUNTS: 'INPUT - Bank Accounts',
  DEBTS: 'INPUT - Debts',
  BILLS: 'INPUT - Bills',
  UPCOMING: 'INPUT - Upcoming Expenses',
  CASH_FLOW_PREFIX: 'INPUT - Cash Flow ',
  ACTIVITY_LOG: 'LOG - Activity'
};

var ONBOARDING_TEST_PREFIX_ = 'TEST - ';

/**
 * Normalize an incoming mode string ('normal' | 'test'). Unknown / blank /
 * null values collapse to 'normal' so a bad query string can never silently
 * bind onboarding to test sheets.
 */
function normalizeOnboardingMode_(mode) {
  var m = String(mode || '').trim().toLowerCase();
  if (m === 'test') return 'test';
  return 'normal';
}

/**
 * Resolve a canonical sheet key to the actual sheet name for the requested
 * mode. For Cash Flow, pass the year as the third argument.
 *
 * @param {string} mode 'normal' or 'test'
 * @param {string} key  One of ONBOARDING_LIVE_SHEET_NAMES_ keys.
 * @param {number|string=} year Only used for CASH_FLOW_PREFIX.
 * @returns {string}
 */
function resolveOnboardingSheetName_(mode, key, year) {
  var live = ONBOARDING_LIVE_SHEET_NAMES_[key];
  if (!live) throw new Error('Unknown onboarding sheet key: ' + key);
  var base = live;
  if (key === 'CASH_FLOW_PREFIX') {
    if (year === undefined || year === null || year === '') {
      throw new Error('CASH_FLOW_PREFIX requires a year.');
    }
    base = live + String(year);
  }
  if (normalizeOnboardingMode_(mode) === 'test') return ONBOARDING_TEST_PREFIX_ + base;
  return base;
}

/**
 * Read-only: return the sheet if it exists, else null. Never throws.
 * Deliberately does not use `getSheet_` because that throws on missing
 * sheets — and onboarding status MUST treat missing as "Missing", not as
 * a fatal error.
 */
function getOnboardingSheet_(ss, mode, key, year) {
  var name = resolveOnboardingSheetName_(mode, key, year);
  return ss.getSheetByName(name) || null;
}

/* -------------------------------------------------------------------------- */
/*  Status probes (read-only per entity)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Shape returned by every probe:
 *   {
 *     status: 'complete' | 'partial' | 'missing',
 *     count: number,          // active rows that look usable
 *     partialCount: number,   // active rows with a missing key field
 *     sheetExists: boolean,
 *     sheetName: string,
 *     note: string            // user-facing hint
 *   }
 */

function emptyProbeResult_(mode, key, extra) {
  var name;
  try {
    name = resolveOnboardingSheetName_(mode, key, extra && extra.year);
  } catch (e) {
    name = '';
  }
  return {
    status: 'missing',
    count: 0,
    partialCount: 0,
    sheetExists: false,
    sheetName: name,
    note: extra && extra.note ? extra.note : 'No data yet.'
  };
}

/** Lowercased set of header strings for case-insensitive lookup. */
function buildHeaderIndex_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    var label = String(headerRow[i] || '').trim().toLowerCase();
    if (label) map[label] = i;
  }
  return map;
}

function headerIndexCI_(map, label) {
  var k = String(label || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : -1;
}

/**
 * Bank Accounts probe. Reads the year block for the current year on
 * INPUT - Bank Accounts and the Account Name column on SYS - Accounts is
 * NOT inspected here — onboarding never touches SYS.
 *
 * Complete: at least one active account name in the current-year block.
 * Partial : active names exist but lack Type / Use Policy signal on SYS is
 *           not inspected; we instead look for at least one name row
 *           without any non-blank month value as a proxy for "key data
 *           missing". This is intentionally conservative — the point is
 *           to surface partial states without reading SYS.
 * Missing : sheet missing or no account rows.
 */
function probeBankAccountsStatus_(ss, mode) {
  var sheet = getOnboardingSheet_(ss, mode, 'BANK_ACCOUNTS');
  if (!sheet) return emptyProbeResult_(mode, 'BANK_ACCOUNTS', { note: 'Bank Accounts sheet not found.' });

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    return emptyProbeResult_(mode, 'BANK_ACCOUNTS', { note: 'Could not read sheet.' });
  }
  if (display.length < 2) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Sheet exists but has no rows yet.'
    };
  }

  var currentYear = getCurrentYear_();
  var yearRow = -1;
  for (var r = 0; r < display.length; r++) {
    var colA = String(display[r][0] || '').trim();
    var colB = String(display[r][1] || '').trim();
    if (colA === 'Year' && colB === String(currentYear)) {
      yearRow = r;
      break;
    }
  }

  if (yearRow === -1) {
    // Fall back to scanning every row — some workbooks only have the
    // previous year's block set up. We still count account-name rows so
    // "Partial" surfaces instead of "Missing" when there is history.
    var anyName = 0;
    for (var r2 = 1; r2 < display.length; r2++) {
      var name = String(display[r2][0] || '').trim();
      if (!name) continue;
      if (name === 'Year' || name === 'Account Name' || name === 'Total Accounts' || name === 'Delta') continue;
      anyName++;
    }
    return {
      status: anyName > 0 ? 'partial' : 'missing',
      count: anyName,
      partialCount: anyName,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: anyName > 0
        ? 'Historical accounts detected but no ' + currentYear + ' block yet.'
        : 'No accounts tracked.'
    };
  }

  // Walk the block looking for data rows (names that are not reserved
  // labels) and whether at least one month cell has any content.
  var headerRowIdx = yearRow + 1;
  var dataStart = headerRowIdx + 1;
  var complete = 0;
  var partial = 0;
  for (var r3 = dataStart; r3 < display.length; r3++) {
    var name3 = String(display[r3][0] || '').trim();
    if (!name3) continue;
    if (name3 === 'Total Accounts' || name3 === 'Delta' || name3 === 'Year') break;
    if (name3 === 'Account Name') continue;

    var hasAnyMonthValue = false;
    for (var c = 1; c < display[r3].length; c++) {
      var v = String(display[r3][c] || '').trim();
      if (v) { hasAnyMonthValue = true; break; }
    }

    if (hasAnyMonthValue) complete++;
    else partial++;
  }

  var total = complete + partial;
  if (total === 0) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'No accounts in the ' + currentYear + ' block yet.'
    };
  }

  return {
    status: complete > 0 && partial === 0 ? 'complete' : (complete > 0 ? 'partial' : 'partial'),
    count: total,
    partialCount: partial,
    sheetExists: true,
    sheetName: sheet.getName(),
    note: complete + ' with balance · ' + partial + ' without'
  };
}

/**
 * Debts probe. Requires Account Name, Account Balance, Minimum Payment for
 * "complete". Active column is optional (blank treated as active, matching
 * the sheet readers elsewhere).
 */
function probeDebtsStatus_(ss, mode) {
  var sheet = getOnboardingSheet_(ss, mode, 'DEBTS');
  if (!sheet) return emptyProbeResult_(mode, 'DEBTS', { note: 'Debts sheet not found.' });

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    return emptyProbeResult_(mode, 'DEBTS', { note: 'Could not read sheet.' });
  }
  if (display.length < 2) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Sheet exists but has no rows yet.'
    };
  }

  var headerMap = buildHeaderIndex_(display[0]);
  var nameIdx = headerIndexCI_(headerMap, 'Account Name');
  var balanceIdx = headerIndexCI_(headerMap, 'Account Balance');
  var minPayIdx = headerIndexCI_(headerMap, 'Minimum Payment');
  var activeIdx = headerIndexCI_(headerMap, 'Active');

  if (nameIdx === -1) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Debts sheet is missing the Account Name column.'
    };
  }

  var complete = 0;
  var partial = 0;
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][nameIdx] || '').trim();
    if (!name) continue;
    if (name.toLowerCase() === 'total debt') continue;
    if (activeIdx !== -1) {
      var act = String(display[r][activeIdx] || '').trim();
      if (act && normalizeYesNo_(act) === 'no') continue;
    }

    var hasBalance = balanceIdx !== -1 && String(display[r][balanceIdx] || '').trim() !== '';
    var hasMin = minPayIdx !== -1 && String(display[r][minPayIdx] || '').trim() !== '';

    if (hasBalance && hasMin) complete++;
    else partial++;
  }

  var total = complete + partial;
  if (total === 0) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'No active debts tracked.'
    };
  }

  return {
    status: partial === 0 ? 'complete' : (complete > 0 ? 'partial' : 'partial'),
    count: total,
    partialCount: partial,
    sheetExists: true,
    sheetName: sheet.getName(),
    note: complete + ' with balance + min payment · ' + partial + ' with missing fields'
  };
}

/**
 * Bills probe. Requires Payee, Default Amount, Due Day for "complete".
 */
function probeBillsStatus_(ss, mode) {
  var sheet = getOnboardingSheet_(ss, mode, 'BILLS');
  if (!sheet) return emptyProbeResult_(mode, 'BILLS', { note: 'Bills sheet not found.' });

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    return emptyProbeResult_(mode, 'BILLS', { note: 'Could not read sheet.' });
  }
  if (display.length < 2) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Sheet exists but has no rows yet.'
    };
  }

  var headerMap = buildHeaderIndex_(display[0]);
  var payeeIdx = headerIndexCI_(headerMap, 'Payee');
  var amountIdx = headerIndexCI_(headerMap, 'Default Amount');
  var dueDayIdx = headerIndexCI_(headerMap, 'Due Day');
  var frequencyIdx = headerIndexCI_(headerMap, 'Frequency');
  var activeIdx = headerIndexCI_(headerMap, 'Active');

  if (payeeIdx === -1) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Bills sheet is missing the Payee column.'
    };
  }

  var complete = 0;
  var partial = 0;
  for (var r = 1; r < display.length; r++) {
    var payee = String(display[r][payeeIdx] || '').trim();
    if (!payee) continue;
    if (activeIdx !== -1) {
      var act = String(display[r][activeIdx] || '').trim();
      if (act && normalizeYesNo_(act) === 'no') continue;
    }

    var hasAmt = amountIdx !== -1 && String(display[r][amountIdx] || '').trim() !== '';
    var hasDueDay = dueDayIdx !== -1 && String(display[r][dueDayIdx] || '').trim() !== '';
    var hasFreq = frequencyIdx === -1 || String(display[r][frequencyIdx] || '').trim() !== '';

    if (hasAmt && hasDueDay && hasFreq) complete++;
    else partial++;
  }

  var total = complete + partial;
  if (total === 0) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'No active bills tracked.'
    };
  }

  return {
    status: partial === 0 ? 'complete' : 'partial',
    count: total,
    partialCount: partial,
    sheetExists: true,
    sheetName: sheet.getName(),
    note: complete + ' with amount + due info · ' + partial + ' with missing fields'
  };
}

/**
 * Upcoming probe. Needs Expense Name, Amount, Due Date. Only Planned rows
 * count — Paid / Dismissed rows are history.
 */
function probeUpcomingStatus_(ss, mode) {
  var sheet = getOnboardingSheet_(ss, mode, 'UPCOMING');
  if (!sheet) return emptyProbeResult_(mode, 'UPCOMING', { note: 'Upcoming Expenses sheet not found.' });

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    return emptyProbeResult_(mode, 'UPCOMING', { note: 'Could not read sheet.' });
  }
  if (display.length < 2) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'Sheet exists but has no rows yet.'
    };
  }

  var headerMap = buildHeaderIndex_(display[0]);
  var nameIdx = headerIndexCI_(headerMap, 'Expense Name');
  var amountIdx = headerIndexCI_(headerMap, 'Amount');
  var dueIdx = headerIndexCI_(headerMap, 'Due Date');
  var statusIdx = headerIndexCI_(headerMap, 'Status');
  var payeeIdx = headerIndexCI_(headerMap, 'Payee');

  var complete = 0;
  var partial = 0;
  for (var r = 1; r < display.length; r++) {
    var rowStatus = statusIdx !== -1 ? String(display[r][statusIdx] || '').trim().toLowerCase() : '';
    if (rowStatus && rowStatus !== 'planned') continue;

    var name = nameIdx !== -1 ? String(display[r][nameIdx] || '').trim() : '';
    var payee = payeeIdx !== -1 ? String(display[r][payeeIdx] || '').trim() : '';
    if (!name && !payee) continue;

    var hasAmt = amountIdx !== -1 && String(display[r][amountIdx] || '').trim() !== '';
    var hasDue = dueIdx !== -1 && String(display[r][dueIdx] || '').trim() !== '';

    if (hasAmt && hasDue) complete++;
    else partial++;
  }

  var total = complete + partial;
  if (total === 0) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: sheet.getName(),
      note: 'No planned upcoming items.'
    };
  }

  return {
    status: partial === 0 ? 'complete' : 'partial',
    count: total,
    partialCount: partial,
    sheetExists: true,
    sheetName: sheet.getName(),
    note: complete + ' with amount + date · ' + partial + ' with missing fields'
  };
}

/**
 * Income probe. Cash Flow-driven. Complete = at least one recurring
 * income group detected via the existing grouping logic. Partial = only
 * non-recurring / excluded income is visible. Missing = no Cash Flow
 * income rows at all.
 */
function probeIncomeStatus_(ss, mode) {
  var currentYear = getCurrentYear_();
  var cashFlowName = resolveOnboardingSheetName_(mode, 'CASH_FLOW_PREFIX', currentYear);
  var cashFlowSheet = ss.getSheetByName(cashFlowName);

  if (!cashFlowSheet) {
    // Walk back one year for test mode, since a fresh TEST - INPUT - Cash
    // Flow <year> might not exist yet and we still want a meaningful
    // state rather than a hard error.
    cashFlowSheet = ss.getSheetByName(
      resolveOnboardingSheetName_(mode, 'CASH_FLOW_PREFIX', currentYear - 1)
    );
  }

  if (!cashFlowSheet) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: false,
      sheetName: cashFlowName,
      note: 'Cash Flow sheet for ' + currentYear + ' not found.'
    };
  }

  var headerMap;
  try {
    headerMap = getCashFlowHeaderMap_(cashFlowSheet);
  } catch (e) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: cashFlowSheet.getName(),
      note: 'Cash Flow header row is malformed.'
    };
  }

  var display = cashFlowSheet.getDataRange().getDisplayValues();
  var recurringNames = {};
  var otherNames = {};

  // Collect active Income payees and approximate months seen per group.
  // We mirror the existing income grouping rules (normalizeIncomeName_
  // + incomeIsExcludedName_) without importing the heavier analysis
  // machinery; this keeps the onboarding probe cheap.
  var groupMonths = {};
  var monthCols = [];
  for (var c = 0; c < display[0].length; c++) {
    var hdr = String(display[0][c] || '').trim();
    if (/^[A-Za-z]{3}-\d{2}$/.test(hdr)) monthCols.push(c);
  }

  for (var r = 1; r < display.length; r++) {
    var row = display[r] || [];
    var type = String(row[headerMap.typeColZero] || '').trim().toLowerCase();
    if (type !== 'income') continue;
    if (headerMap.activeColZero !== -1) {
      var act = String(row[headerMap.activeColZero] || '').trim();
      if (act && normalizeYesNo_(act) === 'no') continue;
    }
    var payee = String(row[headerMap.payeeColZero] || '').trim();
    if (!payee) continue;
    var normalized = normalizeIncomeName_(payee);
    var excluded = incomeIsExcludedName_(normalized);
    if (!groupMonths[normalized]) {
      groupMonths[normalized] = { months: 0, excluded: excluded };
    }
    var monthsHit = 0;
    for (var m = 0; m < monthCols.length; m++) {
      var v = toNumber_(row[monthCols[m]]);
      if (isFinite(v) && v > 0) monthsHit++;
    }
    groupMonths[normalized].months = Math.max(groupMonths[normalized].months, monthsHit);
  }

  var recurringCount = 0;
  var otherCount = 0;
  for (var gname in groupMonths) {
    if (!Object.prototype.hasOwnProperty.call(groupMonths, gname)) continue;
    var g = groupMonths[gname];
    if (!g.excluded && g.months >= 3) {
      recurringCount++;
      recurringNames[gname] = true;
    } else if (g.months > 0) {
      otherCount++;
      otherNames[gname] = true;
    }
  }

  if (recurringCount === 0 && otherCount === 0) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: cashFlowSheet.getName(),
      note: 'No income detected on ' + cashFlowSheet.getName() + '.'
    };
  }

  return {
    status: recurringCount > 0 ? 'complete' : 'partial',
    count: recurringCount + otherCount,
    partialCount: otherCount,
    sheetExists: true,
    sheetName: cashFlowSheet.getName(),
    note: recurringCount + ' recurring · ' + otherCount + ' other detected'
  };
}

/* -------------------------------------------------------------------------- */
/*  Dashboard-facing status endpoint                                          */
/* -------------------------------------------------------------------------- */

/**
 * Top-level read API for the onboarding UI. Returns a shape the client
 * can render directly. Safe for existing users: this reads live sheets
 * only when mode === 'normal', and NEVER writes anywhere.
 *
 * @param {string=} mode 'normal' (default) or 'test'
 */
function getOnboardingStatusFromDashboard(mode) {
  var ctxMode = normalizeOnboardingMode_(mode);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var bank = probeBankAccountsStatus_(ss, ctxMode);
  var debts = probeDebtsStatus_(ss, ctxMode);
  var bills = probeBillsStatus_(ss, ctxMode);
  var upcoming = probeUpcomingStatus_(ss, ctxMode);
  var income = probeIncomeStatus_(ss, ctxMode);

  var steps = [
    { key: 'bank', label: 'Bank Accounts', state: bank },
    { key: 'debts', label: 'Debts', state: debts },
    { key: 'bills', label: 'Bills', state: bills },
    { key: 'upcoming', label: 'Upcoming Expenses', state: upcoming },
    { key: 'income', label: 'Income', state: income }
  ];

  var missingTestSheets = [];
  if (ctxMode === 'test') {
    ['BANK_ACCOUNTS', 'DEBTS', 'BILLS', 'UPCOMING'].forEach(function(key) {
      var name = resolveOnboardingSheetName_(ctxMode, key);
      if (!ss.getSheetByName(name)) missingTestSheets.push(name);
    });
    var currentYear = getCurrentYear_();
    var cfName = resolveOnboardingSheetName_(ctxMode, 'CASH_FLOW_PREFIX', currentYear);
    if (!ss.getSheetByName(cfName)) missingTestSheets.push(cfName);
    var activityName = resolveOnboardingSheetName_(ctxMode, 'ACTIVITY_LOG');
    if (!ss.getSheetByName(activityName)) missingTestSheets.push(activityName);
  }

  return {
    mode: ctxMode,
    testBanner: ctxMode === 'test' ? 'TEST MODE — using TEST sheets only' : '',
    missingTestSheets: missingTestSheets,
    steps: steps.map(function(s) {
      return {
        key: s.key,
        label: s.label,
        status: s.state.status,
        count: s.state.count,
        partialCount: s.state.partialCount,
        sheetExists: s.state.sheetExists,
        sheetName: s.state.sheetName,
        note: s.state.note
      };
    })
  };
}

/* -------------------------------------------------------------------------- */
/*  Per-step detail readers (read-only)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Bank Accounts detail view for the onboarding Bank Accounts step.
 *
 * Read-only. Uses the shared resolver so TEST mode stays isolated to
 * TEST - INPUT - Bank Accounts. Does NOT touch SYS - Accounts — onboarding
 * deliberately stays away from SYS, so buffer / Use Policy / Type are
 * not included here. Those remain owned by the Assets → Bank Accounts
 * surface and will be surfaced separately in a later pass if needed.
 *
 * Returns a flat shape the client can render without further parsing:
 *   {
 *     mode, sheetName, sheetExists,
 *     year,                         // current year
 *     yearBlockFound,               // did we find a block for `year`
 *     accounts: [
 *       { name, latestMonth, latestBalance, hasAnyBalance }
 *     ],
 *     status,                       // 'complete' | 'partial' | 'missing'
 *     statusNote,
 *     testBanner
 *   }
 */
function getOnboardingBankAccountsFromDashboard(mode) {
  var ctxMode = normalizeOnboardingMode_(mode);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = resolveOnboardingSheetName_(ctxMode, 'BANK_ACCOUNTS');
  var sheet = ss.getSheetByName(sheetName);
  var currentYear = getCurrentYear_();

  var base = {
    mode: ctxMode,
    sheetName: sheetName,
    sheetExists: !!sheet,
    year: currentYear,
    yearBlockFound: false,
    accounts: [],
    status: 'missing',
    statusNote: '',
    testBanner: ctxMode === 'test' ? 'TEST MODE — using TEST sheets only' : ''
  };

  if (!sheet) {
    base.statusNote = 'Bank Accounts sheet not found.';
    return base;
  }

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    base.statusNote = 'Could not read Bank Accounts sheet.';
    return base;
  }
  if (display.length < 2) {
    base.statusNote = 'Sheet exists but has no rows yet.';
    return base;
  }

  // Locate the current-year block. If absent, we still return whatever
  // account names show up outside a year block so the user gets a clear
  // "historical but not set up for this year" signal rather than an empty
  // screen.
  var yearRow = -1;
  for (var r = 0; r < display.length; r++) {
    var colA = String(display[r][0] || '').trim();
    var colB = String(display[r][1] || '').trim();
    if (colA === 'Year' && colB === String(currentYear)) {
      yearRow = r;
      break;
    }
  }

  if (yearRow === -1) {
    var historic = [];
    for (var r2 = 1; r2 < display.length; r2++) {
      var name2 = String(display[r2][0] || '').trim();
      if (!isOnboardingBankAccountNameRow_(name2)) continue;
      historic.push({ name: name2, latestMonth: '', latestBalance: '', hasAnyBalance: false });
    }
    base.accounts = historic;
    base.status = historic.length > 0 ? 'partial' : 'missing';
    base.statusNote = historic.length > 0
      ? 'Historical accounts detected but no ' + currentYear + ' block yet.'
      : 'No accounts tracked.';
    return base;
  }

  base.yearBlockFound = true;

  // The row right after "Year <year>" is the month header row for that
  // block (Jan, Feb, ..., Dec, Total). We capture the month labels so we
  // can surface the most recent non-blank month per account.
  var monthHeaderRow = display[yearRow + 1] || [];
  var monthLabels = [];
  for (var c = 1; c < monthHeaderRow.length; c++) {
    monthLabels.push(String(monthHeaderRow[c] || '').trim());
  }

  var accounts = [];
  for (var r3 = yearRow + 2; r3 < display.length; r3++) {
    var nm = String(display[r3][0] || '').trim();
    if (!nm) continue;
    if (nm === 'Total Accounts' || nm === 'Delta' || nm === 'Year') break;
    if (!isOnboardingBankAccountNameRow_(nm)) continue;

    var latestMonth = '';
    var latestBalance = '';
    var hasAnyBalance = false;
    for (var c2 = 1; c2 < display[r3].length; c2++) {
      var label = monthLabels[c2 - 1] || '';
      // Skip the trailing "Total" column — we want the most recent month,
      // not a year-to-date roll-up.
      if (!label || /^total$/i.test(label)) continue;
      var v = String(display[r3][c2] || '').trim();
      if (v === '') continue;
      latestMonth = label;
      latestBalance = v;
      hasAnyBalance = true;
    }

    accounts.push({
      name: nm,
      latestMonth: latestMonth,
      latestBalance: latestBalance,
      hasAnyBalance: hasAnyBalance
    });
  }

  base.accounts = accounts;
  if (accounts.length === 0) {
    base.status = 'missing';
    base.statusNote = 'No accounts in the ' + currentYear + ' block yet.';
  } else {
    var withBal = 0;
    accounts.forEach(function(a) { if (a.hasAnyBalance) withBal++; });
    if (withBal === accounts.length) {
      base.status = 'complete';
    } else if (withBal > 0) {
      base.status = 'partial';
    } else {
      base.status = 'partial';
    }
    base.statusNote = withBal + ' with balance · ' + (accounts.length - withBal) + ' without';
  }

  return base;
}

/**
 * Debts detail view for the onboarding Debts step.
 *
 * Read-only. Uses the shared resolver so TEST mode stays isolated to
 * TEST - INPUT - Debts. Skips the reserved TOTAL DEBT summary row and
 * any rows flagged explicitly inactive, matching the rest of the app's
 * readers. Does NOT touch planning outputs or activity — this is
 * pure inspection.
 *
 * Returns a flat shape the client can render without further parsing:
 *   {
 *     mode, sheetName, sheetExists,
 *     debts: [ { name, balance, minPayment, type, hasBalance, hasMinPayment } ],
 *     status,            // 'complete' | 'partial' | 'missing'
 *     statusNote,
 *     testBanner
 *   }
 */
function getOnboardingDebtsFromDashboard(mode) {
  var ctxMode = normalizeOnboardingMode_(mode);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = resolveOnboardingSheetName_(ctxMode, 'DEBTS');
  var sheet = ss.getSheetByName(sheetName);

  var base = {
    mode: ctxMode,
    sheetName: sheetName,
    sheetExists: !!sheet,
    debts: [],
    status: 'missing',
    statusNote: '',
    testBanner: ctxMode === 'test' ? 'TEST MODE — using TEST sheets only' : ''
  };

  if (!sheet) {
    base.statusNote = 'Debts sheet not found.';
    return base;
  }

  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    base.statusNote = 'Could not read Debts sheet.';
    return base;
  }
  if (display.length < 2) {
    base.statusNote = 'Sheet exists but has no rows yet.';
    return base;
  }

  var headerMap = buildHeaderIndex_(display[0]);
  var nameIdx = headerIndexCI_(headerMap, 'Account Name');
  var typeIdx = headerIndexCI_(headerMap, 'Type');
  var balanceIdx = headerIndexCI_(headerMap, 'Account Balance');
  var minPayIdx = headerIndexCI_(headerMap, 'Minimum Payment');
  var activeIdx = headerIndexCI_(headerMap, 'Active');

  if (nameIdx === -1) {
    base.statusNote = 'Debts sheet is missing the Account Name column.';
    return base;
  }

  var complete = 0;
  var partial = 0;
  var debts = [];
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][nameIdx] || '').trim();
    if (!name) continue;
    // Reserved summary row used on INPUT - Debts; never surface it as
    // an account to the user.
    if (name.toLowerCase() === 'total debt') continue;
    if (activeIdx !== -1) {
      var act = String(display[r][activeIdx] || '').trim();
      if (act && normalizeYesNo_(act) === 'no') continue;
    }

    var balanceRaw = balanceIdx !== -1 ? String(display[r][balanceIdx] || '').trim() : '';
    var minRaw = minPayIdx !== -1 ? String(display[r][minPayIdx] || '').trim() : '';
    var typeRaw = typeIdx !== -1 ? String(display[r][typeIdx] || '').trim() : '';

    var hasBalance = balanceRaw !== '';
    var hasMinPayment = minRaw !== '';
    if (hasBalance && hasMinPayment) complete++;
    else partial++;

    debts.push({
      name: name,
      type: typeRaw,
      balance: balanceRaw,
      minPayment: minRaw,
      hasBalance: hasBalance,
      hasMinPayment: hasMinPayment
    });
  }

  base.debts = debts;
  var total = debts.length;
  if (total === 0) {
    base.status = 'missing';
    base.statusNote = 'No active debts tracked.';
  } else {
    base.status = partial === 0 ? 'complete' : 'partial';
    base.statusNote = complete + ' with balance + min payment · ' + partial + ' with missing fields';
  }
  return base;
}

/**
 * Ensure the live INPUT - Debts sheet exists before the user is handed
 * off to the full Planning → Debts editor from onboarding.
 *
 * Localized safeguard, same contract as ensureOnboardingBankAccounts-
 * SheetFromDashboard:
 *   - Normal mode only. Test mode is a hard no-op.
 *   - Never overwrites an existing sheet.
 *   - If creating, the sheet is populated with the full canonical
 *     schema recognized by the existing Debts readers (getDebtsHeader-
 *     Map_ in debts.js and the probe in this file). Column order
 *     mirrors addDebtFromDashboard so the new sheet is immediately
 *     usable by the Planning → Debts Add / Manage surfaces.
 *   - No data rows are seeded — no fake debts, no TOTAL DEBT summary,
 *     no activity log entries.
 *
 * @param {string=} mode 'normal' (default) or 'test'
 * @returns {{ ok: boolean, created: boolean, sheetName: string, mode: string, reason?: string }}
 */
function ensureOnboardingDebtsSheetFromDashboard(mode) {
  var m = normalizeOnboardingMode_(mode);
  var sheetName = resolveOnboardingSheetName_(m, 'DEBTS');

  if (m === 'test') {
    return {
      ok: true,
      created: false,
      sheetName: sheetName,
      mode: m,
      reason: 'Test mode: use ensureOnboardingTestSheetsFromDashboard instead.'
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    return { ok: true, created: false, sheetName: sheetName, mode: m };
  }

  var sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    if (ss.getSheetByName(sheetName)) {
      return { ok: true, created: false, sheetName: sheetName, mode: m };
    }
    throw e;
  }

  try {
    // Header order mirrors the fields written by debts.js → addDebt-
    // FromDashboard. `getDebtsHeaderMap_` only *requires* Account Name
    // and Type; every other column is optional in the map but the Add
    // form writes all of them, so we seed the full canonical layout.
    // Active is included so self-heal in ensureDebtsActiveColumn_ is a
    // no-op on freshly created sheets.
    var headerRow = [
      'Account Name',
      'Type',
      'Account Balance',
      'Minimum Payment',
      'Credit Limit',
      'Credit Left',
      'Int Rate',
      'Due Date',
      'Acct PCT Avail',
      'Active'
    ];
    sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

    try {
      sheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } catch (_e) {
      // Cosmetic only — never fail the ensure op on formatting hiccups.
    }
  } catch (e) {
    return {
      ok: false,
      created: true,
      sheetName: sheetName,
      mode: m,
      reason: 'Sheet was created but structure write failed: ' + (e.message || e)
    };
  }

  return { ok: true, created: true, sheetName: sheetName, mode: m };
}

/**
 * Local helper: reject reserved labels from the Bank Accounts block
 * structure so a "Total Accounts" / "Delta" / "Year" row never appears
 * as an account in the UI. Named `isOnboardingBankAccountNameRow_` to
 * avoid colliding with the global `isBankAccountNameRow_` already
 * defined in bank_accounts.js — Apps Script merges globals, so a
 * second definition of the same name would be a parse error.
 */
function isOnboardingBankAccountNameRow_(value) {
  if (!value) return false;
  if (value === 'Account Name') return false;
  if (value === 'Total Accounts') return false;
  if (value === 'Delta') return false;
  if (value === 'Year') return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Test sheet bootstrap                                                      */
/* -------------------------------------------------------------------------- */

/**
 * "Flat" input sheets whose data rows can be safely cleared after a
 * structure clone. Block-structured sheets (Bank Accounts, Cash Flow)
 * are cloned as-is — their formulas and block markers are integral to
 * the structure and clearing rows below the header would leave the tab
 * in a broken half-state that read code elsewhere would choke on.
 */
var ONBOARDING_TEST_CLEAR_DATA_KEYS_ = {
  BILLS: true,
  DEBTS: true,
  UPCOMING: true,
  ACTIVITY_LOG: true
};

/**
 * Ensure every test sheet required by onboarding exists. Rerunnable:
 * sheets that already exist are left untouched. Live sheets are the
 * structural source — we clone them via `copyTo(ss)` to preserve
 * formulas, data validation, and column widths, then (for flat sheets
 * only) clear the data rows so user data does not leak into the sandbox.
 *
 * @returns {{ created: string[], skipped: string[], missingSources: string[] }}
 */
function ensureOnboardingTestSheetsFromDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];
  var skipped = [];
  var missingSources = [];

  var targets = [
    { key: 'BANK_ACCOUNTS' },
    { key: 'DEBTS' },
    { key: 'BILLS' },
    { key: 'UPCOMING' },
    { key: 'CASH_FLOW_PREFIX', year: getCurrentYear_() },
    { key: 'ACTIVITY_LOG' }
  ];

  targets.forEach(function(t) {
    var testName = resolveOnboardingSheetName_('test', t.key, t.year);
    if (ss.getSheetByName(testName)) {
      skipped.push(testName);
      return;
    }

    var liveName;
    try {
      liveName = resolveOnboardingSheetName_('normal', t.key, t.year);
    } catch (e) {
      missingSources.push(testName);
      return;
    }
    var liveSheet = ss.getSheetByName(liveName);
    if (!liveSheet) {
      missingSources.push(testName + ' (source "' + liveName + '" not found)');
      return;
    }

    var copy;
    try {
      copy = liveSheet.copyTo(ss);
    } catch (e) {
      missingSources.push(testName + ' (copy failed: ' + (e.message || e) + ')');
      return;
    }
    try {
      copy.setName(testName);
    } catch (e) {
      // Name collision (race): remove the stray copy and skip.
      ss.deleteSheet(copy);
      skipped.push(testName);
      return;
    }

    if (ONBOARDING_TEST_CLEAR_DATA_KEYS_[t.key]) {
      try {
        var lastRow = copy.getLastRow();
        if (lastRow > 1) {
          copy.getRange(2, 1, lastRow - 1, copy.getLastColumn()).clearContent();
        }
      } catch (e) {
        // Non-fatal: test sheet still exists with data; user can trim by hand.
      }
    }

    created.push(testName);
  });

  return {
    ok: true,
    created: created,
    skipped: skipped,
    missingSources: missingSources,
    message: created.length
      ? 'Created ' + created.length + ' test sheet(s).'
      : 'All test sheets already present.'
  };
}

/* -------------------------------------------------------------------------- */
/*  Sheet existence safeguards (live sheets only)                             */
/* -------------------------------------------------------------------------- */

/**
 * Ensure the live INPUT - Bank Accounts sheet exists before the user is
 * handed off to the full Bank Accounts editor from onboarding.
 *
 * This is deliberately localized to Bank Accounts. Onboarding is not a
 * global sheet manager; other required sheets (SYS - Accounts, LOG -
 * Activity, etc.) are owned by the flows that write them and are not
 * auto-created here.
 *
 * Safety contract:
 *   - Normal mode only. Test mode is a hard no-op (TEST sheets are bootstrapped
 *     separately via `ensureOnboardingTestSheetsFromDashboard`).
 *   - Never overwrites an existing sheet. If the sheet is already present,
 *     even empty, we leave it alone — the user's own structure wins.
 *   - If creating, the sheet is populated with the minimum viable structure
 *     recognized by the existing Bank Accounts readers:
 *       Row 1: A="Year", B=<current year>
 *       Row 2: A="Account Name", B..M=month headers (Jan-YY..Dec-YY to
 *              match cashflow_setup.js), N="Total"
 *     This is exactly what `getBankAccountsYearBlock_` and the onboarding
 *     probe scan for, so the new sheet is immediately usable by both the
 *     Assets editor and the onboarding read path.
 *   - No data rows are seeded — there are no fake accounts, no SYS mirror
 *     entries, and no Activity events.
 *
 * @param {string=} mode 'normal' (default) or 'test'
 * @returns {{ ok: boolean, created: boolean, sheetName: string, mode: string, reason?: string }}
 */
function ensureOnboardingBankAccountsSheetFromDashboard(mode) {
  var m = normalizeOnboardingMode_(mode);
  var sheetName = resolveOnboardingSheetName_(m, 'BANK_ACCOUNTS');

  if (m === 'test') {
    // Test sheets have their own bootstrap entry point; do not diverge here.
    return {
      ok: true,
      created: false,
      sheetName: sheetName,
      mode: m,
      reason: 'Test mode: use ensureOnboardingTestSheetsFromDashboard instead.'
    };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    return { ok: true, created: false, sheetName: sheetName, mode: m };
  }

  var sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    // Benign race: another caller just created it. Treat as success.
    if (ss.getSheetByName(sheetName)) {
      return { ok: true, created: false, sheetName: sheetName, mode: m };
    }
    throw e;
  }

  try {
    var currentYear = getCurrentYear_();
    var suffix = String(currentYear).slice(-2);
    // Month names mirror the convention used by cashflow_setup.js so
    // Bank Accounts stays visually consistent with Cash Flow headers.
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var monthHeaders = monthNames.map(function(n) { return n + '-' + suffix; });

    // Row 1: Year marker. getBankAccountsYearBlock_ looks for ("Year", "<year>").
    sheet.getRange(1, 1, 1, 2).setValues([['Year', String(currentYear)]]);
    // Row 2: Column header row. Col A must be literally "Account Name"
    // (enforced by getBankAccountsYearBlock_). Trailing "Total" column
    // matches the reader in getOnboardingBankAccountsFromDashboard, which
    // skips any column labelled /^total$/i when picking the latest month.
    var headerRow = ['Account Name'].concat(monthHeaders).concat(['Total']);
    sheet.getRange(2, 1, 1, headerRow.length).setValues([headerRow]);

    try {
      sheet.getRange(1, 1, 2, headerRow.length).setFontWeight('bold');
      sheet.setFrozenRows(2);
    } catch (_e) {
      // Cosmetic only — never fail the ensure op on formatting hiccups.
    }
  } catch (e) {
    // If structure write fails partway through, surface the error rather
    // than leaving a half-built sheet silently in place.
    return {
      ok: false,
      created: true,
      sheetName: sheetName,
      mode: m,
      reason: 'Sheet was created but structure write failed: ' + (e.message || e)
    };
  }

  return { ok: true, created: true, sheetName: sheetName, mode: m };
}

/* -------------------------------------------------------------------------- */
/*  Apps Script menu launcher                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Owner-only entry point for Test Setup. Opens the deployed web app with
 * `?onboarding=test` so the dashboard boots the onboarding page in test
 * mode. Exposed via the `Debt Planner` menu in `code.js` (menu only
 * appears for spreadsheet editors, which is the existing admin/dev
 * surface pattern).
 */
function openPlannerDashboardWebTestOnboardingLauncher() {
  var url = getPlannerDashboardWebAppUrl_();
  var joiner = url.indexOf('?') === -1 ? '?' : '&';
  var testUrl = url + joiner + 'onboarding=test';
  var safeUrl = testUrl.replace(/"/g, '&quot;');

  var html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_top"></head><body>' +
    '<script>' +
    'window.open("' + safeUrl + '", "_blank");' +
    'google.script.host.close();' +
    '</script>' +
    '<div style="font-family:Arial,sans-serif;padding:16px;">Opening CashCompass (Test Setup)...</div>' +
    '</body></html>'
  ).setWidth(260).setHeight(80);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Opening Test Setup...');
}
