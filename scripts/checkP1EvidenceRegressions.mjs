import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [registry, formulas, cf, named, health, release, contract, suites,
  planner, bank, investments, houses, plannerOutput, quickAdd, dashboard, performanceScenario, billsPayScenario,
  harnessCore, p1Runner, webapp, centralDiagnostics, firstRunE2E, firstRunBrowser, firstRunUi,
  populatedE2E, populatedBrowser, populatedUi, recoveryLive, recoveryUi, performanceSampling, performanceSamplingUi,
  validationUi, validationServer, sharedRules, engineeringStandards, testingUrls, debtUi] = await Promise.all([
  read('validator_schema_registry.js'), read('validator_formulas.js'),
  read('validator_conditional_formatting.js'), read('validator_named_ranges.js'),
  read('validator_health.js'), read('release_readiness_runner.js'),
  read('P1_RELEASE_EVIDENCE_CONTRACT.md'), read('test_harness_suites.js'),
  read('code.js'), read('bank_accounts.js'), read('investments.js'), read('house_values.js'),
  read('planner_output.js'), read('quick_add_payment.js'), read('dashboard_data.js'),
  read('test_harness_scenarios_performance.js'), read('test_harness_scenarios_bills_pay.js'),
  read('test_harness_core.js'), read('test_p1_isolated_runner.js'), read('webapp.js'), read('central_diagnostics.js'),
  read('first_run_e2e.js'), read('Dashboard_Script_FirstRunE2E.html'), read('FirstRunE2ETestingUI.html'),
  read('populated_dashboard_e2e.js'), read('Dashboard_Script_PopulatedDashboardE2E.html'),
  read('PopulatedDashboardE2ETestingUI.html'),
  read('recovery_live.js'), read('RecoveryTestingUI.html'), read('performance_sampling.js'),
  read('PerformanceSamplingUI.html'), read('ValidationTestingUI.html'),
  read('validation_testing_server.js'), read('agents/shared.md'), read('ENGINEERING_STANDARDS.md'),
  read('TESTING_URLS.md'), read('Dashboard_Script_PlanningDebts.html')
]);

const rootEntries = await readdir(new URL('../', import.meta.url), { withFileTypes: true });
const rootJsNames = rootEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.js')).map((entry) => entry.name);
const rootJsSources = await Promise.all(rootJsNames.map((name) => read(name)));
const allRootJs = rootJsSources.join('\n');

assert.doesNotMatch(allRootJs,
  /(?:setProperty|deleteProperty)\s*\(\s*(?:ADMIN_EMAILS_KEY_|['"]ADMIN_EMAILS['"])/,
  'Runtime and test code must never modify the immutable ADMIN_EMAILS property');
assert.match(centralDiagnostics, /getProperty\(ADMIN_EMAILS_KEY_\)/,
  'Admin identity must remain a read-only configuration lookup');
assert.doesNotMatch(p1Runner, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'P1 writers must never resolve an existing user or bounded workbook');
assert.match(p1Runner, /isAdminUser_\(\)/, 'P1 runners must remain admin-gated');
assert.match(p1Runner, /isCentralModeEnabled_\(\)/, 'P1 runners must remain Central-only');
assert.match(p1Runner, /RELEASE_TEST_SOURCE_VERSION/);
assert.match(p1Runner, /RELEASE_TEST_DEPLOYMENT/);
assert.doesNotMatch(p1Runner, /sourceVersion:\s*['"]\d+['"]|deployment:\s*['"][^'"]*@\d+['"]/,
  'Permanent P1 runners must not hardcode a stale deployment/version');
assert.doesNotMatch(webapp, /testRunP1WorkbookHealthAndRelease|testRunP1PerformancePlanner|testRunP1BillsPayE2E/,
  'P1 editor runners must never be wired into normal web-app routing');
assert.match(harnessCore, /target is the active\/bound workbook/,
  'Disposable gate must explicitly refuse the active/bounded workbook');
assert.match(harnessCore, /target ID matches a protected production workbook/,
  'Disposable gate must refuse Golden, configured-default, and mapped workbook IDs');

assert.match(registry, /getValidatorCanonicalModel_\(\)/, 'Schema registry must reference the live canonical model');
assert.doesNotMatch([registry, formulas, cf, named, health].join('\n'), /setValue|setValues|setFormula|setConditionalFormatRules|setNamedRange|insertSheet|deleteSheet/,
  'Validator modules must remain read-only');
for (const fn of ['validateFormulas_', 'validateConditionalFormatting_', 'validateNamedRanges_', 'validateWorkbookHealth_']) {
  assert.match([formulas, cf, named, health].join('\n'), new RegExp(`function ${fn}\\(`), `Missing ${fn}`);
}
assert.match(release, /one scenario per invocation/i);
assert.match(release, /LockService\.getScriptLock\(\)/, 'Bounded runner must prevent concurrent chunks');
assert.match(release, /runScenario_\(scenario,[\s\S]*\{ trash: true \}\)/,
  'Release chunks must use disposable scenario runners and request Trash');
assert.doesNotMatch(release, /runScenario_\([^\n]*candidateSpreadsheetId/,
  'Candidate workbook ID must never enter a writer');
for (const suite of [
  'SUITE-HOUSE-FINANCIAL-ACCURACY',
  'SUITE-FINANCIAL-INTEGRITY-CANONICAL',
  'SUITE-POPULATED-DASHBOARD-E2E',
  'SUITE-RECOVERY-LIVE'
]) {
  assert.ok(release.includes(`'${suite}'`), `Required release inventory missing ${suite}`);
}
assert.match(suites, /id: 'SUITE-RECOVERY-LIVE'[\s\S]*?implemented: true[\s\S]*?runner: 'browser'[\s\S]*?RECOVERY_LIVE_LATEST_EVIDENCE_V1/,
  'Recovery Live must be an implemented browser suite backed by saved evidence');
assert.match(recoveryLive, /RECOVERY_LIVE_TEST_EMAIL_\s*=\s*'cashcompass2026@gmail.com'/,
  'Recovery Live must stay pinned to the permanent disposable identity');
assert.match(recoveryLive, /!isAdminUser_\(\)[\s\S]*?isCentralModeEnabled_\(\)[\s\S]*?isAllowlistedUser_\(\)/,
  'Recovery Live must require the exact disposable, non-admin, allow-listed Central identity');
assert.doesNotMatch(recoveryLive, /function recoveryLiveStart\([^)]*(?:email|spreadsheet|workbook|file)Id/i,
  'Recovery Live start must never accept a caller-selected identity or workbook');
assert.match(recoveryLive, /priorId[\s\S]*?frE2ECleanupVerified_\(priorState, email\)[\s\S]*?findCandidateWorkbooks_\(email\)/,
  'Recovery Live may recycle only an exactly verified mapped disposable workbook before candidate recheck');
assert.match(recoveryLive, /resolveExistingWorkbookForRecovery_\(email, 'no_mapping'\)/,
  'Recovery Live must exercise the production confirmation path');
assert.match(recoveryLive, /recoveryReconnectSelf\(\)/,
  'Recovery Live must exercise the production self-scoped reconnect path');
assert.match(recoveryLive, /getUserSpreadsheet_\(\)/,
  'Recovery Live must exercise production stale-mapping routing');
assert.match(recoveryLive, /Drive\.Files\.update\(\{ trashed: true \}, id\)/,
  'Recovery Live cleanup must soft-trash only a verified active-run fixture');
assert.doesNotMatch(recoveryLive, /setProperty\(\s*ADMIN_EMAILS_KEY_|deleteProperty\(\s*ADMIN_EMAILS_KEY_/,
  'Recovery Live must never modify administrator configuration');
assert.match(recoveryUi, /cashcompass2026@gmail\.com[\s\S]*?never accepts an email or workbook ID/,
  'Recovery Live UI must explain its fixed identity and target boundary');
assert.match(validationUi, /single suite inventory and evidence dashboard[\s\S]*?All suites/,
  'Validation console must remain the consolidated suite inventory and evidence surface');
assert.match(suites, /id: 'SUITE-FIRST-RUN-UX-E2E'[\s\S]*?implemented: true[\s\S]*?runner: 'browser'[\s\S]*?FIRST_RUN_E2E_LATEST_EVIDENCE_V2/,
  'First-Run UX must be an implemented browser suite backed by saved evidence');
assert.match(firstRunE2E, /FIRST_RUN_E2E_EVIDENCE_KEY_\s*=\s*'FIRST_RUN_E2E_LATEST_EVIDENCE_V2'/,
  'The expanded customer-language contract must invalidate older eight-assertion evidence');
assert.match(firstRunE2E, /FIRST_RUN_E2E_TEST_EMAIL_\s*=\s*'cashcompass2026@gmail.com'/,
  'First-Run E2E must stay pinned to the permanent disposable identity');
assert.match(firstRunE2E, /if \(isAdminUser_\(\)\) return false/,
  'The disposable E2E identity must never be an admin');
assert.doesNotMatch(firstRunE2E, /getProperty\(['"]TEST_HARNESS_ENABLED['"]\)/,
  'First-Run browser access must not require the global writer harness to remain enabled');
assert.match(firstRunE2E, /email !== FIRST_RUN_E2E_TEST_EMAIL_[\s\S]*?isAdminUser_\(\)[\s\S]*?isCentralModeEnabled_\(\)[\s\S]*?isAllowlistedUser_\(\)/,
  'First-Run browser access must require the exact disposable, non-admin, allow-listed Central identity');
assert.doesNotMatch(firstRunE2E, /function frE2EPrepare\([^)]*(?:spreadsheet|workbook|file)Id/i,
  'First-Run preparation must never accept an arbitrary workbook target');
assert.match(firstRunE2E, /provisionWorkbookForUser_\(email\)/,
  'First-Run E2E must exercise the production Central provisioning path');
assert.match(firstRunE2E, /Drive\.Files\.update\(\{ trashed: true \}, state\.workbookId\)/,
  'First-Run cleanup must soft-trash only its verified state workbook');
assert.match(firstRunE2E, /assertFirstRunE2EFixture_\(state, email, true\)[\s\S]*?if \(!file\.trashed\) Drive\.Files\.update/,
  'Verified stale mappings to an already-Trashed disposable workbook must be safely clearable');
assert.match(firstRunE2E, /priorId[\s\S]*?frE2ECleanupVerified_\(priorState, email\)[\s\S]*?findCandidateWorkbooks_\(email\)/,
  'First-Run preflight may recycle only an exactly verified mapped disposable workbook before candidate recheck');
assert.match(firstRunE2E, /mode: FIRST_RUN_E2E_MODE_[\s\S]*?state\.mode !== FIRST_RUN_E2E_MODE_/,
  'First-Run route must accept only fixtures prepared for the First-Run suite');
assert.match(firstRunBrowser, /\.frE2EComplete\(cfg\.runId/,
  'The browser runner must save its evidence through the guarded completion seam');
assert.match(firstRunE2E, /'customer_language'/,
  'First-Run E2E must require the whole-interface customer-language assertion');
assert.match(firstRunBrowser, /function customerLanguageLeaks\(/,
  'First-Run E2E must scan visible customer pages for internal workbook terminology');
assert.match(suites, /id: 'SUITE-POPULATED-DASHBOARD-E2E'[\s\S]*?implemented: true[\s\S]*?runner: 'browser'[\s\S]*?POPULATED_DASHBOARD_E2E_LATEST_EVIDENCE_V1/,
  'Populated Dashboard E2E must be an implemented browser suite backed by saved evidence');
assert.match(populatedE2E, /POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_\s*=\s*'POPULATED_DASHBOARD_E2E_LATEST_EVIDENCE_V1'/,
  'Populated Dashboard E2E must use its own versioned saved-evidence key');
assert.doesNotMatch(populatedE2E, /function pdE2EPrepare\([^)]*(?:spreadsheet|workbook|file)Id/i,
  'Populated Dashboard preparation must never accept an arbitrary workbook target');
assert.match(populatedE2E, /frE2EPrepare\(confirmed, requestedReleaseRunId\)/,
  'Populated Dashboard must reuse the guarded production Central provisioning lifecycle');
assert.match(populatedE2E, /state\.mode = POPULATED_DASHBOARD_E2E_MODE_[\s\S]*?state\.mode !== POPULATED_DASHBOARD_E2E_MODE_/,
  'Populated Dashboard route must accept only fixtures prepared and seeded for its suite');
assert.match(populatedE2E, /assertFirstRunE2EFixture_\(state, email, false\)[\s\S]*?runMinimalBootstrap_\(ss\)[\s\S]*?harnessSeedRepresentativeWorkbook_\(ctx\)/,
  'Populated Dashboard must verify the exact mapped fixture before explicit-target seeding');
assert.match(populatedE2E, /frE2ECleanupVerified_\(state, email\)/,
  'Populated Dashboard cleanup must reuse exact verified soft-Trash cleanup');
assert.match(populatedE2E, /var sharing = frE2EInspectRestrictedSharing_\(state\.workbookId\)/,
  'Populated Dashboard completion must re-verify Restricted sharing before reporting PASS');
assert.match(populatedBrowser, /\.pdE2EComplete\(cfg\.runId/,
  'The populated browser runner must save evidence through its guarded completion seam');
assert.match(populatedBrowser, /showPage\('assets'\)[\s\S]*?showTab\('bank'\)[\s\S]*?showPage\('cashflow'\)[\s\S]*?showPage\('assets'\)/,
  'Subtab retention must establish Assets → Bank before leaving and returning');
assert.match(populatedBrowser, /loadDebtSectionThenSelect_\(expected\.debtName\)/,
  'Populated Debt selection must use the production load-and-select path');
assert.match(populatedBrowser, /\/complete\/i\.test\(setupText\)/,
  'Populated Setup wording must be checked case-insensitively against customer-facing text');
assert.match(populatedBrowser, /income_manage_list[\s\S]*?income_other_detected/,
  'Populated Income evidence must accept both tracked and reference-only product presentations');
assert.match(populatedBrowser,
  /incomeMainHasExpected[\s\S]*?incomeOtherHasExpected[\s\S]*?add\('income_setup_consistency'/,
  'Populated Dashboard E2E must fail when Income and Setup classify the salary differently');
for (const assertionId of ['overview_kpis', 'bank_selection_actions', 'debt_selection_actions',
  'property_equity', 'populated_workspaces', 'income_setup_consistency', 'subtab_retention', 'setup_help_language',
  'customer_language', 'refresh_button_state', 'clean_console_navigation']) {
  assert.ok(populatedE2E.includes(`'${assertionId}'`), `Populated Dashboard contract missing ${assertionId}`);
}
assert.match(populatedUi, /cashcompass2026@gmail\.com[\s\S]*?never accepts a workbook ID[\s\S]*?bounded workbook/,
  'Populated Dashboard control UI must explain its fixed disposable safety boundary');
assert.match(webapp, /view === 'populated-dashboard-e2e'[\s\S]*?isFirstRunE2EUser_\(\)/,
  'Populated Dashboard control route must remain hidden from every non-test identity');
assert.match(webapp, /pdE2ERenderContext_\(populatedRunId\)/,
  'Populated Dashboard run route must require the guarded active run context');
assert.match(validationServer, /function vtOpenHarnessBrowserRunner\(suiteId, requestedReleaseRunId\)[\s\S]*?assertValidatorAllowed_\(\)/,
  'Only the admin Validator console may launch the browser-test link from the console');
assert.match(suites, /id: 'SUITE-PERFORMANCE-PLANNER'[\s\S]*?implemented: true[\s\S]*?'PERFORMANCE-PLANNER-FIRST-REPEAT'/,
  'Performance suite must use the explicit-workbook planner scenario');
assert.match(suites, /id: 'SUITE-PERFORMANCE-PLANNER'[\s\S]*?runner: 'browser'[\s\S]*?PERFORMANCE_PLANNER_LATEST_EVIDENCE_V1/,
  'Performance Planner must be a browser sampling suite backed by saved evidence');
assert.match(performanceSampling, /PERFORMANCE_SAMPLING_TARGET_PAIRS_\s*=\s*20/,
  'Performance campaign must collect at least 20 independent first\/repeat pairs');
assert.match(performanceSampling, /runScenario_\([\s\S]*?getHarnessPerformancePlannerScenario_\(\)[\s\S]*?\{ trash: true \}/,
  'Performance sampling must reuse the registered real scenario with verified Trash requested');
assert.match(performanceSampling, /isFirstRunE2EUser_\(\)/,
  'Performance sampling must stay pinned to the permanent disposable non-admin guard');
assert.doesNotMatch(performanceSampling, /getUserSpreadsheet_\s*\(|getActiveSpreadsheet\s*\(/,
  'Performance sampling must never resolve an existing user or bounded workbook');
assert.match(performanceSampling, /PERFORMANCE_REFRESH_P50_BUDGET_MS_\s*=\s*30000/);
assert.match(performanceSampling, /PERFORMANCE_REFRESH_P95_BUDGET_MS_\s*=\s*60000/);
assert.match(performanceSamplingUi, /20 independent Restricted disposable workbooks[\s\S]*?accepts no email or workbook ID/,
  'Performance UI must explain its fixed sample and target safety boundary');
assert.match(webapp, /view === 'performance-test'[\s\S]*?isPerformanceSamplingUser_\(\)/,
  'Performance sampling route must remain hidden from every non-test identity');
assert.match(sharedRules, /ValidationTestingUI\.html[\s\S]*?only human-facing test inventory[\s\S]*?Every test must be registered as a suite/,
  'Shared agent rules must enforce the single test-console policy');
assert.match(engineeringStandards, /One operator-facing test surface[\s\S]*?single operator-facing home for\s+all test suites/,
  'Engineering standards must preserve one operator-facing test surface');
assert.match(testingUrls, /only test\s+URL an operator should retain/,
  'The human URL registry must direct operators to one test entry point');
assert.doesNotMatch(testingUrls, /\?view=(?:first-run-e2e|populated-dashboard-e2e|recovery-test|performance-test)/,
  'Internal browser execution adapters must not become operator bookmarks');
const performanceMathCtx = vm.createContext({ Math, JSON, Number });
vm.runInContext(performanceSampling, performanceMathCtx);
assert.equal(performanceMathCtx.psMedian_([1000, 3000]), 2000,
  'Performance p50 must use the median for an even sample population');
assert.equal(performanceMathCtx.psPercentileNearestRank_([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
], 0.95), 19, 'Twenty observations must make p95 the nineteenth sorted value');
assert.equal(performanceMathCtx.psDistributionPasses_({ p50Ms: 30000, p95Ms: 60000 }), true,
  'Values exactly on the ratified boundary must pass');
assert.equal(performanceMathCtx.psDistributionPasses_({ p50Ms: 30001, p95Ms: 60000 }), false,
  'A p50 over budget must require optimization');
assert.match(suites, /id: 'SUITE-BILLS-PAY-E2E'[\s\S]*?implemented: true[\s\S]*?'E2E-BILLS-DUE-PAY'/,
  'Bills Pay suite must use the explicit-workbook payment scenario');
assert.match(suites, /id: 'SUITE-WORKBOOK-HEALTH'[\s\S]*?aggregate read-only Workbook Health[\s\S]*?'SMOKE-POPULATED-FIXTURE'/,
  'Workbook Health suite must reuse the proven populated disposable scenario');
assert.match(release, /PERFORMANCE_BUDGETS_RATIFIED/, 'Release verdict must fail closed until performance budgets are ratified');
assert.match(release, /var candidate = \{ workbookFingerprint: releaseWorkbookFingerprint_\(healthReport\.workbook\.id\)/,
  'Archived Release Readiness evidence must fingerprint the disposable health fixture rather than store a raw workbook id');
assert.doesNotMatch(release, /candidate:\s*\{\s*workbookId:/,
  'Release Readiness state must not persist the raw candidate workbook id');
assert.match(release, /function releaseReadinessFinalize\(\)[\s\S]*?releaseLoadExternalEvidence_\([\s\S]*?state\.candidate,\s*state\.runId/,
  'Finalization must refresh browser evidence so a bounded run can resume after external suites finish');
assert.match(release, /releaseEvidenceMatchesCandidate_\(report\.candidate, candidate\)/,
  'Release Readiness must reject browser evidence from a different source or deployment candidate');
assert.match(release, /report\.releaseEligible !== true[\s\S]*?report\.releaseRunId[\s\S]*?releaseRunId/,
  'Release Readiness must reject diagnostic-only or differently owned browser evidence');
assert.match(release, /function releaseBrowserEvidenceContext_\(requestedReleaseRunId\)[\s\S]*?if \(!requested\)[\s\S]*?releaseEligible: false/,
  'Standalone browser campaigns must be diagnostic-only even when an unrelated readiness run remains active');
assert.match(release, /releaseSanitizeMetadata_\(state\.runId\) !== requested[\s\S]*?releaseEligible: false/,
  'Browser evidence must refuse an explicitly requested owner that is not the exact active readiness run');
assert.match(release, /function releaseValidateBrowserEvidenceContext_\(captured\)[\s\S]*?current\.runId[\s\S]*?releaseEvidenceMatchesCandidate_/,
  'Browser evidence must revalidate its owning run and candidate at completion');
for (const [label, source] of [
  ['First-Run UX E2E', firstRunE2E], ['Populated Dashboard E2E', populatedE2E],
  ['Recovery Live', recoveryLive], ['Performance Planner', performanceSampling]
]) {
  assert.match(source, /releaseValidateBrowserEvidenceContext_\(state\.releaseEvidenceContext\)/,
    `${label} must revalidate its captured Release Readiness owner at completion`);
  assert.match(source, /candidate: evidenceContext\.candidate[\s\S]*?releaseEligible: evidenceContext\.releaseEligible[\s\S]*?releaseRunId: evidenceContext\.releaseRunId/,
    `${label} must label diagnostic-only versus exact-candidate evidence explicitly`);
  assert.doesNotMatch(source, /candidate: releaseCurrentCandidateMetadata_\(\)/,
    `${label} must not inherit mutable candidate metadata at completion`);
}
for (const [label, source] of [
  ['First-Run/Populated Dashboard', firstRunE2E],
  ['Recovery Live', recoveryLive],
  ['Performance Planner', performanceSampling]
]) {
  assert.match(source, /releaseEvidenceContext: releaseBrowserEvidenceContext_\(requestedReleaseRunId\)/,
    `${label} must capture only the explicitly requested owning Release Readiness run`);
}
for (const [label, source, startCall] of [
  ['First-Run UX E2E', firstRunUi, 'frE2EPrepare'],
  ['Populated Dashboard E2E', populatedUi, 'pdE2EPrepare'],
  ['Recovery Live', recoveryUi, 'recoveryLiveStart'],
  ['Performance Planner', performanceSamplingUi, 'psStartCampaign']
]) {
  assert.match(source, /Standalone diagnostic run[\s\S]*?requestedReleaseRunId/,
    `${label} must visibly distinguish standalone diagnostic evidence`);
  assert.match(source, new RegExp(`\\.${startCall}\\(confirmed\\(\\), requestedReleaseRunId\\)`),
    `${label} must pass the explicit owner from its server-rendered launch context`);
}
assert.match(webapp, /requestedReleaseRunId[\s\S]*?releaseRunIdJson = JSON\.stringify\(requestedReleaseRunId\)/,
  'Browser control routes must inject only the requested Release Readiness owner into their templates');
assert.match(validationServer, /function vtOpenHarnessBrowserRunner\(suiteId, requestedReleaseRunId\)[\s\S]*?releaseBrowserEvidenceContext_\(releaseRunId\)[\s\S]*?releaseOwned: !!releaseRunId/,
  'The admin launcher must validate and label explicit Release Readiness ownership');
assert.match(validationUi, /function vtRROpenBrowserSuite_\(suiteId\)[\s\S]*?vtOpenHarnessBrowserRunner\(suiteId, vtRRState\.runId\)/,
  'Release Readiness must provide a dedicated exact-owner browser launch path');
assert.match(validationUi, /function vtHRunSuite\(\)[\s\S]*?\.vtOpenHarnessBrowserRunner\(suiteId\)/,
  'The generic suite launcher must omit Release Readiness ownership and remain diagnostic-only');
assert.match(performanceSampling, /RELEASE_PERFORMANCE_BUDGET_RATIFIED_KEY_[\s\S]*?evidenceContext\.releaseEligible \? 'true' : 'false'/,
  'Diagnostic-only performance sampling must not ratify a release budget');
assert.match(validationServer, /function vtReleaseReadinessStart\(spreadsheetId, metadata\)[\s\S]*?spreadsheetId is intentionally ignored[\s\S]*?releaseReadinessStart\(metadata/,
  'Release Readiness must ignore the selected target and start only through disposable workbooks');
assert.doesNotMatch(validationServer, /function vtReleaseReadinessStart\(spreadsheetId, metadata\)[\s\S]*?vtResolveTarget_\(spreadsheetId\)/,
  'Release Readiness must never resolve or open the selected or bounded target workbook');
assert.match(release, /getHarnessScenarioById_\('SMOKE-POPULATED-FIXTURE'\)[\s\S]*?runScenario_\(healthScenario[\s\S]*?\{ trash: true \}/,
  'Workbook Health preflight must run on the Restricted disposable populated fixture with Trash cleanup');
assert.match(release, /healthReport\.full\.health[\s\S]*?releaseCompactHealth_\(healthReport\.full\.health\)/,
  'Release Readiness must consume the harness report full Workbook Health contract');
assert.match(validationServer, /function vtReleaseReadinessRunNextChunk\(\)[\s\S]*?releaseReadinessRunNextChunk/,
  'The console must expose one bounded Release Readiness chunk per RPC');
assert.match(validationUi, /id="vt-release-readiness"[\s\S]*?Run remaining[\s\S]*?function vtRRRunAll\(\)/,
  'The single Validation console must expose resumable Release Readiness controls');
assert.doesNotMatch(validationUi, /if \(done\) vtRRFinalize\(\)/,
  'Run remaining must not finalize before browser evidence is complete');
assert.match(validationUi, /All server checks are complete and saved\. Run any missing browser suites, then finalize\./,
  'Run remaining must stop safely after server checks and direct the operator to browser evidence');
assert.match(debtUi, /function loadDebtSectionThenSelect_\(accountName\)[\s\S]*?data\.editableFields[\s\S]*?loadDebtFieldValue\(\)/,
  'Debt selection helper must populate editable fields before loading the selected value');
assert.match(debtUi,
  /var debtSectionRequestId_ = 0[\s\S]*?function loadDebtSection\(\)[\s\S]*?sectionRequestId = \+\+debtSectionRequestId_[\s\S]*?sectionRequestId !== debtSectionRequestId_[\s\S]*?function loadDebtSectionThenSelect_\(accountName\)[\s\S]*?sectionRequestId = \+\+debtSectionRequestId_[\s\S]*?sectionRequestId !== debtSectionRequestId_/,
  'Debt section loaders must ignore stale overlapping responses before they can reset the selected account');
const debtLoaderMatch = debtUi.match(
  /^\/\* Planning — Debts tab \*\/[\s\S]*?\n}\n\n\/\/ First-run fallback/
);
assert.ok(debtLoaderMatch, 'Debt section loader functions must remain dynamically testable');
const debtPendingCalls = [];
const debtAccountSelect = {
  value: '',
  options: [],
  appendChild(option) { this.options.push(option); }
};
const debtTypeSelect = {
  value: 'All',
  innerHTML: '',
  options: [],
  appendChild(option) { this.options.push(option); }
};
const debtFieldSelect = {
  value: '',
  innerHTML: '',
  options: [],
  appendChild(option) { this.options.push(option); if (!this.value) this.value = option.value; }
};
const debtElements = {
  debt_typeFilter: debtTypeSelect,
  debt_field: debtFieldSelect,
  debt_account: debtAccountSelect
};
const debtRunner = {
  success: null,
  failure: null,
  withSuccessHandler(handler) { this.success = handler; return this; },
  withFailureHandler(handler) { this.failure = handler; return this; },
  getDebtsUiData() {
    debtPendingCalls.push({ success: this.success, failure: this.failure });
    this.success = null;
    this.failure = null;
  }
};
const debtRaceCtx = vm.createContext({
  google: { script: { run: debtRunner } },
  document: {
    getElementById: (id) => debtElements[id],
    createElement: () => ({ value: '', textContent: '' })
  },
  allDebtRows: [],
  pendingFocus: null,
  updateDebtUpdateAvailability_: () => {},
  populateDebtAddDatalists_: () => {},
  populateDebtPropertyOptions_: () => {},
  filterDebtAccounts: () => {
    debtAccountSelect.value = '';
    debtAccountSelect.options = [{ value: '' }, { value: 'Synthetic Visa' }];
  },
  loadDebtFieldValue: () => {},
  setStatus: () => {}
});
vm.runInContext(debtLoaderMatch[0].replace(/\n\/\/ First-run fallback$/, ''), debtRaceCtx);
debtRaceCtx.loadDebtSection();
debtRaceCtx.loadDebtSectionThenSelect_('Synthetic Visa');
assert.equal(debtPendingCalls.length, 2, 'Race test must create overlapping Debt section requests');
const debtResponse = {
  debts: [{ accountName: 'Synthetic Visa', type: 'Credit Card' }],
  types: ['All', 'Credit Card'],
  editableFields: ['Account Balance'],
  propertyOptions: []
};
debtPendingCalls[1].success(debtResponse);
assert.equal(debtAccountSelect.value, 'Synthetic Visa',
  'Newest Debt load-and-select response must select the requested account');
debtPendingCalls[0].success(debtResponse);
assert.equal(debtAccountSelect.value, 'Synthetic Visa',
  'Late ordinary Debt response must not clear the newer selected account');
assert.match(validationUi, /never uses the selected target workbook[\s\S]*?Workbook Health and every workflow check create and safely trash their own disposable workbook/,
  'Release Readiness UI must state that all checks use disposable workbooks');
assert.match(validationServer, /function vtSetReleaseHarnessEnabled\(enabled, confirmed\)[\s\S]*?assertValidatorAllowed_\(\)[\s\S]*?confirmed !== true[\s\S]*?TEST_HARNESS_ENABLED_KEY_/,
  'Only an explicitly confirmed admin Validator session may toggle the disposable runner');
assert.match(release, /releaseRestoreHarnessFlagIfOwned_\(\)[\s\S]*?deleteProperty\(TEST_HARNESS_ENABLED_KEY_\)/,
  'A console-owned Release Readiness run must restore the Harness flag to OFF when finalized');
assert.match(validationUi, /Enable disposable runner[\s\S]*?function vtRRSetHarness_\(enabled\)/,
  'Release Readiness must expose the guarded runner enable control on the single console');
assert.match(planner, /options\.spreadsheet \|\| getUserSpreadsheet_\(\)/, 'Planner must preserve normal resolution and allow an internal explicit target');
assert.match(planner, /buildInputBillPlannerPaymentWindows_\([\s\S]*?paySoonWindowDays,\s*ss\s*\)/,
  'Planner must propagate its explicit workbook into nested Bills payment-window reads');
assert.match(planner, /getBillsDueFromCashFlowForDashboard\(cashFlowRaw, ss\)/,
  'Planner must propagate its explicit workbook into nested Bills Due reads');
assert.match(dashboard, /function getBillsDueFromCashFlowForDashboard\(preloadedCurrentCashFlow, optionalSs\)/);
assert.match(dashboard, /function buildInputBillPlannerPaymentWindows_\(today, tz, payNowWindowDays, paySoonWindowDays, optionalSs\)/);
assert.match(dashboard, /buildCashFlowYearSheet_\(ss, today\.getFullYear\(\)\)/,
  'Bills Due first-run provisioning must remain on the already-resolved explicit workbook');
assert.match(bank, /function syncAllAccountsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(investments, /function syncAllAssetsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(houses, /function syncAllHouseAssetsFromLatestCurrentYear_\(optionalSs\)/);
assert.match(plannerOutput, /if \(emailMode === 'suppress'\) return;/, 'Planner harness runs must never send or queue email');
assert.match(quickAdd, /function quickAddPayment\(payload, optionalSs\)/);
assert.match(dashboard, /function markDashboardBillOccurrencePaid\(payload, optionalSs\)/);
assert.doesNotMatch(performanceScenario + billsPayScenario, /getUserSpreadsheet_\s*\(/,
  'New server suites must never resolve an owner/bounded workbook');

const inventoryCtx = vm.createContext({ assertHarnessAllowed_: () => {}, console });
vm.runInContext(suites, inventoryCtx);
vm.runInContext(release, inventoryCtx);
const inventory = inventoryCtx.releaseBuildInventory_();
assert.deepEqual(Array.from(inventory.missingSuites), [
], 'Release inventory must contain no unimplemented required suite');
assert.deepEqual(Array.from(inventory.externalSuites), [
  'SUITE-FIRST-RUN-UX-E2E', 'SUITE-POPULATED-DASHBOARD-E2E', 'SUITE-RECOVERY-LIVE',
  'SUITE-PERFORMANCE-PLANNER'
], 'Release inventory must require all authenticated browser suites outside the server scenario queue');
assert.throws(() => inventoryCtx.testRunSuiteById_('SUITE-FIRST-RUN-UX-E2E', {}), /authenticated browser runner/,
  'The server runner must never substitute an empty run for First-Run browser evidence');
assert.throws(() => inventoryCtx.testRunSuiteById_('SUITE-POPULATED-DASHBOARD-E2E', {}), /authenticated browser runner/,
  'The server runner must never substitute an empty run for Populated Dashboard browser evidence');
assert.throws(() => inventoryCtx.testRunSuiteById_('SUITE-RECOVERY-LIVE', {}), /authenticated browser runner/,
  'The server runner must never substitute an empty run for Recovery Live evidence');
assert.throws(() => inventoryCtx.testRunSuiteById_('SUITE-PERFORMANCE-PLANNER', {}), /authenticated browser runner/,
  'The server runner must never substitute a single execution for percentile evidence');

const propertyBag = new Map();
const props = {
  getProperty: (k) => propertyBag.has(k) ? propertyBag.get(k) : null,
  setProperty: (k, v) => { propertyBag.set(k, String(v)); return props; },
  deleteProperty: (k) => { propertyBag.delete(k); return props; }
};
const verdictCtx = vm.createContext({
  assertValidatorAllowed_: () => {}, assertHarnessAllowed_: () => {},
  PropertiesService: { getScriptProperties: () => props }, console
});
vm.runInContext(suites, verdictCtx);
vm.runInContext(release, verdictCtx);
assert.equal(verdictCtx.releaseBrowserEvidenceContext_().releaseEligible, false,
  'A standalone browser campaign must be diagnostic-only when no Release Readiness run is active');
const baseState = {
  version: 1, runId: 'RR-test', startedAt: new Date().toISOString(),
  candidate: { workbookFingerprint: 'fixture-hash', sourceVersion: 'abc123', deployment: '@test' },
  openIssues: { severity1: 0, severity2: 0, declared: true },
  health: { overall: 'PASS' }, inventory: { missingSuites: [], externalSuites: ['SUITE-FIRST-RUN-UX-E2E', 'SUITE-POPULATED-DASHBOARD-E2E', 'SUITE-RECOVERY-LIVE', 'SUITE-PERFORMANCE-PLANNER'], scenarioIds: [] },
  externalEvidence: {},
  cursor: 0, results: [], status: 'IN_PROGRESS'
};
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify(baseState));
assert.equal(verdictCtx.releaseBrowserEvidenceContext_().releaseEligible, false,
  'A standalone browser campaign must remain diagnostic-only while a stale readiness run is active');
assert.equal(verdictCtx.releaseBrowserEvidenceContext_('RR-wrong').releaseEligible, false,
  'A browser campaign must not adopt a different active readiness run');
const capturedBrowserContext = verdictCtx.releaseBrowserEvidenceContext_(baseState.runId);
assert.equal(capturedBrowserContext.releaseEligible, true,
  'An explicitly requested active Release Readiness run must provide an exact browser-evidence owner');
assert.equal(capturedBrowserContext.releaseRunId, baseState.runId);
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify({
  ...baseState, runId: 'RR-replaced'
}));
assert.equal(verdictCtx.releaseValidateBrowserEvidenceContext_(capturedBrowserContext).releaseEligible, false,
  'Evidence must become diagnostic-only when its owning release run is replaced');
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify(baseState));
assert.equal(verdictCtx.releaseReadinessFinalize().status, 'NOT_READY',
  'Missing execution-dependent evidence must force NOT READY');
const readyState = { ...baseState, runId: 'RR-ready',
  inventory: { missingSuites: [], externalSuites: ['SUITE-FIRST-RUN-UX-E2E', 'SUITE-POPULATED-DASHBOARD-E2E', 'SUITE-RECOVERY-LIVE', 'SUITE-PERFORMANCE-PLANNER'], scenarioIds: [] },
  externalEvidence: {
    'SUITE-FIRST-RUN-UX-E2E': { overall: 'PASS', cleanupVerified: true },
    'SUITE-POPULATED-DASHBOARD-E2E': { overall: 'PASS', cleanupVerified: true },
    'SUITE-RECOVERY-LIVE': { overall: 'PASS', cleanupVerified: true },
    'SUITE-PERFORMANCE-PLANNER': { overall: 'PASS', cleanupVerified: true }
  },
  status: 'IN_PROGRESS' };
props.setProperty('RELEASE_READINESS_ACTIVE_RUN_V1', JSON.stringify(readyState));
for (const suiteId of readyState.inventory.externalSuites) {
  const suite = verdictCtx.getHarnessSuiteById_(suiteId);
  props.setProperty(suite.evidenceKey, JSON.stringify({
    suiteId, runId: `${suiteId}-pass`, finishedAt: new Date().toISOString(), overall: 'PASS',
    releaseEligible: true, releaseRunId: readyState.runId,
    candidate: readyState.candidate,
    cleanup: { verified: true }
  }));
}
props.setProperty('PERFORMANCE_BUDGETS_RATIFIED', 'true');
assert.equal(verdictCtx.releaseReadinessFinalize().status, 'READY',
  'Complete passing evidence with ratified budgets must produce READY');
assert.match(contract, /must never substitute static checks or the pure Recovery decision matrix for live E2E evidence/i);

const base = {
  VALIDATOR_SEV_ERROR_: 'ERROR', VALIDATOR_SEV_WARN_: 'WARN', VALIDATOR_SEV_INFO_: 'INFO', VALIDATOR_SEV_OK_: 'OK',
  validatorFinding_: (severity, sheetName, kind, message) => ({ severity, sheetName, kind, message }),
  validatorWorstSeverity_: (fs) => fs.some((f) => f.severity === 'ERROR') ? 'ERROR' : fs.some((f) => f.severity === 'WARN') ? 'WARN' : 'OK',
  pushAll_: (a, b) => a.push(...b),
  schemaCountFindings_: (fs) => fs.reduce((c, f) => { c[f.severity.toLowerCase()]++; return c; }, { error: 0, warn: 0, info: 0, ok: 0 }),
  safeName_: () => 'Fixture', safeId_: () => 'fixture-id', console
};

const formulaCtx = vm.createContext({ ...base, columnToLetter_: (n) => String.fromCharCode(64 + n) });
vm.runInContext(formulas, formulaCtx);
const healthyFormulaSheet = {
  getName: () => 'INPUT - Debts',
  getLastRow: () => 3, getLastColumn: () => 2,
  getRange: (row, col, rows, cols) => row === 1 && rows === 3
    ? { getDisplayValues: () => [['Account Name', 'Balance'], ['Test Visa', '100'], ['TOTAL DEBT', '100']] }
    : { getDisplayValues: () => [['TOTAL DEBT', '100']], getFormulas: () => [['', '=SUM(B2:B2)']] }
};
assert.equal(formulaCtx.validatorCheckSummaryFormulas_(healthyFormulaSheet).length, 0,
  'Canonical SUM summary must pass formula validation');
const normalizedSingleCellFormulaSheet = {
  ...healthyFormulaSheet,
  getLastRow: () => 4,
  getRange: (row, col, rows, cols) => row === 1 && rows === 4
    ? { getDisplayValues: () => [['Account Name', 'Balance'], ['Test A', ''], ['Test B', '100'], ['TOTAL DEBT', '100']] }
    : { getDisplayValues: () => [['TOTAL DEBT', '100']], getFormulas: () => [['', '=SUM(B3)']] }
};
assert.equal(formulaCtx.validatorCheckSummaryFormulas_(normalizedSingleCellFormulaSheet).length, 0,
  'Google Sheets-normalized single-cell SUM summary must pass formula validation');
const hardcodedFormulaSheet = {
  ...healthyFormulaSheet,
  getLastRow: () => 2,
  getRange: (row, col, rows, cols) => row === 1 && rows === 2
    ? { getDisplayValues: () => [['Account Name', 'Balance'], ['TOTAL DEBT', '$100.00']] }
    : { getDisplayValues: () => [['TOTAL DEBT', '$100.00']], getFormulas: () => [['', '']] }
};
assert.ok(formulaCtx.validatorCheckSummaryFormulas_(hardcodedFormulaSheet).some((f) => /hardcoded|no formulas/i.test(f.message)),
  'Hardcoded summary values must be surfaced');

const namedCtx = vm.createContext({ ...base });
vm.runInContext(named, namedCtx);
assert.equal(namedCtx.validateNamedRanges_({ getNamedRanges: () => [], getName: () => 'Fixture', getId: () => 'id' }).overall, 'PASS');
assert.equal(namedCtx.validateNamedRanges_({ getNamedRanges: () => [{ getName: () => 'Unexpected' }], getName: () => 'Fixture', getId: () => 'id' }).overall, 'DRIFT');

console.log('P1 evidence safety regression checks passed.');
