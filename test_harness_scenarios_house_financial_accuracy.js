/**
 * House Financial Accuracy schema + financing regression.
 *
 * The setup creates the real production Debts presentation, removes only the
 * new trailing column to simulate the retired schema, then exercises the real
 * migration and Property Performance calculation. All mutation is confined to
 * the harness-created disposable workbook and guarded by ctx.assertWritable().
 */
function getHarnessHouseDebtLinkSchemaScenario_() {
  return {
    id: 'REGRESSION-HOUSE-DEBT-LINK-SCHEMA',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Evolve a styled legacy Debts sheet and reconcile linked actual loan payments into Property Performance.',
    expectedSheets: [
      getSheetNames_().DEBTS,
      getSheetNames_().HOUSE_ASSETS,
      getCashFlowSheetName_(getCurrentYear_())
    ],
    setup: function(ctx) {
      var year = getCurrentYear_();
      ctx.assertWritable();
      var houseAssets = ensureSysHouseAssetsSheet_(ctx.ss);
      harnessAppendByHeader_(houseAssets, {
        'House': 'Harness Rental',
        'Type': 'Rental',
        'Loan Amount Left': 180000,
        'Current Value': 300000,
        'Active': 'Yes'
      });
      createHousesExpenseSheet_(ctx.ss, 'Harness Rental');

      ctx.assertWritable();
      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      var debts = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
      var currentMap = getDebtsHeaderMap_(debts);
      debts.deleteColumn(currentMap.linkedPropertyCol);
      var legacyHeaders = DEBTS_REQUIRED_HEADERS_.slice(0, DEBTS_REQUIRED_HEADERS_.length - 1);
      var legacyMap = getDebtsHeaderMap_(debts);
      var totalRow = findDebtTotalRow_(debts, legacyMap);
      var debtRow = harnessInsertBeforeByHeader_(debts, totalRow, {
        'Account Name': 'Harness Mortgage',
        'Type': 'Loan',
        'Account Balance': 180000,
        'Due Date': 15,
        'Credit Limit': 0,
        'Minimum Payment': 1450,
        'Credit Left': -180000,
        'Int Rate': 4.25,
        'Acct PCT Avail': 0,
        'Active': 'Yes'
      });
      applyDebtsSheetStyling_(debts);

      ctx.assertWritable();
      var cashFlow = buildCashFlowYearSheet_(ctx.ss, year);
      var rentRow = insertCashFlowRow_(cashFlow, 'Income', 'Rent Harness Rental', 'CASH').row;
      var paymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness Mortgage', 'CASH').row;
      var helocPaymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness HELOC', 'CASH').row;
      var inactivePaymentRow = insertCashFlowRow_(cashFlow, 'Expense', 'Harness Inactive Loan', 'CASH').row;
      var duplicateDebtPaymentRow = insertCashFlowRow_(
        cashFlow, 'Expense', 'Harness Duplicate Debt', 'CASH').row;
      var ambiguousPaymentRowA = insertCashFlowRow_(
        cashFlow, 'Expense', 'Harness Ambiguous Loan', 'CASH').row;
      // Production insertion is intentionally idempotent by Type + Payee, so
      // it cannot create this retired/malformed state. Copy the production row
      // once inside the disposable fixture to prove reconciliation fails
      // closed when a legacy workbook already contains duplicate payment rows.
      ctx.assertWritable();
      cashFlow.insertRowAfter(ambiguousPaymentRowA);
      var ambiguousPaymentRowB = ambiguousPaymentRowA + 1;
      cashFlow.getRange(ambiguousPaymentRowA, 1, 1, cashFlow.getLastColumn()).copyTo(
        cashFlow.getRange(ambiguousPaymentRowB, 1, 1, cashFlow.getLastColumn()));
      var janCol = getMonthColumnByDate_(cashFlow, new Date(year, 0, 15), 1);
      var febCol = getMonthColumnByDate_(cashFlow, new Date(year, 1, 15), 1);
      setCurrencyCellPreserveRowFormat_(cashFlow, rentRow, janCol, 12000, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, paymentRow, janCol, 1000, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, paymentRow, febCol, 1100, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, helocPaymentRow, janCol, 500, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, inactivePaymentRow, janCol, 9999, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, duplicateDebtPaymentRow, janCol, 777, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, ambiguousPaymentRowA, janCol, 333, 5);
      setCurrencyCellPreserveRowFormat_(cashFlow, ambiguousPaymentRowB, janCol, 444, 5);

      ctx.houseDebtLinkSchema = {
        year: year,
        sheet: debts,
        debtRow: debtRow,
        beforeHeaders: legacyHeaders,
        beforeRow: debts.getRange(debtRow, 1, 1, legacyHeaders.length).getValues()[0],
        beforeTotal: debts.getRange(debtRow + 1, 1).getDisplayValue(),
        activeHeaderBackground: debts.getRange(1, legacyMap.activeCol).getBackground(),
        activeHeaderFontColor: debts.getRange(1, legacyMap.activeCol).getFontColor(),
        activeHeaderFontWeight: debts.getRange(1, legacyMap.activeCol).getFontWeight(),
        activeBodyBackground: debts.getRange(debtRow, legacyMap.activeCol).getBackground(),
        totalRowBackground: debts.getRange(debtRow + 1, 1).getBackground()
      };
      ctx.actions.push(
        'Create production-styled legacy Debts fixture, actual Cash Flow payments, and one guarded malformed duplicate');
    },
    actions: function(ctx) {
      var state = ctx.houseDebtLinkSchema;
      ctx.assertWritable();
      state.firstMap = ensureDebtsLinkedPropertyColumn_(state.sheet, ctx.ss);
      state.afterFirstLastCol = state.sheet.getLastColumn();
      state.afterFirstHeaders = state.sheet.getRange(
        1, 1, 1, state.afterFirstLastCol).getDisplayValues()[0];
      state.afterFirstRow = state.sheet.getRange(
        state.debtRow, 1, 1, state.beforeHeaders.length).getValues()[0];
      state.afterFirstTotal = state.sheet.getRange(state.debtRow + 1, 1).getDisplayValue();
      state.linkedHeaderBackground = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getBackground();
      state.linkedHeaderFontColor = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getFontColor();
      state.linkedHeaderFontWeight = state.sheet.getRange(1, state.firstMap.linkedPropertyCol).getFontWeight();
      state.linkedBodyBackground = state.sheet.getRange(
        state.debtRow, state.firstMap.linkedPropertyCol).getBackground();
      state.linkedWidth = state.sheet.getColumnWidth(state.firstMap.linkedPropertyCol);

      var validatedLink = validateDebtLinkedProperty_(ctx.ss, 'Loan', 'Harness Rental', '');
      state.sheet.getRange(state.debtRow, state.firstMap.linkedPropertyCol).setValue(validatedLink);

      var additionalDebts = [
        { name: 'Harness HELOC', type: 'HELOC', balance: 25000, active: 'Yes' },
        { name: 'Harness Missing Payment', type: 'Loan', balance: 15000, active: 'Yes' },
        { name: 'Harness Inactive Loan', type: 'Loan', balance: 9000, active: 'No' },
        { name: 'Harness Duplicate Debt', type: 'Loan', balance: 12000, active: 'Yes' },
        { name: 'Harness Duplicate Debt', type: 'Loan', balance: 11000, active: 'Yes' },
        { name: 'Harness Ambiguous Loan', type: 'Loan', balance: 10000, active: 'Yes' }
      ];
      additionalDebts.forEach(function(debt) {
        ctx.assertWritable();
        var liveMap = getDebtsHeaderMap_(state.sheet);
        var liveTotalRow = findDebtTotalRow_(state.sheet, liveMap);
        harnessInsertBeforeByHeader_(state.sheet, liveTotalRow, {
          'Account Name': debt.name,
          'Type': debt.type,
          'Account Balance': debt.balance,
          'Due Date': 15,
          'Credit Limit': debt.type === 'HELOC' ? 50000 : 0,
          'Minimum Payment': 250,
          'Credit Left': debt.type === 'HELOC' ? 25000 : -debt.balance,
          'Int Rate': 5,
          'Acct PCT Avail': debt.type === 'HELOC' ? 50 : 0,
          'Active': debt.active,
          'Linked Property': validateDebtLinkedProperty_(ctx.ss, debt.type, 'Harness Rental', '')
        });
      });
      var finalMap = getDebtsHeaderMap_(state.sheet);
      refreshDebtsTotalRow_(state.sheet, finalMap, findDebtTotalRow_(state.sheet, finalMap));
      applyDebtsSheetStyling_(state.sheet);
      applyDebtLinkedPropertyValidation_(state.sheet, ctx.ss, finalMap);

      ctx.assertWritable();
      state.secondMap = ensureDebtsLinkedPropertyColumn_(state.sheet, ctx.ss);
      state.afterSecondLastCol = state.sheet.getLastColumn();
      state.validation = state.sheet.getRange(
        state.debtRow, state.secondMap.linkedPropertyCol).getDataValidation();
      state.performance = getPropertyPerformanceDataForSpreadsheet_(ctx.ss, { year: state.year });
      state.performanceRow = state.performance.rows.filter(function(row) {
        return row.house === 'Harness Rental';
      })[0] || null;
      ctx.actions.push('Run production migration twice and reconcile the production Property Performance payload');
    },
    expectedOutcome: function(ctx) {
      var state = ctx.houseDebtLinkSchema;
      var mod = 'House Debt Link Schema';
      ctx.assert.equals('Linked Property is column 11', state.firstMap.linkedPropertyCol, 11, { module: mod });
      ctx.assert.equals('Linked Property is final header',
        state.afterFirstHeaders[state.afterFirstHeaders.length - 1],
        DEBTS_LINKED_PROPERTY_HEADER_, { module: mod });
      ctx.assert.equals('First ensure adds one column', state.afterFirstLastCol, 11, { module: mod });
      ctx.assert.equals('Second ensure adds no column', state.afterSecondLastCol, 11, { module: mod });
      ctx.assert.equals('Existing debt cells are preserved',
        JSON.stringify(state.afterFirstRow), JSON.stringify(state.beforeRow), { module: mod });
      ctx.assert.equals('TOTAL DEBT label is preserved', state.afterFirstTotal, state.beforeTotal, { module: mod });
      ctx.assert.equals('Active remains before Linked Property', state.secondMap.activeCol, 10, { module: mod });
      ctx.assert.equals('Active-property validation is present', !!state.validation, true, { module: mod });
      ctx.assert.equals('Linked Property header background inherits production styling',
        state.linkedHeaderBackground, state.activeHeaderBackground, { module: mod });
      ctx.assert.equals('Linked Property header font color inherits production styling',
        state.linkedHeaderFontColor, state.activeHeaderFontColor, { module: mod });
      ctx.assert.equals('Linked Property header weight inherits production styling',
        state.linkedHeaderFontWeight, state.activeHeaderFontWeight, { module: mod });
      ctx.assert.equals('Linked Property body background inherits production styling',
        state.linkedBodyBackground, state.activeBodyBackground, { module: mod });
      ctx.assert.equals('Linked Property canonical width', state.linkedWidth, 220, { module: mod });
      ctx.assert.equals('Header row remains frozen', state.sheet.getFrozenRows(), 1, { module: mod });
      ctx.assert.equals('TOTAL DEBT styling remains distinct from data row',
        state.totalRowBackground === state.activeBodyBackground, false, { module: mod });

      var finance = 'Property Financing';
      ctx.assert.equals('Property row is present', !!state.performanceRow, true, { module: finance });
      if (state.performanceRow) {
        ctx.assert.equals('Operating expenses remain separate',
          state.performanceRow.operatingExpenses, 0, { module: finance });
        ctx.assert.equals('Operating net remains rent minus operating expenses',
          state.performanceRow.operatingNet, 12000, { module: finance });
        ctx.assert.equals('Distinct linked loans sum selected-year Cash Flow',
          state.performanceRow.loanPayments, 2600, { module: finance });
        ctx.assert.equals('Net cash flow subtracts financing once',
          state.performanceRow.netCashFlow, 9400, { module: finance });
        ctx.assert.equals('Inactive linked debt is excluded from linked-loan count',
          state.performanceRow.linkedLoanCount, 6, { module: finance });
        ctx.assert.equals('Only recorded active loan rows are matched',
          state.performanceRow.matchedLoanCount, 2, { module: finance });
        ctx.assert.equals('Missing payment is surfaced without an estimate',
          state.performanceRow.financingMessage,
          'No loan payments recorded for this year.', { module: finance });
      }
      ctx.assert.equals('Duplicate linked debt names fail closed',
        String(state.performance.message || '').indexOf(
          'Duplicate linked debt names were excluded to prevent double counting.') !== -1,
        true, { module: finance });
      ctx.assert.equals('Duplicate Cash Flow payment rows fail closed',
        String(state.performance.message || '').indexOf(
          'Ambiguous loan-payment rows were excluded to prevent double counting.') !== -1,
        true, { module: finance });
      ctx.assert.equals('Portfolio loan payments reconcile to rows',
        state.performance.portfolio.loanPayments, 2600, { module: finance });
      ctx.assert.equals('Portfolio net cash flow reconciles to rows',
        state.performance.portfolio.netCashFlow, 9400, { module: finance });
    }
  };
}
