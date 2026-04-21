function getSheetNames_() {
  return {
    CASH_FLOW_PREFIX: 'INPUT - Cash Flow ',
    DEBTS: 'INPUT - Debts',
    BANK_ACCOUNTS: 'INPUT - Bank Accounts',
    HOUSE_VALUES: 'INPUT - House Values',
    INVESTMENTS: 'INPUT - Investments',
    BILLS: 'INPUT - Bills',

    ACCOUNTS: 'SYS - Accounts',
    HOUSE_ASSETS: 'SYS - House Assets',
    ASSETS: 'SYS - Assets',

    DASHBOARD: 'OUT - Dashboard',
    HISTORY: 'OUT - History'
  };
}

function getSheet_(ss, key) {
  const names = getSheetNames_();
  const name = names[key];

  if (!name) {
    throw new Error('Sheet key not defined: ' + key);
  }

  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  // Stale-handle retry. Some Apps Script executions leave a just-inserted
  // sheet invisible to a Spreadsheet handle captured before the insert,
  // even if a later call site uses SpreadsheetApp.getActiveSpreadsheet()
  // fresh. Flushing pending writes and re-fetching both the spreadsheet
  // and the sheet by name clears that case. If the retry also misses we
  // throw a distinct error message ("Missing sheet (after retry+flush):")
  // so deployment/version mismatches are immediately distinguishable from
  // a genuinely-missing sheet in a running deployment. Seeing the bare
  // "Missing sheet: …" banner in the UI means the serving deployment is
  // pinned to a pre-fix version of config.js.
  try {
    SpreadsheetApp.flush();
  } catch (_flushErr) {
    // Flush is best-effort; fall through to the retry regardless.
  }
  const freshSs = SpreadsheetApp.getActiveSpreadsheet();
  sheet = freshSs.getSheetByName(name);
  if (sheet) return sheet;

  // List existing sheet names to aid diagnosis when retry also fails.
  // Truncated to avoid oversize banners; this is diagnostic output only.
  var existingNames = [];
  try {
    var allSheets = freshSs.getSheets();
    for (var i = 0; i < allSheets.length && i < 30; i++) {
      existingNames.push(allSheets[i].getName());
    }
  } catch (_e) { /* diagnostic only */ }

  throw new Error(
    'Missing sheet (after retry+flush): ' + name +
    (existingNames.length
      ? ' | present: ' + existingNames.join(', ')
      : '')
  );
}

function getCashFlowSheetName_(year) {
  const names = getSheetNames_();
  return names.CASH_FLOW_PREFIX + String(year);
}

function getCashFlowSheet_(ss, year) {
  const sheetName = getCashFlowSheetName_(year);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing cash flow sheet: ' + sheetName);
  }

  return sheet;
}