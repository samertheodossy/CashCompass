import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../performance_timing.js', import.meta.url), 'utf8');
const plannerSource = await readFile(new URL('../code.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const dashboardClient = await readFile(new URL('../Dashboard_Script_Render.html', import.meta.url), 'utf8');
const performanceSamplingSource = await readFile(new URL('../performance_sampling.js', import.meta.url), 'utf8');
const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8');

assert.match(performanceSamplingSource, /failedAssertions:\s*failedAssertions/,
  'Performance samples must retain privacy-safe failed assertion labels');
assert.match(performanceSamplingSource, /provisioning:\s*report\.gate\.provisioning/,
  'Performance samples must retain compact gate diagnostics');
assert.match(configSource, /SpreadsheetApp\.openById\(exactId\)/,
  'Sheet retries must reopen the exact caller-supplied spreadsheet');
assert.doesNotMatch(configSource, /freshSs\s*=\s*[\s\S]{0,200}getUserSpreadsheet_\(/,
  'Sheet retries must never escape to the mapped user workbook');

function buildContext({ flag = 'false', propertyThrows = false, ticks = [] } = {}) {
  const logs = [];
  const RealDate = Date;
  function FakeDate(value) {
    return new RealDate(value);
  }
  FakeDate.now = () => {
    assert.ok(ticks.length, 'Test clock exhausted');
    return ticks.shift();
  };

  const context = {
    Date: FakeDate,
    JSON,
    Math,
    Object,
    String,
    Number,
    PropertiesService: {
      getScriptProperties() {
        if (propertyThrows) throw new Error('unavailable');
        return { getProperty: () => flag };
      }
    },
    console: { log: (line) => logs.push(line) },
    Logger: { log: (line) => logs.push(line) }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, logs };
}

{
  const { context, logs } = buildContext({ flag: 'false' });
  assert.equal(context.startPerformanceTrace_('planner.manual_refresh'), null);
  assert.deepEqual(logs, []);
}

{
  const { context, logs } = buildContext({ propertyThrows: true });
  assert.equal(context.startPerformanceTrace_('planner.manual_refresh'), null);
  assert.deepEqual(logs, []);
}

{
  const { context, logs } = buildContext({
    flag: 'true',
    ticks: [1000, 1030, 1080, 1090]
  });
  const trace = context.startPerformanceTrace_('planner.manual refresh/user@example.com');
  context.markPerformanceTrace_(trace, 'read_inputs');
  context.markPerformanceTrace_(trace, 'write_dashboard');
  const report = context.finishPerformanceTrace_(trace, { outcome: 'ok' });

  assert.equal(report.operation, 'operation');
  assert.equal(report.totalMs, 90);
  assert.equal(report.measuredStageMs, 80);
  assert.equal(report.unattributedMs, 10);
  assert.equal(report.slowestStage, 'write_dashboard');
  assert.equal(report.slowestStageMs, 50);
  assert.equal(report.outcome, 'ok');
  assert.equal(report.stages.length, 2);
  assert.equal(logs.length, 1, 'One structured log must be emitted per trace');
  assert.match(logs[0], /^\[PERF\] /);
  assert.ok(!logs[0].includes('@'), 'Timing logs must sanitize arbitrary names');

  const repeated = context.finishPerformanceTrace_(trace, { outcome: 'error' });
  assert.equal(repeated, report, 'Finishing twice must be idempotent');
  assert.equal(logs.length, 1, 'Idempotent finish must not duplicate logs');
}

{
  const { context } = buildContext({ flag: 'true', ticks: [2000, 2020] });
  const trace = context.startPerformanceTrace_('planner.run');
  const report = context.finishPerformanceTrace_(trace, {
    outcome: 'error',
    failedStage: 'planner / private detail'
  });
  assert.equal(report.outcome, 'error');
  assert.equal(report.failedStage, 'unknown');
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'errorMessage'), false);
}

for (const stage of [
  'sync_inputs',
  'read_inputs',
  'build_payment_windows',
  'calculate_plan',
  'email'
]) {
  assert.ok(plannerSource.includes(`'${stage}'`), `Planner trace must retain stage ${stage}`);
}
const plannerOutput = await readFile(new URL('../planner_output.js', import.meta.url), 'utf8');
for (const stage of [
  'write_history',
  'cleanup_history_charts',
  'write_dashboard_data',
  'format_dashboard',
  'build_dashboard_charts'
]) {
  assert.ok(plannerOutput.includes(`'${stage}'`), `Planner output trace must retain stage ${stage}`);
}
const appendHistorySource = plannerOutput.slice(
  plannerOutput.indexOf('function appendHistory_'),
  plannerOutput.indexOf('function isDuplicateHistoryRow_')
);
assert.ok(
  appendHistorySource.includes('retireHistoryChartsAndSupportData_(sheet);'),
  'Planner must remove legacy History charts/support tables during the next History append'
);
assert.ok(
  !appendHistorySource.includes('buildHistoryCharts_('),
  'Planner must not rebuild legacy History charts'
);
assert.ok(!plannerOutput.includes('function buildHistoryCharts_'),
  'Obsolete History chart rollback builder must remain removed');
assert.ok(!plannerOutput.includes('.newChart('),
  'Planner output must not contain any embedded chart builders');
assert.ok(!plannerOutput.includes('.insertChart('),
  'Planner output must not insert any embedded charts');

const writeDashboardSource = plannerOutput.slice(
  plannerOutput.indexOf('function writeRecommendations_'),
  plannerOutput.indexOf('function removeAllCharts_')
);
assert.ok(
  writeDashboardSource.includes('retireDashboardCharts_(sheet);'),
  'Planner must retire its legacy Dashboard charts after writing the table'
);
assert.ok(
  !writeDashboardSource.includes('writeDashboardChartDataAndBuildCharts_'),
  'Planner must not write Dashboard chart-support tables or rebuild charts'
);
assert.ok(
  !plannerOutput.includes('function writeDashboardChartDataAndBuildCharts_'),
  'Legacy Dashboard chart writer must remain removed'
);

const retireDashboardStart = plannerOutput.indexOf('function retireDashboardCharts_');
const retireDashboardEnd = plannerOutput.indexOf('/** Remove retired History charts', retireDashboardStart);
assert.ok(retireDashboardStart >= 0 && retireDashboardEnd > retireDashboardStart,
  'Dashboard chart retirement helper must remain present');
const retireDashboardSource = plannerOutput.slice(retireDashboardStart, retireDashboardEnd);
const retiredDashboardTitles = [
  'Net Worth by Run',
  'Cash Flow by Run (Blue=Projected, Red=Previous Month)',
  'Assets vs Liabilities vs Net Worth',
  'Asset Allocation',
  'Liability Breakdown',
  'Credit Card Balances'
];
for (const title of retiredDashboardTitles) {
  assert.ok(retireDashboardSource.includes(`'${title}'`),
    `Dashboard chart retirement must retain the known title: ${title}`);
}
assert.ok(retireDashboardSource.includes('sheet.getCharts()'),
  'Dashboard chart retirement must inspect existing charts once');
assert.ok(retireDashboardSource.includes('sheet.removeChart(chart)'),
  'Dashboard chart retirement must remove matching planner-owned charts');
assert.ok(!retireDashboardSource.includes('removeAllCharts_'),
  'Dashboard cleanup must preserve unknown customer-added charts');

const removed = [];
const knownChart = {
  getOptions: () => ({ get: key => key === 'title' ? 'Asset Allocation' : '' })
};
const customChart = {
  getOptions: () => ({ get: key => key === 'title' ? 'My custom chart' : '' })
};
const unreadableChart = {
  getOptions: () => { throw new Error('metadata unavailable'); }
};
const retirementContext = { String };
vm.createContext(retirementContext);
vm.runInContext(retireDashboardSource, retirementContext);
retirementContext.retireDashboardCharts_({
  getCharts: () => [knownChart, customChart, unreadableChart],
  removeChart: chart => removed.push(chart)
});
assert.deepEqual(removed, [knownChart],
  'Dashboard cleanup must remove known planner charts and preserve unknown/unreadable charts');

const retireHistoryStart = plannerOutput.indexOf('function retireHistoryChartsAndSupportData_');
const retireHistoryEnd = plannerOutput.indexOf('function formatRecommendationsSheet_', retireHistoryStart);
assert.ok(retireHistoryStart >= 0 && retireHistoryEnd > retireHistoryStart,
  'History chart/support retirement helper must remain present');
const retireHistorySource = plannerOutput.slice(retireHistoryStart, retireHistoryEnd);
assert.ok(retireHistorySource.includes('removeAllCharts_(sheet);'),
  'History cleanup must remove all retired embedded chart objects');
assert.ok(retireHistorySource.includes("=== 'Run Label'"),
  'History cleanup must recognize the legacy support-table header');
assert.ok(retireHistorySource.includes('.clearContent()'),
  'History cleanup must clear recognized legacy support data');

let historyChartsRemoved = 0;
let historySupportCleared = 0;
const legacyHistorySheet = {
  getMaxColumns: () => 54,
  getMaxRows: () => 100,
  getCharts: () => [{}],
  removeChart: () => { historyChartsRemoved += 1; },
  getRange: (row, col, rows, cols) => ({
    getDisplayValues: () => [[...(col === 25 ? ['Run Label'] : []), ...Array(Math.max(0, cols - 1)).fill('')]],
    clearContent: () => { historySupportCleared += 1; }
  })
};
const historyRetirementContext = { Math, String };
historyRetirementContext.removeAllCharts_ = sheet => {
  sheet.getCharts().forEach(chart => sheet.removeChart(chart));
};
vm.createContext(historyRetirementContext);
vm.runInContext(retireHistorySource, historyRetirementContext);
historyRetirementContext.retireHistoryChartsAndSupportData_(legacyHistorySheet);
assert.equal(historyChartsRemoved, 1,
  'History cleanup must remove legacy chart objects');
assert.equal(historySupportCleared, 1,
  'History cleanup must clear a recognized legacy support table');

historySupportCleared = 0;
historyRetirementContext.retireHistoryChartsAndSupportData_({
  ...legacyHistorySheet,
  getCharts: () => [],
  getRange: (_row, _col, _rows, cols) => ({
    getDisplayValues: () => [Array(cols).fill('Customer data')],
    clearContent: () => { historySupportCleared += 1; }
  })
});
assert.equal(historySupportCleared, 0,
  'History cleanup must preserve unrecognized customer data outside canonical columns');
for (const stage of ['touch_source', 'build_snapshot', 'save_baseline']) {
  assert.ok(dashboardSource.includes(`'${stage}'`), `Dashboard trace must retain stage ${stage}`);
}
assert.match(dashboardSource, /planner\.manual_refresh/);
assert.match(dashboardSource, /planner\.save_refresh/);
assert.match(dashboardClient, /\[CashCompass performance\]/);

console.log('Performance timing regression checks passed.');
