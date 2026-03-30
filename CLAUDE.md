# CLAUDE.md

## Project Overview

Zoho CRM widgets for managing vendor-related documents (Bills and Purchase Orders) directly from Vendor records in Zoho CRM. The widgets create/edit records in Zoho Books via its REST API.

## Repository Structure

```
Vendor_Creation/
  bill-creation-widget/    # React app - Bill & PO dashboard widget (embedded in CRM)
    src/
      App.js               # Entry point, Zoho SDK init, MUI theme
      components/
        Dashboard.js       # Main view: tabs for Bills / Purchase Orders lists
        BillForm.js        # Create/edit bill form
        PurchaseOrderForm.js  # Create/edit purchase order form
        LineItemTable.js   # Shared line items table component
        TotalsSection.js   # Shared totals/discount/adjustment section
      services/
        zohoService.js     # All Zoho CRM + Books API calls
  po-creation-widget/      # Standalone PO widget (same stack, subset of functionality)
  createVendorInBooks.dg   # Deluge: syncs CRM Vendor -> Books contact (create/update)
  createBillInBooks.dg     # Deluge: server-side bill creation in Books
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

## Common Commands

```bash
# From bill-creation-widget/ or po-creation-widget/:
npm start          # Dev server (localhost:3000)
npm run build      # Production build for widget packaging
npm test           # Run tests
```

## Architecture Notes

- The widget initializes via `ZOHO.embeddedApp.init()` in `index.js`, which fires a `PageLoad` event providing the current `EntityId` (CRM Vendor record ID).
- All Books API calls go through `ZOHO.CRM.CONNECTION.invoke()` using the `zoho_books_testing` connection, which handles OAuth automatically.
- `zohoService.js` is shared logic between bill and PO operations - it contains helpers for CRM record fetch, Books items/taxes/accounts lookups, and CRUD for bills and purchase orders.
- The Dashboard component manages navigation between list view and form views (bill or PO).
- Deluge scripts (`.dg` files) are server-side automation that run within Zoho CRM workflows.

## Conventions

- Functional React components with hooks (no class components)
- MUI `sx` prop for styling (no separate CSS files in src/)
- `Promise.allSettled` for parallel API calls that can independently fail
- API response parsing handled centrally in `parseConnectionResponse()`
