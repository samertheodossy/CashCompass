function doGet(e) {
  // Allow-list gate: rejects any caller not in FAMILY_BETA_ALLOWLIST.
  // Runs unconditionally — does not check CENTRAL_MODE — so the
  // central deployment URL is never reachable by anonymous Google
  // accounts. The existing bound deployment remains safe only because
  // it is pinned to a prior script version that predates this gate;
  // if the bound deployment is ever redeployed to head, the developer
  // MUST be in FAMILY_BETA_ALLOWLIST for the bound URL to continue
  // serving the dashboard (the platform-level access:MYSELF check
  // admits the developer to doGet, but does not bypass the in-doGet
  // allow-list).
  //
  // See:
  //   - CENTRAL_APP_RESOLVER_PROVISIONING_IMPLEMENTATION_PROMPT.md
  //   - central_provisioning.js (isAllowlistedUser_,
  //     renderAllowlistRejection_)
  if (!isAllowlistedUser_()) {
    return renderAllowlistRejection_();
  }

  // Admin diagnostics route: /exec?view=admin. Read-only, admin-gated.
  // Non-admins silently fall through to the normal dashboard so the admin
  // route's existence is never disclosed (no distinct rejection, no error).
  var view = (e && e.parameter && e.parameter.view)
    ? String(e.parameter.view) : '';
  var requestedReleaseRunId = (e && e.parameter && e.parameter.releaseRunId)
    ? String(e.parameter.releaseRunId) : '';
  if (view === 'admin' && isAdminUser_()) {
    return HtmlService.createTemplateFromFile('AdminDiagnostics')
      .evaluate()
      .setTitle('CashCompass — Admin Diagnostics')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Validation & Testing console route: /exec?view=validation. Admin-gated,
  // read-only Validator surface. Like the admin route above, non-admins silently
  // fall through to the normal dashboard so the route's existence is never
  // disclosed. The page's server functions independently re-gate on every call
  // (assertValidatorAllowed_: VALIDATOR_ENABLED + isAdminUser_).
  if (view === 'validation' && isAdminUser_()) {
    return HtmlService.createTemplateFromFile('ValidationTestingUI')
      .evaluate()
      .setTitle('CashCompass — Validation & Testing')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Recovery Live runner. Unlike the admin console, this must execute as the
  // permanent disposable non-admin identity so candidate files are owned by
  // that caller and production owner-scoped discovery can see them. The route
  // and every server step independently require the exact identity, Central
  // mode, and allow-list membership. No client-selected email or workbook ID
  // exists. Everyone else falls through without learning the route exists.
  if (view === 'recovery-test' && isRecoveryLiveUser_()) {
    var recoveryTemplate = HtmlService.createTemplateFromFile('RecoveryTestingUI');
    recoveryTemplate.releaseRunIdJson = JSON.stringify(requestedReleaseRunId);
    return recoveryTemplate
      .evaluate()
      .setTitle('CashCompass — Recovery Live')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Performance sampling runs as the permanent disposable non-admin so every
  // timing pair owns its own Restricted fixture. The route and every RPC are
  // identity-gated; there is no caller-selected email or workbook target.
  if (view === 'performance-test' && isPerformanceSamplingUser_()) {
    var performanceTemplate = HtmlService.createTemplateFromFile('PerformanceSamplingUI');
    performanceTemplate.releaseRunIdJson = JSON.stringify(requestedReleaseRunId);
    return performanceTemplate
      .evaluate()
      .setTitle('CashCompass — Performance Planner Sampling')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Browser-backed First-Run UX E2E. Both routes are invisible to every
  // account except the permanent disposable non-admin identity. The control
  // page creates the fixture; the run route renders the shipping dashboard
  // with a narrowly-scoped assertion overlay only after the exact run token,
  // mapping, owner, and durable workbook markers have all been verified.
  if (view === 'first-run-e2e' && isFirstRunE2EUser_()) {
    var firstRunControlTemplate = HtmlService.createTemplateFromFile('FirstRunE2ETestingUI');
    firstRunControlTemplate.releaseRunIdJson = JSON.stringify(requestedReleaseRunId);
    return firstRunControlTemplate
      .evaluate()
      .setTitle('CashCompass — First-Run UX E2E')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (view === 'first-run-e2e-run') {
    var runId = (e && e.parameter && e.parameter.runId) ? String(e.parameter.runId) : '';
    var context = frE2ERenderContext_(runId);
    if (context) {
      var e2eTemplate = HtmlService.createTemplateFromFile('PlannerDashboardWeb');
      e2eTemplate.firstRunE2EEnabled = true;
      e2eTemplate.firstRunE2EConfigJson = JSON.stringify({ enabled: true, runId: context.runId });
      e2eTemplate.populatedDashboardE2EEnabled = false;
      e2eTemplate.populatedDashboardE2EConfigJson = '{}';
      return e2eTemplate.evaluate()
        .setTitle('CashCompass — First-Run UX E2E Running')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  // Browser-backed representative existing-user validation. The control route
  // is locked to the same permanent disposable non-admin identity. Preparation
  // creates and seeds only a newly provisioned Central workbook; the run route
  // requires the exact active token and verified mapped-workbook identity.
  if (view === 'populated-dashboard-e2e' && isFirstRunE2EUser_()) {
    var populatedControlTemplate = HtmlService.createTemplateFromFile('PopulatedDashboardE2ETestingUI');
    populatedControlTemplate.releaseRunIdJson = JSON.stringify(requestedReleaseRunId);
    return populatedControlTemplate
      .evaluate()
      .setTitle('CashCompass — Populated Dashboard E2E')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (view === 'populated-dashboard-e2e-run') {
    var populatedRunId = (e && e.parameter && e.parameter.runId) ? String(e.parameter.runId) : '';
    var populatedContext = pdE2ERenderContext_(populatedRunId);
    if (populatedContext) {
      var populatedTemplate = HtmlService.createTemplateFromFile('PlannerDashboardWeb');
      populatedTemplate.firstRunE2EEnabled = false;
      populatedTemplate.firstRunE2EConfigJson = '{}';
      populatedTemplate.populatedDashboardE2EEnabled = true;
      populatedTemplate.populatedDashboardE2EConfigJson = JSON.stringify({
        enabled: true,
        runId: populatedContext.runId,
        expected: populatedContext.expected
      });
      return populatedTemplate.evaluate()
        .setTitle('CashCompass — Populated Dashboard E2E Running')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  var dashboardTemplate = HtmlService.createTemplateFromFile('PlannerDashboardWeb');
  dashboardTemplate.firstRunE2EEnabled = false;
  dashboardTemplate.firstRunE2EConfigJson = '{}';
  dashboardTemplate.populatedDashboardE2EEnabled = false;
  dashboardTemplate.populatedDashboardE2EConfigJson = '{}';
  return dashboardTemplate.evaluate()
    .setTitle('CashCompass')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setPlannerDashboardWebAppUrl() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Set CashCompass Web App URL',
    'Paste the deployed Web App URL that ends with /exec',
    ui.ButtonSet.OK_CANCEL
  );

  if (resp.getSelectedButton() !== ui.Button.OK) return;

  const url = String(resp.getResponseText() || '').trim();

  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(\?.*)?$/.test(url)) {
    throw new Error('Please paste a valid deployed Apps Script Web App URL ending in /exec.');
  }

  PropertiesService.getScriptProperties().setProperty('PLANNER_DASHBOARD_WEBAPP_URL', url);
  ui.alert('CashCompass Web App URL saved successfully.');
}

function clearPlannerDashboardWebAppUrl() {
  PropertiesService.getScriptProperties().deleteProperty('PLANNER_DASHBOARD_WEBAPP_URL');
  SpreadsheetApp.getUi().alert('CashCompass Web App URL cleared.');
}

function getPlannerDashboardWebAppUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('PLANNER_DASHBOARD_WEBAPP_URL');

  if (!url) {
    throw new Error(
      'CashCompass Web App URL is not set.\n\n' +
      'Run: Set CashCompass Web App URL\n' +
      'Then paste your deployed /exec URL once.'
    );
  }

  return url;
}

function openPlannerDashboardWebLauncher() {
  const url = getPlannerDashboardWebAppUrl_();

  const safeUrl = url.replace(/"/g, '&quot;');

  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_top"></head><body>' +
    '<script>' +
    'window.open("' + safeUrl + '", "_blank");' +
    'google.script.host.close();' +
    '</script>' +
    '<div style="font-family:Arial,sans-serif;padding:16px;">Opening CashCompass...</div>' +
    '</body></html>'
  ).setWidth(220).setHeight(80);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Opening CashCompass...');
}
