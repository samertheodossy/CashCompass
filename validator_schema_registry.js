/**
 * Formal, read-only schema registry for Workbook Health.
 * Registry entries reference the live canonical model at call time; they never
 * duplicate production headers or mutate a workbook.
 */
var VALIDATOR_SCHEMA_VERSION_CURRENT_ = '2026.08';

function getValidatorSchemaRegistry_() {
  return {
    currentVersion: VALIDATOR_SCHEMA_VERSION_CURRENT_,
    versions: {
      '2026.08': {
        status: 'CURRENT',
        model: getValidatorCanonicalModel_(),
        supportedLegacyDifferences: []
      },
      '2026.07': {
        status: 'SUPPORTED_LEGACY',
        model: getValidatorCanonicalModel_(),
        supportedLegacyDifferences: [
          'INPUT - Debts missing final Linked Property column'
        ]
      },
      'legacy-pre-meta': {
        status: 'SUPPORTED_LEGACY',
        model: getValidatorCanonicalModel_(),
        supportedLegacyDifferences: [
          'missing SYS - Meta',
          'legacy header ordering',
          'legacy frozen-pane conventions',
          'INPUT - Debts missing final Linked Property column'
        ]
      }
    }
  };
}

function validatorResolveSchemaVersion_(schemaEvolutionReport) {
  var legacy = schemaEvolutionReport && schemaEvolutionReport.generation === 'LEGACY';
  var findings = schemaEvolutionReport && schemaEvolutionReport.schema &&
    schemaEvolutionReport.schema.findings ? schemaEvolutionReport.schema.findings : [];
  if (legacy) {
    for (var legacyIdx = 0; legacyIdx < findings.length; legacyIdx++) {
      if (String(findings[legacyIdx] && findings[legacyIdx].message || '').indexOf('SYS - Meta') !== -1) {
        return 'legacy-pre-meta';
      }
    }
  }
  for (var i = 0; i < findings.length; i++) {
    if (String(findings[i] && findings[i].message || '').indexOf('Linked Property') !== -1) {
      return '2026.07';
    }
  }
  return legacy ? 'legacy-pre-meta' : VALIDATOR_SCHEMA_VERSION_CURRENT_;
}
