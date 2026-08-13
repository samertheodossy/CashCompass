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
