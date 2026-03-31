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
  const [expense, cogs, asset, otherAsset] = await Promise.allSettled([
    booksApi("GET", "/chartofaccounts?filter_by=AccountType.Expense"),
    booksApi("GET", "/chartofaccounts?filter_by=AccountType.CostOfGoodsSold"),
    booksApi("GET", "/chartofaccounts?filter_by=AccountType.FixedAsset"),
    booksApi("GET", "/chartofaccounts?filter_by=AccountType.OtherCurrentAsset"),
  ]);
  const all = [
    ...(expense.status === "fulfilled" ? expense.value.chartofaccounts || [] : []),
    ...(cogs.status === "fulfilled" ? cogs.value.chartofaccounts || [] : []),
    ...(asset.status === "fulfilled" ? asset.value.chartofaccounts || [] : []),
    ...(otherAsset.status === "fulfilled" ? otherAsset.value.chartofaccounts || [] : []),
  ];
  return all.map((a) => ({
    account_id: a.account_id, account_name: a.account_name, account_type: a.account_type,
  }));
}

/* ========== Purchase Orders ========== */

export async function listPurchaseOrders(vendorId) {
  const data = await booksApi("GET", `/purchaseorders?vendor_id=${vendorId}`);
  return data.purchaseorders || [];
}

export async function getPurchaseOrder(poId) {
  const data = await booksApi("GET", `/purchaseorders/${poId}`);
  return data.purchaseorder || data;
}

export async function createPurchaseOrder(payload, status = "draft") {
  const data = await booksApi("POST", `/purchaseorders?status=${status}`, payload);
  return data.purchaseorder || data;
}

export async function updatePurchaseOrder(poId, payload) {
  const data = await booksApi("PUT", `/purchaseorders/${poId}`, payload);
  return data.purchaseorder || data;
}

export async function deletePurchaseOrder(poId) {
  return await booksApi("DELETE", `/purchaseorders/${poId}`);
}

export async function markPoAsIssued(poId) {
  return await booksApi("POST", `/purchaseorders/${poId}/status/issued`, {});
}

/* ========== Bills (for Convert to Bill) ========== */

export async function createBill(payload, status = "draft") {
  const data = await booksApi("POST", `/bills?status=${status}`, payload);
  return data.bill || data;
}
