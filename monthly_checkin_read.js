/**
 * Monthly Financial Check-In read-only orchestration.
 *
 * Derives the current cycle, reads persisted state from INPUT - Settings when
 * present, loads active domain records through existing UI data helpers, resolves
 * durable account keys via monthly_checkin_identity.js, and projects status via
 * monthly_checkin.js. No Settings writes, confirm actions, or financial-value
 * mutations.
 */

var MONTHLY_CHECKIN_READ_VERSION_ = 'MONTHLY_CHECKIN_READ_V1';
var MONTHLY_CHECKIN_SETTINGS_SHEET_NAME_ = 'INPUT - Settings';

function monthlyCheckinCurrentCycleKey_(optionalDate) {
  return Utilities.formatDate(optionalDate || new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
}

function monthlyCheckinReadSettingsRawValue_(ss, settingsKey) {
  if (!ss || !settingsKey) return '';
  var sheet = ss.getSheetByName(MONTHLY_CHECKIN_SETTINGS_SHEET_NAME_);
  if (!sheet) return '';
  var last = sheet.getLastRow();
  if (last < 2) return '';
  var values = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key !== settingsKey) continue;
    return String(values[i][1] == null ? '' : values[i][1]).trim();
  }
  return '';
}

function monthlyCheckinReadStoredStateForCycle_(ss, cycleKey) {
  var key = String(cycleKey || '').trim();
  if (!monthlyCheckinValidateCycleKey_(key)) {
    return {
      ok: false,
      reason: 'INVALID_EXPECTED_CYCLE',
      settingsKey: '',
      state: null
    };
  }
  var settingsKey = monthlyCheckinSettingsKey_(key);
  var raw = monthlyCheckinReadSettingsRawValue_(ss, settingsKey);
  if (!raw) {
    return {
      ok: false,
      reason: 'MISSING',
      settingsKey: settingsKey,
      state: monthlyCheckinDefaultState_(key)
    };
  }
  var parsed = monthlyCheckinParseStoredState_(raw, key);
  return {
    ok: parsed.ok,
    reason: parsed.ok ? '' : parsed.reason,
    settingsKey: settingsKey,
    state: parsed.state
  };
}

var MONTHLY_CHECKIN_INCOME_PRODUCING_PURPOSE_ = 'INCOME_PRODUCING';

function monthlyCheckinIsIncomeProducingInvestmentRow_(row) {
  return String((row && row.planningPurpose) || '').trim().toUpperCase() ===
    MONTHLY_CHECKIN_INCOME_PRODUCING_PURPOSE_;
}

function monthlyCheckinBuildInvestmentLifecycleCounts_(managementAccounts) {
  var counts = Object.create(null);
  (managementAccounts || []).forEach(function(row) {
    var investmentId = String((row && row.investmentId) || '').trim();
    if (!investmentId) return;
    counts[investmentId] = Number(counts[investmentId] || 0) + 1;
  });
  return counts;
}

function monthlyCheckinIdentityIssueFromResult_(result, displayName) {
  return {
    code: String((result && result.code) || 'IDENTITY_UNRESOLVED'),
    message: String((result && result.message) || 'Account identity could not be resolved.'),
    displayName: String(displayName || '').trim()
  };
}

function monthlyCheckinCycleKeyToBalanceDate_(cycleKey) {
  var parts = String(cycleKey || '').trim().split('-');
  if (parts.length !== 2) return new Date();
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 15);
}

function monthlyCheckinPriorCycleKey_(cycleKey) {
  var parts = String(cycleKey || '').trim().split('-');
  if (parts.length !== 2) return '';
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month) return '';
  if (month === 1) return String(year - 1) + '-12';
  var priorMonth = month - 1;
  return String(year) + '-' + (priorMonth < 10 ? '0' : '') + priorMonth;
}

function monthlyCheckinIsPresentSheetValue_(value) {
  return !(value === '' || value === null || value === undefined);
}

function monthlyCheckinParseSheetNumericEvidence_(raw) {
  if (!monthlyCheckinIsPresentSheetValue_(raw)) {
    return {
      present: false,
      valid: false,
      value: null,
      invalid: false
    };
  }
  var parsed = typeof monthlyCheckinTryNumber_ === 'function'
    ? monthlyCheckinTryNumber_(raw)
    : { valid: typeof raw === 'number' && isFinite(raw), value: typeof raw === 'number' ? raw : Number(raw) };
  if (!parsed.valid) {
    return { present: true, valid: false, value: null, invalid: true };
  }
  return {
    present: true,
    valid: true,
    value: round2_(parsed.value),
    invalid: false
  };
}

function monthlyCheckinReadMonthValueMap_(sheet, balanceDate, blockReader, rowMatcher) {
  var result = Object.create(null);
  if (!sheet || typeof blockReader !== 'function' || typeof rowMatcher !== 'function') {
    return result;
  }
  var display;
  try {
    display = sheet.getDataRange().getDisplayValues();
  } catch (_displayErr) {
    return result;
  }
  var year = balanceDate.getFullYear();
  var block;
  try {
    block = blockReader(sheet, year, display);
  } catch (_blockErr) {
    return result;
  }
  if (!block || block.dataEndRow < block.dataStartRow) return result;

  var headerRow = display[block.headerRow - 1] || [];
  var monthCol = findMonthColumnIndex_(headerRow, balanceDate);
  if (monthCol === -1) return result;

  var lastCol = sheet.getLastColumn();
  if (lastCol < monthCol) return result;

  var numRows = block.dataEndRow - block.dataStartRow + 1;
  var values;
  try {
    values = sheet.getRange(block.dataStartRow, 1, numRows, lastCol).getValues();
  } catch (_valuesErr) {
    return result;
  }

  var colZero = monthCol - 1;
  for (var i = 0; i < values.length; i++) {
    var dispRow = display[block.dataStartRow - 1 + i] || [];
    var rowInfo = rowMatcher(dispRow);
    if (!rowInfo || !rowInfo.name) continue;
    var raw = values[i][colZero];
    var parsed = monthlyCheckinParseSheetNumericEvidence_(raw);
    result[String(rowInfo.name).toLowerCase()] = {
      present: parsed.valid,
      value: parsed.valid ? parsed.value : null,
      invalid: parsed.invalid,
      sourceCode: 'MANUAL',
      sourceLabel: 'Manual'
    };
  }
  return result;
}

function monthlyCheckinLoadMonthValueByDomain_(ss, cycleKey) {
  var balanceDate = monthlyCheckinCycleKeyToBalanceDate_(cycleKey);
  var priorCycleKey = monthlyCheckinPriorCycleKey_(cycleKey);
  var priorBalanceDate = priorCycleKey ? monthlyCheckinCycleKeyToBalanceDate_(priorCycleKey) : null;
  var empty = {
    bank: Object.create(null),
    houses: Object.create(null),
    investments: Object.create(null),
    prior: {
      bank: Object.create(null),
      houses: Object.create(null),
      investments: Object.create(null)
    }
  };
  if (!ss) return empty;

  var names = typeof getSheetNames_ === 'function' ? getSheetNames_() : null;
  if (!names) return empty;

  var bankSheet = ss.getSheetByName(names.BANK_ACCOUNTS);
  if (bankSheet) {
    empty.bank = monthlyCheckinReadMonthValueMap_(
      bankSheet,
      balanceDate,
      getBankAccountsYearBlock_,
      function(dispRow) {
        var name = String(dispRow[0] || '').trim();
        if (!isBankAccountDataRowName_(name)) return null;
        return { name: name };
      }
    );
    if (priorBalanceDate) {
      empty.prior.bank = monthlyCheckinReadMonthValueMap_(
        bankSheet,
        priorBalanceDate,
        getBankAccountsYearBlock_,
        function(dispRow) {
          var name = String(dispRow[0] || '').trim();
          if (!isBankAccountDataRowName_(name)) return null;
          return { name: name };
        }
      );
    }
  }

  var houseSheet = ss.getSheetByName(names.HOUSE_VALUES);
  if (houseSheet) {
    empty.houses = monthlyCheckinReadMonthValueMap_(
      houseSheet,
      balanceDate,
      getHouseValuesYearBlock_,
      function(dispRow) {
        var name = String(dispRow[0] || '').trim();
        var sub = String(dispRow[1] || '').trim();
        if (!isHouseDataRowName_(name, sub)) return null;
        return { name: name };
      }
    );
    if (priorBalanceDate) {
      empty.prior.houses = monthlyCheckinReadMonthValueMap_(
        houseSheet,
        priorBalanceDate,
        getHouseValuesYearBlock_,
        function(dispRow) {
          var name = String(dispRow[0] || '').trim();
          var sub = String(dispRow[1] || '').trim();
          if (!isHouseDataRowName_(name, sub)) return null;
          return { name: name };
        }
      );
    }
  }

  var investmentSheet = ss.getSheetByName(names.INVESTMENTS);
  if (investmentSheet) {
    empty.investments = monthlyCheckinReadMonthValueMap_(
      investmentSheet,
      balanceDate,
      getInvestmentsYearBlock_,
      function(dispRow) {
        var name = String(dispRow[0] || '').trim();
        if (!isInvestmentDataRowName_(name)) return null;
        return { name: name };
      }
    );
    if (priorBalanceDate) {
      empty.prior.investments = monthlyCheckinReadMonthValueMap_(
        investmentSheet,
        priorBalanceDate,
        getInvestmentsYearBlock_,
        function(dispRow) {
          var name = String(dispRow[0] || '').trim();
          if (!isInvestmentDataRowName_(name)) return null;
          return { name: name };
        }
      );
    }
  }

  return empty;
}

function monthlyCheckinMonthValueInfo_(monthValues, displayName, priorMonthValues) {
  if (!monthValues || !displayName) {
    return {
      hasCurrentMonthValue: false,
      currentMonthValue: null,
      invalidCurrentMonthValue: false,
      sourceCode: 'MANUAL',
      sourceLabel: 'Manual',
      hasPriorMonthValue: false,
      priorMonthValue: null
    };
  }
  var key = String(displayName).toLowerCase();
  var row = monthValues[key];
  var priorRow = priorMonthValues ? priorMonthValues[key] : null;
  if (!row) {
    return {
      hasCurrentMonthValue: false,
      currentMonthValue: null,
      invalidCurrentMonthValue: false,
      sourceCode: 'MANUAL',
      sourceLabel: 'Manual',
      hasPriorMonthValue: !!(priorRow && priorRow.present),
      priorMonthValue: priorRow && priorRow.present ? priorRow.value : null
    };
  }
  return {
    hasCurrentMonthValue: !!row.present,
    currentMonthValue: row.present ? row.value : null,
    invalidCurrentMonthValue: !!row.invalid,
    sourceCode: row.sourceCode || 'MANUAL',
    sourceLabel: row.sourceLabel || 'Manual',
    hasPriorMonthValue: !!(priorRow && priorRow.present),
    priorMonthValue: priorRow && priorRow.present ? priorRow.value : null
  };
}

function monthlyCheckinResolveBankActive_(rows, registryIndex, monthValues, priorMonthValues) {
  var activeEntries = [];
  var identityIssues = [];
  (rows || []).forEach(function(row) {
    var displayName = String((row && row.accountName) || '').trim();
    if (!displayName) return;
    var resolved = monthlyCheckinResolveAccountKey_({
      domain: 'bank',
      accountName: displayName,
      displayName: displayName,
      registryIndex: registryIndex
    });
    if (resolved.ok) {
      var monthInfo = monthlyCheckinMonthValueInfo_(monthValues, displayName, priorMonthValues);
      activeEntries.push({
        accountKey: resolved.accountKey,
        displayName: displayName,
        hasCurrentMonthValue: monthInfo.hasCurrentMonthValue,
        currentMonthValue: monthInfo.currentMonthValue,
        invalidCurrentMonthValue: monthInfo.invalidCurrentMonthValue,
        sourceCode: monthInfo.sourceCode,
        sourceLabel: monthInfo.sourceLabel,
        hasPriorMonthValue: monthInfo.hasPriorMonthValue,
        priorMonthValue: monthInfo.priorMonthValue
      });
      return;
    }
    identityIssues.push(monthlyCheckinIdentityIssueFromResult_(resolved, displayName));
  });
  return { activeEntries: activeEntries, identityIssues: identityIssues };
}

function monthlyCheckinResolveHouseActive_(rows, registryIndex, monthValues, priorMonthValues) {
  var activeEntries = [];
  var identityIssues = [];
  (rows || []).forEach(function(row) {
    var displayName = String((row && row.houseName) || '').trim();
    if (!displayName) return;
    var resolved = monthlyCheckinResolveAccountKey_({
      domain: 'house',
      houseName: displayName,
      displayName: displayName,
      registryIndex: registryIndex
    });
    if (resolved.ok) {
      var monthInfo = monthlyCheckinMonthValueInfo_(monthValues, displayName, priorMonthValues);
      activeEntries.push({
        accountKey: resolved.accountKey,
        displayName: displayName,
        hasCurrentMonthValue: monthInfo.hasCurrentMonthValue,
        currentMonthValue: monthInfo.currentMonthValue,
        invalidCurrentMonthValue: monthInfo.invalidCurrentMonthValue,
        sourceCode: monthInfo.sourceCode,
        sourceLabel: monthInfo.sourceLabel,
        hasPriorMonthValue: monthInfo.hasPriorMonthValue,
        priorMonthValue: monthInfo.priorMonthValue
      });
      return;
    }
    identityIssues.push(monthlyCheckinIdentityIssueFromResult_(resolved, displayName));
  });
  return { activeEntries: activeEntries, identityIssues: identityIssues };
}

function monthlyCheckinResolveInvestmentActive_(rows, registryIndex, investmentLifecycleCounts, monthValues, priorMonthValues) {
  var activeEntries = [];
  var identityIssues = [];
  (rows || []).forEach(function(row) {
    var displayName = String((row && row.accountName) || '').trim();
    if (!displayName) return;
    var monthInfo = monthlyCheckinMonthValueInfo_(monthValues, displayName, priorMonthValues);
    if (!monthlyCheckinIsIncomeProducingInvestmentRow_(row)) {
      activeEntries.push({
        accountKey: '',
        displayName: displayName,
        hasCurrentMonthValue: monthInfo.hasCurrentMonthValue,
        currentMonthValue: monthInfo.currentMonthValue,
        invalidCurrentMonthValue: monthInfo.invalidCurrentMonthValue,
        sourceCode: monthInfo.sourceCode,
        sourceLabel: monthInfo.sourceLabel,
        hasPriorMonthValue: monthInfo.hasPriorMonthValue,
        priorMonthValue: monthInfo.priorMonthValue
      });
      return;
    }
    var investmentId = String((row && row.investmentId) || '').trim();
    var resolved = monthlyCheckinResolveAccountKey_({
      domain: 'investment',
      investmentId: investmentId,
      displayName: displayName,
      registryIndex: registryIndex,
      investmentLifecycleCounts: investmentLifecycleCounts
    });
    if (resolved.ok) {
      activeEntries.push({
        accountKey: resolved.accountKey,
        displayName: displayName,
        hasCurrentMonthValue: monthInfo.hasCurrentMonthValue,
        currentMonthValue: monthInfo.currentMonthValue,
        invalidCurrentMonthValue: monthInfo.invalidCurrentMonthValue,
        sourceCode: monthInfo.sourceCode,
        sourceLabel: monthInfo.sourceLabel,
        hasPriorMonthValue: monthInfo.hasPriorMonthValue,
        priorMonthValue: monthInfo.priorMonthValue
      });
      return;
    }
    identityIssues.push(monthlyCheckinIdentityIssueFromResult_(resolved, displayName));
  });
  return { activeEntries: activeEntries, identityIssues: identityIssues };
}

function monthlyCheckinResolveDebtActive_(rows, registryIndex) {
  var activeEntries = [];
  var identityIssues = [];
  (rows || []).forEach(function(row) {
    var displayName = String((row && row.accountName) || '').trim();
    if (!displayName) return;
    var resolved = monthlyCheckinResolveAccountKey_({
      domain: 'debt',
      accountName: displayName,
      displayName: displayName,
      registryIndex: registryIndex
    });
    if (resolved.ok) {
      activeEntries.push({
        accountKey: resolved.accountKey,
        displayName: displayName,
        accountBalance: row.accountBalance == null ? '' : row.accountBalance,
        type: String(row.type || '').trim(),
        dueDate: String(row.dueDate || '').trim(),
        minimumPayment: row.minimumPayment == null ? '' : row.minimumPayment,
        lastUpdated: String(row.lastUpdated || '').trim()
      });
      return;
    }
    identityIssues.push(monthlyCheckinIdentityIssueFromResult_(resolved, displayName));
  });
  return { activeEntries: activeEntries, identityIssues: identityIssues };
}

function monthlyCheckinLoadActiveRecordsByDomain_(loaders) {
  var bankUi = (loaders && loaders.getBankAccountUiData) ?
    loaders.getBankAccountUiData() : getBankAccountUiData();
  var houseUi = (loaders && loaders.getHouseUiData) ?
    loaders.getHouseUiData() : getHouseUiData();
  var investmentUi = (loaders && loaders.getInvestmentUiData) ?
    loaders.getInvestmentUiData() : getInvestmentUiData();
  var debtRows = (loaders && loaders.getActiveDebtsForManagementFromDashboard) ?
    loaders.getActiveDebtsForManagementFromDashboard() :
    getActiveDebtsForManagementFromDashboard();

  return {
    bank: (bankUi && bankUi.managementAccounts) ? bankUi.managementAccounts : [],
    houses: (houseUi && houseUi.managementHouses) ? houseUi.managementHouses : [],
    investments: (investmentUi && investmentUi.managementAccounts) ?
      investmentUi.managementAccounts : [],
    debts: debtRows || [],
    investmentLifecycleCounts: monthlyCheckinBuildInvestmentLifecycleCounts_(
      investmentUi && investmentUi.managementAccounts)
  };
}

function monthlyCheckinResolveActiveByDomain_(activeRecords, registryIndex, monthValueByDomain) {
  var records = activeRecords || {};
  var monthValues = monthValueByDomain || {};
  var priorValues = monthValues.prior || {};
  var bank = monthlyCheckinResolveBankActive_(
    records.bank, registryIndex, monthValues.bank, priorValues.bank);
  var houses = monthlyCheckinResolveHouseActive_(
    records.houses, registryIndex, monthValues.houses, priorValues.houses);
  var investments = monthlyCheckinResolveInvestmentActive_(
    records.investments, registryIndex, records.investmentLifecycleCounts,
    monthValues.investments, priorValues.investments);
  var debts = monthlyCheckinResolveDebtActive_(records.debts, registryIndex);
  return {
    activeByDomain: {
      bank: bank.activeEntries,
      houses: houses.activeEntries,
      investments: investments.activeEntries,
      debts: debts.activeEntries
    },
    identityIssuesByDomain: {
      bank: bank.identityIssues,
      houses: houses.identityIssues,
      investments: investments.identityIssues,
      debts: debts.identityIssues
    }
  };
}

function monthlyCheckinUnavailableReadResponse_(routing, cycleKey) {
  return {
    version: MONTHLY_CHECKIN_READ_VERSION_,
    available: false,
    routing: routing || { ok: false, isBlankWorkbook: false, mode: 'normal' },
    cycleKey: cycleKey,
    settingsKey: monthlyCheckinValidateCycleKey_(cycleKey) ?
      monthlyCheckinSettingsKey_(cycleKey) : '',
    state: null,
    projection: null
  };
}

function buildMonthlyCheckinReadModel_(ss, payload, routing, deps) {
  var options = payload || {};
  var services = deps || {};
  var cycleKey = String(options.cycleKey || monthlyCheckinCurrentCycleKey_(options.asOf)).trim();
  if (!monthlyCheckinValidateCycleKey_(cycleKey)) {
    throw new Error('Monthly check-in requires a valid YYYY-MM cycle key.');
  }

  var stored = monthlyCheckinReadStoredStateForCycle_(ss, cycleKey);
  var registryIndex = (services.registryIndex) ?
    services.registryIndex :
    monthlyCheckinReadRegistryIndex_(ss);
  var activeRecords = monthlyCheckinLoadActiveRecordsByDomain_(services.loaders);
  var monthValueByDomain = (services.monthValueByDomain) ?
    services.monthValueByDomain :
    monthlyCheckinLoadMonthValueByDomain_(ss, cycleKey);
  var resolved = monthlyCheckinResolveActiveByDomain_(
    activeRecords, registryIndex, monthValueByDomain);

  var projection = monthlyCheckinBuildCycleProjection_(
    stored.state,
    resolved.activeByDomain,
    resolved.identityIssuesByDomain
  );

  return {
    version: MONTHLY_CHECKIN_READ_VERSION_,
    available: true,
    routing: routing || { ok: true, isBlankWorkbook: false, mode: 'normal' },
    cycleKey: cycleKey,
    settingsKey: stored.settingsKey,
    state: {
      persisted: projection.persisted,
      parseOk: stored.ok,
      parseReason: stored.reason || '',
      revision: projection.revision,
      updatedAt: projection.updatedAt
    },
    projection: projection
  };
}

function getMonthlyCheckinFromDashboard(payload) {
  var options = payload || {};
  var cycleKey = String(options.cycleKey || monthlyCheckinCurrentCycleKey_(options.asOf)).trim();

  var routing;
  try {
    routing = getStartupRoutingFromDashboard();
  } catch (routingErr) {
    return monthlyCheckinUnavailableReadResponse_({
      ok: false,
      isBlankWorkbook: false,
      mode: 'normal',
      reason: 'Startup routing probe failed: ' +
        (routingErr && routingErr.message ? routingErr.message : routingErr)
    }, cycleKey);
  }

  if (routing && routing.mode === 'recovery') {
    return monthlyCheckinUnavailableReadResponse_(routing, cycleKey);
  }

  var ss;
  try {
    ss = getUserSpreadsheet_();
  } catch (resolveErr) {
    var recoveryRouting = (typeof buildRecoveryRouting_ === 'function') ?
      buildRecoveryRouting_(resolveErr) :
      { ok: false, isBlankWorkbook: false, mode: 'recovery',
        recovery: { type: 'unavailable' } };
    return monthlyCheckinUnavailableReadResponse_(recoveryRouting, cycleKey);
  }

  if (!ss) {
    return monthlyCheckinUnavailableReadResponse_({
      ok: false,
      isBlankWorkbook: false,
      mode: 'normal',
      reason: 'getUserSpreadsheet_ returned null.'
    }, cycleKey);
  }

  if (routing && routing.isBlankWorkbook) {
    return monthlyCheckinUnavailableReadResponse_(routing, cycleKey);
  }

  return buildMonthlyCheckinReadModel_(ss, options, routing);
}
