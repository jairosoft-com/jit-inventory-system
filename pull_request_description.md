## Ticket / Task
- **Ticket / Task Name:** Implement Inventory Image Upload Handling & Allow Equipment Asset ID Modification (Bug Fixes for Feature #204715 / #206045)

## Summary
This PR restricts inventory and equipment image uploads to only allow JPG, JPEG, and PNG formats (removing support for GIF and WEBP). It translates backend-thrown error codes (such as HTTP `413 Payload Too Large` and file type failures) into clear, user-friendly error messages on the frontend. 

Additionally, it fixes an issue where the `Asset ID` was not saved when editing equipment. It does this by adding `assetId` to the backend Zod validation schema so it isn't stripped from the PATCH request body. To make database unique constraint violations easier to understand for users, it maps raw database unique constraint failure traces (Prisma code `P2002` on `asset_id` or `serial_number`) to clear, human-readable error messages like `"Asset ID is already in use"`.

Furthermore, it restricts editing the `Asset ID` to administrator accounts only. If a non-admin attempts to modify an equipment's Asset ID, the request is blocked on the backend with a `403 Forbidden` response. In the frontend, the input field is set to `readOnly` and styled with grayed-out disabled indicators when a non-admin user is editing.

## Changes Made

### Frontend (Image Constraints & Error Formatting)
- **Restricted Mime Types / Extensions:** Modified `ALLOWED_MIME_TYPES` and `ALLOWED_EXTENSIONS` in [InventoryManagementPage.tsx](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/pages/InventoryManagementPage.tsx) and [EquipmentPage.tsx](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/pages/EquipmentPage.tsx) to only accept `image/jpeg` (for `.jpg`, `.jpeg`) and `image/png`.
- **Improved UI and Input Attributes:** Updated the file input `accept` attribute to `image/jpeg,image/png` to guide browser file selectors. Updated form formats helper strings and local validation error messages to mention only JPG, JPEG, and PNG.
- **Custom Store Error Mapping:** Refactored the `addImage` and `createEquipment` actions in [itemsStore.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/store/itemsStore.ts), [itemStore.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/store/itemStore.ts), and [equipmentStore.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/store/equipmentStore.ts) to intercept Axios errors. HTTP status `413` (or messages indicating files are too large) is mapped to `"file size exceeds 5mb"`. HTTP status `415` (or messages indicating wrong mimetype/extensions) is mapped to `"wrong file type"`.
- **Equipment Asset ID UI Restriction:** Updated [EquipmentPage.tsx](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/pages/EquipmentPage.tsx) to set the Asset ID input field to `readOnly` and styled as disabled if the logged-in user is not an administrator when editing.
- **Type Safety Resolution:** Declared missing `ItemTypeFilter` and `StatusFilter` type definitions at the top of [InventoryManagementPage.tsx](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/frontend/src/pages/InventoryManagementPage.tsx) to fix compile errors introduced from develop.

### Backend (Equipment Asset ID & Unique constraint mapping)
- **Validation Schema Update:** Added `assetId: z.string().trim().min(1).max(100)` as an optional field in the `updateEquipmentSchema` inside [equipment.schema.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/backend/src/schemas/equipment.schema.ts). This prevents Zod validation from stripping `assetId` out of the PATCH request body.
- **Database Unique Constraint Mapping:** Wrapped the Prisma queries in `EquipmentService.create` and `EquipmentService.update` (inside [equipment.service.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/backend/src/services/equipment.service.ts)) with try-catch blocks. Captured Prisma `P2002` code errors on `asset_id` and `serial_number`, throwing clean errors like `"Asset ID is already in use"` and `"Serial number is already in use"` respectively.
- **Authorization Enforcement:** Added an admin role check inside the PATCH `/equipment/:id` handler in [equipment.routes.ts](file:///c:/Users/kenge/Documents/GitHub/jit-inventory-system/apps/backend/src/routes/equipment.routes.ts) to block any non-admin attempts to change the equipment's Asset ID.

## How to Test
1. **Test Image Upload Restrictions (Frontend):**
   - Go to the **Inventory Management** or **Equipment Management** page.
   - Click to add/edit an item and try uploading an image.
   - Verify that the native file chooser defaults to showing/filtering only JPG, JPEG, and PNG files.
   - Attempt to upload an invalid file format (like GIF/WEBP) or a file larger than 5MB, and verify that the UI shows a clear error message: `"wrong file type"` or `"file size exceeds 5mb"` respectively.
2. **Test Editing Equipment Asset ID (Admin User):**
   - Log in as an administrator.
   - Go to the **Equipment Management** page.
   - Click **Edit** on an existing equipment asset.
   - Verify that the **Asset ID** input is editable.
   - Modify the **Asset ID** field to a new, unique value.
   - Click **Save Changes** and verify that the form successfully saves and displays the updated Asset ID in the equipment list.
3. **Test Editing Equipment Asset ID (Non-Admin User):**
   - Log in as a non-admin user (e.g., manager or staff) who has update permissions.
   - Go to the **Equipment Management** page.
   - Click **Edit** on an existing equipment asset.
   - Verify that the **Asset ID** input is read-only, grayed-out, and displays a disabled blocked cursor.
4. **Test Unique Constraint Failure Message:**
   - Log in as an administrator.
   - Click **Edit** on an existing equipment asset.
   - Change the **Asset ID** to an asset ID already used by another equipment record.
   - Click **Save Changes** and confirm that it shows a clear and clean message: **`"Asset ID is already in use"`** instead of the raw Prisma database trace.
5. **Verify Code Integrity:**
   - Run `npm run type-check` (or `npx tsc --noEmit` under `/apps/frontend`) and `npm run lint` to confirm that all type checks and linters pass without errors.

## Screenshots / Recording
*N/A (Visual components updated: formats helper text, error banners, and browser file picker default constraints)*

## Checklist
- [x] I created this from the latest develop branch
- [x] I tested this locally
- [x] I did not commit .env or secret keys
- [x] I did not include unrelated changes
- [x] I added error handling where needed
- [x] I updated documentation if needed

## Notes
- Database constraints are fully handled, returning clean HTTP `409 Conflict` errors with user-friendly descriptions.
