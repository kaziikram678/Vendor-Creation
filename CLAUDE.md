# CLAUDE.md

## Project Overview

Zoho CRM widgets for managing vendor-related documents directly from Vendor records in Zoho CRM. Two separate widgets handle Bills and Purchase Orders independently, with full CRUD operations against Zoho Books via its REST API.

## Repository Structure

```
Vendor_Creation/
  bill-creation-widget/        # React app - Bill management widget (embedded in CRM)
    src/
      App.js                   # Entry point, Zoho SDK init, MUI theme
      components/
        Dashboard.js           # Bill list view with actions (record payment, edit, delete)
        BillForm.js            # Create/edit bill form (Save as Draft / Save and Submit / Save and Approve)
        RecordPaymentForm.js   # Record payment against an open bill
        AttachmentsSection.js  # File attachment UI (upload, list, delete) used on Step 2 of BillForm
        LineItemTable.js       # Shared line items table with description field
        TotalsSection.js       # Shared totals/discount/adjustment section
      services/
        zohoService.js         # All Zoho CRM + Books API calls (bills, items, taxes, accounts, payments, attachments)
  po-creation-widget/          # React app - Purchase Order management widget (embedded in CRM)
    src/
      App.js                   # Entry point, Zoho SDK init, MUI theme
      components/
        Dashboard.js           # PO list view with actions (mark as issued, convert to bill, view bills, edit, delete)
        PurchaseOrderForm.js   # Create/edit purchase order form
        ConvertToBillForm.js   # Convert an issued PO to a bill (pre-filled bill form)
        AttachmentsSection.js  # File attachment UI (upload, list, delete) used on Step 2 of PurchaseOrderForm
        LineItemTable.js       # Shared line items table with description field
        TotalsSection.js       # Shared totals/discount/adjustment section
      services/
        zohoService.js         # All Zoho CRM + Books API calls (POs, items, taxes, accounts, bills, attachments)
  createVendorInBooks.dg       # Deluge: syncs CRM Vendor -> Books contact (create/update)
  updateVendorInCRM.dg         # Deluge: syncs Books contact -> CRM Vendor (reverse sync on update)
  createBillInBooks.dg         # Deluge: server-side bill creation in Books
```

## Tech Stack

- **Frontend**: React 19, MUI 7 (Material UI), dayjs
- **Build**: Create React App (react-scripts 5)
- **Backend/Integration**: Zoho CRM JS SDK, Zoho Books REST API v3, Deluge scripts
- **Deployment**: Packaged as Zoho CRM widgets (Related List on Vendors module)

## Key Configuration

- **Zoho Books Org ID**: `771340721`
- **Connection name**: `zoho_books_testing` (used in both JS SDK and Deluge scripts)
- **Books API base**: `https://www.zohoapis.com/books/v3`
- **CRM custom field**: `Books_Vendor_ID` on Vendors module links CRM vendor to Books contact
- **bill-creation-widget port**: 3000
- **po-creation-widget port**: 3001 (configured in `.env`)

## Common Commands

```bash
# From bill-creation-widget/ or po-creation-widget/:
npm start          # Dev server (localhost:3000 or 3001)
npm run build      # Production build for widget packaging
npm test           # Run tests
```

## Architecture Notes

- The widget initializes via `ZOHO.embeddedApp.init()` in `index.js`, which fires a `PageLoad` event providing the current `EntityId` (CRM Vendor record ID).
- All Books API calls go through `ZOHO.CRM.CONNECTION.invoke()` using the `zoho_books_testing` connection, which handles OAuth automatically.
- `zohoService.js` in each widget contains its own API helpers - bill widget has bill/payment APIs, PO widget has PO/bill-conversion APIs.
- Both widgets share the same `App → Dashboard → Form` architecture pattern.
- Clicking bill/PO numbers in the dashboard opens the record in Zoho Books in a new tab.

## Bill Widget Workflow

- **Create**: Save as Draft / Save and Submit (→ pending_approval) / Save and Approve (→ open)
- **Record Payment**: Open/partially_paid/overdue bills can have payments recorded via `/vendorpayments` API
- **Edit/Delete**: Available on all bills
- **Form steps**: Basic Info → Items → Totals & Notes → Attachments (4-step stepper; attachments live on their own step so the Totals panel never gets pushed off-screen)
- **Attachments**: Files attached in widget are uploaded to Books after save; existing Books attachments load on edit; deletions are immediate via DELETE API
- **Dashboard**: Bill list uses MUI `TablePagination` (default 5 rows/page; options 5/10/25/50) with debounced search (300ms) filtering across Bill#, Reference, Status, Date, Due Date, Total, Balance
- Items filtered to exclude sales-only items (`item_type !== "sales"`)
- Due date picker prevents selecting dates before bill date
- Line items include a description field below the item selector

## PO Widget Workflow

- **Create**: Save as Draft / Save as Open
- **Mark as Issued**: Draft POs can be marked as issued via `/purchaseorders/{id}/status/issued`
- **Convert to Bill**: Issued POs can be converted to a bill (creates bill with `purchaseorder_ids` linking)
- **View Bills**: Closed/billed POs show a popover with linked bills (clickable to open in Zoho Books)
- **Edit/Delete**: Available on all POs
- **Form steps**: Basic Info → Items → Totals & Notes → Attachments (same 4-step layout as bill widget)
- **Attachments**: Same bidirectional sync as bill widget, works in edit and readOnly (view-only) modes
- **Dashboard**: PO list uses MUI `TablePagination` (default 5 rows/page; options 5/10/25/50) with debounced search (300ms) filtering across PO#, Reference, Status, Date, Delivery Date, Total
- Items filtered to exclude sales-only items
- Accounts fetched from multiple types: Expense, CostOfGoodsSold, FixedAsset, OtherCurrentAsset
- Line items include a description field below the item selector

## Custom Fields Feature (Bill Widget)

- **Location**: Custom fields from Zoho Books appear on **Step 1 (Basic Info)** of the bill form, below the standard date/payment-terms fields.
- **Fetch strategy**: `fetchCustomFields("bill")` in `zohoService.js` tries two endpoints in order:
  1. `/settings/customfields?entity=bill`
  2. `/settings/customfields?entity_type=bill`
  If both return empty (e.g. scope not granted), falls back to fetching the most recent bill (`/bills?per_page=1`) and deriving field schema from its `custom_fields` array.
- **Edit mode fallback**: When editing a bill, `BillForm` merges schema from `customFieldsMeta` prop (settings fetch) with definitions embedded in the bill record itself (`bill.custom_fields`). This ensures fields render even if the settings endpoint is inaccessible.
- **Supported data types**: `string`, `date`, `number`/`decimal`/`amount`/`percent`, `email`, `url`, `multi_line`, `dropdown`, `checkbox` — rendered as appropriate MUI `TextField` variants.
- **Payload**: Custom field values are serialised as `[{api_name, value}]` under `custom_fields` in the bill create/update payload.
- **Component**: `CustomFieldsSection.js` — shared render + helper exports `customFieldsToPayload` and `customFieldsFromRecord`.

## Dashboard Search Feature (Both Widgets)

- **Location**: Search bar in the list panel header, left of the Refresh button.
- **Debounce**: 300ms via `setTimeout`/`clearTimeout` in a `useEffect` — filters only fire after the user pauses typing.
- **Scope**: Client-side filter over the already-fetched list (no extra API call).
  - Bill widget: Bill#, Reference, Status, Date, Due Date, Total, Balance.
  - PO widget: PO#, Reference, Status (including locally-billed override), Date, Delivery Date, Total.
- **UX details**: Count badge switches to `filtered / total` when a query is active; ×-clear button; empty-state row shows `No items match "query"` inside the table; pagination resets to page 1 on query change.

## Attachments Feature

- **Component**: `AttachmentsSection.js` in each widget's `components/` — renders upload button, file list, delete icons
- **Limits**: Max 5 files, 10 MB each — enforced client-side with snackbar warning for oversized files
- **Pending state**: Files queued before save show a "pending upload" chip; they are uploaded sequentially after the bill/PO record is saved/created
- **Sync from Books**: Existing attachments are loaded from the `documents` array in the `GET /bills/{id}` or `GET /purchaseorders/{id}` response whenever the edit/view form opens
- **Upload flow (CRM-attach + Deluge relay)**:
  1. Widget calls `ZOHO.CRM.API.attachFile({Entity: "Vendors", RecordID: crmVendorId, File: {Name, Content}})` to stage the file on the current CRM Vendor record. The SDK handles multipart/binary natively, so file size is bounded only by Books' own 10 MB limit.
  2. Widget calls the `upload_attachment_to_books` Deluge function via `ZOHO.CRM.FUNCTIONS.execute`, passing only `entity_type`, `entity_id`, `crm_module`, `crm_record_id`, `crm_attachment_id` (tiny payload — no binary).
  3. Deluge downloads the staged file from CRM via `invokeurl` GET on `/crm/v7/{module}/{record_id}/Attachments/{attachment_id}` using the `zoho_crm_conn_1` connection, calls `file_obj.setParamName("attachment")` to force the multipart field name Books expects, then POSTs to Books via `invokeurl` using the `zoho_books_testing` connection.
- **Why this architecture**: Earlier attempts sent base64-encoded file bytes through `FUNCTIONS.execute`, but the widget proxy (`crm.zoho.com/crm/v2/functions/{name}/actions/execute`) rejects payloads above ~500 KB with `413 Content Too Large`. Staging via `attachFile` bypasses that proxy entirely. `ZOHO.CRM.CONNECTION.invoke` is not a viable alternative because it JSON-stringifies parameters (confirmed in SDK v1.2 source: `f.parameters=JSON.stringify(d.parameters)`), losing binary content.
- **Deluge proxy function**: `uploadAttachmentToBooks.dg` — must be registered in Zoho CRM as a standalone function with API name `upload_attachment_to_books`, accepting a single `Map arguments` parameter.
- **Required Zoho connections**:
  - `zoho_crm_conn_1` — CRM self-connection used to download the staged attachment. Scopes: `ZohoCRM.modules.ALL`, `ZohoCRM.files.ALL`.
  - `zoho_books_testing` — Books connection used to upload the file to the bill/PO.
- **Books field name**: Books' `/bills/{id}/attachment` and `/purchaseorders/{id}/attachment` endpoints require the multipart field to be literally named `attachment`. Without `setParamName("attachment")`, Books returns `{"code":33003,"message":"Attachment not found."}`.
- **Delete API**: `DELETE /bills/{id}/attachment?documents={doc_id}` — fires immediately when the user clicks the delete icon in edit mode.
- **Known SDK limitations**: `ZOHO.CRM.CONNECTION.getAuthToken` does not exist in ZohoEmbededAppSDK v1.2/v1.3; `CONNECTION.invoke` cannot transmit binary data; `FUNCTIONS.execute` has a ~500 KB payload cap on its widget proxy route.

## API Patterns

- `status` parameter passed as **query parameter** in URL (not in JSON body) for bill/PO creation
- `parseConnectionResponse()` handles centralized response parsing
- `Promise.allSettled` for parallel API calls that can independently fail
- `booksApi()` is a unified helper for all Books API methods (GET, POST, PUT, DELETE)
- Attachment upload uses a separate lenient response parser (empty response treated as success) since the Books attachment endpoint response format differs slightly
- Paid Through accounts for bill payments: fetched from all chart of accounts, filtered client-side by applicable types (cash, bank, equity, other_current_liability, etc.)

## Conventions

- Functional React components with hooks (no class components)
- MUI `sx` prop for styling (no separate CSS files in src/)
- Confirmation dialogs before destructive actions (delete, mark as issued)
- Snackbar notifications for success/error feedback
- Deluge scripts (`.dg` files) are server-side automation that run within Zoho CRM workflows
