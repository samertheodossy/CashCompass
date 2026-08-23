/**
 * Income lifecycle regression. Every writer receives the harness-owned
 * disposable workbook explicitly; no mapped/bounded workbook is resolved.
 */
function getHarnessIncomeLifecycleScenario_() {
  return {
    id: 'REGRESSION-INCOME-LIFECYCLE',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Prove counted inactive Income discovery, exact-row Stop/Reactivate, Add separation, and preservation of every monthly value.',
    expectedSheets: [
      'INPUT - Settings',
      getCashFlowSheetName_(getCurrentYear_()),
      ACTIVITY_LOG_SHEET_NAME,
      'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      var year = getCurrentYear_();
      var sheet = buildCashFlowYearSheet_(ctx.ss, year);
      var first = insertCashFlowRow_(sheet, 'Income', 'Cisco Pay 1', 'DIRECT DEPOSIT');
      var second = insertCashFlowRow_(sheet, 'Income', 'Cisco Pay 2', 'STOCK');
      var map = getCashFlowHeaderMap_(sheet);
      var janCol = getMonthColumnByDate_(sheet, new Date(year, 0, 15), 1);
      var currentCol = getMonthColumnByDate_(sheet, new Date(), 1);
      sheet.getRange(first.row, janCol).setValue(4100.25);
      sheet.getRange(first.row, currentCol).setValue(4250.75);
      sheet.getRange(second.row, janCol).setValue(900.50);
      sheet.getRange(second.row, currentCol).setValue(1025.35);

      ctx.incomeLifecycle = {
        year: year,
        sheet: sheet,
        map: map,
        rows: [first.row, second.row],
        beforeRowCount: sheet.getLastRow(),
        beforeRows: [first.row, second.row].map(function(row) {
          return sheet.getRange(row, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
        })
      };
      ctx.actions.push('Create one two-row normalized recurring Income identity with distinct sources and historical/current amounts');
    },
    actions: function(ctx) {
      ctx.assertWritable();
      var state = ctx.incomeLifecycle;
      state.before = getIncomeSourcesForManagementFromDashboard(ctx.ss);
      state.activeToken = state.before.activeSources[0];
      state.firstStop = deactivateIncomeSourceFromDashboard(state.activeToken, ctx.ss);
      state.afterStop = getIncomeSourcesForManagementFromDashboard(ctx.ss);
      state.inactiveToken = state.afterStop.inactiveSources[0];

      var staleToken = JSON.parse(JSON.stringify(state.inactiveToken));
      staleToken.rows[0].payee = staleToken.rows[0].payee + ' stale';
      try {
        reactivateIncomeSourceFromDashboard(staleToken, ctx.ss);
        state.staleError = '';
      } catch (staleErr) {
        state.staleError = String(staleErr && staleErr.message || staleErr);
      }

      var duplicate = [];
      for (var c = 0; c < state.sheet.getLastColumn(); c++) duplicate[c] = '';
      duplicate[state.map.typeColZero] = 'Income';
      duplicate[state.map.payeeColZero] = 'Cisco Pay 3';
      duplicate[state.map.activeColZero] = 'NO';
      state.sheet.appendRow(duplicate);
      try {
        reactivateIncomeSourceFromDashboard(state.inactiveToken, ctx.ss);
        state.ambiguousError = '';
      } catch (ambiguousErr) {
        state.ambiguousError = String(ambiguousErr && ambiguousErr.message || ambiguousErr);
      }
      state.sheet.deleteRow(state.sheet.getLastRow());

      state.reactivate = reactivateIncomeSourceFromDashboard(state.inactiveToken, ctx.ss);
      state.afterReactivate = getIncomeSourcesForManagementFromDashboard(ctx.ss);
      state.afterReactivateRows = state.rows.map(function(row) {
        return state.sheet.getRange(row, 1, 1, state.sheet.getLastColumn()).getDisplayValues()[0];
      });
      state.alreadyActive = reactivateIncomeSourceFromDashboard(
        state.afterReactivate.activeSources[0], ctx.ss);
      state.secondStop = deactivateIncomeSourceFromDashboard(
        state.afterReactivate.activeSources[0], ctx.ss);
      state.afterSecondStop = getIncomeSourcesForManagementFromDashboard(ctx.ss);

      var beforeBlockedAdd = state.rows.map(function(row) {
        return state.sheet.getRange(row, 1, 1, state.sheet.getLastColumn()).getDisplayValues()[0];
      });
      try {
        addIncomeSourceFromDashboard({ sourceName: 'Cisco Salary', amount: 9999 }, ctx.ss);
        state.blockedAddError = '';
      } catch (addErr) {
        state.blockedAddError = String(addErr && addErr.message || addErr);
      }
      state.afterBlockedAddRows = state.rows.map(function(row) {
        return state.sheet.getRange(row, 1, 1, state.sheet.getLastColumn()).getDisplayValues()[0];
      });
      state.afterBlockedAddRowCount = state.sheet.getLastRow();

      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var activityRows = activity ? activity.getDataRange().getDisplayValues() : [];
      state.stopAuditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'income_deactivate' && String(row[5] || '') === 'Cisco Salary';
      }).length;
      state.reactivateAuditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'income_reactivate' && String(row[5] || '') === 'Cisco Salary';
      }).length;
      state.beforeBlockedAddRows = beforeBlockedAdd;
      ctx.actions.push('Run active → inactive → active → inactive through production writers and challenge stale/ambiguous/Add paths');
    },
    expectedOutcome: function(ctx) {
      var state = ctx.incomeLifecycle;
      var mod = 'Income Lifecycle';
      ctx.assert.equals('Two raw payees collapse to one active logical source', state.before.activeSources.length, 1, { module: mod });
      ctx.assert.equals('Active source carries both exact row identities', state.activeToken.rows.length, 2, { module: mod });
      ctx.assert.equals('First Stop succeeds', state.firstStop.ok, true, { module: mod });
      ctx.assert.equals('Stopping the final active source keeps the same management year', state.afterStop.year, state.year, { module: mod });
      ctx.assert.equals('Stopped source leaves active inventory', state.afterStop.activeSources.length, 0, { module: mod });
      ctx.assert.equals('Stopped source appears exactly once in inactive inventory', state.afterStop.inactiveSources.length, 1, { module: mod });
      ctx.assert.equals('Stale payee evidence fails safely', /moved or changed/.test(state.staleError), true, { module: mod });
      ctx.assert.equals('Additional matching row fails as ambiguous', /ambiguous/.test(state.ambiguousError), true, { module: mod });
      ctx.assert.equals('Reactivate succeeds', state.reactivate.ok, true, { module: mod });
      ctx.assert.equals('Reactivate restores one active logical source', state.afterReactivate.activeSources.length, 1, { module: mod });
      ctx.assert.equals('Reactivate removes the inactive source', state.afterReactivate.inactiveSources.length, 0, { module: mod });
      ctx.assert.equals('Reactivate preserves every non-lifecycle value byte-for-display', JSON.stringify(state.afterReactivateRows), JSON.stringify(state.beforeRows), { module: mod });
      ctx.assert.equals('Already-active Reactivate is a no-op', state.alreadyActive.alreadyActive, true, { module: mod });
      ctx.assert.equals('Second Stop succeeds', state.secondStop.ok, true, { module: mod });
      ctx.assert.equals('Second Stop returns the source to inactive inventory', state.afterSecondStop.inactiveSources.length, 1, { module: mod });
      ctx.assert.equals('Add refuses an inactive normalized identity', /Show inactive income sources/.test(state.blockedAddError), true, { module: mod });
      ctx.assert.equals('Blocked Add creates no row', state.afterBlockedAddRowCount, state.beforeRowCount, { module: mod });
      ctx.assert.equals('Blocked Add changes no preserved value', JSON.stringify(state.afterBlockedAddRows), JSON.stringify(state.beforeBlockedAddRows), { module: mod });
      ctx.assert.equals('Two Stops write two non-monetary lifecycle events', state.stopAuditCount, 2, { module: mod });
      ctx.assert.equals('Reactivate writes one non-monetary lifecycle event', state.reactivateAuditCount, 1, { module: mod });
    }
  };
}
