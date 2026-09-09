import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

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

const assetsHeaders = [
  'Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id', 'Planning Purpose'
];

const assetsRows = [
  ['401K Account', 'Retirement', '120000', 'Yes', 'INV-401K-1', ''],
  ['Samer Robinhood', 'Brokerage', '16193.06', 'Yes', 'INV-RH-1', 'INCOME_PRODUCING'],
  ['Synthetic E*TRADE Taxable', 'Brokerage', '50000', 'Yes', 'INV-ET-BOUNDED-1', ''],
  ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', 'INV-M1-GMAIL-1', ''],
  ['M1 Account - yahoo', 'Brokerage', '88000', 'Yes', 'INV-M1-YAHOO-1', ''],
  ['Synthetic M1 Taxable One', 'Brokerage', '25000', 'Yes', 'INV-M1-BOUNDED-1', ''],
  ['Inactive M1 Account', 'Brokerage', '500', 'No', 'INV-M1-INACTIVE', '']
];

const stubRegistry = {
  accounts: [
    {
      stableAccountId: 'STABLE-M1-GMAIL-GROUP',
      domain: 'INVESTMENT',
      displayName: 'M1 Account - Gmail',
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
      legacyKey: 'INV-M1-GMAIL-1'
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
    }
  ]
};

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

function buildM1Statement(options = {}) {
  const masked = options.masked || 'XXXX1234';
  const periodStart = options.periodStart || '08/01/2026';
  const periodEnd = options.periodEnd || '08/31/2026';
  const totalValue = options.totalValue || '10000.00';
  const portfolioTotal = options.portfolioTotal || '9505.00';
  const synaMv = options.synaMv || '5765.20';
  const synbMv = options.synbMv || '3308.91';
  const accountLabel = options.accountLabel || 'Synthetic M1 Child Brokerage';
  return `# Synthetic M1 Brokerage Statement PDF text extract — structure only (no real balances)
Statement
Statement period: ${periodStart} to ${periodEnd}
Account number: ${masked}
Account: ${accountLabel}
Type: Margin
Account title: SYNTHETIC OWNER / JTWROS

Account value
Total account value / 1-month change
$${totalValue} / $500.00 [5.26%]

Account breakdown
Description | Last period | Current period | Change
07/31/2026 | 08/31/2026
Cash | $5.00 | $5.00 | $0.00
Equities | $9,000.00 | $9,500.00 | $500.00
Total portfolio | $9,005.00 | $${portfolioTotal} | $500.00

Total portfolio
Symbol | Quantity | Price | Market value | Cost basis | Unrealized P/L
SYNA | 57.65199 | $100.00 | $${synaMv} | $2,000.00 | $3,765.20
SYNB | 165.44571 | $20.00 | $${synbMv} | $3,400.00 | ($91.09)
Total | $${portfolioTotal} | $5,400.00 | $4,105.00

Financial instrument information
Symbol | Share class | Description | Exchange
SYNA | Class A | SYNTHETIC ALPHA INC COM | NASD
SYNB | Class A | SYNTHETIC BETA INC COM NEW | NASD
`;
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

function buildContext(options = {}) {
  const rows = options.assetsRows || assetsRows;
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    ScriptApp: {
      getService() {
        return {
          getUrl() {
            return 'https://script.google.com/macros/s/SYNTHETIC_BOUNDED_DEPLOY/exec';
          }
        };
      }
    },
    isAdminUser_: () => false,
    isCentralModeEnabled_: () => false,
    isAllowlistedUser_: () => true
  };
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
  vm.runInContext(read('bounded_holdings_preview_pdf_client.js'), context, {
    filename: 'bounded_holdings_preview_pdf_client.js'
  });
  context.getSheetNames_ = () => ({ ASSETS: 'SYS - Assets' });
  context.financialIdentityReadRegistry_ = () => stubRegistry;
  context.getUserSpreadsheet_ = () => makeAssetsSpreadsheet(rows);
  return context;
}

const ctx = buildContext();
const groupsSource = read('bounded_holdings_preview_groups.js');
const boundedSource = read('bounded_holdings_preview.js');
const identitySource = read('bounded_holdings_preview_identity.js');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const m1Source = read('investment_m1_statement_pdf.js');

const groupPayload = {
  pickerValue: 'INV-M1-GMAIL-1',
  accountName: 'M1 Account - Gmail',
  sysAssetsRow: 5,
  source: 'M1_STATEMENT_PDF',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
};

function runGroupedChild(text, extra = {}) {
  return ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
    ...groupPayload,
    rawDocumentText: text,
    sessionChildren: extra.sessionChildren || groupPayload.sessionChildren,
    sessionPreviews: extra.sessionPreviews || groupPayload.sessionPreviews,
    ...extra
  });
}

// --- Setup exposes one visible M1 Gmail group ---
const setup = ctx.getBoundedHoldingsPreviewSetupFromDashboard();
assert.equal(setup.ok, true);
const gmailAccount = setup.accounts.find((row) => row.accountName === 'M1 Account - Gmail');
assert.ok(gmailAccount, 'M1 Account - Gmail must appear as one visible group');
assert.equal(gmailAccount.previewMode, 'GROUPED_PROVIDER');
assert.equal(gmailAccount.groupProviderKey, 'M1_GMAIL');
assert.equal(gmailAccount.parentIsAggregateOnly, true);
assert.equal(gmailAccount.currentBalance, 95000);

const yahooAccount = setup.accounts.find((row) => row.accountName === 'M1 Account - yahoo');
assert.ok(yahooAccount, 'M1 Account - yahoo must appear as one visible group');
assert.equal(yahooAccount.previewMode, 'GROUPED_PROVIDER');
assert.equal(yahooAccount.groupProviderKey, 'M1_YAHOO');

const etAccount = setup.accounts.find((row) => row.accountName === 'Synthetic E*TRADE Taxable');
assert.ok(etAccount);
assert.equal(etAccount.previewMode, 'SINGLE_ACCOUNT');

// --- First child requires confirmation ---
const child1Text = buildM1Statement({ masked: 'XXXX1001' });
const needsConfirm = runGroupedChild(child1Text);
assert.equal(needsConfirm.ok, false);
assert.equal(needsConfirm.requiresConfirmation, true);
assert.match(needsConfirm.childMatch.prompt, /new M1 account under M1 Account - Gmail/i);

const child1 = runGroupedChild(child1Text, {
  confirmNewChild: true,
  confirmationToken: needsConfirm.childMatch.confirmationToken
});
assert.equal(child1.ok, true, child1.error || 'child1 preview failed');
assert.equal(child1.replayOutcome, 'ACCEPT_NEW');
assert.ok(child1.childPartition.childPartitionId.indexOf('PREVIEW-GROUP-M1_GMAIL-') === 0);
assert.notEqual(child1.childPartition.childPartitionId, 'XXXX1001');
assert.notEqual(child1.childPartition.childPartitionId, gmailAccount.suggestedStableAccountId);
assert.equal(child1.preview.account.displayName, 'Account 1');
assert.equal(child1.childPartition.recognitionLabel, 'Account 1');
assert.notEqual(child1.preview.account.displayName, 'Synthetic M1 Child Brokerage');
assert.equal(child1.sessionPreview.statementAccountLabel, 'Synthetic M1 Child Brokerage');
assert.equal(child1.sessionPreview.parentGroupLabel, 'M1 Account - Gmail');
assert.notEqual(child1.childPartition.childPartitionId, 'XXXX1001');
assert.notEqual(child1.preview.account.stableAccountId, 'XXXX1001');

// --- Child preview structure: cash, equities, total, reconciliation ---
const structureText = read('test/fixtures/m1/synthetic_m1_statement_child_preview_structure.txt');
const structureConfirm = runGroupedChild(structureText, { sessionChildren: [], sessionPreviews: [] });
assert.equal(structureConfirm.requiresConfirmation, true);
const structureChild = runGroupedChild(structureText, {
  sessionChildren: [],
  sessionPreviews: [],
  confirmNewChild: true,
  confirmationToken: structureConfirm.childMatch.confirmationToken
});
assert.equal(structureChild.ok, true, structureChild.error || 'structure child preview failed');
assert.equal(structureChild.childPartition.recognitionLabel, 'Account 1');
assert.equal(structureChild.preview.account.displayName, 'Account 1');
assert.equal(structureChild.preview.cashBalance, 6.92);
assert.equal(structureChild.preview.totalAccountValue, 18377.36);
assert.equal(structureChild.sessionPreview.equitiesSubtotal, 18370.44);
assert.equal(structureChild.sessionPreview.cashPlusEquitiesReconciles, true);
assert.match(structureChild.sessionPreview.statementAccountLabel, /Synthetic M1 Joint Brokerage Account/i);
assert.notEqual(structureChild.preview.account.displayName, structureChild.sessionPreview.statementAccountLabel);

// --- End-to-end: char-spaced PDF.js extract → client normalize → grouped preview ---
const charSpacedChildFixture = read('test/fixtures/m1/synthetic_m1_statement_pdfjs_char_spaced_child_structure.txt');
const readableCharSpaced = ctx.boundedHoldingsPreviewReadableExtractText_(charSpacedChildFixture);
assert.equal(readableCharSpaced.normalized, true);
const finalizedCharSpaced = ctx.boundedHoldingsPreviewFinalizeLoadedDocumentText_(
  readableCharSpaced.text, 'pdf');
assert.match(finalizedCharSpaced.text, /Account breakdown/i);
const charSpacedConfirm = runGroupedChild(finalizedCharSpaced.text, {
  sessionChildren: [],
  sessionPreviews: []
});
assert.equal(charSpacedConfirm.requiresConfirmation, true);
const charSpacedChild = runGroupedChild(finalizedCharSpaced.text, {
  sessionChildren: [],
  sessionPreviews: [],
  confirmNewChild: true,
  confirmationToken: charSpacedConfirm.childMatch.confirmationToken
});
assert.equal(charSpacedChild.ok, true, charSpacedChild.error || 'char-spaced grouped preview failed');
assert.equal(charSpacedChild.preview.totalAccountValue, 18377.36);
assert.equal(charSpacedChild.preview.cashBalance, 6.92);
assert.equal(charSpacedChild.sessionPreview.equitiesSubtotal, 18370.44);
assert.equal(charSpacedChild.sessionPreview.cashPlusEquitiesReconciles, true);
assert.equal(
  Math.round((charSpacedChild.preview.cashBalance + charSpacedChild.sessionPreview.equitiesSubtotal) * 100) / 100,
  18377.36
);
assert.equal(charSpacedChild.childPartition.recognitionLabel, 'Account 1');
assert.equal(charSpacedChild.aggregate.totalCash, 6.92);
assert.ok(charSpacedChild.aggregate.cashPercent > 0);
assert.notEqual(charSpacedChild.aggregate.totalPreviewedValue, charSpacedChild.reconciliation.parentAggregateValue);
assert.equal(charSpacedChild.reconciliation.parentExcludedFromChildTotals, true);
const charSpacedSignals = ctx.boundedHoldingsPreviewParseGroupedStatementSignals_(
  finalizedCharSpaced.text, 'M1_STATEMENT_PDF');
assert.deepEqual({
  marketValue: charSpacedSignals.totalAccountValue,
  cashBalance: charSpacedSignals.cashBalance,
  equitiesSubtotal: charSpacedSignals.equitiesSubtotal,
  cashPlusEquitiesReconciles: charSpacedSignals.cashPlusEquitiesReconciles
}, {
  marketValue: 18377.36,
  cashBalance: 6.92,
  equitiesSubtotal: 18370.44,
  cashPlusEquitiesReconciles: true
});

// --- End-to-end: two-column cash row (last + change only) through grouped preview ---
const twoColumnCashText = read('test/fixtures/m1/synthetic_m1_statement_child_preview_structure.txt')
  .replace('Cash $6.92 $6.92 $0.00', 'Cash $6.92 $0.00');
const twoColConfirm = runGroupedChild(twoColumnCashText, { sessionChildren: [], sessionPreviews: [] });
const twoColChild = runGroupedChild(twoColumnCashText, {
  sessionChildren: [],
  sessionPreviews: [],
  confirmNewChild: true,
  confirmationToken: twoColConfirm.childMatch.confirmationToken
});
assert.equal(twoColChild.ok, true, twoColChild.error || 'two-column cash grouped preview failed');
assert.equal(twoColChild.preview.cashBalance, 6.92);
assert.notEqual(twoColChild.preview.cashBalance, 0);
assert.equal(twoColChild.sessionPreview.equitiesSubtotal, 18370.44);
assert.equal(twoColChild.sessionPreview.cashPlusEquitiesReconciles, true);
assert.ok(twoColChild.aggregate.cashPercent > 0);

let sessionChildren = child1.sessionChildren;
let sessionPreviews = [child1.sessionPreview];

// --- Duplicate same document ---
const duplicate = runGroupedChild(child1Text, { sessionChildren, sessionPreviews });
assert.equal(duplicate.ok, true);
assert.equal(duplicate.replayOutcome, 'DUPLICATE_NOOP');
assert.equal(duplicate.duplicateNoop, true);
assert.equal(sessionPreviews.length, 1);

// --- Same child new period ---
const child1Sep = buildM1Statement({
  masked: 'XXXX1001',
  periodStart: '09/01/2026',
  periodEnd: '09/30/2026',
  totalValue: '10100.00',
  portfolioTotal: '9600.00'
});
const child1NewPeriod = runGroupedChild(child1Sep, { sessionChildren, sessionPreviews });
assert.equal(child1NewPeriod.ok, true, child1NewPeriod.error || 'new period failed');
assert.equal(child1NewPeriod.replayOutcome, 'ACCEPT_NEW');
sessionPreviews = sessionPreviews.concat([child1NewPeriod.sessionPreview]);

// --- Same child same period changed content ---
const child1Conflict = buildM1Statement({
  masked: 'XXXX1001',
  synaMv: '6000.00',
  synbMv: '3000.00'
});
const conflict = runGroupedChild(child1Conflict, { sessionChildren, sessionPreviews });
assert.equal(conflict.ok, false);
assert.equal(conflict.replayOutcome, 'CONFLICT_REVIEW_REQUIRED');

// --- Second distinct child same period ---
const needsConfirm2 = runGroupedChild(buildM1Statement({ masked: 'XXXX1002' }), {
  sessionChildren,
  sessionPreviews
});
assert.equal(needsConfirm2.requiresConfirmation, true);
const child2 = runGroupedChild(buildM1Statement({ masked: 'XXXX1002' }), {
  sessionChildren,
  sessionPreviews,
  confirmNewChild: true,
  confirmationToken: needsConfirm2.childMatch.confirmationToken
});
assert.equal(child2.ok, true);
sessionChildren = child2.sessionChildren;
sessionPreviews = sessionPreviews.concat([child2.sessionPreview]);
assert.notEqual(child1.childPartition.childPartitionId, child2.childPartition.childPartitionId);

// --- Five distinct child previews ---
for (let i = 3; i <= 5; i += 1) {
  const masked = 'XXXX100' + i;
  const inspect = runGroupedChild(buildM1Statement({ masked }), { sessionChildren, sessionPreviews });
  assert.equal(inspect.requiresConfirmation, true);
  const added = runGroupedChild(buildM1Statement({ masked }), {
    sessionChildren,
    sessionPreviews,
    confirmNewChild: true,
    confirmationToken: inspect.childMatch.confirmationToken
  });
  assert.equal(added.ok, true, added.error || 'child ' + i + ' failed');
  sessionChildren = added.sessionChildren;
  sessionPreviews = sessionPreviews.concat([added.sessionPreview]);
}
assert.equal(sessionChildren.length, 5);
assert.equal(new Set(sessionChildren.map((row) => row.childPartitionId)).size, 5);

// --- Fewer than five: reconciliation does not assume completeness ---
const partialAggregate = ctx.boundedHoldingsPreviewAggregateGroupedFromDashboard({
  ...groupPayload,
  sessionChildren: sessionChildren.slice(0, 2),
  sessionPreviews: sessionPreviews.slice(0, 2)
});
assert.equal(partialAggregate.ok, true);
assert.equal(partialAggregate.reconciliation.assumedCompleteChildCount, null);
assert.equal(partialAggregate.reconciliation.allExpectedStatementsPresent, null);

// --- Reconciliation excludes parent from child totals ---
const fullAggregate = ctx.boundedHoldingsPreviewAggregateGroupedFromDashboard({
  ...groupPayload,
  sessionChildren,
  sessionPreviews
});
assert.equal(fullAggregate.ok, true);
assert.match(fullAggregate.reconciliation.label, /Previewed M1 child accounts only/i);
assert.equal(fullAggregate.reconciliation.parentAggregateValue, 95000);
assert.equal(fullAggregate.reconciliation.parentExcludedFromChildTotals, true);
assert.ok(fullAggregate.reconciliation.childPreviewedValueSum > 0);
assert.equal(
  fullAggregate.reconciliation.difference,
  Math.round((95000 - fullAggregate.reconciliation.childPreviewedValueSum) * 100) / 100
);
assert.equal(fullAggregate.reconciliation.distinctChildAccountsObserved, 5);
assert.equal(fullAggregate.reconciliation.assumedCompleteChildCount, 5);
assert.equal(fullAggregate.aggregate.scopeLabel, 'Previewed accounts only.');
assert.equal(fullAggregate.aggregate.parentAggregateExcluded, true);
assert.equal(fullAggregate.aggregate.totalPreviewedValue, fullAggregate.reconciliation.childPreviewedValueSum);
assert.notEqual(fullAggregate.aggregate.totalPreviewedValue, fullAggregate.reconciliation.parentAggregateValue);

// --- Ambiguous masked identifier ---
const ambiguous = ctx.boundedHoldingsPreviewResolveGroupedChildMatch_(
  { maskedAccountNumber: 'XXXX9999' },
  [
    { maskedAccountSignal: 'XXXX9999', childPartitionId: 'A' },
    { maskedAccountSignal: 'XXXX9999', childPartitionId: 'B' }
  ],
  ctx.boundedHoldingsPreviewMatchGroupProvider_('M1 Account - Gmail', 'M1_STATEMENT_PDF')
);
assert.equal(ambiguous.status, 'IDENTITY_REVIEW_REQUIRED');

// --- Session-only remove helpers ---
const removed = ctx.boundedHoldingsPreviewRemoveGroupedSessionChild_(
  sessionChildren,
  sessionPreviews,
  sessionChildren[0].childPartitionId
);
assert.equal(removed.sessionChildren.length, sessionChildren.length - 1);
assert.ok(removed.sessionPreviews.every((row) =>
  row.childPartitionId !== sessionChildren[0].childPartitionId));

// --- Inspect RPC ---
const inspect = ctx.boundedHoldingsPreviewInspectGroupedStatementFromDashboard({
  ...groupPayload,
  rawDocumentText: buildM1Statement({ masked: 'XXXX2001' })
});
assert.equal(inspect.ok, true);
assert.equal(inspect.childMatch.status, 'NEW_CHILD_CONFIRMATION_REQUIRED');
assert.equal(inspect.maskedIdentifierIsMatchingSignalOnly, true);

// --- No workbook writes / no persistent identity creation ---
assert.doesNotMatch(groupsSource, /\bsetValues\b|\bappendRow\b|financialIdentityApply|ensureInvestment/);
assert.doesNotMatch(groupsSource, /CacheService|PropertiesService|Firestore/);
assert.match(boundedHtml, /groupedSession/);
assert.match(boundedHtml, /CashCompass saves internal identity automatically/);
assert.doesNotMatch(boundedHtml, /id="investmentId"/);
assert.match(boundedSource, /BOUNDED_HOLDINGS_PREVIEW_MISSING_INTERNAL_INVESTMENT_ID_ERROR_/);
assert.match(boundedSource, /BOUNDED_HOLDINGS_PREVIEW_AUTO_IDENTITY_ON_CONFIRM_MESSAGE_/);
assert.match(identitySource, /boundedHoldingsPreviewAssignAssetsInvestmentId_/);
assert.match(boundedSource, /boundedHoldingsPreviewValidateClientInvestmentId_/);
assert.match(boundedSource, /boundedHoldingsPreviewReadInvestmentIdFromAssetsRow_/);
assert.doesNotMatch(boundedHtml, /investmentId: String\(selected\.investmentId/);

// --- Server resolves parent Investment Id from selected account name ---
const serverResolvedPayload = {
  accountName: 'M1 Account - Gmail',
  sysAssetsRow: gmailAccount.sysAssetsRow,
  pickerValue: gmailAccount.pickerValue,
  source: 'M1_STATEMENT_PDF',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
};
const serverResolvedConfirm = runGroupedChild(child1Text, serverResolvedPayload);
assert.equal(serverResolvedConfirm.ok, false);
assert.equal(serverResolvedConfirm.requiresConfirmation, true);
const serverResolvedRun = runGroupedChild(child1Text, {
  ...serverResolvedPayload,
  confirmNewChild: true,
  confirmationToken: serverResolvedConfirm.childMatch.confirmationToken
});
assert.equal(serverResolvedRun.ok, true, serverResolvedRun.error || 'server-resolved grouped preview failed');
assert.equal(serverResolvedRun.childPartition.childPartitionId.indexOf('PREVIEW-GROUP-M1_GMAIL-INV-M1-GMAIL-1-'), 0);

const accountNameOnlyConfirm = ctx.boundedHoldingsPreviewRunGroupedChildFromDashboard({
  accountName: 'M1 Account - Gmail',
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: child1Text,
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  sessionChildren: [],
  sessionPreviews: []
});
assert.equal(accountNameOnlyConfirm.ok, false);
assert.equal(accountNameOnlyConfirm.requiresConfirmation, true,
  accountNameOnlyConfirm.error || 'account-name-only grouped inspect failed');

const mismatchedClientId = runGroupedChild(child1Text, {
  ...groupPayload,
  investmentId: 'INV-ET-BOUNDED-1'
});
assert.equal(mismatchedClientId.ok, false);
assert.match(mismatchedClientId.error, /could not be verified|must match/i);

const missingInternalCtx = buildContext({
  assetsRows: assetsRows.map((row) =>
    row[0] === 'M1 Account - Gmail'
      ? ['M1 Account - Gmail', 'Brokerage', '95000', 'Yes', '', '']
      : row.slice())
});
const missingInternalSetup = missingInternalCtx.getBoundedHoldingsPreviewSetupFromDashboard();
const missingGmail = missingInternalSetup.accounts.find((row) => row.accountName === 'M1 Account - Gmail');
assert.ok(missingGmail);
assert.equal(missingGmail.needsAutoIdentity, true);
assert.match(missingGmail.identityMessage, /assign internal identity automatically/i);
assert.match(identitySource, /boundedHoldingsPreviewAssignAssetsInvestmentId_/);
assert.doesNotMatch(boundedHtml, /id="stableAccountId"/);
assert.doesNotMatch(boundedHtml, /Identity setup required/);
assert.doesNotMatch(boundedHtml, /Set up identity/);
assert.match(boundedHtml, /id="selectedAccount"/);
assert.match(boundedHtml, /id="registrationType"/);
assert.match(boundedHtml, /id="explicitAccountMatch"/);
assert.doesNotMatch(boundedHtml, /id="documentFileGrouped"/);
assert.match(boundedHtml, /previousMode !== match\.previewMode/);
assert.match(boundedHtml, /Single account statement/);
assert.match(boundedHtml, /M1 grouped statements/);
assert.match(boundedHtml, /each statement belongs under/i);
assert.doesNotMatch(boundedHtml, /each pasted statement belongs under/i);
assert.match(boundedHtml, /groupedChildDetailArea/);
assert.match(boundedHtml, /Statement source \(verification only\)/);
assert.match(boundedHtml, /parent control total/i);
assert.doesNotMatch(boundedHtml, /Load up to/i);
assert.doesNotMatch(boundedHtml, /up to five/i);
assert.doesNotMatch(boundedHtml, /maxChildAccounts \|\| 5\)/);
assert.doesNotMatch(boundedHtml, /Expected statement count is unknown until five distinct child accounts are observed/i);
assert.doesNotMatch(boundedHtml, /All expected statements present/i);
assert.match(boundedHtml, /Each distinct child account is tracked separately, and duplicate statements are ignored/i);
assert.match(boundedHtml, /Additional child accounts are added when their statements are confirmed/i);
assert.match(boundedHtml, /Preview holdings/);
assert.match(boundedHtml, /id="workflowSingle"/);
assert.match(boundedHtml, /id="workflowGrouped"/);
assert.match(boundedHtml, /workflowSingleEl\.hidden = !state\.selectedAccount \|\| isGroupedMode\(\)/);
assert.match(boundedHtml, /workflowGroupedEl\.hidden = !isGroupedMode\(\)/);
assert.match(boundedHtml, /boundedHoldingsPreviewSuggestRegistrationFromDashboard/);
assert.match(boundedHtml, /confirmedRegistrationByPicker/);
assert.doesNotMatch(boundedHtml, /id="groupedCard"/);
assert.doesNotMatch(boundedHtml, /id="groupedRegistrationType"/);
assert.doesNotMatch(boundedHtml, /id="groupedExplicitMatch"/);
assert.doesNotMatch(boundedHtml, /id="investmentId"/);

// --- Registration suggest RPC ---
const taxableSuggest = ctx.boundedHoldingsPreviewSuggestRegistrationFromDashboard({
  rawDocumentText: buildM1Statement({ masked: 'XXXX1001' }),
  source: 'M1_STATEMENT_PDF'
});
assert.equal(taxableSuggest.ok, true);
assert.equal(taxableSuggest.suggested, 'TAXABLE');
assert.equal(taxableSuggest.confidence, 'MEDIUM');

// --- E*TRADE single-account path unchanged ---
const etradeFixture = read('test/fixtures/etrade/synthetic_etrade_positions_minimal.txt');
const etPreview = ctx.boundedHoldingsPreviewRunFromDashboard({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  investmentId: 'INV-ET-BOUNDED-1',
  accountName: 'Synthetic E*TRADE Taxable',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(etPreview.ok, true, etPreview.error || 'etrade preview failed');

// --- Robinhood adapter unchanged ---
assert.match(read('investment_portfolio_foundation.js'), /investmentPortfolioRobinhoodImportEligible_/);

// --- M1 adapter unchanged (no grouped logic in parser) ---
assert.doesNotMatch(m1Source, /GROUPED_PROVIDER|boundedHoldingsPreview/);

console.log('Bounded holdings preview grouped M1 regressions passed.');
