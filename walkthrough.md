# Overdue Monitoring & Alerts - Walkthrough

I have completed implementing the overdue equipment monitoring and alerts features on both frontend and backend. The application builds successfully.

## Changes Made

### Frontend Stores
1. **[borrowStore.ts](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/store/borrowStore.ts)**:
   - Added `runOverdueCheck` method definitions and API action implementation to call POST `/borrow/overdue-check`.
   - Connected `runOverdueCheck` to automatically refresh global alerts counts and unread messages in the notifications store.

2. **[dashboardStore.ts](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/store/dashboardStore.ts)**:
   - Created `OverdueEquipmentItem` interface.
   - Updated `DashboardAlerts` to hold `overdueEquipment` list.
   - Initialized the store alerts state with empty `overdueEquipment`.

### Frontend Components & Pages
1. **[DashboardPage.tsx](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/pages/DashboardPage.tsx)**:
   - Mapped `alerts.overdueEquipment` list to dashboard overdue alerts.
   - Rendered a new **Overdue Equipment Alerts** card list dynamically on the main dashboard for managers and admins.

2. **[BorrowRequestPage.tsx](file:///c:/Users/My%20Pc/Music/jit-inventory-system/apps/frontend/src/pages/BorrowRequestPage.tsx)**:
   - Added a **Run Overdue Check** button in the `AdminPanel` next to the status filters.
   - Allows managers to trigger the overdue scanning immediately, updating the database status of overdue items and refreshing dashboard metrics.
