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