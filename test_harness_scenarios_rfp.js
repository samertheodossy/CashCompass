/** RFP-2 investment identity and Income-Producing metadata lifecycle. */
function getHarnessRfpInvestmentMetadataScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-RFP-INVESTMENT-METADATA',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    expectedAssertionCount: 19,
    description: 'Prove multiple explicit Income-Producing designations, independent removal, stable rename identity, and Stop/Reactivate behavior on a disposable workbook.',
    requiresTrashCleanup: true,
    expectedSheets: [names.INVESTMENTS, names.ASSETS, ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.assertWritable();
      ensureInputInvestmentsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysAssetsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureActivityLogSheet_(ctx.ss);
      SpreadsheetApp.flush();
      ctx.actions.push('Create Investments, Assets, and Activity sheets on explicit disposable target');
    },
    actions: function(ctx) {
      var year = getCurrentYear_();
      var today = new Date();
      harnessRfpAddInvestment_(ctx, year, today, 'Samer Robinhood', 16193.06, 'Yes');
      harnessRfpAddInvestment_(ctx, year, today, 'Lutfi Robinhood', 10845.46, 'Yes');
      SpreadsheetApp.flush();

      var assets = ctx.ss.getSheetByName(getSheetNames_().ASSETS);
      var samerRow = harnessRfpFindAssetRow_(assets, 'Samer Robinhood');
      var lutfiRow = harnessRfpFindAssetRow_(assets, 'Lutfi Robinhood');

      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: samerRow, expectedAccountName: 'Samer Robinhood',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }, {
        sysAssetsRow: lutfiRow, expectedAccountName: 'Lutfi Robinhood',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }] }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.firstConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.samerInitial = ctx.firstConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Robinhood';
      })[0];
      ctx.lutfiInitial = ctx.firstConfig.accounts.filter(function(row) {
        return row.accountName === 'Lutfi Robinhood';
      })[0];

      ctx.assertWritable();
      saveTrackedInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Robinhood',
        newAccountName: 'Samer Income Portfolio',
        type: 'Brokerage'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.renamedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.renamedSamer = ctx.renamedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      deactivateInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Income Portfolio'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.stoppedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.stoppedSamer = ctx.stoppedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      reactivateInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Income Portfolio'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.reactivatedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.reactivatedSamer = ctx.reactivatedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: lutfiRow, expectedAccountName: 'Lutfi Robinhood', planningPurpose: ''
      }] }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.removedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.remainingSamerPurpose = harnessRfpReadAssetField_(
        assets, samerRow, INVESTMENT_PLANNING_PURPOSE_HEADER_);
      var metadataHeaderMap = getAssetsHeaderMap_(assets);
      ctx.investmentIdColumnWidth = assets.getColumnWidth(metadataHeaderMap.investmentIdCol);
      ctx.planningPurposeColumnWidth = assets.getColumnWidth(metadataHeaderMap.planningPurposeCol);
      ctx.finalInputHeaders = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
      ctx.activityEvents = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME)
        .getDataRange().getDisplayValues();
      ctx.actions.push('Designate two accounts, rename, Stop, Reactivate, and remove one through production writers');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Rolling Financial Plan';
      ctx.assert.equals('Two Income-Producing accounts selected', ctx.firstConfig.configuredCount,
        2, { module: mod });
      ctx.assert.equals('Both selected accounts eligible', ctx.firstConfig.eligibleCount,
        2, { module: mod });
      ctx.assert.equals('Samer stable id exists', !!ctx.samerInitial.investmentId,
        true, { module: mod });
      ctx.assert.equals('Lutfi stable id exists', !!ctx.lutfiInitial.investmentId,
        true, { module: mod });
      ctx.assert.equals('Rename preserves stable id', ctx.renamedSamer.investmentId,
        ctx.samerInitial.investmentId, { module: mod });
      ctx.assert.equals('Rename updates configured name', ctx.renamedSamer.accountName,
        'Samer Income Portfolio', { module: mod });
      ctx.assert.equals('Stop preserves both configurations', ctx.stoppedConfig.configuredCount,
        2, { module: mod });
      ctx.assert.equals('Stop suspends only Samer eligibility', ctx.stoppedSamer.eligible,
        false, { module: mod });
      ctx.assert.equals('Lutfi remains eligible while Samer stopped', ctx.stoppedConfig.eligibleCount,
        1, { module: mod });
      ctx.assert.equals('Reactivate restores Samer eligibility', ctx.reactivatedSamer.eligible,
        true, { module: mod });
      ctx.assert.equals('Reactivate preserves stable id', ctx.reactivatedSamer.investmentId,
        ctx.samerInitial.investmentId, { module: mod });
      ctx.assert.equals('Removing Lutfi leaves one configuration', ctx.removedConfig.configuredCount,
        1, { module: mod });
      ctx.assert.equals('Remaining Samer account stays eligible', ctx.removedConfig.eligibleCount,
        1, { module: mod });
      ctx.assert.equals('Removing Lutfi leaves Samer designated', ctx.remainingSamerPurpose,
        INCOME_PRODUCING_PURPOSE_, { module: mod });
      ctx.assert.equals('INPUT Investments has no Investment Id header',
        ctx.finalInputHeaders.indexOf(INVESTMENT_ID_HEADER_), -1, { module: mod });
      ctx.assert.equals('INPUT Investments has no Planning Purpose header',
        ctx.finalInputHeaders.indexOf(INVESTMENT_PLANNING_PURPOSE_HEADER_), -1, { module: mod });
      ctx.assert.equals('Investment Id metadata column is readable',
        ctx.investmentIdColumnWidth >= 250, true, { module: mod });
      ctx.assert.equals('Planning Purpose metadata column is readable',
        ctx.planningPurposeColumnWidth >= 150, true, { module: mod });
      var purposeEvents = ctx.activityEvents.filter(function(row) {
        return String(row[1] || '') === 'investment_planning_purpose_update';
      });
      ctx.assert.equals('Designation changes are audited', purposeEvents.length >= 3,
        true, { module: mod });
    }
  };
}

function harnessRfpAddInvestment_(ctx, year, today, name, balance, active) {
  var input = ctx.ss.getSheetByName(getSheetNames_().INVESTMENTS);
  var block = getInvestmentsYearBlock_(input, year);
  ctx.assertWritable();
  var row = insertNewInvestmentHistoryRow_(input, block, name, 'Brokerage');
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  ctx.assertWritable();
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, balance, block.firstMonthCol);
  var activeCol = ensureInvestmentsActiveColumnForBlock_(input, block);
  ctx.assertWritable();
  writeActiveCellWithRowFormat_(input, row, activeCol, active);
  ctx.assertWritable();
  refreshInvestmentsAccountTotalsRow_(input, year);
  ctx.assertWritable();
  appendAssetsRowForNewInvestment_(
    ctx.ss.getSheetByName(getSheetNames_().ASSETS), name, 'Brokerage', balance);
}

function harnessRfpFindAssetRow_(sheet, accountName) {
  var values = sheet.getDataRange().getDisplayValues();
  var headerMap = getAssetsHeaderMap_(sheet, values);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][headerMap.nameColZero] || '').trim() === accountName) return r + 1;
  }
  throw new Error('Harness asset row not found: ' + accountName);
}

function harnessRfpReadAssetField_(sheet, row, header) {
  var display = sheet.getDataRange().getDisplayValues();
  var index = (display[0] || []).indexOf(header);
  return index === -1 ? '' : String((display[row - 1] || [])[index] || '').trim();
}

/** RFP-6a broker activity import, exclusions, dedupe, and holdings rebuild. */
function getHarnessRfpInvestmentActivityScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-RFP-INVESTMENT-ACTIVITY',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    expectedAssertionCount: 21,
    description: 'Prove preview-first Robinhood import, option/unrelated/footer exclusions, lazy system sheets, duplicate protection, and holdings reconciliation on a disposable workbook.',
    requiresTrashCleanup: true,
    expectedSheets: [names.INVESTMENTS, names.ASSETS, names.INVESTMENT_ACTIVITY,
      names.INVESTMENT_HOLDINGS, ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.assertWritable();
      ensureInputInvestmentsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysAssetsSheet_(ctx.ss);
      var year = getCurrentYear_();
      var today = new Date(year, 7, 13);
      harnessRfpAddInvestment_(ctx, year, today, 'Synthetic Income Portfolio', 18000, 'Yes');
      var assets = ctx.ss.getSheetByName(names.ASSETS);
      ctx.assetRow = harnessRfpFindAssetRow_(assets, 'Synthetic Income Portfolio');
      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: ctx.assetRow,
        expectedAccountName: 'Synthetic Income Portfolio',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }] }, ctx.ss);
      ctx.investmentId = getIncomeProducingAccountConfigurations_(ctx.ss)
        .eligibleAccounts[0].investmentId;
      ctx.inputHeadersBefore = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
    },
    actions: function(ctx) {
      ctx.csv = [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"4/21/2026","4/21/2026","4/22/2026","","ACH Deposit","ACH","","","$4,000.00"',
        '"4/27/2026","4/27/2026","4/28/2026","QQQ","Invesco QQQ","Buy","5","$600.00","($3,000.00)"',
        '"4/27/2026","4/27/2026","4/28/2026","JEPQ","JPMorgan Income ETF","Buy","20","$50.00","($1,000.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","QQQ","Invesco QQQ Recurring","Buy","0.5","$700.00","($350.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","JEPQ","JPMorgan Income ETF Recurring","Buy","1.5","$50.00","($75.00)"',
        '"5/5/2026","5/5/2026","5/5/2026","JEPQ","Cash Div","CDIV","","","$10.00"',
        '"5/4/2026","5/4/2026","5/5/2026","","ACH Deposit","ACH","","","$500.00"',
        '"5/4/2026","5/4/2026","5/5/2026","","ACH Deposit","ACH","","","$5.00"',
        '"5/4/2026","5/4/2026","5/5/2026","SPY","SPY 5/8/2026 Call $700.00","BTO","1","$1.00","($100.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","HL","Hecla Mining","Buy","2","$5.00","($10.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","","Gold Subscription Fee","GOLD","","","($5.00)"',
        '""',
        '"","","","","","","","","","The data provided is for informational purposes only. Please consult a professional tax service or personal tax advisor."'
      ].join('\n');
      ctx.preview = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ''
      }, ctx.ss);
      ctx.assertWritable();
      ctx.firstImport = importInvestmentActivityFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ctx.preview.cutoffDate,
        expectedDigest: ctx.preview.digest
      }, ctx.ss);
      ctx.assertWritable();
      ctx.secondImport = importInvestmentActivityFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ctx.preview.cutoffDate,
        expectedDigest: ctx.preview.digest
      }, ctx.ss);
      ctx.activityRows = ctx.ss.getSheetByName(names.INVESTMENT_ACTIVITY).getLastRow() - 1;
      ctx.holdingsRows = ctx.ss.getSheetByName(names.INVESTMENT_HOLDINGS)
        .getDataRange().getDisplayValues();
      ctx.inputHeadersAfter = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
      ctx.actions.push('Preview and import a synthetic Robinhood CSV twice through production writers');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Investment activity import';
      ctx.assert.equals('Start date auto-detected', ctx.preview.cutoffDate, '2026-04-27', { module: mod });
      ctx.assert.equals('Accepted portfolio rows', ctx.preview.summary.acceptedCount, 7, { module: mod });
      ctx.assert.equals('Excluded non-portfolio rows', ctx.preview.summary.excludedCount, 6, { module: mod });
      ctx.assert.equals('Options excluded', ctx.preview.summary.excludedByReason.OPTIONS_ACTIVITY, 1, { module: mod });
      ctx.assert.equals('Unrelated holding excluded', ctx.preview.summary.excludedByReason.OUTSIDE_PORTFOLIO, 1, { module: mod });
      ctx.assert.equals('Admin cash and matching fee offset excluded', ctx.preview.summary.excludedByReason.CASH_OR_ADMIN, 2, { module: mod });
      ctx.assert.equals('Robinhood disclaimer footer excluded', ctx.preview.summary.excludedByReason.NON_ACTIVITY_FOOTER, 1, { module: mod });
      ctx.assert.equals('Contribution total', ctx.preview.summary.contributions, 500, { module: mod });
      ctx.assert.equals('Opening capital reconstructed', ctx.preview.summary.openingCapital, 4000, { module: mod });
      ctx.assert.equals('Total capital includes opening funding', ctx.preview.summary.totalCapitalAdded, 4500, { module: mod });
      ctx.assert.equals('Purchase total', ctx.preview.summary.purchases, 4425, { module: mod });
      ctx.assert.equals('Dividend total', ctx.preview.summary.dividends, 10, { module: mod });
      ctx.assert.equals('First import appends all accepted rows', ctx.firstImport.appendedRows, 7, { module: mod });
      ctx.assert.equals('Second import appends no rows', ctx.secondImport.appendedRows, 0, { module: mod });
      ctx.assert.equals('Second import reports all duplicates', ctx.secondImport.duplicateRows, 7, { module: mod });
      ctx.assert.equals('Activity ledger remains deduplicated', ctx.activityRows, 7, { module: mod });
      ctx.assert.equals('Holdings contains two tickers', ctx.firstImport.holdings.length, 2, { module: mod });
      var qqq = ctx.firstImport.holdings.filter(function(row) { return row.ticker === 'QQQ'; })[0];
      var jepq = ctx.firstImport.holdings.filter(function(row) { return row.ticker === 'JEPQ'; })[0];
      ctx.assert.equals('QQQ quantity reconciles', round2_(qqq.quantity), 5.5, { module: mod });
      ctx.assert.equals('JEPQ quantity reconciles', round2_(jepq.quantity), 21.5, { module: mod });
      ctx.assert.equals('JEPQ dividend reconciles', jepq.dividendsReceived, 10, { module: mod });
      ctx.assert.equals('INPUT Investments schema unchanged', JSON.stringify(ctx.inputHeadersAfter),
        JSON.stringify(ctx.inputHeadersBefore), { module: mod });
    }
  };
}
