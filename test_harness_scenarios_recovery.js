/**
 * test_harness_scenarios_recovery.js — Central Recovery regression scenarios.
 *
 * Scenarios use the production pure decision seam and a disposable harness
 * workbook. They never clear mappings, inspect a real user's Drive, or invoke
 * Drive.Files.create through the Central provisioning path.
 */

/**
 * REG-009 — a cleared/stale mapping must not silently create a duplicate.
 *
 * @returns {Object} scenario descriptor
 */
function getHarnessRecoveryDuplicateGuardScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string')
    ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string')
    ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-RECOVERY-DUPLICATE-GUARD',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    description: 'Validate the Central recovery candidate matrix so only confirmed zero candidates may create a workbook.',
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal disposable workbook for harness validation');
    },
    actions: function(ctx) {
      ctx.actions.push('Evaluate production recovery decision seam with synthetic candidate sets');
    },
    expectedOutcome: function(ctx) {
      if (typeof decideRecoveryCandidateAction_ !== 'function') {
        throw new Error('Recovery decision seam (decideRecoveryCandidateAction_) is unavailable.');
      }

      var marker = [{ id: 'marker-candidate', matchedBy: 'marker' }];
      var nameOnly = [{ id: 'name-candidate', matchedBy: 'name' }];
      var multiple = marker.concat(nameOnly);
      var mod = 'Central Recovery';

      ctx.assert.equals('No mapping + confirmed zero may create',
        decideRecoveryCandidateAction_('no_mapping', [], false).action,
        'create', { module: mod });
      ctx.assert.equals('Stale mapping + zero stops unavailable',
        decideRecoveryCandidateAction_('stale', [], false).action,
        'unavailable', { module: mod });
      ctx.assert.equals('One HIGH marker candidate relinks with flag off',
        decideRecoveryCandidateAction_('no_mapping', marker, false).action,
        'relink', { module: mod });
      ctx.assert.equals('One MEDIUM name candidate confirms with flag off',
        decideRecoveryCandidateAction_('no_mapping', nameOnly, false).action,
        'confirm', { module: mod });
      ctx.assert.equals('One MEDIUM name candidate relinks with flag on',
        decideRecoveryCandidateAction_('no_mapping', nameOnly, true).action,
        'relink', { module: mod });
      ctx.assert.equals('Multiple candidates stop as ambiguous',
        decideRecoveryCandidateAction_('no_mapping', multiple, true).action,
        'ambiguous', { module: mod });
      ctx.assert.equals('Stale one HIGH candidate reconnects',
        decideRecoveryCandidateAction_('stale', marker, false).action,
        'relink', { module: mod });
    }
  };
}
