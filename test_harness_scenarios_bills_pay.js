/** Bills Due → Pay server E2E on one explicit disposable workbook. */
function getHarnessBillsPayE2EScenario_() {
  return {
    id: 'E2E-BILLS-DUE-PAY',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Seed a bill, record its payment through the real Quick Add workflow, mark the occurrence handled twice, and verify Cash Flow plus deduped Activity evidence.',
    requiresTrashCleanup: true,
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      harnessSeedRepresentativeWorkbook_(ctx);
      ctx.actions.push('Provision representative bill and Cash Flow fixture');
    },
    actions: function(ctx) {
      var p = ctx.representativeProfile;
      var today = new Date();
      var iso = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      ctx.assertWritable();
      var result = quickAddPayment({
        entryType: 'Expense', payee: p.bill.payee, entryDate: iso,
        amount: p.bill.amount, createIfMissing: true, flowSource: 'CASH',
        activityOrigin: 'bill_payment'
      }, ctx.ss);
      var marker = { payee: p.bill.payee, dueDate: iso, amount: p.bill.amount, monthHeader: result.preview.month };
      ctx.assertWritable();
      markDashboardBillOccurrencePaid(marker, ctx.ss);
      ctx.assertWritable();
      markDashboardBillOccurrencePaid(marker, ctx.ss);
      ctx.billsPayEvidence = { result: result, marker: marker };
      ctx.actions.push('Record payment and re-submit the same handled marker to verify dedupe');
    },
    expectedOutcome: function(ctx) {
      var ev = ctx.billsPayEvidence;
      var result = ev && ev.result;
      if (!result) throw new Error('Bills Pay result unavailable.');
      ctx.assert.equals('Cash Flow payment amount', result.preview.currentValue,
        -ctx.representativeProfile.bill.amount, { module: 'Bills Pay', location: result.preview.sheetName + ' / ' + result.preview.month });
      var activity = ctx.ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
      var rows = activity ? activity.getDataRange().getDisplayValues() : [];
      var header = rows.length ? rows[0] : [];
      var eventCol = header.indexOf('Event Type');
      var dedupeCol = header.indexOf('Dedupe Key');
      var paidKey = 'bill_paid::' + buildDashboardBillPaidKey_(ev.marker.payee, ev.marker.dueDate);
      var paidCount = 0, quickPayCount = 0;
      var quickPayEnvelope = null;
      var detailsCol = header.indexOf('Details');
      for (var r = 1; r < rows.length; r++) {
        if (eventCol !== -1 && rows[r][eventCol] === 'quick_pay') {
          quickPayCount++;
          quickPayEnvelope = detailsCol === -1
            ? null
            : parseActivityOperationEnvelope_(rows[r][detailsCol]);
        }
        if (eventCol !== -1 && rows[r][eventCol] === 'bill_paid' &&
            dedupeCol !== -1 && rows[r][dedupeCol] === paidKey) paidCount++;
      }
      ctx.assert.equals('Quick Pay Activity row', quickPayCount, 1, { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME });
      ctx.assert.equals('Handled marker deduplicated', paidCount, 1, { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME });
      ctx.assert.equals('Linked Bill Quick Pay envelope is audit-only',
        quickPayEnvelope && quickPayEnvelope.status, 'AUDIT_ONLY',
        { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME + ' / Details' });
      ctx.assert.equals('Quick Pay operation ID persisted',
        quickPayEnvelope && quickPayEnvelope.envelope.operationId,
        result.activitySnapshot.operationId,
        { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME + ' / Details' });
      ctx.assert.equals('Quick Pay target descriptor count',
        quickPayEnvelope && quickPayEnvelope.envelope.targets.length, 1,
        { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME + ' / Details' });
      var operationPreview = previewActivityOperationInSpreadsheet_(
        ctx.ss,
        result.activitySnapshot.operationId
      );
      ctx.assert.equals('Linked Bill Quick Pay operation preview is audit-only',
        operationPreview.status, 'AUDIT_ONLY',
        { module: 'Bills Pay', location: ACTIVITY_LOG_SHEET_NAME + ' / operation preview' });
    }
  };
}
