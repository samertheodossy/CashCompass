/**
 * House Financial Accuracy schema + financing regression.
 *
 * The setup creates the real production Debts presentation, removes only the
 * new trailing column to simulate the retired schema, then exercises the real
 * migration and Property Performance calculation. All mutation is confined to
 * the harness-created disposable workbook and guarded by ctx.assertWritable().
 */
function getHarnessHouseLifecycleScenario_() {
  return {
    id: 'REGRESSION-HOUSE-LIFECYCLE',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Prove exact House Stop, inactive discovery, stale/duplicate-safe Reactivate, and preservation of values, assets, expenses, and linked debt evidence.',
    expectedSheets: [
      'INPUT - Settings',
      getSheetNames_().HOUSE_VALUES,
      getSheetNames_().HOUSE_ASSETS,
      'HOUSES - Harness Lifecycle House',
      getSheetNames_().DEBTS,
      ACTIVITY_LOG_SHEET_NAME,
      'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      var year = getCurrentYear_();
      var houseName = 'Harness Lifecycle House';
      var hvSheet = ensureInputHouseValuesSheet_(ctx.ss);
      var haSheet = ensureSysHouseAssetsSheet_(ctx.ss);
      var block = getHouseValuesYearBlock_(hvSheet, year);
      var hvRow = insertNewHouseHistoryRow_(hvSheet, block, houseName, 412345.67);
      var hvHeaders = hvSheet.getRange(block.headerRow, 1, 1, hvSheet.getLastColumn())
        .getDisplayValues()[0];
      var hvActiveCol = hvHeaders.map(function(value) {
        return String(value || '').trim().toLowerCase();
      }).indexOf('active') + 1;
      if (hvActiveCol < 1) throw new Error('House lifecycle fixture could not resolve Active.');
      var janCol = getMonthColumnByDate_(hvSheet, new Date(year, 0, 15), block.headerRow);
      var julCol = getMonthColumnByDate_(hvSheet, new Date(year, 6, 15), block.headerRow);
      hvSheet.getRange(hvRow, janCol).setValue(825000);
      hvSheet.getRange(hvRow, julCol).setValue(910500.25);
      appendHouseAssetsRowForNewHouse_(
        haSheet, houseName, 'Rental', 412345.67, 910500.25);

      var houseSheet = createHousesExpenseSheet_(ctx.ss, houseName).sheet;
      houseSheet.getRange(3, 1, 1, 9).setValues([[
        'Roof reserve', 'Repair', year + '-04-12', houseName,
        2350.75, 125, 'No', 'Receipt-42', 'Preserve lifecycle expense history'
      ]]);

      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debts = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
      var debtMap = ensureDebtsLinkedPropertyColumn_(debts, ctx.ss);
      var totalRow = findDebtTotalRow_(debts, debtMap);
      var debtRow = harnessInsertBeforeByHeader_(debts, totalRow, {
        'Account Name': 'Harness Lifecycle Mortgage',
        'Type': 'Loan',
        'Account Balance': 412345.67,
        'Due Date': 15,
        'Credit Limit': 0,
        'Minimum Payment': 2750,
        'Credit Left': -412345.67,
        'Int Rate': 4.5,
        'Acct PCT Avail': 0,
        'Active': 'Yes',
        'Linked Property': houseName
      });

      appendActivityLog_(ctx.ss, {
        eventType: 'house_add',
        entryDate: year + '-01-15',
        amount: 910500.25,
        direction: 'expense',
        payee: houseName,
        category: 'Rental',
        accountSource: '',
        cashFlowSheet: '',
        cashFlowMonth: '',
        dedupeKey: '',
        details: JSON.stringify({ detailsVersion: 1, fixture: true })
      });

      var haMap = getHouseAssetsHeaderMap_(haSheet);
      var haDisplay = haSheet.getDataRange().getDisplayValues();
      var sysRow = -1;
      for (var r = 1; r < haDisplay.length; r++) {
        if (String(haDisplay[r][haMap.houseColZero] || '') === houseName) {
          sysRow = r + 1;
          break;
        }
      }
      if (sysRow < 2) throw new Error('House lifecycle fixture could not resolve SYS identity.');

      ctx.houseLifecycle = {
        year: year,
        houseName: houseName,
        hvSheet: hvSheet,
        haSheet: haSheet,
        houseSheet: houseSheet,
        debts: debts,
        debtRow: debtRow,
        debtMap: debtMap,
        hvRow: hvRow,
        hvActiveCol: hvActiveCol,
        sysRow: sysRow,
        haMap: haMap,
        hvBefore: hvSheet.getRange(hvRow, 1, 1, hvSheet.getLastColumn()).getDisplayValues()[0],
        haBefore: haSheet.getRange(sysRow, 1, 1, haSheet.getLastColumn()).getDisplayValues()[0],
        houseSheetBefore: houseSheet.getDataRange().getDisplayValues(),
        debtLinkBefore: debts.getRange(debtRow, debtMap.linkedPropertyCol).getDisplayValue()
      };
      ctx.actions.push('Create one exact House identity across values, assets, expenses, debt linkage, and Activity');
    },
    actions: function(ctx) {
      var state = ctx.houseLifecycle;
      ctx.assertWritable();
      state.firstStop = deactivateHouseFromDashboard(
        { houseName: state.houseName }, ctx.ss);
      state.afterStop = getHouseUiDataForSpreadsheet_(ctx.ss);

      try {
        reactivateHouseFromDashboard({
          sysHouseAssetsRow: state.sysRow,
          expectedHouseName: state.houseName + ' stale'
        }, ctx.ss);
        state.staleError = '';
      } catch (staleErr) {
        state.staleError = String(staleErr && staleErr.message || staleErr);
      }
      try {
        reactivateHouseFromDashboard({
          sysHouseAssetsRow: state.sysRow + 50,
          expectedHouseName: state.houseName
        }, ctx.ss);
        state.removedError = '';
      } catch (removedErr) {
        state.removedError = String(removedErr && removedErr.message || removedErr);
      }

      var duplicate = [];
      for (var c = 0; c < state.haSheet.getLastColumn(); c++) duplicate[c] = '';
      duplicate[state.haMap.houseColZero] = state.houseName;
      duplicate[state.haMap.typeColZero] = 'Rental';
      duplicate[state.haMap.loanColZero] = 1;
      duplicate[state.haMap.valueColZero] = 1;
      duplicate[state.haMap.activeColZero] = 'No';
      state.haSheet.appendRow(duplicate);
      try {
        reactivateHouseFromDashboard({
          sysHouseAssetsRow: state.sysRow,
          expectedHouseName: state.houseName
        }, ctx.ss);
        state.ambiguousError = '';
      } catch (ambiguousErr) {
        state.ambiguousError = String(ambiguousErr && ambiguousErr.message || ambiguousErr);
      }
      state.haSheet.deleteRow(state.haSheet.getLastRow());

      state.reactivate = reactivateHouseFromDashboard({
        sysHouseAssetsRow: state.sysRow,
        expectedHouseName: state.houseName
      }, ctx.ss);
      state.afterReactivate = getHouseUiDataForSpreadsheet_(ctx.ss);
      state.hvAfterReactivate = state.hvSheet
        .getRange(state.hvRow, 1, 1, state.hvSheet.getLastColumn()).getDisplayValues()[0];
      state.haAfterReactivate = state.haSheet
        .getRange(state.sysRow, 1, 1, state.haSheet.getLastColumn()).getDisplayValues()[0];
      state.houseSheetAfterReactivate = state.houseSheet.getDataRange().getDisplayValues();
      state.debtLinkAfterReactivate = state.debts
        .getRange(state.debtRow, state.debtMap.linkedPropertyCol).getDisplayValue();
      state.alreadyActive = reactivateHouseFromDashboard({
        sysHouseAssetsRow: state.sysRow,
        expectedHouseName: state.houseName
      }, ctx.ss);

      try {
        validateNewHouseName_(state.houseName, ctx.ss);
        state.duplicateAddError = '';
      } catch (duplicateAddErr) {
        state.duplicateAddError = String(
          duplicateAddErr && duplicateAddErr.message || duplicateAddErr);
      }

      state.secondStop = deactivateHouseFromDashboard(
        { houseName: state.houseName }, ctx.ss);
      state.afterSecondStop = getHouseUiDataForSpreadsheet_(ctx.ss);
      state.hvAfterSecondStop = state.hvSheet
        .getRange(state.hvRow, 1, 1, state.hvSheet.getLastColumn()).getDisplayValues()[0];

      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var activityRows = activity ? activity.getDataRange().getDisplayValues() : [];
      state.addAuditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'house_add' && String(row[5] || '') === state.houseName;
      }).length;
      state.stopAuditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'house_deactivate' && String(row[5] || '') === state.houseName;
      }).length;
      state.reactivateAuditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'house_reactivate' && String(row[5] || '') === state.houseName;
      }).length;
      ctx.actions.push('Run active → inactive → active → inactive through production lifecycle writers');
    },
    expectedOutcome: function(ctx) {
      var state = ctx.houseLifecycle;
      var mod = 'House Lifecycle';
      ctx.assert.equals('First Stop succeeds', state.firstStop.ok, true, { module: mod });
      ctx.assert.equals('Stopped House leaves active inventory',
        state.afterStop.houses.indexOf(state.houseName), -1, { module: mod });
      ctx.assert.equals('Stopped House appears exactly once in inactive inventory',
        state.afterStop.inactiveHouses.filter(function(row) {
          return row.houseName === state.houseName && row.sysHouseAssetsRow === state.sysRow;
        }).length, 1, { module: mod });
      ctx.assert.equals('Stale expected name fails safely',
        /moved/.test(state.staleError), true, { module: mod });
      ctx.assert.equals('Removed or moved row fails safely',
        /moved/.test(state.removedError), true, { module: mod });
      ctx.assert.equals('Ambiguous duplicate identity fails safely',
        /ambiguous/.test(state.ambiguousError), true, { module: mod });
      ctx.assert.equals('Reactivate succeeds', state.reactivate.ok, true, { module: mod });
      ctx.assert.equals('Reactivate returns the House to active inventory',
        state.afterReactivate.houses.filter(function(name) {
          return name === state.houseName;
        }).length, 1, { module: mod });
      ctx.assert.equals('Reactivate removes the House from inactive inventory',
        state.afterReactivate.inactiveHouses.filter(function(row) {
          return row.houseName === state.houseName;
        }).length, 0, { module: mod });
      ctx.assert.equals('House Values configuration and history survive Reactivate',
        JSON.stringify(state.hvAfterReactivate), JSON.stringify(state.hvBefore), { module: mod });
      ctx.assert.equals('House Assets configuration survives Reactivate',
        JSON.stringify(state.haAfterReactivate), JSON.stringify(state.haBefore), { module: mod });
      ctx.assert.equals('House expense history survives Reactivate',
        JSON.stringify(state.houseSheetAfterReactivate),
        JSON.stringify(state.houseSheetBefore), { module: mod });
      ctx.assert.equals('Linked debt relationship survives Reactivate',
        state.debtLinkAfterReactivate, state.debtLinkBefore, { module: mod });
      ctx.assert.equals('Already-active Reactivate is an identity-preserving no-op',
        state.alreadyActive.alreadyActive, true, { module: mod });
      ctx.assert.equals('Add refuses an existing active or inactive House identity',
        /already exists/.test(state.duplicateAddError), true, { module: mod });
      ctx.assert.equals('Second Stop succeeds', state.secondStop.ok, true, { module: mod });
      ctx.assert.equals('Second Stop returns one preserved inactive identity',
        state.afterSecondStop.inactiveHouses.filter(function(row) {
          return row.houseName === state.houseName;
        }).length, 1, { module: mod });
      ctx.assert.equals('Second Stop changes only the House Values Active cell',
        JSON.stringify(state.hvAfterSecondStop),
        JSON.stringify(state.hvBefore.map(function(value, index) {
          return index === state.hvActiveCol - 1 ? 'No' : value;
        })),
        { module: mod });
      ctx.assert.equals('Pre-existing House Activity remains', state.addAuditCount, 1, { module: mod });
      ctx.assert.equals('Two Stops write two lifecycle events', state.stopAuditCount, 2, { module: mod });
      ctx.assert.equals('Reactivate writes one lifecycle event', state.reactivateAuditCount, 1, { module: mod });
      ctx.assert.equals('Exactly one House Assets identity remains',
        state.haSheet.getDataRange().getDisplayValues().filter(function(row, index) {
          return index > 0 && String(row[state.haMap.houseColZero] || '') === state.houseName;
        }).length, 1, { module: mod });
      ctx.assert.equals('Exactly one House expense sheet remains',
        ctx.ss.getSheets().filter(function(sheet) {
          return sheet.getName() === 'HOUSES - ' + state.houseName;
        }).length, 1, { module: mod });
    }
  };
}

function getHarnessHouseDebtLinkSchemaScenario_() {
  return {
    id: 'REGRESSION-HOUSE-DEBT-LINK-SCHEMA',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Evolve a styled legacy Debts sheet and reconcile linked actual loan payments into Property Performance.',
    expectedSheets: [
      getSheetNames_().DEBTS,
      getSheetNames_().HOUSE_ASSETS,
      getCashFlowSheetName_(getCurrentYear_())
    ],
    setup: function(ctx) {
      var year = getCurrentYear_();
      ctx.assertWritable();
      var houseAssets = ensureSysHouseAssetsSheet_(ctx.ss);
      harnessAppendByHeader_(houseAssets, {
        'House': 'Harness Rental',
        'Type': 'Rental',
        'Loan Amount Left': 180000,
        'Current Value': 300000,
        'Active': 'Yes'
      });
      createHousesExpenseSheet_(ctx.ss, 'Harness Rental');

      ctx.assertWritable();
      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debts = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
      var currentMap = getDebtsHeaderMap_(debts);
      debts.deleteColumn(currentMap.linkedPropertyCol);
      var legacyHeaders = DEBTS_REQUIRED_HEADERS_.slice(0, DEBTS_REQUIRED_HEADERS_.length - 1);
      var legacyMap = getDebtsHeaderMap_(debts);
      var totalRow = findDebtTotalRow_(debts, legacyMap);
      var debtRow = harnessInsertBeforeByHeader_(debts, totalRow, {
        'Account Name': 'Harness Mortgage',
        'Type': 'Loan',
        'Account Balance': 180000,
        'Due Date': 15,
        'Credit Limit': 0,
        'Minimum Payment': 1450,
        'Credit Left': -180000,
        'Int Rate': 4.25,
        'Acct PCT Avail': 0,
        'Active': 'Yes'
      });
      applyDebtsSheetStyling_(debts);

      ctx.assertWritable();
      var cashFlow = buildCashFlowYearSheet_(ctx.ss, year);
      var rentRow = insertCashFlowRow_(cashFlow, 'Income', 'Rent Harness Rental', 'CASH').row;
      var paymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness Mortgage', 'CASH').row;
      var helocPaymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness HELOC', 'CASH').row;
      var inactivePaymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness Inactive Loan', 'CASH').row;
      var duplicateDebtPaymentRow = insertCashFlowRow_(
        cashFlow, 'Expense', 'Harness Duplicate Debt', 'CASH').row;
      var ambiguousPaymentRowA = insertCashFlowRow_(
        cashFlow, 'Expense', 'Harness Ambiguous Loan', 'CASH').row;
      // Production insertion is intentionally idempotent by Type + Payee, so
      // it cannot create this retired/malformed state. Copy the production row
      // once inside the disposable fixture to prove reconciliation fails
      // closed when a legacy workbook already contains duplicate payment rows.
      ctx.assertWritable();
      cashFlow.insertRowAfter(ambiguousPaymentRowA);
      var ambiguousPaymentRowB = ambiguousPaymentRowA + 1;
      cashFlow.getRange(ambiguousPaymentRowA, 1, 1, cashFlow.getLastColumn()).copyTo(
        cashFlow.getRange(ambiguousPaymentRowB, 1, 1, cashFlow.getLastColumn()));
      var janCol = getMonthColumnByDate_(cashFlow, new Date(year, 0, 15), 1);
      var febCol = getMonthColumnByDate_(cashFlow, new Date(year, 1, 15), 1);
      setCurrencyCellPreserveRowFormat_(cashFlow, rentRow, janCol, 12000, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, paymentRow, janCol, 1000, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, paymentRow, febCol, 1100, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, helocPaymentRow, janCol, 500, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, inactivePaymentRow, janCol, 9999, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, duplicateDebtPaymentRow, janCol, 777, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, ambiguousPaymentRowA, janCol, 333, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, ambiguousPaymentRowB, janCol, 444, 5);

      ctx.houseDebtLinkSchema = {
        year: year,
        sheet: debts,
        debtRow: debtRow,
        beforeHeaders: legacyHeaders,
        beforeRow: debts.getRange(debtRow, 1, 1, legacyHeaders.length).getValues()[0],
        beforeTotal: debts.getRange(debtRow + 1, 1).getDisplayValue(),
        activeHeaderBackground: debts.getRange(1, legacyMap.activeCol).getBackground(),
        activeHeaderFontColor: debts.getRange(1, legacyMap.activeCol).getFontColor(),
        activeHeaderFontWeight: debts.getRange(1, legacyMap.activeCol).getFontWeight(),
        activeBodyBackground: debts.getRange(debtRow, legacyMap.activeCol).getBackground(),
        totalRowBackground: debts.getRange(debtRow + 1, 1).getBackground()
      };
      ctx.actions.push(
        'Create production-styled legacy Debts fixture, actual Cash Flow payments, and one guarded malformed duplicate');
    },
    actions: function(ctx) {
      var state = ctx.houseDebtLinkSchema;
      ctx.assertWritable();
      state.firstMap = ensureDebtsLinkedPropertyColumn_(state.sheet, ctx.ss);
      state.afterFirstLastCol = state.sheet.getLastColumn();
      state.afterFirstHeaders = state.sheet.getRange(
        1, 1, 1, state.afterFirstLastCol).getDisplayValues()[0];
      state.afterFirstRow = state.sheet.getRange(
        state.debtRow, 1, 1, state.beforeHeaders.length).getValues()[0];
      state.afterFirstTotal = state.sheet.getRange(state.debtRow + 1, 1).getDisplayValue();
      state.linkedHeaderBackground = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getBackground();
      state.linkedHeaderFontColor = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getFontColor();
      state.linkedHeaderFontWeight = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getFontWeight();
      state.linkedBodyBackground = state.sheet.getRange(
        state.debtRow, state.firstMap.linkedPropertyCol).getBackground();
      state.linkedWidth = state.sheet.getColumnWidth(state.firstMap.linkedPropertyCol);

      var validatedLink = validateDebtLinkedProperty_(ctx.ss, 'Loan', 'Harness Rental', '');
      state.sheet.getRange(state.debtRow, state.firstMap.linkedPropertyCol).setValue(validatedLink);

      var additionalDebts = [
        { name: 'Harness HELOC', type: 'HELOC', balance: 25000, active: 'Yes' },
        { name: 'Harness Missing Payment', type: 'Loan', balance: 15000, active: 'Yes' },
        { name: 'Harness Inactive Loan', type: 'Loan', balance: 9000, active: 'No' },
        { name: 'Harness Duplicate Debt', type: 'Loan', balance: 12000, active: 'Yes' },
        { name: 'Harness Duplicate Debt', type: 'Loan', balance: 11000, active: 'Yes' },
        { name: 'Harness Ambiguous Loan', type: 'Loan', balance: 10000, active: 'Yes' }
      ];
      additionalDebts.forEach(function(debt) {
        ctx.assertWritable();
        var liveMap = getDebtsHeaderMap_(state.sheet);
        var liveTotalRow = findDebtTotalRow_(state.sheet, liveMap);
        harnessInsertBeforeByHeader_(state.sheet, liveTotalRow, {
          'Account Name': debt.name,
          'Type': debt.type,
          'Account Balance': debt.balance,
          'Due Date': 15,
          'Credit Limit': debt.type === 'HELOC' ? 50000 : 0,
          'Minimum Payment': 250,
          'Credit Left': debt.type === 'HELOC' ? 25000 : -debt.balance,
          'Int Rate': 5,
          'Acct PCT Avail': debt.type === 'HELOC' ? 50 : 0,
          'Active': debt.active,
          'Linked Property': validateDebtLinkedProperty_(ctx.ss, debt.type, 'Harness Rental', '')
        });
      });
      var finalMap = getDebtsHeaderMap_(state.sheet);
      refreshDebtsTotalRow_(state.sheet, finalMap, findDebtTotalRow_(state.sheet, finalMap));
      applyDebtsSheetStyling_(state.sheet);
      applyDebtLinkedPropertyValidation_(state.sheet, ctx.ss, finalMap);

      ctx.assertWritable();
      state.secondMap = ensureDebtsLinkedPropertyColumn_(state.sheet, ctx.ss);
      state.afterSecondLastCol = state.sheet.getLastColumn();
      state.validation = state.sheet.getRange(
        state.debtRow, state.secondMap.linkedPropertyCol).getDataValidation();
      state.performance = getPropertyPerformanceDataForSpreadsheet_(ctx.ss, { year: state.year });
      state.performanceRow = state.performance.rows.filter(function(row) {
        return row.house === 'Harness Rental';
      })[0] || null;
      ctx.actions.push('Run production migration twice and reconcile the production Property Performance payload');
    },
    expectedOutcome: function(ctx) {
      var state = ctx.houseDebtLinkSchema;
      var mod = 'House Debt Link Schema';
      ctx.assert.equals('Linked Property is column 11', state.firstMap.linkedPropertyCol, 11, { module: mod });
      ctx.assert.equals('Linked Property is final header',
        state.afterFirstHeaders[state.afterFirstHeaders.length - 1],
        DEBTS_LINKED_PROPERTY_HEADER_, { module: mod });
      ctx.assert.equals('First ensure adds one column', state.afterFirstLastCol, 11, { module: mod });
      ctx.assert.equals('Second ensure adds no column', state.afterSecondLastCol, 11, { module: mod });
      ctx.assert.equals('Existing debt cells are preserved',
        JSON.stringify(state.afterFirstRow), JSON.stringify(state.beforeRow), { module: mod });
      ctx.assert.equals('TOTAL DEBT label is preserved', state.afterFirstTotal, state.beforeTotal, { module: mod });
      ctx.assert.equals('Active remains before Linked Property', state.secondMap.activeCol, 10, { module: mod });
      ctx.assert.equals('Active-property validation is present', !!state.validation, true, { module: mod });
      ctx.assert.equals('Linked Property header background inherits production styling',
        state.linkedHeaderBackground, state.activeHeaderBackground, { module: mod });
      ctx.assert.equals('Linked Property header font color inherits production styling',
        state.linkedHeaderFontColor, state.activeHeaderFontColor, { module: mod });
      ctx.assert.equals('Linked Property header weight inherits production styling',
        state.linkedHeaderFontWeight, state.activeHeaderFontWeight, { module: mod });
      ctx.assert.equals('Linked Property body background inherits production styling',
        state.linkedBodyBackground, state.activeBodyBackground, { module: mod });
      ctx.assert.equals('Linked Property canonical width', state.linkedWidth, 220, { module: mod });
      ctx.assert.equals('Header row remains frozen', state.sheet.getFrozenRows(), 1, { module: mod });
      ctx.assert.equals('TOTAL DEBT styling remains distinct from data row',
        state.totalRowBackground === state.activeBodyBackground, false, { module: mod });

      var finance = 'Property Financing';
      ctx.assert.equals('Property row is present', !!state.performanceRow, true, { module: finance });
      if (state.performanceRow) {
        ctx.assert.equals('Operating expenses remain separate',
          state.performanceRow.operatingExpenses, 0, { module: finance });
        ctx.assert.equals('Operating net remains rent minus operating expenses',
          state.performanceRow.operatingNet, 12000, { module: finance });
        ctx.assert.equals('Distinct linked loans sum selected-year Cash Flow',
          state.performanceRow.loanPayments, 2600, { module: finance });
        ctx.assert.equals('Net cash flow subtracts financing once',
          state.performanceRow.netCashFlow, 9400, { module: finance });
        ctx.assert.equals('Inactive linked debt is excluded from linked-loan count',
          state.performanceRow.linkedLoanCount, 6, { module: finance });
        ctx.assert.equals('Only recorded active loan rows are matched',
          state.performanceRow.matchedLoanCount, 2, { module: finance });
        ctx.assert.equals('Missing payment is surfaced without an estimate',
          state.performanceRow.financingMessage,
          'No loan payments recorded for this year.', { module: finance });
      }
      ctx.assert.equals('Duplicate linked debt names fail closed',
        String(state.performance.message || '').indexOf(
          'Duplicate linked debt names were excluded to prevent double counting.') !== -1,
        true, { module: finance });
      ctx.assert.equals('Duplicate Cash Flow payment rows fail closed',
        String(state.performance.message || '').indexOf(
          'Ambiguous loan-payment rows were excluded to prevent double counting.') !== -1,
        true, { module: finance });
      ctx.assert.equals('Portfolio loan payments reconcile to rows',
        state.performance.portfolio.loanPayments, 2600, { module: finance });
      ctx.assert.equals('Portfolio net cash flow reconciles to rows',
        state.performance.portfolio.netCashFlow, 9400, { module: finance });
    }
  };
}
