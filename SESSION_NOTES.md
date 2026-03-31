- sped up the quick payment / bill pay screen updates
- fixed credit card logic to show even if value is 0
- subtracted the payument for other than loans from the Debt page
In this change: hasHistory was removed in getRecurringBillsWithoutDueDateForDashboard() in dashboard_data.js, with a short comment so you can restore the old gate if you ever need to.
3/31 Session
- sped up the debt code 
- updated the overview page (too slow still)