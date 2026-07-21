/** Planner performance evidence on an explicit disposable workbook. */
function getHarnessPerformancePlannerScenario_() {
  return {
    id: 'PERFORMANCE-PLANNER-FIRST-REPEAT',
    category: 'STRESS',
    executionLevel: 'INTEGRATION',
    description: 'Run the real planner twice on a Restricted populated disposable workbook; retain History rows, remove History charts, and record first/repeat timing.',
    requiresTrashCleanup: true,
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      harnessSeedRepresentativeWorkbook_(ctx);
      ctx.actions.push('Provision and seed representative planner inputs');
    },
    actions: function(ctx) {
      if (typeof runDebtPlanner !== 'function') throw new Error('Planner entry point unavailable.');
      ctx.assertWritable();
      var firstStarted = Date.now();
      runDebtPlanner({ spreadsheet: ctx.ss, emailMode: 'suppress' });
      var firstMs = Date.now() - firstStarted;
      ctx.assertWritable();
      var repeatStarted = Date.now();
      runDebtPlanner({ spreadsheet: ctx.ss, emailMode: 'suppress' });
      var repeatMs = Date.now() - repeatStarted;
      ctx.performanceEvidence = { firstMs: firstMs, repeatMs: repeatMs };
      ctx.actions.push('Planner first run: ' + firstMs + ' ms');
      ctx.actions.push('Planner repeat run: ' + repeatMs + ' ms');
    },
    expectedOutcome: function(ctx) {
      var evidence = ctx.performanceEvidence;
      if (!evidence) throw new Error('Planner timing evidence unavailable.');
      ctx.assert.exists('Planner first-run timing', evidence.firstMs, { module: 'Performance' });
      ctx.assert.exists('Planner repeat timing', evidence.repeatMs, { module: 'Performance' });
      var history = ctx.ss.getSheetByName('OUT - History');
      ctx.assert.equals('History rows retained', !!(history && history.getLastRow() >= 2), true, { module: 'Performance', location: 'OUT - History' });
      ctx.assert.equals('History charts retired', history ? history.getCharts().length : -1, 0, { module: 'Performance', location: 'OUT - History' });
    }
  };
}
