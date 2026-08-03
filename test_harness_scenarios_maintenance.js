/** Focused maintenance regressions for coordinated Bill edits and Donations. */

function harnessCreateBillsMaintenanceFixture_(ctx, options) {
  options = options || {};
  var ss = ctx.ss;
  var billsName = getSheetNames_().BILLS;
  var header = [
    'Payee', 'Category', 'Due Day', 'Default Amount', 'Varies', 'Autopay',
    'Active', 'Payment Source', 'Frequency', 'Start Month', 'Notes',
    'Weekday', 'Anchor Date', 'Schedule Effective Date'
  ];
  var bills = ss.getSheetByName(billsName) || ss.insertSheet(billsName);
  bills.getRange(1, 1, 1, header.length).setValues([header]);
  var payee = options.payee || 'Harness Electric';
  var row = [
    payee,
    'Utilities',
    options.dueDay || 9,
    options.amount || 75,
    'No',
    options.autopay || 'No',
    'Yes',
    'CASH',
    'Monthly',
    options.startMonth || 1,
    'Original note',
    '',
    '',
    ''
  ];
  bills.getRange(2, 1, 1, row.length).setValues([row]);

  var year = Number(options.year || new Date().getFullYear());
  var cashFlow = buildCashFlowYearSheet_(ss, year);
  var cashFlowRow = insertCashFlowRow_(cashFlow, 'Expense', payee, 'CASH');
  return {
    bills: bills,
    billsName: billsName,
    billRow: 2,
    cashFlow: cashFlow,
    cashFlowRow: cashFlowRow.row,
    year: year,
    payee: payee,
    header: header
  };
}

function harnessBillEditPayload_(fixture, expectedPayee, payee, overrides) {
  var payload = {
    sheetRow: fixture.billRow,
    expectedPayee: expectedPayee,
    payee: payee,
    dueDay: 9,
    frequency: 'Monthly',
    paymentSource: 'CASH',
    defaultAmount: 75,
    category: 'Utilities',
    notes: 'Original note',
    autopay: 'No',
    varies: 'No',
    weekday: '',
    anchorDate: ''
  };
  Object.keys(overrides || {}).forEach(function(key) {
    payload[key] = overrides[key];
  });
  return payload;
}

function getHarnessBillsEditIntegrityScenario_() {
  return {
    id: 'REGRESSION-BILLS-EDIT-INTEGRITY',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Verify exact current-year Bill payee propagation, dynamic Payee-column sizing, collision refusal, category-race fallback, immutable audit, and audit-failure rollback.',
    expectedSheets: [
      'INPUT - Settings',
      'INPUT - Bills',
      getCashFlowSheetName_(new Date().getFullYear()),
      ACTIVITY_LOG_SHEET_NAME,
      'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.billEditIntegrity = harnessCreateBillsMaintenanceFixture_(ctx, {
        year: new Date().getFullYear()
      });
      var state = ctx.billEditIntegrity;
      var cfHeader = getCashFlowHeaderMap_(state.cashFlow);
      state.bills.setColumnWidth(1, 60);
      state.cashFlow.setColumnWidth(cfHeader.payeeCol, 60);
      state.billPayeeWidthBeforeRename = state.bills.getColumnWidth(1);
      state.cashFlowPayeeWidthBeforeRename = state.cashFlow.getColumnWidth(cfHeader.payeeCol);
      ctx.actions.push('Create exact linked Bill and current-year Cash Flow Expense row');
    },
    actions: function(ctx) {
      var state = ctx.billEditIntegrity;
      ctx.assertWritable();
      state.rename = updateTrackedBillFromDashboard(
        harnessBillEditPayload_(state, state.payee, 'Harness Power'),
        ctx.ss
      );

      var cfHeader = getCashFlowHeaderMap_(state.cashFlow);
      state.billPayeeAfterRename = state.bills.getRange(2, 1).getDisplayValue();
      state.cashFlowPayeeAfterRename = state.cashFlow
        .getRange(state.cashFlowRow, cfHeader.payeeCol)
        .getDisplayValue();
      state.billPayeeWidthAfterRename = state.bills.getColumnWidth(1);
      state.cashFlowPayeeWidthAfterRename = state.cashFlow.getColumnWidth(cfHeader.payeeCol);

      // Reproduce the first-open category race at the server boundary: an
      // omitted category retains the verified row value instead of failing.
      ctx.assertWritable();
      state.categoryFallback = updateTrackedBillFromDashboard(
        harnessBillEditPayload_(state, 'Harness Power', 'Harness Power', {
          category: '',
          notes: 'Category request was still loading'
        }),
        ctx.ss
      );
      state.categoryAfterFallback = state.bills.getRange(2, 2).getDisplayValue();

      // Destination Cash Flow collision must refuse before either row changes.
      ctx.assertWritable();
      insertCashFlowRow_(state.cashFlow, 'Expense', 'Harness Taken', 'CASH');
      try {
        updateTrackedBillFromDashboard(
          harnessBillEditPayload_(state, 'Harness Power', 'Harness Taken', {
            notes: 'Category request was still loading'
          }),
          ctx.ss
        );
        state.collisionError = '';
      } catch (collisionErr) {
        state.collisionError = String(collisionErr && collisionErr.message || collisionErr);
      }

      // Force the mandatory audit append to fail after the coordinated writes;
      // both cells and the accompanying Notes edit must roll back.
      var originalAppend = appendActivityLog_;
      appendActivityLog_ = function() { return false; };
      try {
        ctx.assertWritable();
        updateTrackedBillFromDashboard(
          harnessBillEditPayload_(state, 'Harness Power', 'Harness Rollback', {
            notes: 'Must roll back with rename'
          }),
          ctx.ss
        );
        state.rollbackError = '';
      } catch (rollbackErr) {
        state.rollbackError = String(rollbackErr && rollbackErr.message || rollbackErr);
      } finally {
        appendActivityLog_ = originalAppend;
      }
      state.billPayeeAfterRollback = state.bills.getRange(2, 1).getDisplayValue();
      state.billNotesAfterRollback = state.bills.getRange(2, 11).getDisplayValue();
      state.cashFlowPayeeAfterRollback = state.cashFlow
        .getRange(state.cashFlowRow, cfHeader.payeeCol)
        .getDisplayValue();

      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var activityRows = activity ? activity.getDataRange().getDisplayValues() : [];
      state.renameAuditCount = activityRows.filter(function(row) {
        if (String(row[1] || '') !== 'bill_update') return false;
        try {
          var details = JSON.parse(String(row[11] || '{}'));
          return details.linkedCashFlowRename &&
            details.linkedCashFlowRename.newPayee === 'Harness Power';
        } catch (_e) { return false; }
      }).length;
    },
    expectedOutcome: function(ctx) {
      var state = ctx.billEditIntegrity;
      var mod = 'Bill Edit Integrity';
      ctx.assert.equals('Bill row renamed', state.billPayeeAfterRename, 'Harness Power', { module: mod });
      ctx.assert.equals('Exact linked Cash Flow row renamed', state.cashFlowPayeeAfterRename, 'Harness Power', { module: mod });
      ctx.assert.equals('Bills Payee column auto-fits renamed text', state.billPayeeWidthAfterRename > state.billPayeeWidthBeforeRename, true, { module: mod });
      ctx.assert.equals('Cash Flow Payee column auto-fits renamed text', state.cashFlowPayeeWidthAfterRename > state.cashFlowPayeeWidthBeforeRename, true, { module: mod });
      ctx.assert.equals('Rename writes exactly one immutable audit entry', state.renameAuditCount, 1, { module: mod });
      ctx.assert.equals('Missing category retains verified row category', state.categoryAfterFallback, 'Utilities', { module: mod });
      ctx.assert.equals('Category-race fallback save succeeds', state.categoryFallback.ok, true, { module: mod });
      ctx.assert.equals('Destination collision is refused', /already uses the new payee/.test(state.collisionError), true, { module: mod });
      ctx.assert.equals('Audit failure reports rollback', /rolled back/.test(state.rollbackError), true, { module: mod });
      ctx.assert.equals('Bill payee restored after audit failure', state.billPayeeAfterRollback, 'Harness Power', { module: mod });
      ctx.assert.equals('Cash Flow payee restored after audit failure', state.cashFlowPayeeAfterRollback, 'Harness Power', { module: mod });
      ctx.assert.equals('Companion Bill edit restored after audit failure', state.billNotesAfterRollback, 'Category request was still loading', { module: mod });
    }
  };
}

function getHarnessBillsAutopayFormatScenario_() {
  return {
    id: 'REGRESSION-BILLS-AUTOPAY-FORMAT',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Verify a production AutoPay write stores -75 and ends with the canonical red negative-currency format.',
    expectedSheets: [
      'INPUT - Settings', 'INPUT - Bills', 'INPUT - Cash Flow 2026',
      ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.billsAutopayFormat = harnessCreateBillsMaintenanceFixture_(ctx, {
        year: 2026,
        dueDay: 9,
        startMonth: 7,
        autopay: 'Yes',
        amount: 75,
        payee: 'Harness AutoPay Format'
      });
    },
    actions: function(ctx) {
      var state = ctx.billsAutopayFormat;
      ctx.assertWritable();
      getInputBillsDueRows_(
        ctx.ss,
        new Date(2026, 6, 10),
        Session.getScriptTimeZone()
      );
      var monthCol = getMonthColumnByDate_(state.cashFlow, new Date(2026, 6, 10), 1);
      var cell = state.cashFlow.getRange(state.cashFlowRow, monthCol);
      state.value = Number(cell.getValue());
      state.numberFormat = cell.getNumberFormat();
      state.display = cell.getDisplayValue();
    },
    expectedOutcome: function(ctx) {
      var state = ctx.billsAutopayFormat;
      var mod = 'Bill AutoPay Format';
      ctx.assert.equals('AutoPay writes the signed expense value', state.value, -75, { module: mod });
      ctx.assert.equals('AutoPay applies canonical red-negative currency format', state.numberFormat, CASH_FLOW_MONEY_FORMAT_, { module: mod });
      ctx.assert.equals('AutoPay display retains currency and negative sign', state.display, '-$75.00', { module: mod });
    }
  };
}

function getHarnessDonationCommentsEditScenario_() {
  return {
    id: 'REGRESSION-DONATION-COMMENTS-EDIT',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Verify locked Recent Donations comments-only editing, exact-row refusal, audit history, and audit-failure rollback.',
    expectedSheets: [
      'INPUT - Settings', DONATION_SHEET_NAME_, ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.donationCommentsEdit = {};
    },
    actions: function(ctx) {
      var state = ctx.donationCommentsEdit;
      var year = new Date().getFullYear();
      var date = Utilities.formatDate(new Date(year, 5, 12), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      ctx.assertWritable();
      addDonation({
        charityName: 'Harness Food Pantry', donationDate: date, amount: 90,
        taxYear: year, comments: 'Original comment', paymentType: 'Cash'
      }, ctx.ss);
      var recent = getDonationsFormData(ctx.ss).recentDonations[0];
      state.recent = recent;

      ctx.assertWritable();
      state.updated = updateRecentDonationComments({
        sheetRow: recent.sheetRow,
        taxYear: recent.taxYear,
        charityName: recent.charity,
        entryDate: recent.entryDate,
        amount: recent.amount,
        paymentType: recent.paymentType,
        expectedComments: recent.comments,
        comments: 'Updated from Recent Donations'
      }, ctx.ss);
      state.afterUpdate = getDonationsFormData(ctx.ss).recentDonations[0];

      var originalAppend = appendActivityLog_;
      appendActivityLog_ = function() { return false; };
      try {
        ctx.assertWritable();
        updateRecentDonationComments({
          sheetRow: state.afterUpdate.sheetRow,
          taxYear: state.afterUpdate.taxYear,
          charityName: state.afterUpdate.charity,
          entryDate: state.afterUpdate.entryDate,
          amount: state.afterUpdate.amount,
          paymentType: state.afterUpdate.paymentType,
          expectedComments: state.afterUpdate.comments,
          comments: 'Must not survive failed audit'
        }, ctx.ss);
        state.rollbackError = '';
      } catch (rollbackErr) {
        state.rollbackError = String(rollbackErr && rollbackErr.message || rollbackErr);
      } finally {
        appendActivityLog_ = originalAppend;
      }
      state.afterRollback = getDonationsFormData(ctx.ss).recentDonations[0];

      // A stale browser snapshot must not overwrite a newer comment.
      try {
        ctx.assertWritable();
        updateRecentDonationComments({
          sheetRow: recent.sheetRow,
          taxYear: recent.taxYear,
          charityName: recent.charity,
          entryDate: recent.entryDate,
          amount: recent.amount,
          paymentType: recent.paymentType,
          expectedComments: recent.comments,
          comments: 'Stale overwrite'
        }, ctx.ss);
        state.staleError = '';
      } catch (staleErr) {
        state.staleError = String(staleErr && staleErr.message || staleErr);
      }

      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var activityRows = activity.getDataRange().getDisplayValues();
      state.auditCount = activityRows.filter(function(row) {
        return String(row[1] || '') === 'donation_comment_update';
      }).length;
    },
    expectedOutcome: function(ctx) {
      var state = ctx.donationCommentsEdit;
      var mod = 'Donation Comments Edit';
      ctx.assert.equals('Comments-only update succeeds', state.updated.ok, true, { module: mod });
      ctx.assert.equals('Recent Donations returns updated comments', state.afterUpdate.comments, 'Updated from Recent Donations', { module: mod });
      ctx.assert.equals('Exactly one comment audit row is retained', state.auditCount, 1, { module: mod });
      ctx.assert.equals('Audit failure reports restoration', /prior value was restored/.test(state.rollbackError), true, { module: mod });
      ctx.assert.equals('Audit failure rolls comments back', state.afterRollback.comments, 'Updated from Recent Donations', { module: mod });
      ctx.assert.equals('Stale row snapshot is refused', /changed or moved/.test(state.staleError), true, { module: mod });
    }
  };
}

function getHarnessDonationFullEditScenario_() {
  return {
    id: 'REGRESSION-DONATION-FULL-EDIT',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Verify locked full-donation editing, safe tax-year moves, immutable audit, stale refusal, and audit-failure rollback.',
    expectedSheets: [
      'INPUT - Settings', DONATION_SHEET_NAME_, ACTIVITY_LOG_SHEET_NAME, 'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      var sheet = getDonationsSheet_(ctx.ss);
      sheet.getRange(5, 1, 2, DONATION_REQUIRED_HEADERS_.length).setValues([
        ['Year', 2025, '', '', '', ''],
        DONATION_REQUIRED_HEADERS_.slice()
      ]);
      ctx.donationFullEdit = { sheet: sheet };
    },
    actions: function(ctx) {
      var state = ctx.donationFullEdit;
      ctx.assertWritable();
      addDonation({
        charityName: 'Harness Original Charity', donationDate: '2026-06-12',
        amount: 90, taxYear: 2026, comments: 'Original full-edit comment',
        paymentType: 'Cash'
      }, ctx.ss);
      var original = getDonationsFormData(ctx.ss).recentDonations[0];
      state.original = original;

      ctx.assertWritable();
      updateDonationFromDashboard({
        sheetRow: original.sheetRow, taxYear: original.taxYear,
        charityName: original.charity, entryDate: original.entryDate,
        amount: original.amount, paymentType: original.paymentType,
        expectedComments: original.comments,
        newCharityName: 'Harness Updated Charity', newDonationDate: '2026-07-14',
        newAmount: 125.5, newTaxYear: 2026,
        newPaymentType: 'Check #4400', newComments: 'Every field updated'
      }, ctx.ss);
      state.afterInPlace = getDonationsFormData(ctx.ss).recentDonations[0];

      ctx.assertWritable();
      updateDonationFromDashboard({
        sheetRow: state.afterInPlace.sheetRow, taxYear: state.afterInPlace.taxYear,
        charityName: state.afterInPlace.charity, entryDate: state.afterInPlace.entryDate,
        amount: state.afterInPlace.amount, paymentType: state.afterInPlace.paymentType,
        expectedComments: state.afterInPlace.comments,
        newCharityName: 'Harness Moved Charity', newDonationDate: '2025-12-20',
        newAmount: 140.25, newTaxYear: 2025,
        newPaymentType: 'Card', newComments: 'Moved tax year safely'
      }, ctx.ss);
      state.afterMove = getDonationsFormData(ctx.ss).recentDonations[0];
      state.sourceRowAfterMove = state.sheet.getRange(original.sheetRow, 1, 1, 6).getDisplayValues()[0];

      var originalAppend = appendActivityLog_;
      appendActivityLog_ = function() { return false; };
      try {
        ctx.assertWritable();
        updateDonationFromDashboard({
          sheetRow: state.afterMove.sheetRow, taxYear: state.afterMove.taxYear,
          charityName: state.afterMove.charity, entryDate: state.afterMove.entryDate,
          amount: state.afterMove.amount, paymentType: state.afterMove.paymentType,
          expectedComments: state.afterMove.comments,
          newCharityName: 'Must Roll Back', newDonationDate: '2025-11-11',
          newAmount: 999, newTaxYear: 2025,
          newPaymentType: 'Failed audit', newComments: 'Must not survive'
        }, ctx.ss);
        state.rollbackError = '';
      } catch (rollbackErr) {
        state.rollbackError = String(rollbackErr && rollbackErr.message || rollbackErr);
      } finally {
        appendActivityLog_ = originalAppend;
      }
      state.afterRollback = getDonationsFormData(ctx.ss).recentDonations[0];

      try {
        ctx.assertWritable();
        updateDonationFromDashboard({
          sheetRow: original.sheetRow, taxYear: original.taxYear,
          charityName: original.charity, entryDate: original.entryDate,
          amount: original.amount, paymentType: original.paymentType,
          expectedComments: original.comments,
          newCharityName: 'Stale overwrite', newDonationDate: original.entryDate,
          newAmount: original.amount, newTaxYear: original.taxYear,
          newPaymentType: original.paymentType, newComments: original.comments
        }, ctx.ss);
        state.staleError = '';
      } catch (staleErr) {
        state.staleError = String(staleErr && staleErr.message || staleErr);
      }

      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      state.auditCount = activity.getDataRange().getDisplayValues().filter(function(row) {
        return String(row[1] || '') === 'donation_update';
      }).length;
    },
    expectedOutcome: function(ctx) {
      var state = ctx.donationFullEdit;
      var mod = 'Donation Full Edit';
      ctx.assert.equals('In-place edit changes charity', state.afterInPlace.charity, 'Harness Updated Charity', { module: mod });
      ctx.assert.equals('In-place edit changes amount', state.afterInPlace.amount, 125.5, { module: mod });
      ctx.assert.equals('Tax-year edit moves donation', state.afterMove.taxYear, 2025, { module: mod });
      ctx.assert.equals('Moved donation retains charity', state.afterMove.charity, 'Harness Moved Charity', { module: mod });
      ctx.assert.equals('Moved donation retains amount', state.afterMove.amount, 140.25, { module: mod });
      ctx.assert.equals('Source row clears without shifting structure', state.sourceRowAfterMove.join(''), '', { module: mod });
      ctx.assert.equals('Successful edits create immutable audits', state.auditCount, 2, { module: mod });
      ctx.assert.equals('Audit failure reports restoration', /prior values were restored/.test(state.rollbackError), true, { module: mod });
      ctx.assert.equals('Audit failure restores charity', state.afterRollback.charity, 'Harness Moved Charity', { module: mod });
      ctx.assert.equals('Audit failure restores amount', state.afterRollback.amount, 140.25, { module: mod });
      ctx.assert.equals('Stale original row is refused', /changed or moved/.test(state.staleError), true, { module: mod });
    }
  };
}
