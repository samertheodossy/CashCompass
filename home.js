function buildHomePage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const homeName = 'HOME';

  let sheet = ss.getSheetByName(homeName);
  if (!sheet) {
    sheet = ss.insertSheet(homeName, 0);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
  }

  const allSheets = ss.getSheets();
  const grouped = {
    'OUT': [],
    'INPUT': [],
    'SYS': [],
    'HOUSES': [],
    'CARS': [],
    'LOANS': [],
    'OTHER': []
  };

  allSheets.forEach(function(s) {
    const name = s.getName();
    if (name === homeName) return;

    const upper = name.toUpperCase();

    if (upper.indexOf('OUT - ') === 0) grouped.OUT.push(name);
    else if (upper.indexOf('INPUT - ') === 0) grouped.INPUT.push(name);
    else if (upper.indexOf('SYS - ') === 0) grouped.SYS.push(name);
    else if (upper.indexOf('HOUSES - ') === 0 || upper === 'HOUSES') grouped.HOUSES.push(name);
    else if (upper.indexOf('CARS - ') === 0 || upper === 'CARS') grouped.CARS.push(name);
    else if (upper.indexOf('LOANS - ') === 0 || upper === 'LOANS') grouped.LOANS.push(name);
    else grouped.OTHER.push(name);
  });

  Object.keys(grouped).forEach(function(key) {
    grouped[key].sort();
  });

  sheet.setColumnWidth(1, 26);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 260);
  sheet.setColumnWidth(5, 220);

  sheet.getRange('A1:E1').merge();
  sheet.getRange('A1')
    .setValue('Debt Planner Home')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  sheet.getRange('A2:E2').merge();
  sheet.getRange('A2')
    .setValue('Grouped automatically by sheet name prefix')
    .setHorizontalAlignment('center')
    .setBackground('#eef6ff')
    .setFontColor('#475569');

  let row = 4;

  [
    'OUT',
    'INPUT',
    'SYS',
    'HOUSES',
    'CARS',
    'LOANS',
    'OTHER'
  ].forEach(function(groupName) {
    row = writeHomeSection_(sheet, ss, row, groupName, grouped[groupName]);
  });

  row += 1;

  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue('ACTIONS')
    .setFontWeight('bold')
    .setBackground('#d9eaf7');
  row++;

  const actions = [
    ['Run Planner', 'Menu', 'Debt Planner -> Run Planner'],
    ['Open House Values UI', 'Menu', 'Debt Planner -> Open House Values UI'],
    ['Open Bank Accounts UI', 'Menu', 'Debt Planner -> Open Bank Accounts UI'],
    ['Open Investments UI', 'Menu', 'Debt Planner -> Open Investments UI'],
    ['Open Debts UI', 'Menu', 'Debt Planner -> Open Debts UI'],
    ['Refresh HOME', 'Menu', 'Debt Planner -> Rebuild HOME']
  ];

  actions.forEach(function(action) {
    sheet.getRange(row, 2).setValue(action[0]);
    sheet.getRange(row, 3).setValue(action[1]);
    sheet.getRange(row, 4).setValue(action[2]);
    row++;
  });

  row += 2;

  const dashboardName = getSheetNames_().DASHBOARD;
  const dashboardSheet = ss.getSheetByName(dashboardName);

  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue('KEY SUMMARY')
    .setFontWeight('bold')
    .setBackground('#d9eaf7');
  row++;

  if (dashboardSheet) {
    const summaryMap = getDashboardMetricMap_(dashboardSheet);
    const metrics = [
      'Run Date',
      'Month',
      'Monthly Stability',
      'Projected Cash Flow This Month',
      'Usable Cash After Buffers',
      'Total Minimum Payments',
      'Total Assets',
      'Total Liabilities',
      'Net Worth',
      'Recommended Total To Pay Now'
    ];

    metrics.forEach(function(metric) {
      sheet.getRange(row, 2).setValue(metric);
      sheet.getRange(row, 3).setValue(summaryMap[metric] || '');
      row++;
    });
  } else {
    sheet.getRange(row, 2).setValue('Dashboard not found');
    row++;
  }

  row += 1;

  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue('TIPS')
    .setFontWeight('bold')
    .setBackground('#d9eaf7');
  row++;

  [
    'Tabs are grouped automatically by prefix.',
    'Rename sheets with prefixes like INPUT - , OUT - , SYS - , HOUSES - , CARS - , LOANS - .',
    'Any sheet without one of those prefixes appears under OTHER.',
    'Use the sidebar UIs for safer updates to Houses, Bank Accounts, Investments, and Debts.'
  ].forEach(function(tip) {
    sheet.getRange(row, 2, 1, 3).merge();
    sheet.getRange(row, 2).setValue(tip);
    row++;
  });

  sheet.getRange(1, 1, row, 5)
    .setFontFamily('Arial')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.getRange('B:B').setFontWeight('bold');
  sheet.setFrozenRows(2);
}

function writeHomeSection_(sheet, ss, startRow, sectionName, sheetNames) {
  let row = startRow;

  sheet.getRange(row, 1, 1, 5).merge();
  sheet.getRange(row, 1)
    .setValue(sectionName)
    .setFontWeight('bold')
    .setBackground('#d9eaf7');
  row++;

  if (!sheetNames || sheetNames.length === 0) {
    sheet.getRange(row, 2).setValue('No sheets found');
    row += 2;
    return row;
  }

  sheet.getRange(row, 2).setValue('Sheet');
  sheet.getRange(row, 3).setValue('Link');
  sheet.getRange(row, 2, 1, 2)
    .setFontWeight('bold')
    .setBackground('#edf3f8');
  row++;

  sheetNames.forEach(function(tabName) {
    const target = ss.getSheetByName(tabName);

    sheet.getRange(row, 2).setValue(tabName);

    if (target) {
      const gid = target.getSheetId();
      sheet.getRange(row, 3).setFormula('=HYPERLINK("#gid=' + gid + '","Open")');
    } else {
      sheet.getRange(row, 3).setValue('Missing');
    }

    row++;
  });

  row++;
  return row;
}

function getDashboardMetricMap_(sheet) {
  const values = sheet.getDataRange().getValues();
  const map = {};

  for (let r = 0; r < values.length; r++) {
    const key = String(values[r][0] || '').trim();
    const val = values[r][1];

    if (key && val !== '' && val !== null && val !== undefined) {
      map[key] = val;
    }
  }

  return map;
}