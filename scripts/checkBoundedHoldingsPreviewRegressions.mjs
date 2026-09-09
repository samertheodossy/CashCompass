import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (subdir, name) => read(`test/fixtures/${subdir}/${name}`);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`${name} must have a complete body`);
}

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  }
};

const stubAccounts = [
  {
    investmentId: 'INV-ET-BOUNDED-1',
    accountName: 'Synthetic E*TRADE Taxable',
    type: 'Brokerage',
    currentBalance: 50000,
    identityReady: true,
    identityCode: 'RESOLVED',
    identityMessage: '',
    suggestedStableAccountId: 'STABLE-ET-BOUNDED-1',
    suggestedRegistrationType: 'TAXABLE'
  },
  {
    investmentId: 'INV-M1-BOUNDED-1',
    accountName: 'Synthetic M1 Taxable One',
    type: 'Brokerage',
    currentBalance: 25000,
    identityReady: true,
    identityCode: 'RESOLVED',
    identityMessage: '',
    suggestedStableAccountId: 'STABLE-M1-BOUNDED-1',
    suggestedRegistrationType: 'TAXABLE'
  }
];

const stubManagementAccounts = stubAccounts.map((row) => ({
  investmentId: row.investmentId,
  accountName: row.accountName,
  type: row.type,
  currentBalance: row.currentBalance,
  inactive: false
}));

const stubRegistry = {
  accounts: [
    {
      stableAccountId: 'STABLE-401K-1',
      domain: 'RETIREMENT',
      displayName: '401K Account',
      institution: '',
      accountType: 'Retirement',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: '401K',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-401K-1'
    },
    {
      stableAccountId: 'STABLE-RH-1',
      domain: 'INVESTMENT',
      displayName: 'Samer Robinhood',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-RH-1'
    },
    {
      stableAccountId: 'STABLE-ET-BOUNDED-1',
      domain: 'INVESTMENT',
      displayName: 'Synthetic E*TRADE Taxable',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-ET-BOUNDED-1'
    },
    {
      stableAccountId: 'STABLE-M1-BOUNDED-1',
      domain: 'INVESTMENT',
      displayName: 'Synthetic M1 Taxable One',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-M1-BOUNDED-1'
    },
    {
      stableAccountId: 'STABLE-M1-BOUNDED-2',
      domain: 'INVESTMENT',
      displayName: 'Synthetic M1 Taxable Two',
      institution: '',
      accountType: 'Brokerage',
      accountSubtype: '',
      ownerId: 'OWNER-1',
      registrationType: 'TAXABLE',
      currency: 'USD',
      last4: '',
      active: 'Yes',
      identityStatus: '',
      legacyDomain: 'SYS_ASSETS',
      legacyKey: 'INV-M1-BOUNDED-2'
    }
  ]
};

const assetsHeaders = [
  'Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id', 'Planning Purpose'
];

const assetsRows = [
  ['401K Account', 'Retirement', '120000', 'Yes', 'INV-401K-1', ''],
  ['Samer Robinhood', 'Brokerage', '16193.06', 'Yes', 'INV-RH-1', 'INCOME_PRODUCING'],
  ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', ''],
  ['Synthetic M1 Taxable One', 'Brokerage', '25000', 'Yes', 'INV-M1-BOUNDED-1', ''],
  ['Synthetic M1 Taxable Two', 'Brokerage', '18000', 'Yes', 'INV-M1-BOUNDED-2', ''],
  ['E*TRADE Unregistered', 'Brokerage', '9000', 'Yes', 'INV-ET-UNREG', ''],
  ['Missing Investment Id', 'Brokerage', '1000', 'Yes', '', ''],
  ['Inactive M1 Account', 'Brokerage', '500', 'No', 'INV-M1-INACTIVE', '']
];

function makeAssetsSpreadsheet(rows) {
  const display = [assetsHeaders, ...rows];
  const values = display.map((row) => row.slice());
  return {
    getSheetByName(name) {
      if (name !== 'SYS - Assets') return null;
      return {
        getDataRange() {
          return {
            getDisplayValues: () => display,
            getValues: () => values
          };
        }
      };
    }
  };
}

function loadInvestmentsHelpers(context) {
  const investmentsSource = read('investments.js');
  vm.runInContext(`
    var INVESTMENT_ID_HEADER_ = 'Investment Id';
    var INVESTMENT_PLANNING_PURPOSE_HEADER_ = 'Planning Purpose';
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    function toNumber_(value) {
      if (value === null || typeof value === 'undefined' || value === '') return 0;
      var n = Number(String(value).replace(/,/g, ''));
      return isFinite(n) ? n : 0;
    }
    ${extractFunction(investmentsSource, 'getAssetsHeaderMap_')}
  `, context, { filename: 'investments-helpers.js' });
}

function buildContext(overrides = {}) {
  const deployUrl = overrides.deployUrl ||
    'https://script.google.com/macros/s/SYNTHETIC_BOUNDED_DEPLOY/exec';
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    ScriptApp: {
      getService() {
        return {
          getUrl() {
            return overrides.sandboxUrl || deployUrl;
          }
        };
      }
    },
    assertAdmin_: () => {
      if (!context.__admin) throw new Error('Admin access required.');
    },
    isAdminUser_: () => !!context.__admin,
    isCentralModeEnabled_: () => context.__central !== false,
    isAllowlistedUser_: () => context.__allowlisted !== false,
    ...overrides
  };
  context.__admin = overrides.admin !== false;
  context.__central = overrides.central !== false;
  context.__allowlisted = overrides.allowlisted !== false;
  vm.createContext(context);
  vm.runInContext(read('config.js'), context, { filename: 'config.js' });
  vm.runInContext(read('financial_identity.js'), context, { filename: 'financial_identity.js' });
  vm.runInContext(read('monthly_checkin_identity.js'), context, { filename: 'monthly_checkin_identity.js' });
  vm.runInContext(read('investment_portfolio_foundation.js'), context, {
    filename: 'investment_portfolio_foundation.js'
  });
  vm.runInContext(`
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    ${extractFunction(read('investment_activity.js'), 'normalizeInvestmentImportDate_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportMoney_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportNumber_')}
  `, context, { filename: 'activity-stubs.js' });
  vm.runInContext(read('investment_etrade_csv.js'), context, { filename: 'investment_etrade_csv.js' });
  vm.runInContext(read('investment_etrade_positions_pdf.js'), context, {
    filename: 'investment_etrade_positions_pdf.js'
  });
  vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
    filename: 'investment_m1_statement_pdf.js'
  });
  vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
  vm.runInContext(read('central_holdings_preview_lab.js'), context, {
    filename: 'central_holdings_preview_lab.js'
  });
  loadInvestmentsHelpers(context);
  vm.runInContext(read('bounded_holdings_preview.js'), context, {
    filename: 'bounded_holdings_preview.js'
  });
  vm.runInContext(read('bounded_holdings_preview_groups.js'), context, {
    filename: 'bounded_holdings_preview_groups.js'
  });
  vm.runInContext(read('bounded_holdings_preview_identity.js'), context, {
    filename: 'bounded_holdings_preview_identity.js'
  });
  context.getSheetNames_ = overrides.getSheetNames_ || (() => ({ ASSETS: 'SYS - Assets' }));
  context.financialIdentityReadRegistry_ = overrides.financialIdentityReadRegistry_ ||
    (() => stubRegistry);
  context.getUserSpreadsheet_ = overrides.getUserSpreadsheet_ ||
    (() => makeAssetsSpreadsheet(assetsRows));
  return context;
}

const etradeFixture = fixture('etrade', 'synthetic_etrade_positions_minimal.txt');
const m1Fixture = fixture('m1', 'synthetic_m1_statement_minimal.txt');
const boundedSource = read('bounded_holdings_preview.js');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const webappSource = read('webapp.js');
const investmentsSource = read('investments.js');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');
const dashboardBody = read('Dashboard_Body.html');
const labSource = read('central_holdings_preview_lab.js');
const applyDesign = read('PORTFOLIO_INTELLIGENCE_HOLDINGS_APPLY_DESIGN.md');
const portfolioFoundation = read('investment_portfolio_foundation.js');

const ctx = buildContext({ central: false, admin: false });

// --- Bounded route + access ---
assert.match(webappSource, /view === 'portfolio-holdings-preview' && !isCentralModeEnabled_\(\)/);
assert.match(webappSource, /BoundedHoldingsPreviewUI/);
assert.match(boundedHtml, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(boundedHtml, /Preview only — not loaded into CashCompass/);
assert.match(dashboardBody, /openBoundedHoldingsPreview_/);
assert.match(dashboardInvestments, /getBoundedHoldingsPreviewLaunchUrlFromDashboard/);
assert.match(boundedSource, /boundedHoldingsPreviewLaunchUrl_/);
assert.match(investmentsSource, /boundedHoldingsPreviewUrl:/);
assert.match(boundedSource, /ScriptApp\.getService\(\)\.getUrl\(\)/);
assert.match(boundedSource, /\?view=portfolio-holdings-preview/);
assert.doesNotMatch(dashboardBody, /href="\?view=portfolio-holdings-preview"/);
assert.match(dashboardInvestments, /boundedHoldingsPreviewAvailable/);
assert.match(investmentsSource, /boundedHoldingsPreviewAvailable: !isCentralModeEnabled_\(\)/);

const centralDenied = buildContext({ central: true, admin: false });
assert.equal(centralDenied.getBoundedHoldingsPreviewSetupFromDashboard().ok, false);
assert.match(centralDenied.getBoundedHoldingsPreviewSetupFromDashboard().error, /bounded workbook app only/);

const notAllowlisted = buildContext({ central: false, allowlisted: false });
assert.equal(notAllowlisted.boundedHoldingsPreviewRunFromDashboard({}).ok, false);
assert.match(notAllowlisted.boundedHoldingsPreviewRunFromDashboard({}).error, /Access denied/);

// --- Launch URL uses deployed /exec, never sandbox iframe ---
const launch = ctx.getBoundedHoldingsPreviewLaunchUrlFromDashboard();
assert.equal(launch.ok, true, launch.error || 'launch url failed');
assert.equal(
  launch.url,
  'https://script.google.com/macros/s/SYNTHETIC_BOUNDED_DEPLOY/exec?view=portfolio-holdings-preview'
);
assert.doesNotMatch(launch.url, /userCodeAppPanel/);

const sandboxCtx = buildContext({
  central: false,
  sandboxUrl: 'https://n-example.googleusercontent.com/userCodeAppPanel'
});
assert.equal(sandboxCtx.getBoundedHoldingsPreviewLaunchUrlFromDashboard().ok, false);

// --- Setup payload ---
const setup = ctx.getBoundedHoldingsPreviewSetupFromDashboard();
assert.equal(setup.ok, true, setup.error || 'setup failed');
assert.equal(setup.previewLabel, 'Preview only — not loaded into CashCompass.');
assert.equal(
  setup.dashboardUrl,
  'https://script.google.com/macros/s/SYNTHETIC_BOUNDED_DEPLOY/exec'
);
assert.equal(setup.accounts.length, 7);
const accountNames = setup.accounts.map((row) => row.accountName);
assert.ok(accountNames.includes('Synthetic E*TRADE Taxable'), 'E*TRADE account must appear');
assert.ok(accountNames.includes('Synthetic M1 Taxable One'), 'first M1 account must appear');
assert.ok(accountNames.includes('Synthetic M1 Taxable Two'), 'second M1 account must appear');
assert.ok(accountNames.includes('Samer Robinhood'), 'Robinhood account must appear');
assert.ok(!accountNames.includes('Inactive M1 Account'), 'inactive account must be excluded');
assert.doesNotMatch(boundedSource, /getInvestmentUiData\(\)/);

const unregistered = setup.accounts.find((row) => row.accountName === 'E*TRADE Unregistered');
assert.ok(unregistered);
assert.equal(unregistered.identityReady, false);
assert.equal(unregistered.needsAutoIdentity, true);

const missingId = setup.accounts.find((row) => row.accountName === 'Missing Investment Id');
assert.ok(missingId);
assert.equal(missingId.identityReady, false);
assert.match(missingId.identityMessage, /assign internal identity automatically/i);
assert.equal(missingId.needsAutoIdentity, true);

const m1One = setup.accounts.find((row) => row.investmentId === 'INV-M1-BOUNDED-1');
const m1Two = setup.accounts.find((row) => row.investmentId === 'INV-M1-BOUNDED-2');
assert.ok(m1One && m1Two);
assert.notEqual(m1One.suggestedStableAccountId, m1Two.suggestedStableAccountId);

assert.equal(
  ctx.boundedHoldingsPreviewRunFromDashboard({
    source: 'M1_STATEMENT_PDF',
    rawDocumentText: m1Fixture,
    pickerValue: 'INV-ET-UNREG',
    investmentId: 'INV-ET-UNREG',
    accountName: 'E*TRADE Unregistered',
    registrationType: 'TAXABLE',
    explicitAccountMatch: false
  }).ok,
  false
);

assert.doesNotMatch(boundedHtml, /id="stableAccountId"/);
assert.doesNotMatch(boundedHtml, /Identity setup required/);
assert.doesNotMatch(boundedHtml, /Set up identity/);
assert.match(boundedHtml, /id="selectedAccount"/);
assert.match(boundedHtml, /id="registrationType"/);
assert.match(boundedHtml, /id="explicitAccountMatch"/);
assert.match(boundedHtml, /CashCompass saves internal identity automatically/);
assert.match(boundedHtml, /groupedSession/);
assert.match(boundedHtml, /pickerValue/);
assert.match(boundedSource, /boundedHoldingsPreviewReadActiveInvestmentAccounts_/);
assert.match(boundedSource, /boundedHoldingsPreviewEnsureAccountIdentity_/);
assert.doesNotMatch(boundedSource, /financialIdentityApply|appendRow|setValues/);

const registeredCount = setup.accounts.filter((row) => row.identityReady).length;
assert.ok(registeredCount >= 5);
assert.ok(setup.accounts.some((row) => !row.identityReady));

// --- Identity validation ---
assert.match(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-BOUNDED-1',
  accountName: 'Synthetic E*TRADE Taxable',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).account.stableAccountId, /STABLE-ET-BOUNDED-1/);

assert.match(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Wrong Name',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).error, /Account display name must match/);

assert.match(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Synthetic M1 Taxable One',
  stableAccountId: 'XXXX1234',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).error, /assigned automatically by CashCompass/);

assert.match(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Synthetic M1 Taxable One',
  registrationType: 'TAXABLE',
  explicitAccountMatch: false
}).error, /Explicit account-match confirmation is required/);

assert.match(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Synthetic M1 Taxable One',
  stableAccountId: 'WRONG-STABLE-ID',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).error, /assigned automatically by CashCompass/);

// --- E*TRADE adapter preview ---
const etradePreview = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-BOUNDED-1',
  accountName: 'Synthetic E*TRADE Taxable',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(etradePreview.ok, true, etradePreview.error || 'etrade bounded preview failed');
assert.equal(etradePreview.source, 'ETRADE_POSITIONS_PDF');
assert.equal(etradePreview.account.matchStatus, 'EXPLICIT_MATCH');
assert.ok(etradePreview.holdingsRows.length >= 3);
assert.equal(etradePreview.cashBalance, 12345.67);
assert.equal(etradePreview.readiness.trustedForIncomeAnalysis, false);

// --- M1 adapter preview ---
const m1Preview = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Synthetic M1 Taxable One',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(m1Preview.ok, true, m1Preview.error || 'm1 bounded preview failed');
assert.equal(m1Preview.source, 'M1_STATEMENT_PDF');
assert.equal(m1Preview.holdingsRows.length, 2);
assert.equal(m1Preview.readiness.trustedForTaxLotSalePlanning, false);
assert.ok(m1Preview.analysis.readinessObservations.some((line) =>
  /Income analysis is not ready/.test(line)));

// --- Allocation + concentration + overlap ---
const etradeAnalysis = etradePreview.analysis;
const etradeAllocSum = etradeAnalysis.allocationByHolding.reduce((sum, row) => sum + row.percent, 0) +
  etradeAnalysis.cashPercent;
assert.ok(Math.abs(etradeAllocSum - 100) <= 2, `etrade allocation sum ${etradeAllocSum}`);
assert.ok(etradeAnalysis.concentrationObservations.some((line) => /Cash represents/.test(line)));
assert.ok(m1Preview.analysis.concentrationObservations.some((line) =>
  /Largest holding represents/.test(line)));

// --- One document per account ---
assert.equal(ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  investmentId: 'INV-M1-BOUNDED-1',
  accountName: 'Synthetic M1 Taxable One',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).ok, true);

// --- Clear RPC ---
assert.equal(ctx.boundedHoldingsPreviewClearFromDashboard().ok, true);

// --- No sheet writes / persistence ---
assert.doesNotMatch(boundedSource, /\bsetValues\b|\bappendRow\b|ensureInvestment|previewInvestmentActivityImport|saveTrackedInvestment/);
assert.doesNotMatch(boundedSource, /CacheService|PropertiesService|DriveApp|Firestore/);
assert.doesNotMatch(boundedHtml, /localStorage|sessionStorage|indexedDB/i);

// --- No auto-map / auto-apply ---
assert.doesNotMatch(boundedSource, /autoMap|autoApply|applyInvestment|saveMapping/i);
assert.doesNotMatch(boundedHtml, /autoMap|autoApply|applyInvestment/i);

// --- Robinhood path unchanged ---
assert.match(portfolioFoundation, /investmentPortfolioRobinhoodImportEligible_/);
assert.match(portfolioFoundation, /Robinhood production import remains/);

// --- Central lab unchanged ---
assert.match(labSource, /assertHoldingsPreviewLabAllowed_/);
assert.match(labSource, /Central mode only/);
assert.match(webappSource, /view === 'holdings-preview-lab' && isAdminUser_\(\)/);

// --- Apply design documented, not implemented ---
assert.match(applyDesign, /Design only — \*\*not implemented\*\*/);
assert.match(applyDesign, /INPUT - Investments/);
assert.match(applyDesign, /unified holdings sheet/i);
assert.match(applyDesign, /explicit confirmation required/i);
assert.doesNotMatch(boundedSource, /boundedHoldingsPreviewApply/);

// --- Fixtures remain synthetic ---
assert.ok(m1Fixture.includes('Synthetic'));
assert.ok(etradeFixture.includes('Synthetic'));
assert.doesNotMatch(boundedSource, /samertheodossy@gmail\.com/i);

console.log('Bounded holdings preview regressions passed.');
