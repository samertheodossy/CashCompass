import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../performance_timing.js', import.meta.url), 'utf8');
const plannerSource = await readFile(new URL('../code.js', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../dashboard_data.js', import.meta.url), 'utf8');
const dashboardClient = await readFile(new URL('../Dashboard_Script_Render.html', import.meta.url), 'utf8');

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
  appendHistorySource.includes('removeAllCharts_(sheet);'),
  'Planner must remove legacy History charts during the next History append'
);
assert.ok(
  !appendHistorySource.includes('buildHistoryCharts_('),
  'Planner must not rebuild legacy History charts'
);
assert.match(
  plannerOutput,
  /@deprecated Rollback-only during the History-chart removal release window/,
  'Legacy History chart builder must remain temporarily available for rollback'
);
for (const stage of ['touch_source', 'build_snapshot', 'save_baseline']) {
  assert.ok(dashboardSource.includes(`'${stage}'`), `Dashboard trace must retain stage ${stage}`);
}
assert.match(dashboardSource, /planner\.manual_refresh/);
assert.match(dashboardSource, /planner\.save_refresh/);
assert.match(dashboardClient, /\[CashCompass performance\]/);

console.log('Performance timing regression checks passed.');
