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
          cashFlowMonth: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy')
        }
      };
      ctx.actions.push('Build canonical disposable Cash Flow sheet and seed a reverted Quick Add target');
    },
    actions: function(ctx) {
      var guard = ctx.quickAddGuard;
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
