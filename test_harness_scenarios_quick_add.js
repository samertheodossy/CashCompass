/**
 * test_harness_scenarios_quick_add.js — Quick Add reliability regression.
 *
 * Uses a disposable workbook and production workbook-scoped seams only. It
 * never resolves or writes the configured Central default or a bounded/user
 * workbook.
 */

/**
 * Verify late-edit detection and compare-and-set restore behavior without
 * replaying Quick Add or creating a duplicate Activity entry.
 */
function getHarnessQuickAddWriteGuardScenario_() {
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();
  var cashFlowName = (typeof getCashFlowSheetName_ === 'function')
    ? getCashFlowSheetName_(year) : ('INPUT - Cash Flow ' + year);

  return {
    id: 'REGRESSION-QUICK-ADD-WRITE-GUARD',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Validate Quick Add late-edit detection and duplicate-safe guarded restore.',
    expectedSheets: [cashFlowName],
    setup: function(ctx) {
      ctx.assertWritable();
      var sheet = buildCashFlowYearSheet_(ctx.ss, year);
      var payee = 'Harness Paycheck';
      var rowInfo = findCashFlowRowByTypeAndPayee_(sheet, 'Income', payee);
      if (!rowInfo) rowInfo = insertCashFlowRow_(sheet, 'Income', payee, 'CASH');

      var entryDate = new Date(year, 6, 17); // July 17, local time.
      var monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
      sheet.getRange(rowInfo.row, monthCol).setValue(0);

      ctx.quickAddGuard = {
        sheet: sheet,
        row: rowInfo.row,
        monthCol: monthCol,
        receipt: {
          operationId: 'HARNESS-QUICK-ADD-GUARD',
          entryType: 'Income',
          payee: payee,
          entryDate: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          previousValue: 0,
          newValue: 5929.64,
          signedAmount: 5929.64,
          cashFlowSheet: cashFlowName,
          cashFlowMonth: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy'),
          workbookIdentity: quickAddWorkbookIdentity_(ctx.ss)
        }
      };
      ctx.actions.push('Build canonical disposable Cash Flow sheet and seed a reverted Quick Add target');
    },
    actions: function(ctx) {
      var guard = ctx.quickAddGuard;
      var sourceDate = guard.receipt.entryDate;
      try {
        ctx.assertWritable();
        quickAddPayment({
          entryType: 'Expense',
          payee: 'Harness New Source Required',
          entryDate: sourceDate,
          amount: 45,
          createIfMissing: true,
          activityOrigin: 'direct_quick_add'
        }, ctx.ss);
      } catch (missingSourceErr) {
        guard.missingSourceError = String(missingSourceErr && missingSourceErr.message || missingSourceErr);
      }
      guard.missingSourceRow = findCashFlowRowByTypeAndPayee_(
        guard.sheet,
        'Expense',
        'Harness New Source Required'
      );

      ctx.assertWritable();
      guard.expenseWithSource = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness New Source Required',
        entryDate: sourceDate,
        amount: 45,
        createIfMissing: true,
        flowSource: 'CREDIT_CARD',
        suppressActivityLog: true,
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      var sourcedExpenseRow = findCashFlowRowByTypeAndPayee_(
        guard.sheet,
        'Expense',
        'Harness New Source Required'
      );
      var sourceHeaderMap = getCashFlowHeaderMap_(guard.sheet);
      guard.expenseFlowSource = guard.sheet.getRange(
        sourcedExpenseRow.row,
        sourceHeaderMap.flowSourceCol
      ).getDisplayValue();

      ctx.assertWritable();
      guard.incomeDefaultSource = quickAddPayment({
        entryType: 'Income',
        payee: 'Harness New Income Source',
        entryDate: sourceDate,
        amount: 75,
        createIfMissing: true,
        suppressActivityLog: true,
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      var sourcedIncomeRow = findCashFlowRowByTypeAndPayee_(
        guard.sheet,
        'Income',
        'Harness New Income Source'
      );
      guard.incomeFlowSource = guard.sheet.getRange(
        sourcedIncomeRow.row,
        sourceHeaderMap.flowSourceCol
      ).getDisplayValue();

      guard.before = inspectQuickAddWriteInSpreadsheet_(ctx.ss, normalizeQuickAddWriteReceipt_(guard.receipt));

      ctx.assertWritable();
      guard.firstRestore = restoreQuickAddPaymentWriteInSpreadsheet_(ctx.ss, guard.receipt);
      guard.afterFirst = Number(guard.sheet.getRange(guard.row, guard.monthCol).getValue());

      // A retry must be a no-op MATCH, not another additive write.
      ctx.assertWritable();
      guard.secondRestore = restoreQuickAddPaymentWriteInSpreadsheet_(ctx.ss, guard.receipt);
      guard.afterSecond = Number(guard.sheet.getRange(guard.row, guard.monthCol).getValue());

      // A distinct newer value must be preserved and the restore refused.
      ctx.assertWritable();
      guard.sheet.getRange(guard.row, guard.monthCol).setValue(6000);
      guard.refusedRestore = restoreQuickAddPaymentWriteInSpreadsheet_(ctx.ss, guard.receipt);
      guard.afterRefusal = Number(guard.sheet.getRange(guard.row, guard.monthCol).getValue());
      guard.activitySheetCreated = !!ctx.ss.getSheetByName('LOG - Activity');
      ctx.actions.push('Restore once, retry once, then verify a distinct newer value is preserved');
    },
    expectedOutcome: function(ctx) {
      var guard = ctx.quickAddGuard;
      var mod = 'Quick Add Write Guard';
      ctx.assert.equals('Missing source is rejected before row creation',
        String(guard.missingSourceError || '').indexOf('Payment source is required') !== -1,
        true, { module: mod });
      ctx.assert.equals('Missing-source attempt creates no row',
        guard.missingSourceRow, null, { module: mod });
      ctx.assert.equals('Chosen new Expense source is persisted',
        guard.expenseFlowSource, 'CREDIT_CARD', { module: mod });
      ctx.assert.equals('New Income source defaults to cash',
        guard.incomeFlowSource, 'CASH', { module: mod });
      ctx.assert.equals('Late edit is detected', guard.before.status, 'REVERTED_TO_PREVIOUS', { module: mod });
      ctx.assert.equals('First guarded restore succeeds', guard.firstRestore.status, 'RESTORED', { module: mod });
      ctx.assert.equals('Expected amount is restored', guard.afterFirst, 5929.64, { module: mod });
      ctx.assert.equals('Restore retry is a no-op match', guard.secondRestore.status, 'MATCH', { module: mod });
      ctx.assert.equals('Restore retry does not add twice', guard.afterSecond, 5929.64, { module: mod });
      ctx.assert.equals('Different newer value blocks restore', guard.refusedRestore.status, 'RESTORE_REFUSED', { module: mod });
      ctx.assert.equals('Different newer value remains intact', guard.afterRefusal, 6000, { module: mod });
      ctx.assert.equals('Restore creates no Activity entry', guard.activitySheetCreated, false, { module: mod });
    }
  };
}

/**
 * Verify the immutable 5i correction writer on an exact disposable target:
 * existing Cash Flow + credit-card side effects, created-row removal,
 * immutable correction evidence, retry rejection, and changed-state refusal.
 */
function getHarnessDirectQuickAddCorrectionScenario_() {
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();
  return {
    id: 'REGRESSION-DIRECT-QUICK-ADD-CORRECTION',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Validate safe Activity correction for direct Quick Add operations and fail-closed linked/changed state.',
    expectedSheets: [
      getCashFlowSheetName_(year),
      getSheetNames_().DEBTS,
      ACTIVITY_LOG_SHEET_NAME
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      var cashFlow = buildCashFlowYearSheet_(ctx.ss, year);
      insertCashFlowRow_(cashFlow, 'Expense', 'Harness Visa', 'CREDIT_CARD');
      insertCashFlowRow_(cashFlow, 'Expense', 'Harness Correction Chain', 'CASH');

      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debtSheet = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
      var debtMap = getDebtsHeaderMap_(debtSheet);
      var totalRow = findDebtTotalRow_(debtSheet, debtMap);
      harnessInsertBeforeByHeader_(debtSheet, totalRow, {
        'Account Name': 'Harness Visa',
        'Type': 'Credit Card',
        'Account Balance': 500,
        'Due Date': 15,
        'Credit Limit': 2000,
        'Minimum Payment': 25,
        'Credit Left': 1500,
        'Int Rate': 20,
        'Acct PCT Avail': 75,
        'Active': 'Yes'
      });
      refreshDebtsTotalRow_(debtSheet, debtMap, findDebtTotalRow_(debtSheet, debtMap));
      ctx.quickAddCorrection = {
        date: year + '-07-18',
        cashFlow: cashFlow,
        debtSheet: debtSheet
      };
      ctx.actions.push('Seed direct Quick Add Cash Flow and credit-card targets');
    },
    actions: function(ctx) {
      var state = ctx.quickAddCorrection;
      ctx.assertWritable();
      state.cardWrite = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Visa',
        entryDate: state.date,
        amount: 120,
        createIfMissing: false,
        flowSource: 'CREDIT_CARD',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      state.cardPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.cardWrite.activitySnapshot.operationId
      );

      ctx.assertWritable();
      state.cardCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.cardWrite.activitySnapshot.operationId,
        'Entered twice',
        ''
      );
      var cardRow = findCashFlowRowByTypeAndPayee_(
        state.cashFlow,
        'Expense',
        'Harness Visa'
      );
      var cardMonthCol = getMonthColumnByDate_(
        state.cashFlow,
        parseIsoDateLocal_(state.date),
        1
      );
      state.cardValueAfterCorrection = Number(
        state.cashFlow.getRange(cardRow.row, cardMonthCol).getValue()
      );
      var cardDebtMap = getDebtsHeaderMap_(state.debtSheet);
      var cardDebtRows = state.debtSheet.getDataRange().getDisplayValues();
      state.cardDebtAfterCorrection = null;
      for (var cardDebtIndex = 1; cardDebtIndex < cardDebtRows.length; cardDebtIndex++) {
        if (String(cardDebtRows[cardDebtIndex][cardDebtMap.nameColZero] || '').trim() === 'Harness Visa') {
          state.cardDebtAfterCorrection = Number(
            state.debtSheet.getRange(
              cardDebtIndex + 1,
              cardDebtMap.balanceCol
            ).getValue()
          );
        }
      }
      state.cardRetry = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.cardWrite.activitySnapshot.operationId
      );

      ctx.assertWritable();
      state.createdWrite = quickAddPayment({
        entryType: 'Income',
        payee: 'Harness One-Time Income',
        entryDate: state.date,
        amount: 250,
        createIfMissing: true,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.createdCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.createdWrite.activitySnapshot.operationId,
        'Wrong payee/date',
        ''
      );

      ctx.assertWritable();
      state.changedWrite = quickAddPayment({
        entryType: 'Income',
        payee: 'Harness Salary',
        entryDate: state.date,
        amount: 1000,
        createIfMissing: true,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      var changedRow = findCashFlowRowByTypeAndPayee_(
        state.cashFlow,
        'Income',
        'Harness Salary'
      );
      var changedCol = getMonthColumnByDate_(
        state.cashFlow,
        parseIsoDateLocal_(state.date),
        1
      );
      ctx.assertWritable();
      state.cashFlow.getRange(changedRow.row, changedCol).setValue(1100);
      state.changedPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.changedWrite.activitySnapshot.operationId
      );
      ctx.assertWritable();
      state.changedCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.changedWrite.activitySnapshot.operationId,
        'Wrong amount',
        ''
      );
      state.changedValue = Number(
        state.cashFlow.getRange(changedRow.row, changedCol).getValue()
      );

      ctx.assertWritable();
      state.chain100 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Correction Chain',
        entryDate: state.date,
        amount: 100,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.chain25 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Correction Chain',
        entryDate: state.date,
        amount: 25,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.chain50 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Correction Chain',
        entryDate: state.date,
        amount: 50,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      state.chainMiddlePreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.chain25.activitySnapshot.operationId
      );
      ctx.assertWritable();
      state.chainMiddleCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.chain25.activitySnapshot.operationId,
        'Wrong amount',
        ''
      );

      var chainRow = findCashFlowRowByTypeAndPayee_(
        state.cashFlow,
        'Expense',
        'Harness Correction Chain'
      );
      var chainCol = getMonthColumnByDate_(
        state.cashFlow,
        parseIsoDateLocal_(state.date),
        1
      );
      state.chainAfterMiddle = Number(
        state.cashFlow.getRange(chainRow.row, chainCol).getValue()
      );

      // A new entry recorded after a correction must start a valid next link,
      // not make the earlier Activity sequence permanently read-only.
      ctx.assertWritable();
      state.chain10 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Correction Chain',
        entryDate: state.date,
        amount: 10,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      state.chainFirstPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.chain100.activitySnapshot.operationId
      );
      ctx.assertWritable();
      state.chainFirstCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.chain100.activitySnapshot.operationId,
        'Entered twice',
        ''
      );
      state.chainAfterFirst = Number(
        state.cashFlow.getRange(chainRow.row, chainCol).getValue()
      );
      state.chainLatestPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.chain10.activitySnapshot.operationId
      );
      ctx.assertWritable();
      state.chainLatestCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.chain10.activitySnapshot.operationId,
        'Entered twice',
        ''
      );
      state.chainAfterLatest = Number(
        state.cashFlow.getRange(chainRow.row, chainCol).getValue()
      );
      state.chainRemainingPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.chain50.activitySnapshot.operationId
      );

      // Credit-card sequences must replay both Cash Flow and debt side effects
      // when a non-latest operation is corrected.
      ctx.assertWritable();
      state.cardChain100 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Visa',
        entryDate: state.date,
        amount: 100,
        createIfMissing: false,
        flowSource: 'CREDIT_CARD',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.cardChain25 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Visa',
        entryDate: state.date,
        amount: 25,
        createIfMissing: false,
        flowSource: 'CREDIT_CARD',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.cardChain50 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Visa',
        entryDate: state.date,
        amount: 50,
        createIfMissing: false,
        flowSource: 'CREDIT_CARD',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      state.cardChainMiddlePreview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.cardChain25.activitySnapshot.operationId
      );
      ctx.assertWritable();
      state.cardChainMiddleCorrection = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.cardChain25.activitySnapshot.operationId,
        'Wrong amount',
        '',
        'change_amount',
        30
      );
      state.cardChainCashValue = Number(
        state.cashFlow.getRange(cardRow.row, chainCol).getValue()
      );

      // Amount edits remain one logical entry: edit a middle entry, edit the
      // replacement again, then remove that replacement while later entries
      // stay intact.
      ctx.assertWritable();
      state.edit100 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Amount Edit',
        entryDate: state.date,
        amount: 100,
        createIfMissing: true,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.edit36 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Amount Edit',
        entryDate: state.date,
        amount: 36,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.edit50 = quickAddPayment({
        entryType: 'Expense',
        payee: 'Harness Amount Edit',
        entryDate: state.date,
        amount: 50,
        createIfMissing: false,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ctx.ss);
      ctx.assertWritable();
      state.editNoChange = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.edit36.activitySnapshot.operationId,
        'Wrong amount',
        '',
        'change_amount',
        36
      );
      ctx.assertWritable();
      state.edit36to40 = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.edit36.activitySnapshot.operationId,
        'Wrong amount',
        '',
        'change_amount',
        40
      );
      state.edit40Preview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.edit36to40.replacementOperationId
      );
      ctx.assertWritable();
      state.edit40to45 = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.edit36to40.replacementOperationId,
        'Wrong amount',
        '',
        'change_amount',
        45
      );
      state.edit45Preview = previewDirectQuickAddCorrectionInSpreadsheet_(
        ctx.ss,
        state.edit40to45.replacementOperationId
      );
      ctx.assertWritable();
      state.edit45Remove = correctDirectQuickAddOperationInSpreadsheet_(
        ctx.ss,
        state.edit40to45.replacementOperationId,
        'Entered twice',
        '',
        'remove',
        null
      );
      var editRow = findCashFlowRowByTypeAndPayee_(
        state.cashFlow,
        'Expense',
        'Harness Amount Edit'
      );
      state.editFinalValue = Number(
        state.cashFlow.getRange(editRow.row, chainCol).getValue()
      );
      ctx.actions.push(
        'Correct existing/card and created-row writes; reverse newest, middle, earlier, and post-correction entries while preserving verified later state'
      );
    },
    expectedOutcome: function(ctx) {
      var state = ctx.quickAddCorrection;
      var mod = 'Direct Quick Add Correction';
      var date = parseIsoDateLocal_(state.date);
      var monthCol = getMonthColumnByDate_(state.cashFlow, date, 1);
      var cardRow = findCashFlowRowByTypeAndPayee_(
        state.cashFlow,
        'Expense',
        'Harness Visa'
      );
      var debtMap = getDebtsHeaderMap_(state.debtSheet);
      var debtRows = state.debtSheet.getDataRange().getDisplayValues();
      var debtBalance = null;
      for (var r = 1; r < debtRows.length; r++) {
        if (String(debtRows[r][debtMap.nameColZero] || '').trim() === 'Harness Visa') {
          debtBalance = Number(state.debtSheet.getRange(r + 1, debtMap.balanceCol).getValue());
        }
      }
      ctx.assert.equals('Direct operation preview is ready', state.cardPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Existing-row correction succeeds', state.cardCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Cash Flow exact prior value restored',
        state.cardValueAfterCorrection, 0, { module: mod });
      ctx.assert.equals('Credit-card exact prior balance restored',
        state.cardDebtAfterCorrection, 500, { module: mod });
      ctx.assert.equals('Corrected operation cannot run twice', state.cardRetry.status, 'ALREADY_CORRECTED', { module: mod });
      ctx.assert.equals('App-created row correction succeeds', state.createdCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Untouched app-created row is removed',
        findCashFlowRowByTypeAndPayee_(state.cashFlow, 'Income', 'Harness One-Time Income'),
        null, { module: mod });
      ctx.assert.equals('Changed state blocks preview', state.changedPreview.status, 'PRECONDITION_FAILED', { module: mod });
      ctx.assert.equals('Changed state blocks writer', state.changedCorrection.ok, false, { module: mod });
      ctx.assert.equals('Newer Cash Flow value is preserved', state.changedValue, 1100, { module: mod });
      ctx.assert.equals('Middle chain entry preview is ready',
        state.chainMiddlePreview.status, 'READY', { module: mod });
      ctx.assert.equals('Middle chain preview reports one later entry',
        state.chainMiddlePreview.laterEntryCount, 1, { module: mod });
      ctx.assert.equals('Middle chain correction succeeds',
        state.chainMiddleCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Middle $25 is removed while $100 and $50 remain',
        state.chainAfterMiddle, -150, { module: mod });
      ctx.assert.equals('Earlier entry remains correctable after a later new write',
        state.chainFirstPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Earlier chain correction succeeds',
        state.chainFirstCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Only active $50 and $10 entries remain',
        state.chainAfterFirst, -60, { module: mod });
      ctx.assert.equals('Newest entry remains independently correctable',
        state.chainLatestPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Post-correction newest entry reverses successfully',
        state.chainLatestCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Only active $50 remains after newest reversal',
        state.chainAfterLatest, -50, { module: mod });
      ctx.assert.equals('Remaining entry stays independently correctable',
        state.chainRemainingPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Credit-card middle entry preview is ready',
        state.cardChainMiddlePreview.status, 'READY', { module: mod });
      ctx.assert.equals('Credit-card middle entry amount changes successfully',
        state.cardChainMiddleCorrection.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Credit-card Cash Flow preserves $100 and $50 plus corrected $30',
        state.cardChainCashValue, -180, { module: mod });

      var debtRowsAfterChain = state.debtSheet.getDataRange().getDisplayValues();
      var debtBalanceAfterChain = null;
      for (var debtIndex = 1; debtIndex < debtRowsAfterChain.length; debtIndex++) {
        if (String(debtRowsAfterChain[debtIndex][debtMap.nameColZero] || '').trim() === 'Harness Visa') {
          debtBalanceAfterChain = Number(
            state.debtSheet.getRange(debtIndex + 1, debtMap.balanceCol).getValue()
          );
        }
      }
      ctx.assert.equals('Credit-card balance preserves matching $100, $30, and $50 effects',
        debtBalanceAfterChain, 320, { module: mod });
      ctx.assert.equals('Identical amount is rejected as a no-op',
        state.editNoChange.status, 'NO_CHANGE', { module: mod });
      ctx.assert.equals('Middle amount edit creates a new actionable operation',
        state.edit40Preview.status, 'READY', { module: mod });
      ctx.assert.equals('Replacement can be corrected again',
        state.edit45Preview.status, 'READY', { module: mod });
      ctx.assert.equals('Corrected replacement can be removed',
        state.edit45Remove.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Removing corrected middle entry preserves $100 and later $50',
        state.editFinalValue, -150, { module: mod });

      var activity = state.cashFlow.getParent().getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var rows = activity.getDataRange().getDisplayValues();
      var correctionCount = 0;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][1] === 'quick_pay_correction') correctionCount++;
      }
      ctx.assert.equals('Immutable correction events appended', correctionCount, 9, {
        module: mod,
        location: ACTIVITY_LOG_SHEET_NAME
      });
    }
  };
}
