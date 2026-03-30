import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, TextField, MenuItem, Typography, Button, Alert, CircularProgress,
  Snackbar, Paper, Chip,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";

import LineItemTable, { createEmptyRow } from "./LineItemTable";
import TotalsSection from "./TotalsSection";
import {
  getCurrentVendor,
  fetchItems,
  fetchTaxes,
  fetchChartOfAccounts,
  createPurchaseOrder,
} from "../services/zohoService";

const PAYMENT_TERMS = [
  { value: 0, label: "Due on Receipt" },
  { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" },
  { value: 45, label: "Net 45" },
  { value: 60, label: "Net 60" },
];

export default function PurchaseOrderForm({ entityId }) {
  // ---------- Loading / error state ----------
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // ---------- Reference data from APIs ----------
  const [vendor, setVendor] = useState({ crmId: "", booksVendorId: "", vendorName: "" });
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // ---------- Form fields ----------
  const [poNumber, setPoNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [poDate, setPoDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(0);
  const [paymentTermsLabel, setPaymentTermsLabel] = useState("Due on Receipt");
  const [shipmentPreference, setShipmentPreference] = useState("");
  const [taxType, setTaxType] = useState("false");       // "true" = inclusive
  const [taxLevel, setTaxLevel] = useState("false");      // "false" = transaction level (default for PO)
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  // ---------- Line items ----------
  const [lineItems, setLineItems] = useState([createEmptyRow()]);

  // ---------- Totals inputs ----------
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent");
  const [adjustmentValue, setAdjustmentValue] = useState("0");

  // ---------- Validation ----------
  const [validationErrors, setValidationErrors] = useState({});

  // ---------- Fetch all data on mount ----------
  const loadData = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);

      const vendorInfo = await getCurrentVendor(entityId);
      setVendor(vendorInfo);

      if (!vendorInfo.booksVendorId) {
        setError("This vendor has no linked Books Vendor ID. Please sync the vendor to Zoho Books first.");
        setInitialLoading(false);
        return;
      }

      const [itemsList, taxesList, accountsList] = await Promise.allSettled([
        fetchItems(),
        fetchTaxes(),
        fetchChartOfAccounts(),
      ]);

      if (itemsList.status === "fulfilled") setItems(itemsList.value);
      else console.error("Failed to load items:", itemsList.reason);

      if (taxesList.status === "fulfilled") setTaxes(taxesList.value);
      else console.error("Failed to load taxes:", taxesList.reason);

      if (accountsList.status === "fulfilled") setAccounts(accountsList.value);
      else console.error("Failed to load accounts:", accountsList.reason);

      const failures = [itemsList, taxesList, accountsList].filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        setSnackbar({
          open: true,
          message: `Some reference data could not be loaded. ${failures.length} API call(s) failed.`,
          severity: "warning",
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentTermsChange = (val) => {
    const numVal = parseInt(val, 10);
    setPaymentTerms(numVal);
    const found = PAYMENT_TERMS.find((pt) => pt.value === numVal);
    setPaymentTermsLabel(found ? found.label : `Net ${numVal}`);
  };

  // ---------- Validation ----------
  const validate = () => {
    const errors = {};
    if (!poNumber.trim()) errors.poNumber = "Purchase Order number is required.";
    if (!poDate) errors.poDate = "Date is required.";
    if (!vendor.booksVendorId) errors.vendor = "Vendor must be linked to Zoho Books.";

    const hasValidItem = lineItems.some((row) => {
      const qty = parseFloat(row.quantity) || 0;
      const rate = parseFloat(row.rate) || 0;
      return row.item_id && qty > 0 && rate > 0;
    });
    if (!hasValidItem) errors.lineItems = "At least one line item with an item, quantity, and rate is required.";

    lineItems.forEach((row, idx) => {
      const qty = parseFloat(row.quantity) || 0;
      const rate = parseFloat(row.rate) || 0;
      if (qty < 0) errors[`qty_${idx}`] = `Row ${idx + 1}: Quantity cannot be negative.`;
      if (rate < 0) errors[`rate_${idx}`] = `Row ${idx + 1}: Rate cannot be negative.`;
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---------- Build payload & submit ----------
  const handleSubmit = async (status) => {
    if (!validate()) {
      setSnackbar({ open: true, message: "Please fix the validation errors before submitting.", severity: "error" });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        vendor_id: vendor.booksVendorId,
        purchaseorder_number: poNumber.trim(),
        reference_number: referenceNumber.trim(),
        date: poDate,
        delivery_date: deliveryDate || undefined,
        payment_terms: paymentTerms,
        payment_terms_label: paymentTermsLabel,
        shipment_preference: shipmentPreference || undefined,
        is_inclusive_tax: taxType === "true",
        is_item_level_tax_calc: taxLevel === "true",
        notes: notes,
        terms: terms,
        line_items: lineItems
          .filter((row) => row.item_id || row.name)
          .map((row, idx) => ({
            item_id: row.item_id || undefined,
            name: row.name || undefined,
            account_id: row.account_id || undefined,
            description: row.description || undefined,
            quantity: parseFloat(row.quantity) || 1,
            rate: parseFloat(row.rate) || 0,
            tax_id: row.tax_id || undefined,
            item_order: idx + 1,
          })),
      };

      // Discount
      const discNum = parseFloat(discountValue) || 0;
      if (discNum > 0) {
        payload.discount = discountType === "percent" ? `${discNum}%` : discNum;
      }

      // Adjustment
      const adj = parseFloat(adjustmentValue) || 0;
      if (adj !== 0) {
        payload.adjustment = adj;
        payload.adjustment_description = adj > 0 ? "Adjustment (add)" : "Adjustment (deduct)";
      }

      const result = await createPurchaseOrder(payload, status);

      setSnackbar({
        open: true,
        message: `Purchase Order "${result.purchaseorder_number || poNumber}" created successfully in Zoho Books!`,
        severity: "success",
      });

      resetForm();
    } catch (err) {
      setError(err.message);
      setSnackbar({ open: true, message: err.message, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setPoNumber("");
    setReferenceNumber("");
    setPoDate(dayjs().format("YYYY-MM-DD"));
    setDeliveryDate("");
    setPaymentTerms(0);
    setPaymentTermsLabel("Due on Receipt");
    setShipmentPreference("");
    setNotes("");
    setTerms("");
    setLineItems([createEmptyRow()]);
    setDiscountValue("0");
    setDiscountType("percent");
    setAdjustmentValue("0");
    setValidationErrors({});
  };

  // ---------- Render ----------

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading widget data...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <ShoppingCartIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>New Purchase Order</Typography>
      </Box>

      {/* Global error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Vendor (read-only) */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Vendor Name"
              value={vendor.vendorName}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
              sx={{ backgroundColor: "#f5f5f5" }}
              error={!!validationErrors.vendor}
              helperText={validationErrors.vendor}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: "flex", alignItems: "center", height: "100%", gap: 1 }}>
              <Chip
                label={vendor.booksVendorId ? "Linked to Books" : "Not linked"}
                color={vendor.booksVendorId ? "success" : "error"}
                size="small"
                variant="outlined"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* PO details */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Purchase Order#"
              required
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              fullWidth
              size="small"
              error={!!validationErrors.poNumber}
              helperText={validationErrors.poNumber}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Reference#"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Shipment Preference"
              value={shipmentPreference}
              onChange={(e) => setShipmentPreference(e.target.value)}
              fullWidth
              size="small"
              placeholder="e.g. FedEx, DHL"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              label="Date"
              type="date"
              required
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              error={!!validationErrors.poDate}
              helperText={validationErrors.poDate}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Delivery Date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Payment Terms"
              select
              value={paymentTerms}
              onChange={(e) => handlePaymentTermsChange(e.target.value)}
              fullWidth
              size="small"
            >
              {PAYMENT_TERMS.map((pt) => (
                <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Tax settings */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <TextField
              select
              label="Tax Type"
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="false">Tax Exclusive</MenuItem>
              <MenuItem value="true">Tax Inclusive</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              select
              label="Tax Level"
              value={taxLevel}
              onChange={(e) => setTaxLevel(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="true">At Item Level</MenuItem>
              <MenuItem value="false">At Transaction Level</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Line items */}
      {validationErrors.lineItems && (
        <Alert severity="error" sx={{ mb: 1 }}>{validationErrors.lineItems}</Alert>
      )}
      <LineItemTable
        lineItems={lineItems}
        setLineItems={setLineItems}
        items={items}
        taxes={taxes}
        accounts={accounts}
      />

      {/* Totals */}
      <TotalsSection
        lineItems={lineItems}
        taxes={taxes}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        discountType={discountType}
        setDiscountType={setDiscountType}
        adjustmentValue={adjustmentValue}
        setAdjustmentValue={setAdjustmentValue}
        isInclusiveTax={taxType === "true"}
        isItemLevelTax={taxLevel === "true"}
      />

      {/* Notes */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              size="small"
              placeholder="Will be displayed on purchase order"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Terms & Conditions"
              multiline
              rows={3}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              fullWidth
              size="small"
              placeholder="Enter the terms and conditions of your business"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mb: 4 }}>
        <Button variant="outlined" onClick={resetForm} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={() => handleSubmit("draft")}
          disabled={submitting || !vendor.booksVendorId}
        >
          {submitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={() => handleSubmit("open")}
          disabled={submitting || !vendor.booksVendorId}
        >
          {submitting ? "Saving..." : "Save as Open"}
        </Button>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
