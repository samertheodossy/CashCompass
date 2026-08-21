/** RFP-2 investment identity and Income-Producing metadata lifecycle. */
function getHarnessRfpInvestmentMetadataScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-RFP-INVESTMENT-METADATA',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    expectedAssertionCount: 19,
    description: 'Prove multiple explicit Income-Producing designations, independent removal, stable rename identity, and Stop/Reactivate behavior on a disposable workbook.',
    requiresTrashCleanup: true,
    expectedSheets: [names.INVESTMENTS, names.ASSETS, ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.assertWritable();
      ensureInputInvestmentsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysAssetsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureActivityLogSheet_(ctx.ss);
      SpreadsheetApp.flush();
      ctx.actions.push('Create Investments, Assets, and Activity sheets on explicit disposable target');
    },
    actions: function(ctx) {
      var year = getCurrentYear_();
      var today = new Date();
      harnessRfpAddInvestment_(ctx, year, today, 'Samer Robinhood', 16193.06, 'Yes');
      harnessRfpAddInvestment_(ctx, year, today, 'Lutfi Robinhood', 10845.46, 'Yes');
      SpreadsheetApp.flush();

      var assets = ctx.ss.getSheetByName(getSheetNames_().ASSETS);
      var samerRow = harnessRfpFindAssetRow_(assets, 'Samer Robinhood');
      var lutfiRow = harnessRfpFindAssetRow_(assets, 'Lutfi Robinhood');

      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: samerRow, expectedAccountName: 'Samer Robinhood',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }, {
        sysAssetsRow: lutfiRow, expectedAccountName: 'Lutfi Robinhood',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }] }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.firstConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.samerInitial = ctx.firstConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Robinhood';
      })[0];
      ctx.lutfiInitial = ctx.firstConfig.accounts.filter(function(row) {
        return row.accountName === 'Lutfi Robinhood';
      })[0];

      ctx.assertWritable();
      saveTrackedInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Robinhood',
        newAccountName: 'Samer Income Portfolio',
        type: 'Brokerage'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.renamedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.renamedSamer = ctx.renamedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      deactivateInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Income Portfolio'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.stoppedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.stoppedSamer = ctx.stoppedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      reactivateInvestmentAccountFromDashboard({
        sysAssetsRow: samerRow,
        expectedAccountName: 'Samer Income Portfolio'
      }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.reactivatedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.reactivatedSamer = ctx.reactivatedConfig.accounts.filter(function(row) {
        return row.accountName === 'Samer Income Portfolio';
      })[0];

      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: lutfiRow, expectedAccountName: 'Lutfi Robinhood', planningPurpose: ''
      }] }, ctx.ss);
      SpreadsheetApp.flush();
      ctx.removedConfig = getIncomeProducingAccountConfigurations_(ctx.ss);
      ctx.remainingSamerPurpose = harnessRfpReadAssetField_(
        assets, samerRow, INVESTMENT_PLANNING_PURPOSE_HEADER_);
      var metadataHeaderMap = getAssetsHeaderMap_(assets);
      ctx.investmentIdColumnWidth = assets.getColumnWidth(metadataHeaderMap.investmentIdCol);
      ctx.planningPurposeColumnWidth = assets.getColumnWidth(metadataHeaderMap.planningPurposeCol);
      ctx.finalInputHeaders = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
      ctx.activityEvents = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME)
        .getDataRange().getDisplayValues();
      ctx.actions.push('Designate two accounts, rename, Stop, Reactivate, and remove one through production writers');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Rolling Financial Plan';
      ctx.assert.equals('Two Income-Producing accounts selected', ctx.firstConfig.configuredCount,
        2, { module: mod });
      ctx.assert.equals('Both selected accounts eligible', ctx.firstConfig.eligibleCount,
        2, { module: mod });
      ctx.assert.equals('Samer stable id exists', !!ctx.samerInitial.investmentId,
        true, { module: mod });
      ctx.assert.equals('Lutfi stable id exists', !!ctx.lutfiInitial.investmentId,
        true, { module: mod });
      ctx.assert.equals('Rename preserves stable id', ctx.renamedSamer.investmentId,
        ctx.samerInitial.investmentId, { module: mod });
      ctx.assert.equals('Rename updates configured name', ctx.renamedSamer.accountName,
        'Samer Income Portfolio', { module: mod });
      ctx.assert.equals('Stop preserves both configurations', ctx.stoppedConfig.configuredCount,
        2, { module: mod });
      ctx.assert.equals('Stop suspends only Samer eligibility', ctx.stoppedSamer.eligible,
        false, { module: mod });
      ctx.assert.equals('Lutfi remains eligible while Samer stopped', ctx.stoppedConfig.eligibleCount,
        1, { module: mod });
      ctx.assert.equals('Reactivate restores Samer eligibility', ctx.reactivatedSamer.eligible,
        true, { module: mod });
      ctx.assert.equals('Reactivate preserves stable id', ctx.reactivatedSamer.investmentId,
        ctx.samerInitial.investmentId, { module: mod });
      ctx.assert.equals('Removing Lutfi leaves one configuration', ctx.removedConfig.configuredCount,
        1, { module: mod });
      ctx.assert.equals('Remaining Samer account stays eligible', ctx.removedConfig.eligibleCount,
        1, { module: mod });
      ctx.assert.equals('Removing Lutfi leaves Samer designated', ctx.remainingSamerPurpose,
        INCOME_PRODUCING_PURPOSE_, { module: mod });
      ctx.assert.equals('INPUT Investments has no Investment Id header',
        ctx.finalInputHeaders.indexOf(INVESTMENT_ID_HEADER_), -1, { module: mod });
      ctx.assert.equals('INPUT Investments has no Planning Purpose header',
        ctx.finalInputHeaders.indexOf(INVESTMENT_PLANNING_PURPOSE_HEADER_), -1, { module: mod });
      ctx.assert.equals('Investment Id metadata column is readable',
        ctx.investmentIdColumnWidth >= 250, true, { module: mod });
      ctx.assert.equals('Planning Purpose metadata column is readable',
        ctx.planningPurposeColumnWidth >= 150, true, { module: mod });
      var purposeEvents = ctx.activityEvents.filter(function(row) {
        return String(row[1] || '') === 'investment_planning_purpose_update';
      });
      ctx.assert.equals('Designation changes are audited', purposeEvents.length >= 3,
        true, { module: mod });
    }
  };
}

/** Part 2A-1 identity matching is fail-closed and independent of mutable names. */
function getHarnessPart2aFinancialIdentityScenario_() {
  return {
    id: 'REGRESSION-PART-2A-FINANCIAL-IDENTITY',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    expectedAssertionCount: 7,
    description: 'Prove the pure identity matcher preserves exact source links, refuses ambiguity, separates owners and registrations, and masks identifiers.',
    requiresTrashCleanup: true,
    expectedSheets: ['SYS - Meta'],
    setup: function(ctx) {
      ctx.account = { stableAccountId: 'CASH-test', domain: 'CASH',
        displayName: 'Old name', institution: 'Fixture Bank', last4: '1234',
        ownerId: 'SAMER', registrationType: 'INDIVIDUAL' };
      ctx.raw = { sourceType: 'OFX', sourceSystem: 'Fixture Bank',
        externalAccountId: 'FIXTURE-RAW-1234', institution: 'Fixture Bank',
        displayName: 'Renamed account', last4: '1234', domain: 'CASH',
        accountType: 'Checking', ownerId: 'SAMER', registrationType: 'INDIVIDUAL',
        currency: 'USD' };
    },
    actions: function(ctx) {
      ctx.normalized = normalizeFinancialIdentityAdapterRecord_(ctx.raw);
      ctx.link = { stableAccountId: ctx.account.stableAccountId,
        sourceSystem: ctx.raw.sourceSystem,
        sourceAccountKey: ctx.normalized.sourceAccountKey, linkStatus: 'VERIFIED' };
      ctx.exact = matchFinancialIdentityAdapterRecord_(ctx.raw, [ctx.account], [ctx.link]);
      ctx.ambiguous = matchFinancialIdentityAdapterRecord_(ctx.raw,
        [ctx.account, { stableAccountId: 'CASH-other', domain: 'CASH',
          institution: 'Fixture Bank', last4: '1234', ownerId: 'SAMER',
          registrationType: 'INDIVIDUAL' }], []);
      var child = JSON.parse(JSON.stringify(ctx.raw));
      child.ownerId = 'LAITH';
      child.registrationType = 'CUSTODIAL';
      ctx.ownerConflict = matchFinancialIdentityAdapterRecord_(child, [ctx.account], [ctx.link]);
      ctx.linkAmbiguous = matchFinancialIdentityAdapterRecord_(ctx.raw, [ctx.account],
        [ctx.link, JSON.parse(JSON.stringify(ctx.link))]);
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Financial Identity';
      ctx.assert.equals('Rename preserves exact linked identity', ctx.exact.outcome,
        'EXACT_LINK', { module: mod });
      ctx.assert.equals('Duplicate institution and last4 fail ambiguous', ctx.ambiguous.outcome,
        'AMBIGUOUS', { module: mod });
      ctx.assert.equals('Child and adult identities fail closed', ctx.ownerConflict.outcome,
        'CONFLICT', { module: mod });
      ctx.assert.equals('Duplicate verified source links fail ambiguous', ctx.linkAmbiguous.outcome,
        'AMBIGUOUS', { module: mod });
      ctx.assert.equals('Raw source identifier is replaced by a protected key',
        /^sha256:[a-f0-9]{64}$/.test(ctx.normalized.sourceAccountKey), true, { module: mod });
      ctx.assert.equals('Masked identifier exposes only last four',
        ctx.normalized.maskedIdentifier, '••••1234', { module: mod });
      ctx.assert.equals('Investment stable IDs retain the adopted INV prefix',
        financialIdentityGenerateStableAccountId_('INVESTMENT').indexOf('INV-'), 0,
        { module: mod });
    }
  };
}

/** Part 2A-2 pure provenance, freshness, selection, and actionability contract. */
function getHarnessPart2aFinancialFactsScenario_() {
  return {
    id: 'REGRESSION-PART-2A-FINANCIAL-FACTS',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    expectedAssertionCount: 15,
    description: 'Prove all 23 foundation and debt fact contracts, Effective As Of freshness, policy-owned precedence, conflict retention, value typing, and decision-specific actionability.',
    requiresTrashCleanup: true,
    expectedSheets: ['SYS - Meta'],
    setup: function(ctx) {
      ctx.asOf = '2026-08-15T12:00:00.000Z';
      ctx.currentInstitution = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-current-institution'
      }), { asOf: ctx.asOf });
      ctx.staleInstitution = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-stale-institution', numericValue: 1100,
        effectiveAsOf: '2026-07-01T00:00:00.000Z'
      }), { asOf: ctx.asOf });
      ctx.currentManual = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-current-manual', sourceType: 'MANUAL', sourceSystem: 'USER',
        authorityClass: 'USER_VERIFIED_MANUAL'
      }), { asOf: ctx.asOf });
      ctx.recentInstitution = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-recent-institution', effectiveAsOf: '2026-08-10T00:00:00.000Z'
      }), { asOf: ctx.asOf });
      ctx.currentEstimate = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-current-estimate', numericValue: 995,
        sourceType: 'ESTIMATED', sourceSystem: 'USER_ESTIMATE',
        authorityClass: 'ESTIMATED', verificationStatus: 'UNVERIFIED',
        reconciliationStatus: 'UNVERIFIED'
      }), { asOf: ctx.asOf });
    },
    actions: function(ctx) {
      ctx.unknown = financialFactFromLegacyValue_({
        stableInternalAccountId: 'DEBT-LEGACY', factType: 'CURRENT_BALANCE',
        numericValue: 400, currencyOrUnit: 'USD', asOf: ctx.asOf
      });
      ctx.observedOld = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-old-observed-now', effectiveAsOf: '2026-07-31T00:00:00.000Z',
        observedAt: '2026-08-15T11:59:00.000Z', sourceType: 'STATEMENT',
        authorityClass: 'STATEMENT_DERIVED'
      }), { asOf: ctx.asOf });
      ctx.manualWinner = selectCurrentFinancialFact_([
        ctx.staleInstitution, ctx.currentManual
      ], 'DEBT-AMEX', 'CURRENT_BALANCE', ctx.asOf);
      ctx.authorityWinner = selectCurrentFinancialFact_([
        ctx.recentInstitution, ctx.currentEstimate
      ], 'DEBT-AMEX', 'CURRENT_BALANCE', ctx.asOf);
      try {
        normalizeFinancialFact_(harnessFinancialFactFixture_({
          effectiveAsOf: '2026-08-16T00:00:00.000Z'
        }), { asOf: ctx.asOf });
      } catch (e) { ctx.futureError = String(e && e.message || e); }
      try {
        normalizeFinancialFact_(harnessFinancialFactFixture_({ factType: 'USE_POLICY' }),
          { asOf: ctx.asOf });
      } catch (e2) { ctx.policyError = String(e2 && e2.message || e2); }
      ctx.stalePayoff = evaluateDecisionDataQuality_('PAY_DEBT', [
        selectCurrentFinancialFact_([ctx.staleInstitution], 'DEBT-AMEX',
          'CURRENT_BALANCE', ctx.asOf)
      ]);
      ctx.staleQuantity = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-stale-quantity', stableInternalAccountId: 'INV-TAXABLE',
        factType: 'POSITION_QUANTITY', numericValue: 12, currencyOrUnit: 'SHARES',
        effectiveAsOf: '2026-07-01T00:00:00.000Z'
      }), { asOf: ctx.asOf });
      ctx.staleSale = evaluateDecisionDataQuality_('SELL_SECURITY', [
        selectCurrentFinancialFact_([ctx.staleQuantity], 'INV-TAXABLE',
          'POSITION_QUANTITY', ctx.asOf)
      ]);
      ctx.fixedApr = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-fixed-apr', stableInternalAccountId: 'DEBT-MORTGAGE',
        factType: 'APR', numericValue: 2.75, currencyOrUnit: 'PERCENT_FIXED',
        effectiveAsOf: '2026-01-01T00:00:00.000Z'
      }), { asOf: ctx.asOf });
      ctx.fixedAprSelection = selectCurrentFinancialFact_([ctx.fixedApr],
        'DEBT-MORTGAGE', 'APR', ctx.asOf);
      ctx.conflict = selectCurrentFinancialFact_([
        normalizeFinancialFact_(harnessFinancialFactFixture_({
          factId: 'FACT-conflict-a', numericValue: 1000,
          sourceRecordKey: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }), { asOf: ctx.asOf }),
        normalizeFinancialFact_(harnessFinancialFactFixture_({
          factId: 'FACT-conflict-b', numericValue: 1001,
          sourceRecordKey: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        }), { asOf: ctx.asOf })
      ], 'DEBT-AMEX', 'CURRENT_BALANCE', ctx.asOf);
      ctx.dateFact = normalizeFinancialFact_(harnessFinancialFactFixture_({
        factId: 'FACT-payment-date', factType: 'NEXT_PAYMENT_DATE',
        numericValue: '', textValue: '2026-08-30', currencyOrUnit: 'DATE'
      }), { asOf: ctx.asOf });
      try {
        normalizeFinancialFact_(harnessFinancialFactFixture_({
          factType: 'NEXT_PAYMENT_DATE', numericValue: '', textValue: '2026-02-31',
          currencyOrUnit: 'DATE'
        }), { asOf: ctx.asOf });
      } catch (e3) { ctx.dateError = String(e3 && e3.message || e3); }
      ctx.debtOnlyQuality = evaluateDecisionDataQuality_('PAY_DEBT', [
        selectCurrentFinancialFact_([ctx.currentInstitution], 'DEBT-AMEX',
          'CURRENT_BALANCE', ctx.asOf)
      ]);
      ctx.projection = buildCurrentFinancialFactsProjection_([
        ctx.currentEstimate, ctx.recentInstitution, ctx.fixedApr
      ], ctx.asOf);
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Financial Facts';
      ctx.assert.equals('All approved foundation and debt fact types are present',
        Object.keys(FINANCIAL_FACT_TYPES_).length, 23, { module: mod });
      ctx.assert.equals('Missing legacy timestamp remains UNKNOWN',
        evaluateFinancialFactFreshness_(ctx.unknown, ctx.asOf).status, 'UNKNOWN', { module: mod });
      ctx.assert.equals('Observed today does not refresh old evidence',
        evaluateFinancialFactFreshness_(ctx.observedOld, ctx.asOf).status, 'STALE', { module: mod });
      ctx.assert.equals('Current verified manual beats stale institution',
        ctx.manualWinner.fact.factId, 'FACT-current-manual', { module: mod });
      ctx.assert.equals('Recent institution beats current unverified estimate',
        ctx.authorityWinner.fact.factId, 'FACT-recent-institution', { module: mod });
      ctx.assert.equals('Future Effective As Of is rejected',
        ctx.futureError.indexOf('cannot be in the future') !== -1, true, { module: mod });
      ctx.assert.equals('Policy fields cannot enter Financial Facts',
        ctx.policyError.indexOf('Household policy') !== -1, true, { module: mod });
      ctx.assert.equals('Stale card balance blocks payoff action',
        ctx.stalePayoff.safeToAct, false, { module: mod });
      ctx.assert.equals('Stale quantity blocks security sale',
        ctx.staleSale.safeToAct, false, { module: mod });
      ctx.assert.equals('Verified fixed mortgage APR remains usable',
        ctx.fixedAprSelection.freshness.safeToAct, true, { module: mod });
      ctx.assert.equals('Equal quality disagreement remains a conflict',
        ctx.conflict.reconciliationStatus, 'CONFLICT', { module: mod });
      ctx.assert.equals('Conflict is not actionable', ctx.conflict.freshness.safeToAct,
        false, { module: mod });
      ctx.assert.equals('Date fact is canonical', ctx.dateFact.textValue,
        '2026-08-30', { module: mod });
      ctx.assert.equals('Malformed date is rejected',
        ctx.dateError.indexOf('invalid calendar date') !== -1, true, { module: mod });
      ctx.assert.equals('Unrelated stale brokerage does not lower debt confidence',
        ctx.debtOnlyQuality.confidence, 'HIGH', { module: mod });
    }
  };
}

/** Part 2A-2 additive sheet, append-only supersession, and idempotency proof. */
function getHarnessPart2aFinancialFactsIntegrationScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-PART-2A-FINANCIAL-FACTS-INTEGRATION',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    expectedAssertionCount: 10,
    description: 'Create only the additive Financial Facts sheet and prove exact headers, idempotent evidence, append-only supersession, and rebuildable current projection.',
    requiresTrashCleanup: true,
    expectedSheets: [names.FINANCIAL_FACTS, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.beforeNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.assertWritable();
      ctx.factSheet = ensureFinancialFactsSheet_(ctx.ss);
      ctx.actions.push('Create only SYS - Financial Facts on the explicit disposable target');
    },
    actions: function(ctx) {
      var now = new Date();
      var older = new Date(now.getTime() - 86400000);
      ctx.firstRaw = harnessFinancialFactFixture_({
        factId: '', stableInternalAccountId: 'DEBT-FIXTURE', numericValue: 1000,
        effectiveAsOf: older.toISOString(), observedAt: older.toISOString(),
        createdAt: older.toISOString(),
        sourceRecordKey: 'sha256:1111111111111111111111111111111111111111111111111111111111111111'
      });
      ctx.assertWritable();
      ctx.firstAppend = appendFinancialFacts_(ctx.ss, [ctx.firstRaw], { asOf: now });
      ctx.assertWritable();
      ctx.duplicateAppend = appendFinancialFacts_(ctx.ss, [ctx.firstRaw], { asOf: now });
      ctx.secondRaw = harnessFinancialFactFixture_({
        factId: '', stableInternalAccountId: 'DEBT-FIXTURE', numericValue: 900,
        effectiveAsOf: now.toISOString(), observedAt: now.toISOString(),
        createdAt: now.toISOString(),
        sourceRecordKey: 'sha256:2222222222222222222222222222222222222222222222222222222222222222'
      });
      ctx.assertWritable();
      ctx.secondAppend = appendFinancialFacts_(ctx.ss, [ctx.secondRaw], { asOf: now });
      ctx.facts = readFinancialFacts_(ctx.ss);
      ctx.projection = buildCurrentFinancialFactsProjection_(ctx.facts, now);
      ctx.finalNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.headers = ctx.factSheet.getRange(1, 1, 1, FINANCIAL_FACT_HEADERS_.length)
        .getDisplayValues()[0];
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Financial Facts';
      ctx.assert.equals('Financial Facts sheet uses exact contract headers',
        JSON.stringify(ctx.headers), JSON.stringify(FINANCIAL_FACT_HEADERS_), { module: mod });
      ctx.assert.equals('First evidence appends once', ctx.firstAppend.appended, 1, { module: mod });
      ctx.assert.equals('Repeated evidence does not append', ctx.duplicateAppend.appended, 0,
        { module: mod });
      ctx.assert.equals('Repeated evidence is reported duplicate', ctx.duplicateAppend.duplicates, 1,
        { module: mod });
      ctx.assert.equals('Newer evidence appends once', ctx.secondAppend.appended, 1, { module: mod });
      ctx.assert.equals('History retains exactly two versions', ctx.facts.length, 2, { module: mod });
      ctx.assert.equals('New fact supersedes prior fact', ctx.facts[1].supersedesFactId,
        ctx.facts[0].factId, { module: mod });
      ctx.assert.equals('Rebuildable projection selects latest fact',
        ctx.projection[0].selection.fact.factId, ctx.facts[1].factId, { module: mod });
      ctx.assert.equals('No persisted Current Facts sheet is created',
        ctx.finalNames.indexOf('SYS - Current Facts'), -1, { module: mod });
      var addedNames = ctx.finalNames.filter(function(name) {
        return ctx.beforeNames.indexOf(name) === -1;
      });
      ctx.assert.equals('Fact foundation creates no legacy authority or policy sheets',
        JSON.stringify(addedNames), JSON.stringify([getSheetNames_().FINANCIAL_FACTS]),
        { module: mod });
    }
  };
}

function harnessFinancialFactFixture_(overrides) {
  var base = {
    factId: '', stableInternalAccountId: 'DEBT-AMEX', factType: 'CURRENT_BALANCE',
    numericValue: 1000, textValue: '', currencyOrUnit: 'USD',
    effectiveAsOf: '2026-08-15T00:00:00.000Z',
    observedAt: '2026-08-15T01:00:00.000Z', sourceType: 'INSTITUTION',
    sourceSystem: 'Fixture Institution', importRunId: 'RUN-FIXTURE',
    sourceRecordKey: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
    verifiedAt: '2026-08-15T01:00:00.000Z', manualOverride: false,
    supersedesFactId: '', reconciliationStatus: 'MATCHED',
    createdAt: '2026-08-15T01:00:00.000Z'
  };
  var input = overrides || {};
  Object.keys(input).forEach(function(key) { base[key] = input[key]; });
  return base;
}

/** Part 2A-3 source evidence -> identity -> facts, without Planning authority. */
function getHarnessPart2aAuthoritativeCashImportScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-PART-2A-AUTHORITATIVE-CASH-IMPORT',
    category: 'REGRESSION', executionLevel: 'INTEGRATION',
    expectedAssertionCount: 35,
    description: 'Import authoritative cash evidence into append-only facts with protected identity, partial safe apply, duplicate no-op, exact timestamps, and no legacy Planning writes.',
    requiresTrashCleanup: true,
    expectedSheets: [names.ACCOUNTS, names.FINANCIAL_ACCOUNTS, names.ACCOUNT_SOURCE_LINKS,
      names.FINANCIAL_FACTS, names.IMPORT_RUNS, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.beforeNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.assertWritable();
      var accounts = ensureFinancialAccountsSheet_(ctx.ss);
      ctx.assertWritable();
      var links = ensureAccountSourceLinksSheet_(ctx.ss);
      var now = '2026-08-15T13:00:00.000Z';
      ctx.assertWritable();
      var legacy = ensureSysAccountsSheet_(ctx.ss);
      harnessPart2aCashImportFixture_(legacy, accounts, links, now);
      ctx.legacyPolicyBefore = legacy.getRange(2, 1, 1, legacy.getLastColumn())
        .getDisplayValues()[0];
      ctx.identityRowsBefore = accounts.getLastRow();
      ctx.linkRowsBefore = links.getLastRow();
      ctx.planningBefore = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-15' }));
      ctx.actions.push('Create protected identity and source link on explicit disposable target');
    },
    actions: function(ctx) {
      ctx.rawIdentifier = 'FIXTURE-RAW-9012';
      ctx.ofx = [
        'OFXHEADER:100', 'DATA:OFXSGML', 'VERSION:102', '', '<OFX>',
        '<SIGNONMSGSRSV1><SONRS><FI><ORG>Fixture Bank</ORG><FID>99999</FID></FI></SONRS></SIGNONMSGSRSV1>',
        '<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD',
        '<BANKACCTFROM><BANKID>000000000<ACCTID>' + ctx.rawIdentifier + '<ACCTTYPE>SAVINGS</BANKACCTFROM>',
        '<LEDGERBAL><BALAMT>29850.00<DTASOF>20260815080000[-5:EST]</LEDGERBAL>',
        '<AVAILBAL><BALAMT>29700.00<DTASOF>20260815080000[-5:EST]</AVAILBAL>',
        '</STMTRS></STMTTRNRS><STMTTRNRS><STMTRS><CURDEF>USD',
        '<BANKACCTFROM><BANKID>000000000<ACCTID>UNLINKED-2222<ACCTTYPE>CHECKING</BANKACCTFROM>',
        '<LEDGERBAL><BALAMT>125.00<DTASOF>20260815080000[-5:EST]</LEDGERBAL>',
        '</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>'
      ].join('\n');
      ctx.adapter = adaptOfxCashEvidence_(ctx.ofx, { institution: 'Fixture Bank',
        ownerId: 'SAMER', registrationType: 'INDIVIDUAL',
        observedAt: '2026-08-15T14:00:00.000Z' });
      ctx.preview = previewAuthoritativeCashImport_(ctx.ss, ctx.adapter, {},
        '2026-08-15T15:00:00.000Z');
      ctx.assertWritable();
      ctx.first = applyAuthoritativeCashImport_(ctx.ss, ctx.adapter, {},
        ctx.preview.previewDigest, '2026-08-15T15:00:00.000Z');
      ctx.assertWritable();
      ctx.duplicate = applyAuthoritativeCashImport_(ctx.ss, ctx.adapter, {},
        ctx.preview.previewDigest, '2026-08-15T15:00:00.000Z');
      ctx.facts = readFinancialFacts_(ctx.ss);
      ctx.selection = selectCurrentFinancialFact_(ctx.facts, 'CASH-FIXTURE-ALLY',
        'CURRENT_BALANCE', '2026-08-15T15:00:00.000Z');
      ctx.factRows = ctx.ss.getSheetByName(names.FINANCIAL_FACTS).getDataRange().getDisplayValues();
      ctx.runRows = ctx.ss.getSheetByName(names.IMPORT_RUNS).getDataRange().getDisplayValues();
      ctx.shadow = getCashImportShadowComparison_(ctx.ss, [], '2026-08-15T15:00:00.000Z');
      ctx.planningAfter = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-15' }));
      ctx.legacyPolicyAfter = ctx.ss.getSheetByName(names.ACCOUNTS)
        .getRange(2, 1, 1, ctx.ss.getSheetByName(names.ACCOUNTS).getLastColumn())
        .getDisplayValues()[0];
      ctx.finalNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.actions.push('Preview and apply two-account evidence, safely retain one review row, then replay identical evidence');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Authoritative Cash Import';
      ctx.assert.equals('Two source accounts preview independently', ctx.preview.summary.accounts, 2,
        { module: mod });
      ctx.assert.equals('Verified source link matches one account', ctx.preview.summary.matched, 1,
        { module: mod });
      ctx.assert.equals('Unlinked account remains review required', ctx.preview.summary.reviewRequired, 1,
        { module: mod });
      ctx.assert.equals('Partial safe apply reports review state', ctx.first.status,
        'PARTIAL_REVIEW_REQUIRED', { module: mod });
      ctx.assert.equals('Matched account appends current and available facts', ctx.first.appendedFacts, 2,
        { module: mod });
      ctx.assert.equals('Unresolved account creates no identity',
        ctx.ss.getSheetByName(names.FINANCIAL_ACCOUNTS).getLastRow(), ctx.identityRowsBefore,
        { module: mod });
      ctx.assert.equals('Unresolved account creates no source link',
        ctx.ss.getSheetByName(names.ACCOUNT_SOURCE_LINKS).getLastRow(), ctx.linkRowsBefore,
        { module: mod });
      ctx.assert.equals('Exact source effective instant is retained',
        ctx.selection.fact.effectiveAsOf, '2026-08-15T13:00:00.000Z', { module: mod });
      ctx.assert.equals('Exact observed instant is retained',
        ctx.selection.fact.observedAt, '2026-08-15T14:00:00.000Z', { module: mod });
      ctx.assert.equals('Current authoritative cash is actionable',
        ctx.selection.freshness.safeToAct, true, { module: mod });
      ctx.assert.equals('Missing APY is explicit in preview',
        ctx.preview.accounts[0].diagnostics.indexOf('CASH_YIELD_DATA_REQUIRED') !== -1,
        true, { module: mod });
      ctx.assert.equals('Shadow report selects imported balance',
        ctx.shadow[0].normalizedValue, 29850, { module: mod });
      ctx.assert.equals('Shadow report retains legacy balance',
        ctx.shadow[0].legacyValue, 30411, { module: mod });
      ctx.assert.equals('Shadow difference is retained exactly',
        ctx.shadow[0].difference, -561, { module: mod });
      ctx.assert.equals('Exact reconciliation is separate from undecided planning materiality',
        JSON.stringify([ctx.shadow[0].reconciliationStatus, ctx.shadow[0].materialityStatus]),
        JSON.stringify(['DIFFERENCE_DETECTED', 'NOT_YET_DECIDED']), { module: mod });
      ctx.assert.equals('Identical evidence replay is a no-op', ctx.duplicate.status,
        'DUPLICATE_NOOP', { module: mod });
      ctx.assert.equals('Duplicate replay appends no facts', ctx.duplicate.appendedFacts, 0,
        { module: mod });
      ctx.assert.equals('Manifest records one applied attempt', ctx.runRows.length, 2,
        { module: mod });
      ctx.assert.equals('Facts retain no raw account identifier',
        JSON.stringify(ctx.factRows).indexOf(ctx.rawIdentifier), -1, { module: mod });
      ctx.assert.equals('Manifest retains no raw account identifier',
        JSON.stringify(ctx.runRows).indexOf(ctx.rawIdentifier), -1, { module: mod });
      ctx.assert.equals('Legacy bank authority is not created',
        ctx.finalNames.indexOf(names.BANK_ACCOUNTS), -1, { module: mod });
      ctx.assert.equals('Do Not Touch and Min Buffer policy row remains byte-equivalent',
        JSON.stringify(ctx.legacyPolicyAfter), JSON.stringify(ctx.legacyPolicyBefore),
        { module: mod });
      ctx.assert.equals('Planning output remains byte-equivalent',
        ctx.planningAfter, ctx.planningBefore, { module: mod });
      ctx.assert.equals('No persisted Current Facts sheet is created',
        ctx.finalNames.indexOf('SYS - Current Facts'), -1, { module: mod });
    }
  };
}

/** Part 2A-4 revolving debt evidence -> facts/readiness, without Planning authority. */
function getHarnessPart2aAuthoritativeDebtImportScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-PART-2A-AUTHORITATIVE-REVOLVING-DEBT',
    category: 'REGRESSION', executionLevel: 'INTEGRATION',
    expectedAssertionCount: 33,
    description: 'Import authoritative revolving-debt evidence with protected identity, partial safe apply, manual APR supplement, granular readiness, ambiguity refusal, privacy, duplicate no-op, and no Planning authority change.',
    requiresTrashCleanup: true,
    expectedSheets: [names.ACCOUNTS, names.DEBTS, names.FINANCIAL_ACCOUNTS,
      names.ACCOUNT_SOURCE_LINKS, names.FINANCIAL_FACTS, names.IMPORT_RUNS, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.asOf = '2026-08-16T20:00:00.000Z';
      ctx.rawIdentifier = '4111111111110393';
      ctx.assertWritable();
      var sysAccounts = ensureSysAccountsSheet_(ctx.ss);
      harnessAppendByHeader_(sysAccounts, { 'Account Name': 'Fixture Cash',
        'Current Balance': 20000, 'Available Now': 20000, 'Min Buffer': 1000,
        'Type': 'Checking', 'Use Policy': 'USE_WITH_CAUTION', 'Priority': 1, 'Active': 'Yes' });
      ctx.assertWritable();
      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debts = ctx.ss.getSheetByName(names.DEBTS);
      var hm = getDebtsHeaderMap_(debts);
      var totalRow = findDebtTotalRow_(debts, hm);
      harnessInsertBeforeByHeader_(debts, totalRow, { 'Account Name': 'Fixture CitiAA',
        'Type': 'Credit Card', 'Account Balance': 9500, 'Due Date': 25,
        'Credit Limit': 15000, 'Minimum Payment': 270, 'Credit Left': 5500,
        'Int Rate': 22.99, 'Acct PCT Avail': 36.67, 'Active': 'Yes',
        'Linked Property': '' });
      refreshDebtsTotalRow_(debts, hm, findDebtTotalRow_(debts, hm));
      ctx.assertWritable();
      var accounts = ensureFinancialAccountsSheet_(ctx.ss);
      ctx.assertWritable();
      var links = ensureAccountSourceLinksSheet_(ctx.ss);
      ctx.sourceSystem = 'OFX_FID_4242';
      ctx.sourceKey = financialIdentitySourceAccountKey_(ctx.sourceSystem, ctx.rawIdentifier);
      harnessPart2aDebtImportIdentityFixture_(accounts, links, ctx.sourceSystem,
        ctx.sourceKey, ctx.asOf);
      ctx.assertWritable();
      appendFinancialFacts_(ctx.ss, [{ stableInternalAccountId: 'CASH-FIXTURE',
        factType: 'CURRENT_BALANCE', numericValue: 20000, currencyOrUnit: 'USD',
        effectiveAsOf: ctx.asOf, observedAt: ctx.asOf, sourceType: 'MANUAL',
        sourceSystem: 'HARNESS_VERIFIED',
        sourceRecordKey: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        authorityClass: 'USER_VERIFIED_MANUAL', verificationStatus: 'VERIFIED',
        verifiedAt: ctx.asOf, manualOverride: true, reconciliationStatus: 'MATCHED' }],
      { asOf: ctx.asOf, defaultCreatedAt: ctx.asOf });
      ctx.debtRowBefore = debts.getDataRange().getDisplayValues()[1];
      ctx.planningBefore = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-16' }));
      ctx.actions.push('Seed synthetic legacy debt, protected stable identities, one verified source link, and current cash on the disposable target');
    },
    actions: function(ctx) {
      ctx.ofx = [
        'OFXHEADER:100', 'DATA:OFXSGML', 'VERSION:102', '', '<OFX>',
        '<SIGNONMSGSRSV1><SONRS><FI><ORG>Fixture Card Bank</ORG><FID>4242</FID></FI></SONRS></SIGNONMSGSRSV1>',
        '<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>USD',
        '<CCACCTFROM><ACCTID>' + ctx.rawIdentifier + '</CCACCTFROM>',
        '<LEDGERBAL><BALAMT>9000.00<DTASOF>20260816090000[-5:EST]</LEDGERBAL>',
        '<MINPMTDUE>270.00<NEXTPMTAMT>500.00<DTPMTDUE>20260825000000[-5:EST]',
        '<CREDITLIMIT>15000.00</CCSTMTRS></CCSTMTTRNRS>',
        '<CCSTMTTRNRS><CCSTMTRS><CURDEF>USD',
        '<CCACCTFROM><ACCTID>UNLINKED-2222</CCACCTFROM>',
        '<LEDGERBAL><BALAMT>125.00<DTASOF>20260816090000[-5:EST]</LEDGERBAL>',
        '</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>'
      ].join('\n');
      ctx.adapter = adaptOfxRevolvingDebtEvidence_(ctx.ofx, { institution: 'Fixture Card Bank',
        ownerId: 'SAMER', registrationType: 'INDIVIDUAL', observedAt: ctx.asOf });
      ctx.preview = previewAuthoritativeDebtImport_(ctx.ss, ctx.adapter, {}, ctx.asOf);
      ctx.assertWritable();
      ctx.first = applyAuthoritativeDebtImport_(ctx.ss, ctx.adapter, {},
        ctx.preview.previewDigest, ctx.asOf);
      ctx.assertWritable();
      ctx.duplicate = applyAuthoritativeDebtImport_(ctx.ss, ctx.adapter, {},
        ctx.preview.previewDigest, ctx.asOf);
      ctx.manualAdapter = adaptVerifiedManualDebtEvidence_({ stableAccountId: 'DEBT-FIXTURE-CITIAA',
        apr: 23.49, rateType: 'PERCENT_VARIABLE', effectiveAsOf: ctx.asOf,
        ownerId: 'SAMER', registrationType: 'INDIVIDUAL' }, { observedAt: ctx.asOf });
      var manualDecisions = {};
      manualDecisions[ctx.manualAdapter.accounts[0].sourceAccountKey] = {
        action: 'MATCH', stableAccountId: 'DEBT-FIXTURE-CITIAA' };
      ctx.manualPreview = previewAuthoritativeDebtImport_(ctx.ss, ctx.manualAdapter,
        manualDecisions, ctx.asOf);
      ctx.assertWritable();
      ctx.manualApply = applyAuthoritativeDebtImport_(ctx.ss, ctx.manualAdapter,
        manualDecisions, ctx.manualPreview.previewDigest, ctx.asOf);
      ctx.shadow = getDebtImportShadowComparison_(ctx.ss, [], ctx.asOf)[0];
      ctx.readiness = evaluateWeeklyPlanDataReadiness_(ctx.ss, ctx.asOf);
      ctx.missingDueQuality = evaluateRevolvingDebtActionabilityFromComparisons_({
        CURRENT_BALANCE: ctx.shadow.facts.CURRENT_BALANCE,
        APR: ctx.shadow.facts.APR,
        MINIMUM_PAYMENT: ctx.shadow.facts.MINIMUM_PAYMENT,
        NEXT_PAYMENT_DATE: { selection: { fact: null,
          freshness: evaluateFinancialFactFreshness_(null, ctx.asOf) } }
      }, [], []);
      ctx.multiple = adaptStructuredDebtEvidence_({ sourceSystem: 'HARNESS_MULTI',
        observedAt: ctx.asOf, accounts: [{ externalAccountId: 'MULTI-0393',
          currentBalance: 1000, minimumPayment: 50, nextPaymentDate: '2026-08-25',
          effectiveAsOf: ctx.asOf, ownerId: 'SAMER', registrationType: 'INDIVIDUAL',
          rates: [{ type: 'PURCHASE', apr: 19.99 },
            { type: 'CASH_ADVANCE', apr: 29.99 }] }] });
      ctx.zero = adaptStructuredDebtEvidence_({ sourceSystem: 'HARNESS_ZERO',
        observedAt: ctx.asOf, accounts: [{ externalAccountId: 'ZERO-0000',
          currentBalance: 0, effectiveAsOf: ctx.asOf, ownerId: 'SAMER',
          registrationType: 'INDIVIDUAL', rates: [] }] });
      ctx.assertWritable();
      appendFinancialFacts_(ctx.ss, [
        { stableInternalAccountId: 'DEBT-CONFLICT', factType: 'APR', numericValue: 20,
          currencyOrUnit: 'PERCENT', effectiveAsOf: ctx.asOf, observedAt: ctx.asOf,
          sourceType: 'INSTITUTION', sourceSystem: 'SOURCE-A',
          sourceRecordKey: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-CONFLICT', factType: 'APR', numericValue: 21,
          currencyOrUnit: 'PERCENT', effectiveAsOf: ctx.asOf, observedAt: ctx.asOf,
          sourceType: 'INSTITUTION', sourceSystem: 'SOURCE-B',
          sourceRecordKey: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' }
      ], { asOf: ctx.asOf, defaultCreatedAt: ctx.asOf });
      ctx.conflict = selectCurrentFinancialFact_(readFinancialFacts_(ctx.ss),
        'DEBT-CONFLICT', 'APR', ctx.asOf);
      ctx.factRows = ctx.ss.getSheetByName(names.FINANCIAL_FACTS).getDataRange().getDisplayValues();
      ctx.runRows = ctx.ss.getSheetByName(names.IMPORT_RUNS).getDataRange().getDisplayValues();
      ctx.debtRowAfter = ctx.ss.getSheetByName(names.DEBTS).getDataRange().getDisplayValues()[1];
      ctx.planningAfter = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-16' }));
      ctx.finalNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.actions.push('Preview/apply partial QFX evidence, supplement APR manually, evaluate granular readiness, retain APR conflict, and replay duplicate evidence');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Authoritative Revolving Debt';
      ctx.assert.equals('Two source accounts preview independently', ctx.preview.summary.accounts, 2,
        { module: mod });
      ctx.assert.equals('Verified debt source link matches one account', ctx.preview.summary.matched, 1,
        { module: mod });
      ctx.assert.equals('Unlinked debt remains review required', ctx.preview.summary.reviewRequired, 1,
        { module: mod });
      ctx.assert.equals('Balance-only source reports APR required',
        ctx.preview.accounts[0].diagnostics.indexOf('APR_DATA_REQUIRED') !== -1, true,
        { module: mod });
      ctx.assert.equals('Partial safe apply preserves review state', ctx.first.status,
        'PARTIAL_REVIEW_REQUIRED', { module: mod });
      ctx.assert.equals('Matched QFX appends only supplied debt facts', ctx.first.appendedFacts, 5,
        { module: mod });
      ctx.assert.equals('Manual APR supplement appends separately', ctx.manualApply.appendedFacts, 1,
        { module: mod });
      ctx.assert.equals('Manual APR keeps manual authority', ctx.shadow.facts.APR.normalizedAuthority,
        'USER_VERIFIED_MANUAL', { module: mod });
      ctx.assert.equals('Balance is selected independently', ctx.shadow.facts.CURRENT_BALANCE.normalizedValue,
        9000, { module: mod });
      ctx.assert.equals('APR is selected independently', ctx.shadow.facts.APR.normalizedValue,
        23.49, { module: mod });
      ctx.assert.equals('Minimum is selected independently', ctx.shadow.facts.MINIMUM_PAYMENT.normalizedValue,
        270, { module: mod });
      ctx.assert.equals('Exact due date is selected independently',
        ctx.shadow.facts.NEXT_PAYMENT_DATE.normalizedValue, '2026-08-25', { module: mod });
      ctx.assert.equals('Legacy balance difference remains exact',
        ctx.shadow.facts.CURRENT_BALANCE.difference, -500, { module: mod });
      ctx.assert.equals('Exact debt reconciliation is separate from materiality',
        JSON.stringify([ctx.shadow.facts.CURRENT_BALANCE.reconciliationStatus,
          ctx.shadow.facts.CURRENT_BALANCE.materialityStatus]),
        JSON.stringify(['DIFFERENCE_DETECTED', 'NOT_YET_DECIDED']), { module: mod });
      ctx.assert.equals('Legacy due day is not falsely equal to full date',
        ctx.shadow.facts.NEXT_PAYMENT_DATE.reconciliationStatus, 'UNAVAILABLE', { module: mod });
      ctx.assert.equals('Balance visibility readiness is explicit',
        ctx.readiness.dimensions.balanceReadiness.status, 'READY', { module: mod });
      ctx.assert.equals('Interest ranking readiness is explicit',
        ctx.readiness.dimensions.interestRankingReadiness.status, 'READY', { module: mod });
      ctx.assert.equals('Payment obligation readiness is explicit',
        ctx.readiness.dimensions.paymentObligationReadiness.status, 'READY', { module: mod });
      ctx.assert.equals('Missing exact due date blocks payment obligation readiness',
        ctx.missingDueQuality.paymentObligationReadiness, 'NOT_READY', { module: mod });
      ctx.assert.equals('Exact payoff readiness includes current cash',
        ctx.readiness.dimensions.exactPayoffReadiness.status, 'READY', { module: mod });
      ctx.assert.equals('Weekly milestone reaches review, not authority switch', ctx.readiness.overall,
        'READY_FOR_AUTHORITY_SWITCH_REVIEW', { module: mod });
      ctx.assert.equals('Readiness never switches authority', ctx.readiness.authoritySwitched,
        false, { module: mod });
      ctx.assert.equals('Multiple APRs require review', ctx.multiple.accounts[0].aprReviewStatus,
        'MULTIPLE_APR_REVIEW_REQUIRED', { module: mod });
      ctx.assert.equals('Ambiguous rates produce no planning APR',
        ctx.multiple.accounts[0].facts.some(function(fact) { return fact.factType === 'APR'; }),
        false, { module: mod });
      ctx.assert.equals('Current zero balance is preserved as evidence',
        ctx.zero.accounts[0].facts[0].numericValue, 0, { module: mod });
      ctx.assert.equals('Equal-quality conflicting APRs remain conflict',
        ctx.conflict.reconciliationStatus, 'CONFLICT', { module: mod });
      ctx.assert.equals('Identical QFX replay is a no-op', ctx.duplicate.status,
        'DUPLICATE_NOOP', { module: mod });
      ctx.assert.equals('Facts retain no full card number',
        JSON.stringify(ctx.factRows).indexOf(ctx.rawIdentifier), -1, { module: mod });
      ctx.assert.equals('Import Runs retain no full card number',
        JSON.stringify(ctx.runRows).indexOf(ctx.rawIdentifier), -1, { module: mod });
      ctx.assert.equals('Part 1 debt row remains byte-equivalent',
        JSON.stringify(ctx.debtRowAfter), JSON.stringify(ctx.debtRowBefore), { module: mod });
      ctx.assert.equals('Planning remains byte-equivalent', ctx.planningAfter,
        ctx.planningBefore, { module: mod });
      ctx.assert.equals('No persisted Current Facts sheet is created',
        ctx.finalNames.indexOf('SYS - Current Facts'), -1, { module: mod });
      ctx.assert.equals('Import manifest is shared rather than duplicated',
        ctx.finalNames.filter(function(name) { return name === names.IMPORT_RUNS; }).length,
        1, { module: mod });
    }
  };
}

/** Part 2A-5 customer-facing readiness projection, still shadow-only. */
function getHarnessPart2aDataReadinessScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-PART-2A-DATA-READINESS',
    category: 'REGRESSION', executionLevel: 'INTEGRATION',
    expectedAssertionCount: 24,
    description: 'Project current, stale, missing, conflicting, and differing normalized cash/card facts into a concise customer view without changing Planning authority.',
    requiresTrashCleanup: true,
    expectedSheets: [names.ACCOUNTS, names.DEBTS, names.FINANCIAL_ACCOUNTS,
      names.ACCOUNT_SOURCE_LINKS, names.FINANCIAL_FACTS, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.asOf = '2026-08-17T16:00:00.000Z';
      ctx.assertWritable();
      var legacy = ensureSysAccountsSheet_(ctx.ss);
      ctx.assertWritable();
      var accounts = ensureFinancialAccountsSheet_(ctx.ss);
      ctx.assertWritable();
      var links = ensureAccountSourceLinksSheet_(ctx.ss);
      harnessPart2aCashImportFixture_(legacy, accounts, links, ctx.asOf);
      ctx.assertWritable();
      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debts = ctx.ss.getSheetByName(names.DEBTS);
      var hm = getDebtsHeaderMap_(debts);
      var totalRow = findDebtTotalRow_(debts, hm);
      harnessInsertBeforeByHeader_(debts, totalRow, { 'Account Name': 'Fixture CitiAA',
        'Type': 'Credit Card', 'Account Balance': 9500, 'Due Date': 25,
        'Credit Limit': 15000, 'Minimum Payment': 270, 'Credit Left': 5500,
        'Int Rate': 22.99, 'Acct PCT Avail': 36.67, 'Active': 'Yes' });
      refreshDebtsTotalRow_(debts, hm, findDebtTotalRow_(debts, hm));
      ctx.sourceSystem = 'OFX_FID_4242';
      ctx.sourceKey = financialIdentitySourceAccountKey_(ctx.sourceSystem, '4111111111110393');
      harnessPart2aDebtImportIdentityFixture_(accounts, links, ctx.sourceSystem,
        ctx.sourceKey, ctx.asOf);
      ctx.identityBefore = JSON.stringify(accounts.getDataRange().getDisplayValues());
      ctx.planningBefore = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-17' }));
      ctx.actions.push('Seed one cash account and one revolving debt identity with legacy Planning values on a disposable workbook');
    },
    actions: function(ctx) {
      ctx.assertWritable();
      appendFinancialFacts_(ctx.ss, [
        { stableInternalAccountId: 'CASH-FIXTURE-ALLY', factType: 'CURRENT_BALANCE',
          numericValue: 29850, currencyOrUnit: 'USD', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'FILE_IMPORT', sourceSystem: 'OFX_FID_99999',
          sourceRecordKey: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-FIXTURE-CITIAA', factType: 'CURRENT_BALANCE',
          numericValue: 9000, currencyOrUnit: 'USD', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'FILE_IMPORT', sourceSystem: ctx.sourceSystem,
          sourceRecordKey: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-FIXTURE-CITIAA', factType: 'MINIMUM_PAYMENT',
          numericValue: 270, currencyOrUnit: 'USD', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'FILE_IMPORT', sourceSystem: ctx.sourceSystem,
          sourceRecordKey: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-FIXTURE-CITIAA', factType: 'NEXT_PAYMENT_DATE',
          textValue: '2026-08-25', currencyOrUnit: 'DATE', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'FILE_IMPORT', sourceSystem: ctx.sourceSystem,
          sourceRecordKey: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
          authorityClass: 'INSTITUTION_AUTHORITATIVE', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-FIXTURE-CITIAA', factType: 'PURCHASE_APR',
          numericValue: 23.49, currencyOrUnit: 'PERCENT', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'STATEMENT', sourceSystem: ctx.sourceSystem,
          sourceRecordKey: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          authorityClass: 'STATEMENT_DERIVED', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' },
        { stableInternalAccountId: 'DEBT-FIXTURE-CITIAA', factType: 'CASH_ADVANCE_APR',
          numericValue: 29.99, currencyOrUnit: 'PERCENT', effectiveAsOf: ctx.asOf,
          observedAt: ctx.asOf, sourceType: 'STATEMENT', sourceSystem: ctx.sourceSystem,
          sourceRecordKey: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
          authorityClass: 'STATEMENT_DERIVED', verificationStatus: 'VERIFIED',
          verifiedAt: ctx.asOf, reconciliationStatus: 'MATCHED' }
      ], { asOf: ctx.asOf, defaultCreatedAt: ctx.asOf });
      ctx.model = buildPlanningDataReadinessModel_(ctx.ss, ctx.asOf);
      ctx.noDataReadiness = evaluateWeeklyPlanDataReadinessFromState_([], {}, ctx.asOf);
      ctx.noDataState = dataReadinessCustomerState_(0, 0, ctx.noDataReadiness, []);
      ctx.noDataWeekly = dataReadinessWeeklyPresentation_(ctx.noDataReadiness,
        0, 0, ctx.noDataState);
      ctx.cashOnlyState = dataReadinessCustomerState_(1, 0,
        { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
      ctx.cardsOnlyState = dataReadinessCustomerState_(0, 1,
        { overall: 'NOT_READY_FOR_AUTHORITY_SWITCH' }, []);
      ctx.readyState = dataReadinessCustomerState_(1, 1,
        { overall: 'READY_FOR_AUTHORITY_SWITCH_REVIEW' }, []);
      ctx.planningAfter = JSON.stringify(getCapitalAllocationPlanForSpreadsheet_(ctx.ss,
        { asOfDate: '2026-08-17' }));
      ctx.identityAfter = JSON.stringify(ctx.ss.getSheetByName(names.FINANCIAL_ACCOUNTS)
        .getDataRange().getDisplayValues());
      ctx.finalNames = ctx.ss.getSheets().map(function(sheet) { return sheet.getName(); });
      ctx.actions.push('Build the read-only Data view model from one bulk identity/link/fact read');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Part 2A Data Readiness';
      var cash = ctx.model.cash.filter(function(row) {
        return row.stableAccountId === 'CASH-FIXTURE-ALLY';
      })[0];
      var debt = ctx.model.debts[0];
      var apr = debt.facts.filter(function(fact) { return fact.factType === 'APR'; })[0];
      ctx.assert.equals('View contract is versioned', ctx.model.version,
        'DATA_READINESS_VIEW_V1', { module: mod });
      ctx.assert.equals('Planning authority remains shadow-only',
        ctx.model.authority.planningUsesNormalizedData, false, { module: mod });
      ctx.assert.equals('Authority banner is customer explicit',
        ctx.model.authority.status, 'SHADOW_ONLY', { module: mod });
      ctx.assert.equals('Every active cash identity is projected once', ctx.model.cash.length, 2, { module: mod });
      ctx.assert.equals('Credit card is projected once', ctx.model.debts.length, 1, { module: mod });
      ctx.assert.equals('Normalized cash value is shown', cash.normalizedValue, 29850, { module: mod });
      ctx.assert.equals('Legacy Planning cash value remains visible', cash.planningValue, 30411,
        { module: mod });
      ctx.assert.equals('Cash difference is exact', cash.difference, -561, { module: mod });
      ctx.assert.equals('Cash difference is review-only', cash.differenceStatus,
        'DIFFERENCE_DETECTED', { module: mod });
      ctx.assert.equals('Cash effective date is retained', cash.fact.effectiveAsOf,
        ctx.asOf, { module: mod });
      ctx.assert.equals('Debt balance is normalized independently', debt.facts[0].normalizedValue,
        9000, { module: mod });
      ctx.assert.equals('Debt balance difference is exact', debt.facts[0].difference, -500,
        { module: mod });
      ctx.assert.equals('Multiple APR components remain review required',
        debt.diagnostics.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1, true, { module: mod });
      ctx.assert.equals('Ambiguous APR has no selected planning value', apr.normalizedValue,
        null, { module: mod });
      ctx.assert.equals('Ambiguous APR exposes verified-manual review', apr.canVerifyManually,
        true, { module: mod });
      ctx.assert.equals('APR ambiguity blocks readiness', debt.ready, false, { module: mod });
      ctx.assert.equals('Needs Attention contains actionable APR review',
        ctx.model.attention.some(function(issue) { return issue.title === 'APR needs review'; }),
        true, { module: mod });
      ctx.assert.equals('Weekly readiness remains review-required', ctx.model.weeklyPlanReadiness.status,
        'NEEDS_REVIEW', { module: mod });
      ctx.assert.equals('Unsupported domains use calm placeholder language',
        ctx.model.unsupportedDomains[0].status, 'Authoritative data not connected yet',
        { module: mod });
      ctx.assert.equals('Customer model contains no protected source key',
        JSON.stringify(ctx.model).indexOf(ctx.sourceKey), -1, { module: mod });
      ctx.assert.equals('Identity registry remains byte-equivalent', ctx.identityAfter,
        ctx.identityBefore, { module: mod });
      ctx.assert.equals('Planning remains byte-equivalent', ctx.planningAfter,
        ctx.planningBefore, { module: mod });
      ctx.assert.equals('No persisted Current Facts sheet is created',
        ctx.finalNames.indexOf('SYS - Current Facts'), -1, { module: mod });
      ctx.assert.equals('Only the intended additive facts sheet is present once',
        ctx.finalNames.filter(function(name) { return name === names.FINANCIAL_FACTS; }).length,
        1, { module: mod });
      ctx.assert.equals('Zero cash identities are not connected, never vacuously ready',
        ctx.noDataReadiness.dimensions.cash.status, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('Zero card identities make balances not connected',
        ctx.noDataReadiness.dimensions.balanceReadiness.status, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('Zero card identities make interest rates not connected',
        ctx.noDataReadiness.dimensions.interestRankingReadiness.status, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('Zero card identities make minimums and due dates not connected',
        ctx.noDataReadiness.dimensions.paymentObligationReadiness.status, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('Zero card identities make exact payoff not connected',
        ctx.noDataReadiness.dimensions.exactPayoffReadiness.status, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('No normalized domains produce the explicit customer state',
        ctx.noDataState.code, 'NOT_CONNECTED', { module: mod });
      ctx.assert.equals('Every no-data customer dimension says Not connected',
        ctx.noDataWeekly.dimensions.every(function(row) {
          return row.statusLabel === 'Not connected';
        }), true, { module: mod });
      ctx.assert.equals('No no-data customer dimension says Ready',
        ctx.noDataWeekly.dimensions.some(function(row) {
          return row.statusLabel === 'Ready';
        }), false, { module: mod });
      ctx.assert.equals('Cash-only normalized data produces More data needed',
        ctx.cashOnlyState.code, 'MORE_DATA_NEEDED', { module: mod });
      ctx.assert.equals('Card-only normalized data produces More data needed',
        ctx.cardsOnlyState.code, 'MORE_DATA_NEEDED', { module: mod });
      ctx.assert.equals('Complete normalized domains produce Ready for review only',
        ctx.readyState.code, 'READY_FOR_REVIEW', { module: mod });
    }
  };
}

function harnessRfpAddInvestment_(ctx, year, today, name, balance, active) {
  var input = ctx.ss.getSheetByName(getSheetNames_().INVESTMENTS);
  var block = getInvestmentsYearBlock_(input, year);
  ctx.assertWritable();
  var row = insertNewInvestmentHistoryRow_(input, block, name, 'Brokerage');
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  ctx.assertWritable();
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, balance, block.firstMonthCol);
  var activeCol = ensureInvestmentsActiveColumnForBlock_(input, block);
  ctx.assertWritable();
  writeActiveCellWithRowFormat_(input, row, activeCol, active);
  ctx.assertWritable();
  refreshInvestmentsAccountTotalsRow_(input, year);
  ctx.assertWritable();
  appendAssetsRowForNewInvestment_(
    ctx.ss.getSheetByName(getSheetNames_().ASSETS), name, 'Brokerage', balance);
}

function harnessRfpFindAssetRow_(sheet, accountName) {
  var values = sheet.getDataRange().getDisplayValues();
  var headerMap = getAssetsHeaderMap_(sheet, values);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][headerMap.nameColZero] || '').trim() === accountName) return r + 1;
  }
  throw new Error('Harness asset row not found: ' + accountName);
}

function harnessRfpReadAssetField_(sheet, row, header) {
  var display = sheet.getDataRange().getDisplayValues();
  var index = (display[0] || []).indexOf(header);
  return index === -1 ? '' : String((display[row - 1] || [])[index] || '').trim();
}

/** RFP-6a broker activity import, exclusions, dedupe, and holdings rebuild. */
function getHarnessRfpInvestmentActivityScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-RFP-INVESTMENT-ACTIVITY',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    expectedAssertionCount: 37,
    description: 'Prove account-scoped Robinhood import, new-ticker review, editable recurring plans, exclusions, lazy system sheets, duplicate protection, and holdings reconciliation on a disposable workbook.',
    requiresTrashCleanup: true,
    expectedSheets: [names.INVESTMENTS, names.ASSETS, names.INVESTMENT_ACTIVITY,
      names.INVESTMENT_HOLDINGS, names.INVESTMENT_PLANS,
      ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'],
    setup: function(ctx) {
      ctx.assertWritable();
      ensureInputInvestmentsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysAssetsSheet_(ctx.ss);
      var year = getCurrentYear_();
      var today = new Date(year, 7, 13);
      harnessRfpAddInvestment_(ctx, year, today, 'Synthetic Income Portfolio', 18000, 'Yes');
      var assets = ctx.ss.getSheetByName(names.ASSETS);
      ctx.assetRow = harnessRfpFindAssetRow_(assets, 'Synthetic Income Portfolio');
      ctx.assertWritable();
      setIncomeProducingAccountDesignationsFromDashboard({ changes: [{
        sysAssetsRow: ctx.assetRow,
        expectedAccountName: 'Synthetic Income Portfolio',
        planningPurpose: INCOME_PRODUCING_PURPOSE_
      }] }, ctx.ss);
      ctx.investmentId = getIncomeProducingAccountConfigurations_(ctx.ss)
        .eligibleAccounts[0].investmentId;
      ctx.inputHeadersBefore = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
    },
    actions: function(ctx) {
      ctx.csv = [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"4/21/2026","4/21/2026","4/22/2026","","ACH Deposit","ACH","","","$4,000.00"',
        '"4/27/2026","4/27/2026","4/28/2026","QQQ","Invesco QQQ","Buy","5","$600.00","($3,000.00)"',
        '"4/27/2026","4/27/2026","4/28/2026","JEPQ","JPMorgan Income ETF","Buy","20","$50.00","($1,000.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","QQQ","Invesco QQQ Recurring","Buy","0.5","$700.00","($350.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","JEPQ","JPMorgan Income ETF Recurring","Buy","1.5","$50.00","($75.00)"',
        '"5/5/2026","5/5/2026","5/5/2026","JEPQ","Cash Div","CDIV","","","$10.00"',
        '"5/4/2026","5/4/2026","5/5/2026","","ACH Deposit","ACH","","","$500.00"',
        '"5/4/2026","5/4/2026","5/5/2026","","ACH Deposit","ACH","","","$5.00"',
        '"5/4/2026","5/4/2026","5/5/2026","SPY","SPY 5/8/2026 Call $700.00","BTO","1","$1.00","($100.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","HL","Hecla Mining","Buy","2","$5.00","($10.00)"',
        '"5/4/2026","5/4/2026","5/5/2026","","Gold Subscription Fee","GOLD","","","($5.00)"',
        '""',
        '"","","","","","","","","","The data provided is for informational purposes only. Please consult a professional tax service or personal tax advisor."'
      ].join('\n');
      ctx.discoveryPreview = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ''
      }, ctx.ss);
      ctx.tickerDecisions = { QQQ: 'INCLUDE', JEPQ: 'INCLUDE', HL: 'EXCLUDE' };
      ctx.preview = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv,
        cutoffDate: ctx.discoveryPreview.cutoffDate,
        tickerDecisions: ctx.tickerDecisions
      }, ctx.ss);
      ctx.assertWritable();
      ctx.firstImport = importInvestmentActivityFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ctx.preview.cutoffDate,
        expectedDigest: ctx.preview.digest, tickerDecisions: ctx.tickerDecisions
      }, ctx.ss);
      ctx.assertWritable();
      ctx.portfolioAfterPlan = saveInvestmentTickerPlanFromDashboard({
        investmentId: ctx.investmentId, ticker: 'JEPQ',
        planFrequency: 'WEEKLY', plannedAmount: 75, planActive: true
      }, ctx.ss);
      ctx.assertWritable();
      ctx.ss.getSheetByName(names.INVESTMENT_ACTIVITY).setColumnWidth(1, 60);
      ctx.ss.getSheetByName(names.INVESTMENT_HOLDINGS).setColumnWidth(1, 60);
      ctx.secondPreview = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv,
        cutoffDate: ctx.preview.cutoffDate, tickerDecisions: {}
      }, ctx.ss);
      ctx.assertWritable();
      ctx.secondImport = importInvestmentActivityFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.csv, cutoffDate: ctx.preview.cutoffDate,
        expectedDigest: ctx.secondPreview.digest, tickerDecisions: {}
      }, ctx.ss);
      ctx.futureCsv = ctx.csv + '\n' +
        '"5/11/2026","5/11/2026","5/12/2026","HL","Hecla Mining new purchase","Buy","3","$6.00","($18.00)"';
      ctx.futureDiscovery = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.futureCsv,
        cutoffDate: ctx.preview.cutoffDate, tickerDecisions: {}
      }, ctx.ss);
      ctx.futureIncludePreview = previewInvestmentActivityImportFromDashboard({
        investmentId: ctx.investmentId, rawCsv: ctx.futureCsv,
        cutoffDate: ctx.preview.cutoffDate, tickerDecisions: { HL: 'INCLUDE' }
      }, ctx.ss);
      ctx.assertWritable();
      saveTrackedInvestmentAccountFromDashboard({
        sysAssetsRow: ctx.assetRow,
        expectedAccountName: 'Synthetic Income Portfolio',
        newAccountName: 'Synthetic Income Portfolio Renamed',
        type: 'Brokerage'
      }, ctx.ss);
      var activitySheet = ctx.ss.getSheetByName(names.INVESTMENT_ACTIVITY);
      var holdingsSheet = ctx.ss.getSheetByName(names.INVESTMENT_HOLDINGS);
      ctx.activityRows = activitySheet.getLastRow() - 1;
      ctx.activityImportKeyWidth = activitySheet.getColumnWidth(1);
      ctx.holdingsInvestmentIdWidth = holdingsSheet.getColumnWidth(1);
      ctx.holdingsRows = holdingsSheet.getDataRange().getDisplayValues();
      ctx.planRows = ctx.ss.getSheetByName(names.INVESTMENT_PLANS).getLastRow() - 1;
      var planValues = ctx.ss.getSheetByName(names.INVESTMENT_PLANS)
        .getRange(2, 1, ctx.planRows, INVESTMENT_PLAN_HEADERS_.length).getDisplayValues();
      ctx.hlBoundary = planValues.filter(function(row) { return row[2] === 'HL'; })[0][8];
      ctx.activityAccountNames = activitySheet.getRange(2, 3, ctx.activityRows, 1)
        .getDisplayValues().map(function(row) { return row[0]; });
      ctx.planAccountNames = ctx.ss.getSheetByName(names.INVESTMENT_PLANS)
        .getRange(2, 2, ctx.planRows, 1).getDisplayValues().map(function(row) { return row[0]; });
      ctx.renamedPortfolio = getInvestmentPortfolioActivityFromDashboard(
        ctx.investmentId, ctx.ss);
      ctx.inputHeadersAfter = ctx.ss.getSheetByName(names.INVESTMENTS)
        .getRange(2, 1, 1, 15).getDisplayValues()[0];
      ctx.actions.push('Preview and import a synthetic Robinhood CSV twice through production writers');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Investment activity import';
      ctx.assert.equals('Start date auto-detected', ctx.preview.cutoffDate, '2026-04-27', { module: mod });
      ctx.assert.equals('First preview requires three ticker decisions',
        ctx.discoveryPreview.newTickerCandidates.length, 3, { module: mod });
      ctx.assert.equals('First accepted preview reports two new recurring observations',
        ctx.preview.recurringPlanChanges.length, 2, { module: mod });
      ctx.assert.equals('Accepted portfolio rows', ctx.preview.summary.acceptedCount, 7, { module: mod });
      ctx.assert.equals('Excluded non-portfolio rows', ctx.preview.summary.excludedCount, 6, { module: mod });
      ctx.assert.equals('Options excluded', ctx.preview.summary.excludedByReason.OPTIONS_ACTIVITY, 1, { module: mod });
      ctx.assert.equals('Unrelated holding excluded', ctx.preview.summary.excludedByReason.OUTSIDE_PORTFOLIO, 1, { module: mod });
      ctx.assert.equals('Admin cash and matching fee offset excluded', ctx.preview.summary.excludedByReason.CASH_OR_ADMIN, 2, { module: mod });
      ctx.assert.equals('Robinhood disclaimer footer excluded', ctx.preview.summary.excludedByReason.NON_ACTIVITY_FOOTER, 1, { module: mod });
      ctx.assert.equals('Contribution total', ctx.preview.summary.contributions, 500, { module: mod });
      ctx.assert.equals('Opening capital reconstructed', ctx.preview.summary.openingCapital, 4000, { module: mod });
      ctx.assert.equals('Total capital includes opening funding', ctx.preview.summary.totalCapitalAdded, 4500, { module: mod });
      ctx.assert.equals('Purchase total', ctx.preview.summary.purchases, 4425, { module: mod });
      ctx.assert.equals('Dividend total', ctx.preview.summary.dividends, 10, { module: mod });
      ctx.assert.equals('First import appends all accepted rows', ctx.firstImport.appendedRows, 7, { module: mod });
      ctx.assert.equals('Second import appends no rows', ctx.secondImport.appendedRows, 0, { module: mod });
      ctx.assert.equals('Duplicate preview reports no new recurring observation',
        ctx.secondPreview.recurringPlanChanges.length, 0, { module: mod });
      ctx.assert.equals('Repeat preview does not ask about reviewed excluded ticker',
        ctx.secondPreview.newTickerCandidates.length, 0, { module: mod });
      ctx.assert.equals('Second import reports all duplicates', ctx.secondImport.duplicateRows, 7, { module: mod });
      ctx.assert.equals('Activity ledger remains deduplicated', ctx.activityRows, 7, { module: mod });
      ctx.assert.equals('Ticker decisions persist once per ticker', ctx.planRows, 3, { module: mod });
      ctx.assert.equals('Excluded ticker saves its reviewed-through checkpoint',
        ctx.hlBoundary, '2026-05-04', { module: mod });
      ctx.assert.equals('Later excluded-ticker purchase reopens review',
        ctx.futureDiscovery.newTickerCandidates.length, 1, { module: mod });
      ctx.assert.equals('Including later activity does not import pre-boundary rows',
        ctx.futureIncludePreview.summary.excludedByReason.BEFORE_TICKER_BOUNDARY, 1,
        { module: mod });
      ctx.assert.equals('Including later activity accepts only the new ticker purchase',
        ctx.futureIncludePreview.summary.acceptedCount, 8, { module: mod });
      ctx.assert.equals('Rename updates every Activity account label',
        ctx.activityAccountNames.every(function(name) {
          return name === 'Synthetic Income Portfolio Renamed';
        }), true, { module: mod });
      ctx.assert.equals('Rename updates every Plan account label',
        ctx.planAccountNames.every(function(name) {
          return name === 'Synthetic Income Portfolio Renamed';
        }), true, { module: mod });
      ctx.assert.equals('Stable id loads the renamed account portfolio',
        ctx.renamedPortfolio.accountName, 'Synthetic Income Portfolio Renamed', { module: mod });
      ctx.assert.equals('Duplicate import repairs Activity content width',
        ctx.activityImportKeyWidth > 60, true, { module: mod });
      ctx.assert.equals('Duplicate import repairs Holdings content width',
        ctx.holdingsInvestmentIdWidth > 60, true, { module: mod });
      ctx.assert.equals('Holdings contains two tickers', ctx.firstImport.holdings.length, 2, { module: mod });
      var plannedJepq = ctx.portfolioAfterPlan.holdings.filter(function(row) {
        return row.ticker === 'JEPQ';
      })[0];
      ctx.assert.equals('JEPQ recurring plan is user-configured',
        plannedJepq.planConfigured, true, { module: mod });
      ctx.assert.equals('JEPQ recurring plan preserves the chosen amount',
        plannedJepq.plannedAmount, 75, { module: mod });
      var qqq = ctx.firstImport.holdings.filter(function(row) { return row.ticker === 'QQQ'; })[0];
      var jepq = ctx.firstImport.holdings.filter(function(row) { return row.ticker === 'JEPQ'; })[0];
      ctx.assert.equals('QQQ quantity reconciles', round2_(qqq.quantity), 5.5, { module: mod });
      ctx.assert.equals('JEPQ quantity reconciles', round2_(jepq.quantity), 21.5, { module: mod });
      ctx.assert.equals('JEPQ dividend reconciles', jepq.dividendsReceived, 10, { module: mod });
      ctx.assert.equals('INPUT Investments schema unchanged', JSON.stringify(ctx.inputHeadersAfter),
        JSON.stringify(ctx.inputHeadersBefore), { module: mod });
    }
  };
}

/** RFP-3a deterministic facts and unranked Capital Allocation Queue. */
function getHarnessRfpCapitalAllocationScenario_() {
  return {
    id: 'REGRESSION-RFP-CAPITAL-ALLOCATION-FOUNDATION',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    expectedAssertionCount: 16,
    description: 'Prove deterministic required constraints and unranked candidates without allocating cash or writing recommendations.',
    requiresTrashCleanup: true,
    expectedSheets: ['SYS - Meta'],
    setup: function(ctx) {
      ctx.actions.push('Use normalized synthetic household facts; production kernel remains read-only');
    },
    actions: function(ctx) {
      ctx.facts = {
        asOfDate: '2026-08-14',
        liquidity: {
          cashToUse: 7450,
          accounts: [
            { accountName: 'Operating', balance: 9950, minBuffer: 2500, usable: 7450, included: true },
            { accountName: 'Emergency', balance: 12000, minBuffer: 0, usable: 0,
              included: false, excludedReason: 'do_not_touch_policy' },
            { accountName: 'Property reserve', balance: 500, minBuffer: 1500, usable: 0, included: true }
          ]
        },
        debts: [
          { name: 'High APR card', originalName: 'High APR card', active: true,
            balance: 10000, minimumPayment: 300, interestRate: 26.99 },
          { name: 'Low mortgage', originalName: 'Low mortgage', active: true,
            balance: 100000, minimumPayment: 900, interestRate: 1.99 },
          { name: 'Missing APR', originalName: 'Missing APR', active: true,
            balance: 5000, minimumPayment: 100, interestRate: 0 },
          { name: 'Stopped debt', originalName: 'Stopped debt', active: false,
            balance: 4000, minimumPayment: 50, interestRate: 19 }
        ],
        obligations: [
          { sourceType: 'debt_minimum', sourceId: 'High APR card', name: 'High APR card',
            actionType: 'PAY_DEBT_MINIMUM', amount: 300, requiredThisWeek: true,
            amountBasis: 'MINIMUM_PAYMENT', reason: 'Due', provenance: 'INPUT - Debts' },
          { sourceType: 'tracked_bill', sourceId: 'Tax:2026-08-20', name: 'Property tax',
            actionType: 'PAY_TRACKED_BILL', amount: 850, requiredThisWeek: true,
            amountBasis: 'DEFAULT_AMOUNT', reason: 'Due', provenance: 'INPUT - Bills' }
        ],
        incomeProducingAccounts: [
          { investmentId: 'INV-1', accountName: 'Samer Robinhood', eligible: true,
            requestedWeeklyPace: 500 },
          { investmentId: 'INV-2', accountName: 'Second Income Account', eligible: true,
            requestedWeeklyPace: 0 }
        ],
        dataQuality: []
      };
      ctx.first = buildCapitalAllocationQueue_(ctx.facts);
      ctx.second = buildCapitalAllocationQueue_(ctx.facts);
      ctx.actions.push('Build the same queue twice through the production pure kernel');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Capital Allocation Queue';
      ctx.assert.equals('Schema version is explicit', ctx.first.schemaVersion,
        'RFP_3A_V1', { module: mod });
      ctx.assert.equals('Identical facts are deterministic', JSON.stringify(ctx.first),
        JSON.stringify(ctx.second), { module: mod });
      ctx.assert.equals('Allocation remains disabled', ctx.first.allocationStatus,
        'NOT_ALLOCATED', { module: mod });
      ctx.assert.equals('No cash is allocated', ctx.first.reconciliation.allocatedAmount,
        0, { module: mod });
      ctx.assert.equals('Unallocated cash is unchanged', ctx.first.reconciliation.remainingCash,
        7450, { module: mod });
      ctx.assert.equals('Required actions total without protected cash',
        ctx.first.totals.requiredActionAmount, 1650, { module: mod });
      ctx.assert.equals('Protected balances remain separately visible',
        ctx.first.totals.protectedCashAmount, 15000, { module: mod });
      ctx.assert.equals('Every discretionary candidate is unranked',
        ctx.first.discretionaryCandidates.every(function(row) {
          return row.rank === null && row.allocatedAmount === null && row.status === 'UNRANKED';
        }), true, { module: mod });
      var debtTargets = ctx.first.discretionaryCandidates.filter(function(row) {
        return row.actionType === 'PAY_EXTRA_DEBT';
      }).map(function(row) { return row.targetName; });
      ctx.assert.equals('All active positive debts are candidates', debtTargets.length,
        3, { module: mod });
      ctx.assert.equals('Low APR debt is not excluded', debtTargets.indexOf('Low mortgage') !== -1,
        true, { module: mod });
      ctx.assert.equals('Stopped debt is excluded', debtTargets.indexOf('Stopped debt'),
        -1, { module: mod });
      ctx.assert.equals('Do-not-touch cash is protected', ctx.first.hardConstraints.some(function(row) {
        return row.actionType === 'PROTECT_CASH' && row.requestedAmount === 12000;
      }), true, { module: mod });
      ctx.assert.equals('Reserve shortfall becomes a candidate',
        ctx.first.discretionaryCandidates.some(function(row) {
          return row.actionType === 'RESTORE_RESERVE' && row.requestedAmount === 1000;
        }), true, { module: mod });
      ctx.assert.equals('Samer Robinhood minimum is a distinct policy floor',
        ctx.first.hardConstraints.some(function(row) {
          return row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' &&
            row.actionClass === 'POLICY_FLOOR' &&
            row.targetName === 'Samer Robinhood' && row.requestedAmount === 500;
        }), true, { module: mod });
      ctx.assert.equals('Holding cash remains an explicit candidate',
        ctx.first.discretionaryCandidates.some(function(row) {
          return row.actionType === 'HOLD_CASH';
        }), true, { module: mod });
      ctx.assert.equals('Missing APR blocks later allocation but not queue inclusion',
        ctx.first.dataQuality.some(function(row) {
          return row.findingId === 'MISSING_DEBT_APR:MISSING_APR' && row.blocksAllocation;
        }), true, { module: mod });
    }
  };
}

/** RFP-3b deterministic weekly ranking, allocation, and monthly rollup. */
function getHarnessRfpCapitalAllocationWeeklyPlanScenario_() {
  return {
    id: 'REGRESSION-RFP-CAPITAL-ALLOCATION-WEEKLY-PLAN',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    expectedAssertionCount: 108,
    description: 'Prove deterministic weekly ranking, recommendation lifecycle states, auditable eligible cash, variable-bill estimate handling, 90-day cash protection, debt-before-investment allocation, exact reconciliation, explicit waits, and a monthly rollup derived from the same actions.',
    requiresTrashCleanup: true,
    expectedSheets: ['SYS - Meta'],
    setup: function(ctx) {
      ctx.actions.push('Use normalized synthetic household facts with complete ranking inputs');
    },
    actions: function(ctx) {
      ctx.facts = {
        asOfDate: '2026-08-14',
        liquidity: {
          cashToUse: 7450,
          accounts: [
            { accountName: 'Operating', balance: 9950, minBuffer: 2500, usable: 7450, included: true },
            { accountName: 'Emergency', balance: 12000, minBuffer: 0, usable: 0,
              included: false, excludedReason: 'do_not_touch_policy' },
            { accountName: 'Property reserve', balance: 500, minBuffer: 1500, usable: 0, included: true }
          ]
        },
        income: { expectedThisWeek: null, normalizedWeeklyPace: 2000 },
        forecast90: {
          horizonDays: 90, startDate: '2026-08-14', endDate: '2026-11-11',
          futureBillsAmount: 1200, futureDebtMinimumsAmount: 1800,
          futureUpcomingAmount: 600, futureInvestmentCommitmentsAmount: 6000,
          futureOperatingOutflowsAmount: 3600,
          futureOperatingOutflows30Amount: 1200,
          propertyContingencyAmount: 0,
          expectedIncome: 9000, expectedNonRentalIncome: 6000,
          expectedRentalIncome: 3000, requiredReserveAmount: 2000,
          obligationOwnership: {
            trackedBills: 'bills', debtMinimums: 'debts', upcoming: 'upcoming',
            property: 'property', cashFlow: 'payment evidence', investmentPolicy: 'separate'
          }
        },
        monthlyDebtEvidenceAudit: { inputEvidenceCount: 0, uniqueEvidenceCount: 0,
          duplicateEvidenceSuppressedCount: 0, matchedEvidenceCount: 0,
          unmatchedEvidenceCount: 0, ambiguousEvidenceCount: 0, recordedEvidenceCount: 0,
          institutionConfirmedEvidenceCount: 0, obligationStatusCounts: {} },
        debts: [
          { name: 'High APR card', originalName: 'High APR card', type: 'Credit Card', active: true,
            balance: 10000, minimumPayment: 300, interestRate: 26.99 },
          { name: 'Low mortgage', originalName: 'Low mortgage', type: 'Mortgage', active: true,
            balance: 100000, minimumPayment: 900, interestRate: 1.99 }
        ],
        obligations: [
          { sourceType: 'debt_minimum', sourceId: 'High APR card', name: 'High APR card',
            actionType: 'PAY_DEBT_MINIMUM', amount: 300, requiredThisWeek: true,
            amountBasis: 'MINIMUM_PAYMENT', reason: 'Due', provenance: 'INPUT - Debts' },
          { sourceType: 'tracked_bill', sourceId: 'Tax:2026-08-20', name: 'Property tax',
            actionType: 'PAY_TRACKED_BILL', amount: 850, requiredThisWeek: true,
            amountBasis: 'DEFAULT_AMOUNT', reason: 'Due', provenance: 'INPUT - Bills' }
        ],
        incomeProducingAccounts: [
          { investmentId: 'INV-1', accountName: 'Samer Robinhood', eligible: true,
            requestedWeeklyPace: 500 }
        ],
        existingInvestmentContributions: [{
          name: 'Robinhood', amount: 500, dueDate: '2026-08-17',
          matchedInvestmentId: 'INV-1', matchedAccountName: 'Samer Robinhood',
          classificationBasis: 'MATCHED_INVESTMENT_ACCOUNT', provenance: 'INPUT - Bills'
        }, {
          name: 'M1 Investment', amount: 600, dueDate: '2026-08-17',
          matchedInvestmentId: '', matchedAccountName: '',
          classificationBasis: 'INVESTMENT_CONTRIBUTION_LABEL', provenance: 'INPUT - Bills'
        }],
        recurringInvestmentContributions: [{
          name: 'M1 Investment', scheduledAmount: 600, frequency: 'weekly', amount: 600,
          matchedInvestmentId: '', matchedAccountName: '',
          classificationBasis: 'INVESTMENT_CONTRIBUTION_LABEL',
          provenance: 'INPUT - Bills recurring schedule'
        }],
        brokerageFoundation: [{ investmentId: 'INV-M1', accountName: 'M1 Account',
          currentBalance: 50000, inKindTransferStatus: 'REVIEW_COMPATIBILITY',
          salePlanningStatus: 'TAX_DATA_REQUIRED', actionableSource: true,
          identityMessage: 'Separate SYS - Assets identity verified by INV-M1.',
          sysAssetsRow: 4
        }, { investmentId: '', accountName: '401K Account', currentBalance: 1887450,
          assetClass: 'RETIREMENT_OR_RESTRICTED', actionableSource: false,
          exclusionReason: 'Retirement assets are excluded from actionable capital sources.',
          sysAssetsRow: 5 }],
        dataQuality: [{
          findingId: 'VARIABLE_BILL_ESTIMATE_USED:PROPERTY_TAX',
          severity: 'WARNING', blocksAllocation: false,
          message: 'Property tax uses its saved estimate of $850.00 for this plan.',
          provenance: 'INPUT - Bills', estimatedAmount: 850
        }],
        // Explicit synthetic authority for allocation tests. This fixture value
        // is not a product default or a percentage-based pacing policy.
        deploymentTracking: { planningPeriod: 'WEEKLY', deploymentBudget: 10000,
          alreadyDeployedThisPeriod: 0, awaitingConfirmationAmount: 0 }
      };
      ctx.first = buildCapitalAllocationPlan_(ctx.facts);
      ctx.second = buildCapitalAllocationPlan_(ctx.facts);
      ctx.actions.push('Build the same weekly plan twice through the production pure kernel');
    },
    expectedOutcome: function(ctx) {
      var mod = 'Capital Allocation Weekly Plan';
      ctx.assert.equals('Plan schema version is explicit', ctx.first.schemaVersion,
        'RFP_3B_V2', { module: mod });
      ctx.assert.equals('Current plan is explicitly proposed',
        ctx.first.recommendationLifecycle.currentPlanState,
        'PROPOSED', { module: mod });
      ctx.assert.equals('Projected effects await authoritative confirmation',
        ctx.first.recommendationLifecycle.downstreamEffectsState,
        'AWAITING_CONFIRMATION', { module: mod });
      ctx.assert.equals('Every current weekly action remains a proposal',
        ctx.first.weeklyActions.every(function(row) {
          return row.recommendationState === 'PROPOSED';
        }), true, { module: mod });
      ctx.assert.equals('Identical facts produce identical plans', JSON.stringify(ctx.first),
        JSON.stringify(ctx.second), { module: mod });
      ctx.assert.equals('Complete facts allocate', ctx.first.allocationStatus,
        'ALLOCATED', { module: mod });
      ctx.assert.equals('Saved variable-bill estimates do not pause allocation',
        ctx.first.dataQuality[0].blocksAllocation, false, { module: mod });
      ctx.assert.equals('Opening cash is preserved', ctx.first.summary.openingCash,
        7450, { module: mod });
      ctx.assert.equals('Required actions total', ctx.first.summary.requiredThisWeek,
        1650, { module: mod });
      ctx.assert.equals('Cash after required actions', ctx.first.summary.deployableAfterRequired,
        5800, { module: mod });
      ctx.assert.equals('Protected balances remain visible', ctx.first.summary.protectedCash,
        15000, { module: mod });
      var operatingAudit = ctx.first.capitalSourceLadder.cashAccounts.filter(function(row) {
        return row.accountName === 'Operating';
      })[0];
      ctx.assert.equals('Eligible cash audit exposes balance, buffer, and usable amount',
        operatingAudit.visibleBalance + ':' + operatingAudit.minimumBuffer + ':' +
          operatingAudit.eligibleAmount,
        '9950:2500:7450', { module: mod });
      ctx.assert.equals('Configured buffers avoid silent zero-buffer warnings',
        ctx.first.capitalSourceLadder.zeroBufferWarningCount, 0, { module: mod });
      var protectedAudit = buildCapitalAllocationSourceLadder_({ liquidity: { accounts: [
        { accountName: 'BofA protected', balance: 40000, minBuffer: 0, usable: 0,
          included: false, usePolicy: 'do not touch', planningRole: 'DO_NOT_TOUCH',
          excludedReason: 'hard_exclusion_role' },
        { accountName: 'Child savings', balance: 12000, minBuffer: 0, usable: 0,
          included: false, usePolicy: 'extra cash', planningRole: 'CHILD_CUSTODIAL',
          excludedReason: 'hard_exclusion_role' },
        { accountName: 'Samer Ally', balance: 30411.01, minBuffer: 10000,
          usable: 20411.01, included: true, usePolicy: 'use with caution', planningRole: '' }
      ] } }, ctx.first);
      ctx.assert.equals('Samer Ally follows its configured buffer',
        protectedAudit.totalEligibleCash, 20411.01, { module: mod });
      ctx.assert.equals('BofA Do Not Touch remains excluded',
        protectedAudit.cashAccounts.filter(function(row) {
          return row.accountName === 'BofA protected';
        })[0].status, 'EXCLUDED', { module: mod });
      ctx.assert.equals('Child-owned cash remains excluded',
        protectedAudit.cashAccounts.filter(function(row) {
          return row.accountName === 'Child savings';
        })[0].status, 'EXCLUDED', { module: mod });
      ctx.assert.equals('Ninety-day operating reserve is protected', ctx.first.summary.reserve90Days,
        2000, { module: mod });
      ctx.assert.equals('Goal money excludes the operating reserve', ctx.first.summary.availableForGoals,
        2600, { module: mod });
      ctx.assert.equals('Balanced liquidity preference is the default',
        ctx.first.deploymentPace.liquidityPreference, 'BALANCED', { module: mod });
      ctx.assert.equals('Preferred liquidity target stays separate from the hard floor',
        ctx.first.deploymentPace.hardOperatingFloor + ':' +
          ctx.first.deploymentPace.preferredLiquidityTarget,
        '2000:3200', { module: mod });
      ctx.assert.equals('Balanced monthly deployment is capped by the calculated cushion',
        ctx.first.deploymentPace.capitalAbovePreferredLiquidity + ':' +
          ctx.first.deploymentPace.recommendedAcceleratedDeployment,
        '2600:1200', { module: mod });
      ctx.assert.equals('Balanced monthly tranche equals the calculated liquidity cushion',
        ctx.first.deploymentPace.balancedMonthlyDeploymentCap + ':' +
          ctx.first.deploymentPace.balancedLiquidityCushion,
        '1200:1200', { module: mod });
      ctx.assert.equals('Capital above the monthly tranche remains staged for a future decision',
        ctx.first.deploymentPace.intentionallyStagedCapital,
        1400, { module: mod });
      ctx.assert.equals('Post-decision cash covers both 30 and 90 days without future income',
        ctx.first.deploymentPace.coverage30Days + ':' +
          ctx.first.deploymentPace.coverage90Days + ':' +
          ctx.first.deploymentPace.futureIncomeReliedUponForOptionalDeployment,
        '3.83:1.28:false', { module: mod });
      ctx.assert.equals('Safety proof schema is explicit',
        ctx.first.safetyProof.schemaVersion,
        'RFP_3_POST_DECISION_SAFETY_V1', { module: mod });
      ctx.assert.equals('Post-decision safety proof passes all invariants',
        ctx.first.safetyProof.status, 'PASS', { module: mod });
      ctx.assert.equals('Safety proof preserves account buffers and exclusions',
        ctx.first.safetyProof.checks.accountBuffersIntact + ':' +
          ctx.first.safetyProof.checks.restrictedAccountsExcluded,
        'true:true', { module: mod });
      ctx.assert.equals('Safety proof uses dated 30-day gross obligations',
        ctx.first.safetyProof.sourceInputs.forecast.gross30DayObligations,
        1200, { module: mod });
      ctx.assert.equals('Safety proof uses complete 90-day gross obligations',
        ctx.first.safetyProof.sourceInputs.forecast.gross90DayObligations,
        3600, { module: mod });
      ctx.assert.equals('Thirty-day current-cash surplus is explicit',
        ctx.first.safetyProof.postDecision.coverage30DaySurplus,
        3400, { module: mod });
      ctx.assert.equals('Ninety-day current-cash surplus is explicit',
        ctx.first.safetyProof.postDecision.coverage90DaySurplus,
        1000, { module: mod });
      ctx.assert.equals('Safety proof does not use future income',
        ctx.first.safetyProof.checks.noFutureIncomeRequired,
        true, { module: mod });
      ctx.assert.equals('Safety proof reconciles cash exactly',
        ctx.first.safetyProof.reconciliation.cashIdentityDifference,
        0, { module: mod });
      ctx.assert.equals('Safety proof preserves proposal versus confirmation',
        ctx.first.safetyProof.checks.recommendationAwaitingConfirmation,
        true, { module: mod });
      ctx.assert.equals('Eligible cash reconciles to account-level sources',
        ctx.first.safetyProof.checks.eligibleCashMatchesAccountSources,
        true, { module: mod });
      ctx.assert.equals('Payment evidence has an exact deduplication identity',
        ctx.first.safetyProof.checks.paymentEvidenceDeduplicated,
        true, { module: mod });
      ctx.assert.equals('Recorded and institution evidence remain separate',
        ctx.first.safetyProof.checks.recordedAndInstitutionEvidenceSeparated,
        true, { module: mod });
      ctx.assert.equals('Obligation ownership is complete and exact-once',
        ctx.first.safetyProof.checks.obligationsCountedExactlyOnce,
        true, { module: mod });
      ctx.assert.equals('Balanced mode intentionally retains liquidity',
        ctx.first.deploymentPace.intentionallyRetainedLiquidity, 4600, { module: mod });
      ctx.assert.equals('Snapshot proposal is idempotent rather than additive',
        ctx.first.deploymentPace.proposalSemantics,
        'IDEMPOTENT_SNAPSHOT_NOT_ADDITIVE', { module: mod });
      ctx.assert.equals('Missing cash APY remains an explicit Part 2 boundary',
        ctx.first.deploymentPace.cashYieldDataStatus,
        'CASH_YIELD_DATA_REQUIRED', { module: mod });
      ctx.assert.equals('Existing investment contribution stays separate from required bills',
        ctx.first.existingInvestmentContributions[0].amount, 500, { module: mod });
      var reserve = ctx.first.rankedCandidates.filter(function(row) {
        return row.actionType === 'RESTORE_RESERVE';
      })[0];
      var funding = ctx.first.rankedCandidates.filter(function(row) {
        return row.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT';
      })[0];
      var high = ctx.first.rankedCandidates.filter(function(row) {
        return row.targetName === 'High APR card';
      })[0];
      var low = ctx.first.rankedCandidates.filter(function(row) {
        return row.targetName === 'Low mortgage';
      })[0];
      var hold = ctx.first.rankedCandidates.filter(function(row) {
        return row.actionType === 'HOLD_CASH';
      })[0];
      ctx.assert.equals('Reserve restoration ranks first', reserve.rank, 1, { module: mod });
      ctx.assert.equals('Reserve receives the available deployment budget first',
        reserve.allocatedAmount, 1000, { module: mod });
      ctx.assert.equals('Confirmed investment pace ranks after higher-priority debt', high.rank < funding.rank,
        true, { module: mod });
      ctx.assert.equals('Investment funding waits while higher-priority debt uses goal money', funding.allocatedAmount, 0, { module: mod });
      ctx.assert.equals('Higher APR debt ranks before lower APR debt', high.rank < low.rank,
        true, { module: mod });
      ctx.assert.equals('Remaining cash goes to high APR debt', high.allocatedAmount,
        200, { module: mod });
      ctx.assert.equals('Lower APR debt stays visible with zero allocation', low.allocatedAmount,
        0, { module: mod });
      ctx.assert.equals('Hold cash remains explicit', hold.allocatedAmount, 0, { module: mod });
      ctx.assert.equals('Ending cash reconciles', ctx.first.reconciliation.endingCash,
        4600, { module: mod });
      ctx.assert.equals('Reconciliation difference is zero', ctx.first.reconciliation.difference,
        0, { module: mod });
      ctx.assert.equals('Proposed uses never exceed eligible current cash',
        ctx.first.reconciliation.cashUses <=
          ctx.first.reconciliation.openingCash + ctx.first.reconciliation.expectedInflows,
        true, { module: mod });
      ctx.assert.equals('Only the staged amount remaining after reserve restoration reduces debt',
        Number(high.estimatedAnnualInterestAvoided || 0), 53.98, { module: mod });
      ctx.assert.equals('Monthly totals reuse weekly decisions',
        ctx.first.monthlyOutlook.totals.requiredActions +
          ctx.first.monthlyOutlook.totals.reserveRestoration +
          ctx.first.monthlyOutlook.totals.incomeProducingFunding +
          ctx.first.monthlyOutlook.totals.extraDebt +
          ctx.first.monthlyOutlook.totals.endingCash,
        7450, { module: mod });
      ctx.assert.equals('Optional contributions redirect to high-APR debt',
        ctx.first.contributionStrategy.recommendation + ':' +
          ctx.first.contributionStrategy.redirectedWeekly,
        'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_DEBT:600', { module: mod });
      ctx.assert.equals('Contribution strategy remains a proposal',
        ctx.first.contributionStrategy.recommendationState,
        'PROPOSED', { module: mod });
      ctx.assert.equals('Robinhood funding is modeled as a policy floor',
        ctx.first.investmentPolicy.policyType, 'POLICY_FLOOR', { module: mod });
      ctx.assert.equals('Robinhood policy floor remains $500',
        ctx.first.investmentPolicy.policyFloor, 500, { module: mod });
      ctx.assert.equals('Scheduled Robinhood amount remains auditable',
        ctx.first.investmentPolicy.scheduledAmount, 500, { module: mod });
      ctx.assert.equals('Recommended Robinhood total is separate from acceleration',
        ctx.first.investmentPolicy.recommendedAmount + ':' +
          ctx.first.investmentPolicy.optionalAcceleration,
        '500:0', { module: mod });
      ctx.assert.equals('Loan comparison assumption is explicit and auditable',
        ctx.first.economicAssumptions.investmentComparison.source,
        'DEFAULT_PLANNING_ASSUMPTION', { module: mod });
      ctx.assert.equals('M1 in-kind transfer remains a separate review decision',
        ctx.first.capitalSourceLadder.steps.some(function(row) {
          return row.sourceType === 'BROKERAGE_IN_KIND_TRANSFER_REVIEW' &&
            row.status === 'REVIEW_COMPATIBILITY';
        }), true, { module: mod });
      ctx.assert.equals('M1 taxable sale is blocked pending tax data',
        ctx.first.capitalSourceLadder.steps.some(function(row) {
          return row.sourceType === 'BROKERAGE_SELL_OR_TRIM_REVIEW' &&
            row.status === 'TAX_DATA_REQUIRED';
        }), true, { module: mod });
      ctx.assert.equals('Retirement assets stay outside actionable source candidates',
        ctx.first.capitalSourceLadder.excludedAssets.some(function(row) {
          return row.accountName === '401K Account' &&
            row.assetClass === 'RETIREMENT_OR_RESTRICTED';
        }), true, { module: mod });
      ctx.assert.equals('Next dollar targets highest remaining APR',
        ctx.first.nextDollar.destination, 'High APR card', { module: mod });
      ctx.assert.equals('Debt comparison explains why not invest',
        ctx.first.whyNot.winner, 'PAY_DEBT', { module: mod });
      ctx.assert.equals('Balanced mode does not consume all cash above the hard floor',
        ctx.first.summary.endingCash > ctx.first.summary.reserve90Days,
        true, { module: mod });
      ctx.assert.equals('Balanced reconciliation subtracts the Robinhood floor exactly once',
        ctx.first.summary.householdRequiredThisWeek +
          ctx.first.summary.standingInvestmentFunded +
          ctx.first.deploymentPace.recommendedAcceleratedDeployment +
          ctx.first.deploymentPace.intentionallyRetainedLiquidity,
        ctx.first.summary.openingCash + ctx.first.summary.expectedIncomeThisWeek,
        { module: mod });
      var liquidityFirstFacts = JSON.parse(JSON.stringify(ctx.facts));
      liquidityFirstFacts.liquidityPreference = 'LIQUIDITY_FIRST';
      var liquidityFirst = buildCapitalAllocationPlan_(liquidityFirstFacts);
      var aggressiveFacts = JSON.parse(JSON.stringify(ctx.facts));
      aggressiveFacts.liquidityPreference = 'AGGRESSIVE_DEBT_REDUCTION';
      var aggressive = buildCapitalAllocationPlan_(aggressiveFacts);
      ctx.assert.equals('Liquidity First retains a higher preferred target',
        liquidityFirst.deploymentPace.preferredLiquidityTarget >
          ctx.first.deploymentPace.preferredLiquidityTarget, true, { module: mod });
      ctx.assert.equals('Liquidity First deploys less accelerated capital',
        liquidityFirst.deploymentPace.recommendedAcceleratedDeployment <
          ctx.first.deploymentPace.recommendedAcceleratedDeployment, true, { module: mod });
      ctx.assert.equals('Aggressive debt reduction uses a lower preferred target',
        aggressive.deploymentPace.preferredLiquidityTarget <
          ctx.first.deploymentPace.preferredLiquidityTarget, true, { module: mod });
      ctx.assert.equals('Aggressive debt reduction can deploy more capital',
        aggressive.deploymentPace.recommendedAcceleratedDeployment >
          ctx.first.deploymentPace.recommendedAcceleratedDeployment, true, { module: mod });
      ctx.assert.equals('Aggressive mode still preserves the hard floor',
        aggressive.summary.endingCash >= aggressive.summary.reserve90Days,
        true, { module: mod });
      ctx.assert.equals('Liquidity First reconciliation subtracts the Robinhood floor exactly once',
        liquidityFirst.summary.householdRequiredThisWeek +
          liquidityFirst.summary.standingInvestmentFunded +
          liquidityFirst.deploymentPace.recommendedAcceleratedDeployment +
          liquidityFirst.deploymentPace.intentionallyRetainedLiquidity,
        liquidityFirst.summary.openingCash + liquidityFirst.summary.expectedIncomeThisWeek,
        { module: mod });
      ctx.assert.equals('Aggressive reconciliation subtracts the Robinhood floor exactly once',
        aggressive.summary.householdRequiredThisWeek +
          aggressive.summary.standingInvestmentFunded +
          aggressive.deploymentPace.recommendedAcceleratedDeployment +
          aggressive.deploymentPace.intentionallyRetainedLiquidity,
        aggressive.summary.openingCash + aggressive.summary.expectedIncomeThisWeek,
        { module: mod });
      var missingPacingFacts = JSON.parse(JSON.stringify(ctx.facts));
      delete missingPacingFacts.forecast90.futureOperatingOutflowsAmount;
      delete missingPacingFacts.forecast90.futureOperatingOutflows30Amount;
      delete missingPacingFacts.forecast90.futureBillsAmount;
      delete missingPacingFacts.forecast90.futureDebtMinimumsAmount;
      delete missingPacingFacts.forecast90.futureUpcomingAmount;
      delete missingPacingFacts.forecast90.propertyContingencyAmount;
      var missingPacing = buildCapitalAllocationPlan_(missingPacingFacts);
      ctx.assert.equals('Missing cushion inputs fail closed explicitly',
        missingPacing.deploymentPace.acceleratedDeploymentStatus,
        'PACING_DATA_REQUIRED', { module: mod });
      ctx.assert.equals('Missing cushion inputs authorize no accelerated deployment',
        missingPacing.deploymentPace.recommendedAcceleratedDeployment, 0, { module: mod });
      ctx.assert.equals('Missing cushion inputs never default any comparison mode to unlimited',
        missingPacing.deploymentPace.scenarios.every(function(row) {
          return row.acceleratedDeployment === 0 &&
            row.acceleratedDeploymentStatus === 'PACING_DATA_REQUIRED';
        }), true, { module: mod });
      ctx.assert.equals('Blocked accelerated deployment retains all post-required cash',
        missingPacing.deploymentPace.intentionallyRetainedLiquidity,
        missingPacing.deploymentPace.cashAfterRequiredAndPolicyFloor, { module: mod });
      ctx.assert.equals('Blocked pacing remains exactly reconciled',
        missingPacing.summary.householdRequiredThisWeek +
          missingPacing.summary.standingInvestmentFunded +
          missingPacing.deploymentPace.recommendedAcceleratedDeployment +
          missingPacing.deploymentPace.intentionallyRetainedLiquidity,
        missingPacing.summary.openingCash + missingPacing.summary.expectedIncomeThisWeek,
        { module: mod });
      ctx.assert.equals('Blocked pacing creates no extra debt action',
        missingPacing.weeklyActions.some(function(row) {
          return row.actionType === 'PAY_EXTRA_DEBT';
        }), false, { module: mod });
      ctx.assert.equals('Liquidity modes retain distinct preferred targets while pacing is blocked',
        missingPacing.deploymentPace.scenarios[0].preferredLiquidityTarget !==
          missingPacing.deploymentPace.scenarios[1].preferredLiquidityTarget &&
          missingPacing.deploymentPace.scenarios[1].preferredLiquidityTarget !==
            missingPacing.deploymentPace.scenarios[2].preferredLiquidityTarget,
        true, { module: mod });
      ctx.assert.equals('Plan summary preserves the pacing-data state',
        missingPacing.summary.acceleratedDeploymentStatus,
        'PACING_DATA_REQUIRED', { module: mod });
      var trackedFacts = JSON.parse(JSON.stringify(ctx.facts));
      trackedFacts.liquidity.cashToUse = 100000;
      trackedFacts.liquidity.accounts = [];
      trackedFacts.liquidityPlanning = { otherKnownCushionAmount: 25000 };
      trackedFacts.deploymentTracking = { planningPeriod: 'MONTHLY',
        deploymentBudget: 25000, alreadyDeployedThisPeriod: 20000,
        awaitingConfirmationAmount: 0 };
      var tracked = buildCapitalAllocationPlan_(trackedFacts);
      ctx.assert.equals('Weekly refresh uses only remaining monthly deployment capacity',
        tracked.deploymentPace.remainingDeploymentBudget, 5000, { module: mod });
      var awaitingFacts = JSON.parse(JSON.stringify(trackedFacts));
      awaitingFacts.deploymentTracking.alreadyDeployedThisPeriod = 0;
      awaitingFacts.deploymentTracking.awaitingConfirmationAmount = 25000;
      var awaiting = buildCapitalAllocationPlan_(awaitingFacts);
      ctx.assert.equals('Awaiting deployment is not recommended again',
        awaiting.deploymentPace.remainingDeploymentBudget, 0, { module: mod });
      ctx.assert.equals('Unchanged awaiting facts preserve one proposal identity',
        buildCapitalAllocationPlan_(awaitingFacts).deploymentPace.proposalId,
        awaiting.deploymentPace.proposalId, { module: mod });
      var nextDayFacts = JSON.parse(JSON.stringify(ctx.facts));
      nextDayFacts.asOfDate = '2026-08-15';
      ctx.assert.equals('Another refresh in the same month preserves one proposal identity',
        buildCapitalAllocationPlan_(nextDayFacts).deploymentPace.proposalId,
        ctx.first.deploymentPace.proposalId, { module: mod });
      ctx.assert.equals('Confirmed deployment is disclosed and reduces period capacity',
        tracked.deploymentPace.confirmedDeploymentAmount, 20000, { module: mod });
      var emergencyFacts = JSON.parse(JSON.stringify(ctx.facts));
      emergencyFacts.debts[0].type = 'Credit Card';
      var emergency = buildCapitalAllocationPlan_(emergencyFacts);
      ctx.assert.equals('Critical debt preserves the normal $500 policy',
        emergency.summary.emergencyInvestmentOverride + ':' +
          emergency.summary.standingInvestmentFunded,
        'false:500', { module: mod });
      ctx.assert.equals('Critical debt receives goal money after the standing minimum',
        emergency.nextDollar.destination, 'High APR card', { module: mod });
      ctx.assert.equals('Critical debt creates no Robinhood override reason',
        emergency.summary.emergencyInvestmentOverrideReasons.length, 0, { module: mod });
      ctx.assert.equals('Standing Robinhood action remains proposed',
        emergency.weeklyActions.filter(function(row) {
          return row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM';
        })[0].recommendationState, 'PROPOSED', { module: mod });
      ctx.assert.equals('After-action effects still await confirmation',
        emergency.afterAction.state, 'AWAITING_CONFIRMATION', { module: mod });
      var solvencyFacts = JSON.parse(JSON.stringify(ctx.facts));
      solvencyFacts.liquidity.cashToUse = 3300;
      var solvency = buildCapitalAllocationPlan_(solvencyFacts);
      ctx.assert.equals('Hard operating-floor conflict overrides the Robinhood floor',
        solvency.summary.emergencyInvestmentOverride + ':' +
          solvency.summary.standingInvestmentFunded,
        'true:0', { module: mod });
      ctx.assert.equals('Override state is explicit on the Robinhood action',
        solvency.weeklyActions.filter(function(row) {
          return row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM';
        })[0].status, 'EMERGENCY_OVERRIDE', { module: mod });
      ctx.assert.equals('Override records the exact violated constraint',
        solvency.investmentPolicy.overrideReasons[0].code,
        'OPERATING_FLOOR_CONFLICT', { module: mod });
      ctx.assert.equals('Optional investment funding waits during a policy-floor override',
        solvency.contributionStrategy.recommendation,
        'HOLD_OPTIONAL_DURING_POLICY_OVERRIDE', { module: mod });
      ctx.assert.equals('Emergency override reconciliation omits the unfunded Robinhood floor',
        solvency.summary.householdRequiredThisWeek +
          solvency.summary.standingInvestmentFunded +
          solvency.deploymentPace.recommendedAcceleratedDeployment +
          solvency.deploymentPace.intentionallyRetainedLiquidity,
        solvency.summary.openingCash + solvency.summary.expectedIncomeThisWeek,
        { module: mod });
      ctx.assert.equals('Override explanation names the hard operating floor',
        solvency.investmentPolicy.overrideReasons[0].message.indexOf('hard operating floor') !== -1,
        true, { module: mod });
      var revolvingFacts = JSON.parse(JSON.stringify(ctx.facts));
      revolvingFacts.liquidity.cashToUse = 14000;
      revolvingFacts.liquidity.accounts = [];
      revolvingFacts.obligations = [];
      revolvingFacts.debts = [
        { name: 'Card 18', originalName: 'Card 18', type: 'Credit Card', active: true,
          balance: 2000, minimumPayment: 50, interestRate: 18 },
        { name: 'Card 12', originalName: 'Card 12', type: 'Revolving', active: true,
          balance: 3000, minimumPayment: 75, interestRate: 12 },
        { name: 'Card 8', originalName: 'Card 8', type: 'Credit Card', active: true,
          balance: 4000, minimumPayment: 100, interestRate: 8 }
      ];
      var revolving = buildCapitalAllocationPlan_(revolvingFacts);
      ctx.assert.equals('Approved monthly tranche is exhausted highest APR first without a cutoff',
        revolving.rankedCandidates.filter(function(row) {
          return row.actionType === 'PAY_EXTRA_DEBT';
        }).map(function(row) {
          return row.targetName + ':' + row.allocatedAmount;
        }).join('|'), 'Card 18:1200|Card 12:0|Card 8:0', { module: mod });
      var transitionFacts = JSON.parse(JSON.stringify(ctx.facts));
      transitionFacts.liquidity.cashToUse = 20000;
      transitionFacts.liquidity.accounts = [{ accountName: 'Eligible cash', balance: 20000,
        minBuffer: 0, usable: 20000, included: true, usePolicy: 'use with caution' }];
      transitionFacts.debts[0].type = 'Credit Card';
      transitionFacts.debts[0].balance = 1000;
      transitionFacts.debts[1].interestRate = 7.875;
      var transition = buildCapitalAllocationPlan_(transitionFacts);
      ctx.assert.equals('Projected critical-card payoff keeps the standing $500 funded',
        transition.summary.standingInvestmentFunded, 500, { module: mod });
      ctx.assert.equals('Projected paid-off card remains awaiting confirmation',
        transition.afterAction.debts.filter(function(row) {
          return row.name === 'High APR card';
        })[0].effectState, 'AWAITING_CONFIRMATION', { module: mod });
      ctx.assert.equals('Projected released minimums are not confirmed cash flow',
        transition.afterAction.confirmedReleasedMonthlyMinimums, 0, { module: mod });
      ctx.assert.equals('Economically superior loan can rank after revolving debt',
        transition.nextDollar.actionType + ':' + transition.nextDollar.recommendationState,
        'PAY_EXTRA_DEBT:AWAITING_CONFIRMATION', { module: mod });
      ctx.assert.equals('7.875% loan is chosen generically by economics',
        transition.nextDollar.destination, 'Low mortgage', { module: mod });
      var lowCostFacts = JSON.parse(JSON.stringify(ctx.facts));
      lowCostFacts.debts = [lowCostFacts.debts[1]];
      ctx.assert.equals('1.99% debt does not automatically outrank investing',
        capitalAllocationDebtEconomics_(lowCostFacts.debts[0], lowCostFacts)
          .debtOutranksInvestment, false, { module: mod });
      var blockedFacts = JSON.parse(JSON.stringify(ctx.facts));
      blockedFacts.dataQuality = [{ findingId: 'MISSING', severity: 'ERROR',
        blocksAllocation: true, message: 'Missing', provenance: 'Fixture' }];
      var blocked = buildCapitalAllocationPlan_(blockedFacts);
      ctx.assert.equals('Blocking findings stop discretionary cash after required commitments',
        blocked.allocationStatus + ':' + blocked.reconciliation.endingCash,
        'BLOCKED:5800', { module: mod });
    }
  };
}
