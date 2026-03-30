# Zoho CRM Bill Creation Widget

## Overview

A Zoho CRM widget that allows users to create bills directly from within a **Vendor record** in Zoho CRM. The bill is submitted to **Zoho Books** via its API and appears in the **Bills module** of Zoho Books. The widget is embedded as a **Related List** on the Vendors module so that each vendor's bills are accessible from the CRM record itself.

---

## Architecture

```
Zoho CRM (Vendor Record)
  |
  |-- Related List Widget (this project)
  |       |
  |       |-- Fetches vendor info from CRM (auto-populated)
  |       |-- Fetches Items list from Zoho Books Items API
  |       |-- Fetches Taxes list from Zoho Books Taxes API
  |       |-- User fills in bill form
  |       |-- Submits bill via Zoho Books Create Bill API
  |       |
  |       v
  Zoho Books (Bills Module)
```

---

## Features

1. **Auto-populated Vendor** - The vendor name is auto-filled from the current CRM record (using `Books_Vendor_ID`).
2. **Bill Header Fields**:
   - Bill# (bill number)
   - Order Number (reference number)
   - Bill Date (date picker)
   - Due Date (date picker)
   - Payment Terms (dropdown: Due on Receipt, Net 15, Net 30, Net 45, Net 60)
   - Accounts Payable (account selection)
3. **Tax Settings**:
   - Tax type toggle (Tax Exclusive / Tax Inclusive)
   - Tax level toggle (At Transaction Level / At Line Item Level)
4. **Item Table (Line Items)**:
   - Select item from Zoho Books Items (searchable dropdown)
   - Account selection per line item
   - Quantity (numeric input)
   - Rate (numeric input)
   - Tax selection per line item (from Zoho Books Taxes)
   - Customer Details (optional, for billable expenses)
   - Auto-calculated Amount (quantity x rate)
   - Add / Remove rows
5. **Totals Section**:
   - Sub Total (auto-calculated)
   - Discount (amount or percentage)
   - Adjustment (manual +/- value)
   - **Total** (auto-calculated)
6. **Footer**:
   - Notes (textarea)
   - File attachment support (up to 5 files, 10 MB each)
7. **Submission**:
   - Creates bill in Zoho Books via `POST /books/v3/bills`
   - Links the bill to the vendor using `vendor_id` (Books Vendor ID)
   - Stores a custom field `cf_crm_vendor_id` on the bill for back-reference

---

## Zoho Books API Endpoints Used

| Purpose | Method | Endpoint |
|---|---|---|
| Create Bill | POST | `/books/v3/bills?organization_id={org_id}` |
| List Items | GET | `/books/v3/items?organization_id={org_id}` |
| List Taxes | GET | `/books/v3/taxes?organization_id={org_id}` |
| List Accounts (Chart of Accounts) | GET | `/books/v3/chartofaccounts?organization_id={org_id}` |
| Get Bill (for related list display) | GET | `/books/v3/bills?organization_id={org_id}&vendor_id={vendor_id}` |

**Organization ID**: `771340721`
**Connection name**: `zoho_books_testing`

---

## Bill Create API - Key Fields

### Header-Level Fields

| Field | API Key | Type | Required | Description |
|---|---|---|---|---|
| Vendor | `vendor_id` | string | Yes | Books Vendor ID (fetched from CRM record `Books_Vendor_ID`) |
| Bill Number | `bill_number` | string | Yes | Unique bill identifier |
| Order Number | `reference_number` | string | No | External reference / order number |
| Bill Date | `date` | string (yyyy-mm-dd) | No | Date the bill was issued |
| Due Date | `due_date` | string (yyyy-mm-dd) | No | Payment due date |
| Payment Terms | `payment_terms` | integer | No | 0=Due on Receipt, 15=Net 15, 30=Net 30, etc. |
| Payment Terms Label | `payment_terms_label` | string | No | Display label for payment terms |
| Tax Inclusive | `is_inclusive_tax` | boolean | No | Whether rates include tax |
| Item Level Tax | `is_item_level_tax_calc` | boolean | No | Tax at item level vs transaction level |
| Discount | `discount` | number | No | Discount amount or percentage |
| Adjustment | `adjustment` | number | No | +/- adjustment to total |
| Adjustment Description | `adjustment_description` | string | No | Reason for adjustment |
| Notes | `notes` | string | No | Internal notes |
| Custom Fields | `custom_fields` | array | No | e.g., `cf_crm_vendor_id` |

### Line Item Fields (`line_items[]`)

| Field | API Key | Type | Required | Description |
|---|---|---|---|---|
| Item | `item_id` | string | No | Zoho Books item ID |
| Item Name | `name` | string | No | Name/description of item |
| Account | `account_id` | string | No | Chart of accounts entry |
| Quantity | `quantity` | number | No | Number of units |
| Rate | `rate` | number | No | Unit price |
| Tax | `tax_id` | string | No | Tax or tax group ID |
| Description | `description` | string | No | Line item description |
| Customer | `customer_id` | string | No | For billable expenses |
| Item Order | `item_order` | integer | No | Sort position |

---

## Project Structure

```
Vendor_Creation/
  |-- createVendorInBooks.dg        # Existing: Deluge script for vendor sync CRM -> Books
  |-- README.md                     # This file
  |-- bill-creation-widget/         # New: Zoho CRM Widget
  |     |-- index.html              # Main widget HTML (form UI)
  |     |-- css/
  |     |     |-- style.css         # Widget styling (Zoho Books-like UI)
  |     |-- js/
  |     |     |-- app.js            # Main logic: form handling, API calls, calculations
  |     |-- assets/                 # Icons or static assets (if needed)
  |     |-- plugin-manifest.json    # Zoho CRM widget manifest
  |-- createBillInBooks.dg          # New: Deluge server-side function (if needed)
```

---

## Implementation Plan

### Phase 1 - Setup & Data Fetching
1. Create widget project scaffolding (`plugin-manifest.json`, `index.html`, `css/`, `js/`)
2. Initialize Zoho CRM JS SDK in the widget
3. Fetch current vendor record from CRM (get `Books_Vendor_ID`, `Vendor_Name`)
4. Fetch Items list from Zoho Books API
5. Fetch Taxes list from Zoho Books API
6. Fetch Chart of Accounts from Zoho Books API

### Phase 2 - Build the Form UI
7. Build bill header section (Vendor Name, Bill#, Order Number, Bill Date, Due Date, Payment Terms, Accounts Payable)
8. Build tax settings row (Tax Exclusive/Inclusive toggle, Transaction/Item level toggle)
9. Build Item Table with dynamic rows (Item dropdown, Account, Quantity, Rate, Tax, Customer Details, Amount)
10. Build "Add New Row" button and row delete functionality
11. Build totals section (Sub Total, Discount, Adjustment, Total) with auto-calculation
12. Build footer section (Notes textarea, file attachment area)
13. Build action buttons (Save as Draft, Save as Open)

### Phase 3 - Business Logic
14. Implement auto-calculation: Amount = Quantity x Rate per line item
15. Implement Sub Total = sum of all line item amounts
16. Implement Discount calculation (amount or %)
17. Implement Tax calculation (per item or per transaction)
18. Implement Total = Sub Total - Discount + Tax + Adjustment
19. Implement form validation (required fields, date format, numeric checks)

### Phase 4 - API Integration
20. Build the `create_bill` API payload from form data
21. Submit bill to Zoho Books via `invokeurl` / JS SDK connection
22. Handle success: show confirmation, reset form
23. Handle errors: show error messages from API response
24. Write back bill reference to CRM vendor record (optional)

### Phase 5 - Related List Integration
25. Create a Deluge function or widget view that lists existing bills for the current vendor
26. Display bill number, date, due date, total, status in a table view
27. Register the widget as a Related List on the Vendors module in CRM

---

## Prerequisites

- Zoho CRM with widget support (Enterprise or above)
- Zoho Books account (Org ID: `771340721`)
- Connection `zoho_books_testing` with scopes: `ZohoBooks.bills.CREATE`, `ZohoBooks.bills.READ`, `ZohoBooks.settings.READ`
- `Books_Vendor_ID` custom field on CRM Vendors module (already exists from vendor sync)
- Zoho CRM JS SDK (`https://live.zwidgets.com/js-sdk/1.2/ZohoEmbededAppSDK.min.js`)

---

## UI Reference

The widget UI closely mirrors the native Zoho Books "New Bill" form:
- Clean white card layout with labeled form fields
- Blue accent for primary actions and links
- Item table with column headers: Item Details, Account, Quantity, Rate, Tax, Customer Details, Amount
- Totals section right-aligned below the item table
- Notes and file attachment area at the bottom
