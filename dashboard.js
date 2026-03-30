function openPlannerDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('PlannerDashboard')
    .setTitle('Planner Dashboard')
    .setWidth(420);

  SpreadsheetApp.getUi().showSidebar(html);
}