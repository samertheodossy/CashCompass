/** Planner performance evidence on an explicit disposable workbook. */
function getHarnessPerformancePlannerScenario_() {
  return {
    id: 'PERFORMANCE-PLANNER-FIRST-REPEAT',
    category: 'STRESS',
    executionLevel: 'INTEGRATION',
    description: 'Run the real planner twice on a Restricted populated disposable workbook; retain History rows, retire generated History/Dashboard charts, verify representative Dashboard formatting, and record first/repeat stage timing.',
    requiresTrashCleanup: true,
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      harnessSeedRepresentativeWorkbook_(ctx);
      ctx.actions.push('Provision and seed representative planner inputs');
    },
    actions: function(ctx) {
      if (typeof runDebtPlanner !== 'function') throw new Error('Planner entry point unavailable.');
      if (typeof createPerformanceTrace_ !== 'function' || typeof finishPerformanceTrace_ !== 'function') {
        throw new Error('Planner stage timing unavailable.');
      }
      function runTimedPlanner(label) {
        ctx.assertWritable();
        var trace = createPerformanceTrace_('planner.harness_' + label);
        var snapshotContext = {};
        try {
          runDebtPlanner({ spreadsheet: ctx.ss,
            emailMode: 'suppress',
            performanceTrace: trace,
            snapshotContext: snapshotContext
          });
          return {
            timing: finishPerformanceTrace_(trace, { outcome: 'ok' }),
            snapshotContext: snapshotContext
          };
        } catch (err) {
          finishPerformanceTrace_(trace, { outcome: 'error', failedStage: 'planner' });
          throw err;
        }
      }
      var firstRun = runTimedPlanner('first');
      var repeatRun = runTimedPlanner('repeat');
      var firstTiming = firstRun.timing;
      var repeatTiming = repeatRun.timing;
      ctx.assertWritable();
      var snapshotTrace = createPerformanceTrace_('dashboard.harness_snapshot');
      var snapshot;
      var snapshotTiming;
      try {
        snapshot = buildDashboardSnapshot_(
          ctx.ss, snapshotTrace, repeatRun.snapshotContext.canonicalSnapshot);
        snapshotTiming = finishPerformanceTrace_(snapshotTrace, { outcome: 'ok' });
      } catch (snapshotErr) {
        finishPerformanceTrace_(snapshotTrace, { outcome: 'error', failedStage: 'snapshot' });
        throw snapshotErr;
      }
      var firstMs = firstTiming.totalMs;
      var repeatMs = repeatTiming.totalMs;
      ctx.performanceEvidence = {
        firstMs: firstMs,
        repeatMs: repeatMs,
        firstStages: firstTiming.stages,
        repeatStages: repeatTiming.stages,
        snapshotMs: snapshotTiming.totalMs,
        snapshotStages: snapshotTiming.stages
      };
      ctx.snapshotEvidence = snapshot;
      ctx.actions.push('Planner first run: ' + firstMs + ' ms');
      ctx.actions.push('Planner repeat run: ' + repeatMs + ' ms');
      ctx.actions.push('Dashboard snapshot: ' + snapshotTiming.totalMs + ' ms');
    },
    expectedOutcome: function(ctx) {
      var evidence = ctx.performanceEvidence;
      if (!evidence) throw new Error('Planner timing evidence unavailable.');
      ctx.assert.exists('Planner first-run timing', evidence.firstMs, { module: 'Performance' });
      ctx.assert.exists('Planner repeat timing', evidence.repeatMs, { module: 'Performance' });
      ctx.assert.exists('Dashboard snapshot timing', evidence.snapshotMs, { module: 'Performance' });
      ctx.assert.equals('Dashboard snapshot returned current totals', !!(ctx.snapshotEvidence && typeof ctx.snapshotEvidence.netWorth === 'number'), true, { module: 'Performance', location: 'Overview' });
      ctx.assert.equals('Dashboard snapshot returned selected retirement scenario', !!(ctx.snapshotEvidence && ctx.snapshotEvidence.retirement && ctx.snapshotEvidence.retirement.selectedScenario), true, { module: 'Performance', location: 'Overview' });
      var history = ctx.ss.getSheetByName('OUT - History');
      var dashboard = ctx.ss.getSheetByName('OUT - Dashboard');
      var historyChartSupportEmpty = !!history;
      if (history && history.getMaxColumns() >= 54) {
        historyChartSupportEmpty = history.getRange(1, 25, history.getMaxRows(), 30).isBlank();
      }
      var chartSupportEmpty = !!dashboard;
      if (dashboard && dashboard.getMaxColumns() >= 26) {
        chartSupportEmpty = dashboard.getRange(1, 15, dashboard.getMaxRows(), 12).isBlank();
      }
      ctx.assert.equals('History rows retained', !!(history && history.getLastRow() >= 2), true, { module: 'Performance', location: 'OUT - History' });
      ctx.assert.equals('History charts retired', history ? history.getCharts().length : -1, 0, { module: 'Performance', location: 'OUT - History' });
      ctx.assert.equals('History chart-support columns stay empty', historyChartSupportEmpty, true, { module: 'Performance', location: 'OUT - History!Y:BB' });
      ctx.assert.equals('Generated Dashboard charts retired', dashboard ? dashboard.getCharts().length : -1, 0, { module: 'Performance', location: 'OUT - Dashboard' });
      ctx.assert.equals('Dashboard chart-support columns stay empty', chartSupportEmpty, true, { module: 'Performance', location: 'OUT - Dashboard!O:Z' });
      if (dashboard) {
        var formatRows = dashboard.getRange(1, 1, dashboard.getLastRow(), 2).getDisplayValues();
        function firstDashboardRow_(label) {
          for (var r = 0; r < formatRows.length; r++) {
            if (String(formatRows[r][0] || '').trim() === label) return r + 1;
          }
          return 0;
        }
        var actionPlanRow = firstDashboardRow_('Action Plan');
        var metricRow = firstDashboardRow_('Metric');
        var currencyRow = firstDashboardRow_('Usable Cash After Buffers');
        var stabilityRow = firstDashboardRow_('Monthly Stability');
        var stabilityValue = stabilityRow ? String(formatRows[stabilityRow - 1][1] || '').trim() : '';
        var stabilityColors = {
          Stable: '#d9ead3',
          Tight: '#fff2cc',
          Risky: '#f4cccc'
        };
        var expectedWidths = [280, 180, 140, 140, 140, 140, 140, 170, 170, 180, 700];
        var actualWidths = expectedWidths.map(function(_width, index) {
          return dashboard.getColumnWidth(index + 1);
        });
        ctx.assert.equals('Dashboard title remains merged', dashboard.getRange(1, 1, 1, 11).isPartOfMerge(), true, { module: 'Performance', location: 'OUT - Dashboard!A1:K1' });
        ctx.assert.equals('Dashboard title color retained', dashboard.getRange(1, 1).getBackground(), '#1f4e78', { module: 'Performance', location: 'OUT - Dashboard!A1' });
        ctx.assert.equals('Dashboard section style retained', actionPlanRow ? dashboard.getRange(actionPlanRow, 1).getBackground() : '', '#d9eaf7', { module: 'Performance', location: 'OUT - Dashboard!A:A' });
        ctx.assert.equals('Dashboard table-header style retained', metricRow ? dashboard.getRange(metricRow, 1).getBackground() : '', '#edf3f8', { module: 'Performance', location: 'OUT - Dashboard!A:A' });
        ctx.assert.equals('Dashboard currency format retained', currencyRow ? dashboard.getRange(currencyRow, 2).getNumberFormat() : '', '$#,##0.00;-$#,##0.00', { module: 'Performance', location: 'OUT - Dashboard!B:B' });
        ctx.assert.equals('Dashboard stability style retained', stabilityRow ? dashboard.getRange(stabilityRow, 2).getBackground() : '', stabilityColors[stabilityValue] || '', { module: 'Performance', location: 'OUT - Dashboard!B:B' });
        ctx.assert.equals('Dashboard column widths retained', JSON.stringify(actualWidths), JSON.stringify(expectedWidths), { module: 'Performance', location: 'OUT - Dashboard!A:K' });
      }
    }
  };
}
