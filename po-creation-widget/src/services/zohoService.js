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

const LOCAL_PO_BILLS_KEY = (vendorId) => `po-bill-map:${vendorId}`;
const LEGACY_BILLED_KEY = (vendorId) => `billed-pos:${vendorId}`;

function readPoBillMap(vendorId) {
  if (!vendorId) return {};
  try {
    const raw = localStorage.getItem(LOCAL_PO_BILLS_KEY(vendorId));
    const map = raw ? JSON.parse(raw) : {};
    const legacy = localStorage.getItem(LEGACY_BILLED_KEY(vendorId));
    if (legacy) {
      (JSON.parse(legacy) || []).forEach((poId) => { if (!map[poId]) map[poId] = []; });
    }
    return map;
  } catch {
    return {};
  }
}

function writePoBillMap(vendorId, map) {
  if (!vendorId) return;
  try {
    localStorage.setItem(LOCAL_PO_BILLS_KEY(vendorId), JSON.stringify(map));
  } catch {}
}

export function getLocallyBilledPoIds(vendorId) {
  return new Set(Object.keys(readPoBillMap(vendorId)));
}

export function getLocalBillsForPo(vendorId, poId) {
  const map = readPoBillMap(vendorId);
  return map[poId] || [];
}

export function recordLocalPoBillLink(vendorId, poId, billId) {
  if (!vendorId || !poId || !billId) return;
  const map = readPoBillMap(vendorId);
  const list = new Set(map[poId] || []);
  list.add(billId);
  map[poId] = [...list];
  writePoBillMap(vendorId, map);
}

export async function getBill(billId) {
  const data = await booksApi("GET", `/bills/${billId}`);
  return data.bill || data;
}

export async function listBillsForVendor(vendorId) {
  const data = await booksApi("GET", `/bills?vendor_id=${vendorId}`);
  return data.bills || [];
}

/* ========== PO Attachments ========== */

export async function uploadPoAttachment(poId, file, crmVendorId) {
  // Stage the file on the CRM Vendor record — SDK handles binary natively,
  // avoiding the ~500KB payload cap on the FUNCTIONS.execute proxy.
  const attachResp = await window.ZOHO.CRM.API.attachFile({
    Entity: "Vendors",
    RecordID: crmVendorId,
    File: { Name: file.name, Content: file },
  });
  console.log("[uploadPoAttachment] CRM attachFile raw:", JSON.stringify(attachResp));
  const attachmentId =
    attachResp?.data?.[0]?.details?.id ||
    attachResp?.data?.[0]?.id ||
    attachResp?.details?.id;
  if (!attachmentId) throw new Error("Failed to stage attachment on CRM Vendor record");

  const resp = await window.ZOHO.CRM.FUNCTIONS.execute("upload_attachment_to_books", {
    arguments: JSON.stringify({
      entity_type: "purchaseorders",
      entity_id: poId,
      crm_module: "Vendors",
      crm_record_id: crmVendorId,
      crm_attachment_id: attachmentId,
    }),
  });
  console.log("[uploadPoAttachment] FUNCTIONS.execute raw:", JSON.stringify(resp));
  const output = resp?.details?.output;
  if (!output) return { code: 0 };
  const data = typeof output === "string"
    ? (() => { try { return JSON.parse(output); } catch { return { code: 0 }; } })()
    : output;
  if (data?.code !== undefined && data.code !== 0) throw new Error(data.message || `Upload failed (code ${data.code})`);
  return data;
}

export async function deletePoAttachment(poId, docId) {
  return await booksApi("DELETE", `/purchaseorders/${poId}/attachment?documents=${docId}`);
}

/* ========== Bills (for Convert to Bill) ========== */

export async function createBill(payload, status = "draft") {
  const data = await booksApi("POST", `/bills?status=${status}`, payload);
  return data.bill || data;
}
