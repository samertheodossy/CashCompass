/**
 * Formal, read-only schema registry for Workbook Health.
 * Registry entries reference the live canonical model at call time; they never
 * duplicate production headers or mutate a workbook.
 */
var VALIDATOR_SCHEMA_VERSION_CURRENT_ = '2026.07';

function getValidatorSchemaRegistry_() {
  return {
    currentVersion: VALIDATOR_SCHEMA_VERSION_CURRENT_,
    versions: {
      '2026.07': {
        status: 'CURRENT',
        model: getValidatorCanonicalModel_(),
        supportedLegacyDifferences: []
      },
      'legacy-pre-meta': {
        status: 'SUPPORTED_LEGACY',
        model: getValidatorCanonicalModel_(),
        supportedLegacyDifferences: [
          'missing SYS - Meta',
          'legacy header ordering',
          'legacy frozen-pane conventions'
        ]
      }
    }
  };
}

function validatorResolveSchemaVersion_(schemaEvolutionReport) {
  var legacy = schemaEvolutionReport && schemaEvolutionReport.generation === 'LEGACY';
  return legacy ? 'legacy-pre-meta' : VALIDATOR_SCHEMA_VERSION_CURRENT_;
}
