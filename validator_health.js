/** Aggregate, read-only Workbook Health report (Workbook Health Module 6). */
function validateWorkbookHealth_(ss, options) {
  options = options || {};
  var schemaEvolution = validateSchemaEvolution_(ss, options);
  var reports = {
    provisioning: schemaEvolution.provisioning,
    schema: schemaEvolution.schema,
    schemaEvolution: schemaEvolution,
    drift: validateDrift_(ss, options),
    formulas: validateFormulas_(ss, options),
    conditionalFormatting: validateConditionalFormatting_(ss, options),
    namedRanges: validateNamedRanges_(ss)
  };
  var advisoryDrift = reports.drift.overall === 'DRIFT' || reports.formulas.overall === 'DRIFT' ||
    reports.conditionalFormatting.overall === 'DRIFT' || reports.namedRanges.overall === 'DRIFT';
  var fail = reports.provisioning.overall !== 'PASS' || schemaEvolution.compatibility === SCHEMA_COMPAT_UPGRADE_REQUIRED_;
  return {
    type: 'workbookHealth', workbook: safeName_(ss), workbookId: safeId_(ss),
    capturedAt: new Date().toISOString(), schemaVersion: validatorResolveSchemaVersion_(schemaEvolution),
    workbookType: schemaEvolution.workbookType, compatibility: schemaEvolution.compatibility,
    overall: fail ? 'FAIL' : (advisoryDrift ? 'WARN' : 'PASS'),
    gate: { provisioning: reports.provisioning.overall, compatibility: schemaEvolution.compatibility },
    advisory: { drift: reports.drift.overall, formulas: reports.formulas.overall,
      conditionalFormatting: reports.conditionalFormatting.overall, namedRanges: reports.namedRanges.overall },
    reports: reports
  };
}

function validatorRunWorkbookHealth(spreadsheetIdOverride, options) {
  assertValidatorAllowed_();
  var id = String(spreadsheetIdOverride || '').trim() || getValidatorDefaultCentralWorkbookId_();
  var report = validateWorkbookHealth_(SpreadsheetApp.openById(id), options || {});
  if (!options || options.outputMode !== 'none') Logger.log(JSON.stringify(report));
  return report;
}
