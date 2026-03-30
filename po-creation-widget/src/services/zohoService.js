const BOOKS_ORG_ID = "771340721";
const CONNECTION_NAME = "zoho_books_testing";
const BOOKS_BASE = "https://www.zohoapis.com/books/v3";

/* ---------- SDK bootstrap ---------- */

export function initZohoSDK() {
  return new Promise((resolve, reject) => {
    if (!window.ZOHO) {
      return reject(new Error("Zoho SDK not loaded. Make sure the widget runs inside Zoho CRM."));
    }

    let attempts = 0;
    const maxAttempts = 50;

    const poll = setInterval(() => {
      attempts++;

      if (window.__ZOHO_SDK_READY__) {
        clearInterval(poll);

        if (window.__ZOHO_SDK_ERROR__) {
          return reject(new Error(String(window.__ZOHO_SDK_ERROR__)));
        }

        if (window.__ZOHO_PAGE_DATA__) {
          console.log("Got PageLoad data from inline init:", JSON.stringify(window.__ZOHO_PAGE_DATA__));
          return resolve(window.__ZOHO_PAGE_DATA__);
        }

        console.warn("SDK ready but no PageLoad data. Waiting 3s more...");
        setTimeout(() => {
          if (window.__ZOHO_PAGE_DATA__) {
            return resolve(window.__ZOHO_PAGE_DATA__);
          }
          reject(new Error(
            "Zoho SDK initialized but PageLoad event never provided EntityId. " +
            "URL: " + window.location.href
          ));
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

/* ---------- CRM helpers ---------- */

export async function getCurrentVendor(entityId) {
  try {
    const resp = await window.ZOHO.CRM.API.getRecord({
      Entity: "Vendors",
      RecordID: entityId,
    });
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

/* ---------- Zoho Books API via connection ---------- */

function parseConnectionResponse(resp) {
  console.log("CONNECTION.invoke raw response:", JSON.stringify(resp));

  const body =
    resp?.details?.statusMessage ||
    resp?.statusMessage ||
    resp?.data ||
    resp;

  if (!body) throw new Error("Empty response from Zoho Books.");

  if (typeof body === "object" && body.code !== undefined) {
    if (body.code !== 0) {
      throw new Error(body.message || `Books API error (code ${body.code})`);
    }
    return body;
  }

  if (typeof body === "string") {
    try {
      const data = JSON.parse(body);
      if (data.code !== undefined && data.code !== 0) {
        throw new Error(data.message || `Books API error (code ${data.code})`);
      }
      return data;
    } catch (parseErr) {
      throw new Error("Invalid response from Books API: " + body.substring(0, 200));
    }
  }

  return body;
}

async function booksApiGet(endpoint) {
  const url = `${BOOKS_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}organization_id=${BOOKS_ORG_ID}`;
  try {
    const resp = await window.ZOHO.CRM.CONNECTION.invoke(CONNECTION_NAME, {
      url: url,
      method: "GET",
      param_type: 1,
    });
    return parseConnectionResponse(resp);
  } catch (err) {
    if (err.message?.includes("Books API error") || err.message?.includes("Invalid response")) throw err;
    throw new Error("Books API request failed: " + err.message);
  }
}

async function booksApiPost(endpoint, payload) {
  const url = `${BOOKS_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}organization_id=${BOOKS_ORG_ID}`;
  try {
    const resp = await window.ZOHO.CRM.CONNECTION.invoke(CONNECTION_NAME, {
      url: url,
      method: "POST",
      param_type: 1,
      parameters: { JSONString: JSON.stringify(payload) },
    });
    return parseConnectionResponse(resp);
  } catch (err) {
    if (err.message?.includes("Books API error") || err.message?.includes("Invalid response")) throw err;
    throw new Error("Failed to create purchase order: " + err.message);
  }
}

/* ---------- Data fetchers ---------- */

export async function fetchItems() {
  const data = await booksApiGet("/items");
  return (data.items || []).map((item) => ({
    item_id: item.item_id,
    name: item.name,
    rate: item.rate || 0,
    description: item.description || "",
    tax_id: item.tax_id || "",
    account_id: item.account_id || "",
    unit: item.unit || "",
  }));
}

export async function fetchTaxes() {
  const data = await booksApiGet("/settings/taxes");
  return (data.taxes || []).map((tax) => ({
    tax_id: tax.tax_id,
    tax_name: tax.tax_name,
    tax_percentage: tax.tax_percentage,
  }));
}

export async function fetchChartOfAccounts() {
  const data = await booksApiGet("/chartofaccounts?filter_by=AccountType.Expense");
  return (data.chartofaccounts || []).map((acc) => ({
    account_id: acc.account_id,
    account_name: acc.account_name,
    account_type: acc.account_type,
  }));
}

/* ---------- Purchase Order creation ---------- */

export async function createPurchaseOrder(payload, status = "draft") {
  payload.status = status;
  const data = await booksApiPost("/purchaseorders", payload);
  return data.purchaseorder || data;
}
