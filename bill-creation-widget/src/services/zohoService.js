const BOOKS_ORG_ID = "771340721";
const CONNECTION_NAME = "zoho_books_testing";
const BOOKS_BASE = "https://www.zohoapis.com/books/v3";

/* ========== SDK bootstrap ========== */

export function initZohoSDK() {
  return new Promise((resolve, reject) => {
    if (!window.ZOHO) {
      return reject(new Error("Zoho SDK not loaded."));
    }
    let attempts = 0;
    const maxAttempts = 50;
    const poll = setInterval(() => {
      attempts++;
      if (window.__ZOHO_SDK_READY__) {
        clearInterval(poll);
        if (window.__ZOHO_SDK_ERROR__) return reject(new Error(String(window.__ZOHO_SDK_ERROR__)));
        if (window.__ZOHO_PAGE_DATA__) return resolve(window.__ZOHO_PAGE_DATA__);
        console.warn("SDK ready but no PageLoad data. Waiting 3s more...");
        setTimeout(() => {
          if (window.__ZOHO_PAGE_DATA__) return resolve(window.__ZOHO_PAGE_DATA__);
          reject(new Error("PageLoad event never provided EntityId. URL: " + window.location.href));
        }, 3000);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        reject(new Error("Zoho SDK did not initialize within 10 seconds."));
      }
    }, 200);
  });
}

/* ========== CRM helpers ========== */

export async function getCurrentVendor(entityId) {
  try {
    const resp = await window.ZOHO.CRM.API.getRecord({ Entity: "Vendors", RecordID: entityId });
    const record = resp?.data?.[0];
    if (!record) throw new Error("Vendor record not found in CRM.");
    return {
      crmId: record.id,
      booksVendorId: record.Books_Vendor_ID || null,
      vendorName: record.Vendor_Name || "Unknown Vendor",
    };
  } catch (err) {
    throw new Error("Failed to fetch vendor from CRM: " + err.message);
  }
}

/* ========== Books API helpers ========== */

function parseConnectionResponse(resp) {
  console.log("CONNECTION raw:", JSON.stringify(resp));
  const body = resp?.details?.statusMessage || resp?.statusMessage || resp?.data || resp;
  if (!body) throw new Error("Empty response from Zoho Books.");
  if (typeof body === "object" && body.code !== undefined) {
    if (body.code !== 0) throw new Error(body.message || `Books API error (code ${body.code})`);
    return body;
  }
  if (typeof body === "string") {
    try {
      const data = JSON.parse(body);
      if (data.code !== undefined && data.code !== 0) throw new Error(data.message || `Books API error (code ${data.code})`);
      return data;
    } catch (e) {
      throw new Error("Invalid response: " + body.substring(0, 200));
    }
  }
  return body;
}

async function booksApi(method, endpoint, payload) {
  const url = `${BOOKS_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}organization_id=${BOOKS_ORG_ID}`;
  const config = { url, method, param_type: 1 };
  if (payload && (method === "POST" || method === "PUT")) {
    config.parameters = { JSONString: JSON.stringify(payload) };
  }
  const resp = await window.ZOHO.CRM.CONNECTION.invoke(CONNECTION_NAME, config);
  return parseConnectionResponse(resp);
}

/* ========== Reference data ========== */

export async function fetchItems() {
  const data = await booksApi("GET", "/items");
  return (data.items || [])
    .filter((i) => i.item_type !== "sales")
    .map((i) => ({
      item_id: i.item_id, name: i.name, rate: i.purchase_rate || i.rate || 0,
      description: i.purchase_description || i.description || "",
      tax_id: i.tax_id || "", account_id: i.purchase_account_id || i.account_id || "",
      unit: i.unit || "",
    }));
}

export async function fetchTaxes() {
  const data = await booksApi("GET", "/settings/taxes");
  return (data.taxes || []).map((t) => ({
    tax_id: t.tax_id, tax_name: t.tax_name, tax_percentage: t.tax_percentage,
  }));
}

export async function fetchChartOfAccounts() {
  const data = await booksApi("GET", "/chartofaccounts?filter_by=AccountType.Expense");
  return (data.chartofaccounts || []).map((a) => ({
    account_id: a.account_id, account_name: a.account_name, account_type: a.account_type,
  }));
}

export async function fetchCustomFields(entityType) {
  try {
    const data = await booksApi("GET", `/settings/customfields?entity_type=${entityType}`);
    const list = data.customfields || data.custom_fields || [];
    return list
      .filter((f) => f.is_active !== false && f.show_in_all_pdf !== false)
      .map((f) => ({
        customfield_id: f.customfield_id,
        api_name: f.api_name,
        label: f.label || f.field_name_formatted || f.api_name,
        data_type: (f.data_type || "string").toLowerCase(),
        is_mandatory: !!f.is_mandatory,
        values: f.values || [],
      }));
  } catch (err) {
    console.warn("fetchCustomFields failed:", err.message);
    return [];
  }
}

/* ========== Bills ========== */

export async function listBills(vendorId) {
  const data = await booksApi("GET", `/bills?vendor_id=${vendorId}`);
  return data.bills || [];
}

export async function getBill(billId) {
  const data = await booksApi("GET", `/bills/${billId}`);
  return data.bill || data;
}

export async function createBill(payload, status = "draft") {
  const data = await booksApi("POST", `/bills?status=${status}`, payload);
  return data.bill || data;
}

export async function updateBill(billId, payload) {
  const data = await booksApi("PUT", `/bills/${billId}`, payload);
  return data.bill || data;
}

export async function deleteBill(billId) {
  return await booksApi("DELETE", `/bills/${billId}`);
}

export async function submitBillForApproval(billId) {
  return await booksApi("POST", `/bills/${billId}/submit`, {});
}

export async function approveBill(billId) {
  return await booksApi("POST", `/bills/${billId}/approve`, {});
}

export async function rejectBill(billId) {
  return await booksApi("POST", `/bills/${billId}/reject`, {});
}

/* ========== Bill Payments ========== */

export async function recordBillPayment(billId, payload) {
  payload.bills = [{ bill_id: billId, amount_applied: payload.amount }];
  const data = await booksApi("POST", "/vendorpayments", payload);
  return data.vendorpayment || data;
}

export async function fetchPaidThroughAccounts() {
  const PAID_THROUGH_TYPES = [
    "cash", "bank", "other_current_liability", "equity",
    "other_current_asset", "other_asset", "fixed_asset",
  ];
  const data = await booksApi("GET", "/chartofaccounts");
  const all = (data.chartofaccounts || []).filter((a) =>
    PAID_THROUGH_TYPES.includes(a.account_type?.toLowerCase())
  );
  return all.map((a) => ({
    account_id: a.account_id, account_name: a.account_name, account_type: a.account_type,
  }));
}

