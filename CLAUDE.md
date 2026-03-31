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
        LineItemTable.js       # Shared line items table with description field
        TotalsSection.js       # Shared totals/discount/adjustment section
      services/
        zohoService.js         # All Zoho CRM + Books API calls (bills, items, taxes, accounts, payments)
  po-creation-widget/          # React app - Purchase Order management widget (embedded in CRM)
    src/
      App.js                   # Entry point, Zoho SDK init, MUI theme
      components/
        Dashboard.js           # PO list view with actions (mark as issued, convert to bill, view bills, edit, delete)
        PurchaseOrderForm.js   # Create/edit purchase order form
        ConvertToBillForm.js   # Convert an issued PO to a bill (pre-filled bill form)
        LineItemTable.js       # Shared line items table with description field
        TotalsSection.js       # Shared totals/discount/adjustment section
      services/
        zohoService.js         # All Zoho CRM + Books API calls (POs, items, taxes, accounts, bills)
  createVendorInBooks.dg       # Deluge: syncs CRM Vendor -> Books contact (create/update)
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
- Items filtered to exclude sales-only items (`item_type !== "sales"`)
- Due date picker prevents selecting dates before bill date
- Line items include a description field below the item selector

## PO Widget Workflow

- **Create**: Save as Draft / Save as Open
- **Mark as Issued**: Draft POs can be marked as issued via `/purchaseorders/{id}/status/issued`
- **Convert to Bill**: Issued POs can be converted to a bill (creates bill with `purchaseorder_ids` linking)
- **View Bills**: Closed/billed POs show a popover with linked bills (clickable to open in Zoho Books)
- **Edit/Delete**: Available on all POs
- Items filtered to exclude sales-only items
- Accounts fetched from multiple types: Expense, CostOfGoodsSold, FixedAsset, OtherCurrentAsset
- Line items include a description field below the item selector

## API Patterns

- `status` parameter passed as **query parameter** in URL (not in JSON body) for bill/PO creation
- `parseConnectionResponse()` handles centralized response parsing
- `Promise.allSettled` for parallel API calls that can independently fail
- `booksApi()` is a unified helper for all Books API methods (GET, POST, PUT, DELETE)
- Paid Through accounts for bill payments: fetched from all chart of accounts, filtered client-side by applicable types (cash, bank, equity, other_current_liability, etc.)

## Conventions

- Functional React components with hooks (no class components)
- MUI `sx` prop for styling (no separate CSS files in src/)
- Confirmation dialogs before destructive actions (delete, mark as issued)
- Snackbar notifications for success/error feedback
- Deluge scripts (`.dg` files) are server-side automation that run within Zoho CRM workflows
