function doGet() {
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