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

  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Missing sheet: ' + name);
  }

  return sheet;
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