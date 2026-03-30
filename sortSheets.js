function sortSheetsByName() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  sheets.sort(function(a, b) {
    return a.getName().localeCompare(b.getName());
  });

  for (var i = 0; i < sheets.length; i++) {
    sheets[i].activate();
    SpreadsheetApp.getActiveSpreadsheet().moveActiveSheet(i + 1);
  }
}