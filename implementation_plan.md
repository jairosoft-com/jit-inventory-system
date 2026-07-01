# Overdue Equipment Monitoring & Alerts - Implementation Plan

This plan details the design and code changes required to fully implement overdue equipment monitoring, status updates, dashboard alerts, and notifications.

## Proposed Changes

### Frontend Stores

#### [MODIFY] [borrowStore.ts](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/store/borrowStore.ts)
- Add `runOverdueCheck` method to `BorrowState` interface.
- Implement `runOverdueCheck` in `useBorrowStore` to POST to `/borrow/overdue-check`.
- When a scan is successfully triggered, fetch updated admin records and invoke `fetchUnreadCount` and `fetchUnread` from `useAlertStore` to refresh notifications dropdown immediately.

#### [MODIFY] [dashboardStore.ts](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/store/dashboardStore.ts)
- Add `OverdueEquipmentItem` interface to define the shape of overdue items returned by the backend.
- Update `DashboardAlerts` interface to include `overdueEquipment: OverdueEquipmentItem[]`.
- Initialize `overdueEquipment: []` in the default `alerts` state.

---

### Frontend Components & Pages

#### [MODIFY] [DashboardPage.tsx](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/pages/DashboardPage.tsx)
- Extract `overdueEquipment` alerts from the `alerts` state in `useDashboardStore`.
- Map them to an array of overdue alerts (using `critical` priority styling).
- Render an "Overdue Equipment Alerts" section on the dashboard similar to "Low Stock Alerts", with a "Manage Borrows" button that navigates to `/dashboard/borrow`.
- If no overdue equipment exists, the section will not be displayed, and the overdue borrows KPI card will correctly show `0`.

#### [MODIFY] [BorrowRequestPage.tsx](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/pages/BorrowRequestPage.tsx)
- Destructure `runOverdueCheck` from `useBorrowStore` in `AdminPanel`.
- Render a "Run Overdue Check" action button next to the status filter dropdown.
- This button allows the manager/admin to manually trigger the overdue scan, flagging items, updating database status to `OVERDUE`, and showing them on the dashboard and notifications immediately.

---

## Verification Plan

### Manual Verification
- Log in as ADMIN or MANAGER.
- Go to the **Borrow Requests** page, click the new **Run Overdue Check** button.
- Verify that equipment that is past its due date has its status updated to **OVERDUE** in the requests list.
- Check that a critical notification alert pops up in the top navigation bell dropdown.
- Navigate to the **Dashboard** page and verify that the **Overdue Equipment Alerts** card list appears, listing the overdue item(s) with details (asset ID, borrower, expected return, and days overdue).
- Process a return for the overdue item, re-run the overdue check, and verify that the alert disappears from the dashboard, notifications are resolved/marked-read, and the overdue KPI count goes back to 0.
