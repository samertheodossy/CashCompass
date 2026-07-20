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

  // Recovery Validation 6F fixture route. Unlike the admin consoles, this
  // runs as the one explicitly configured disposable account so Drive-owned
  // candidate files are created in that account. The route and every server
  // action independently require TEST_HARNESS_ENABLED=true, CENTRAL_MODE=true,
  // and an exact RECOVERY_6F_TEST_EMAIL match. Everyone else falls through to
  // the normal dashboard without learning that the route exists.
  if (view === 'recovery-test' && isRecovery6fFixtureUser_()) {
    return HtmlService.createTemplateFromFile('RecoveryTestingUI')
      .evaluate()
      .setTitle('CashCompass — Recovery 6F Test Fixtures')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile('PlannerDashboardWeb')
    .evaluate()
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
