function openPlannerDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('PlannerDashboard')
    .setTitle('CashCompass')
    .setWidth(420);

  SpreadsheetApp.getUi().showSidebar(html);
}