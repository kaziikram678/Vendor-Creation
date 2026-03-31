import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, TextField, MenuItem, Typography, Button, Alert, CircularProgress,
  Snackbar, Paper, IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";

import LineItemTable, { createEmptyRow } from "./LineItemTable";
import TotalsSection from "./TotalsSection";
import { getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder } from "../services/zohoService";

const PAYMENT_TERMS = [
  { value: 0, label: "Due on Receipt" }, { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" }, { value: 45, label: "Net 45" }, { value: 60, label: "Net 60" },
];

export default function PurchaseOrderForm({ vendor, items, taxes, accounts, editPoId, onBack }) {
  const isEdit = !!editPoId;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [poNumber, setPoNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [poDate, setPoDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(0);
  const [paymentTermsLabel, setPaymentTermsLabel] = useState("Due on Receipt");
  const [shipmentPreference, setShipmentPreference] = useState("");
  const [taxType, setTaxType] = useState("false");
  const [taxLevel, setTaxLevel] = useState("false");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lineItems, setLineItems] = useState([createEmptyRow()]);
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [validationErrors, setValidationErrors] = useState({});

  const loadPO = useCallback(async () => {
    if (!editPoId) return;
    try {
      setLoading(true);
      const po = await getPurchaseOrder(editPoId);
      setPoNumber(po.purchaseorder_number || "");
      setReferenceNumber(po.reference_number || "");
      setPoDate(po.date || dayjs().format("YYYY-MM-DD"));
      setDeliveryDate(po.delivery_date || "");
      setPaymentTerms(po.payment_terms || 0);
      setPaymentTermsLabel(po.payment_terms_label || "Due on Receipt");
      setShipmentPreference(po.ship_via || "");
      setTaxType(po.is_inclusive_tax ? "true" : "false");
      setNotes(po.notes || "");
      setTerms(po.terms || "");
      setAdjustmentValue(String(po.adjustment || 0));

      if (po.line_items?.length) {
        setLineItems(po.line_items.map((li) => ({
          item_id: li.item_id || "", name: li.name || "", account_id: li.account_id || "",
          quantity: li.quantity || 1, rate: li.rate || 0, tax_id: li.tax_id || "",
          description: li.description || "", line_item_id: li.line_item_id || "",
        })));
      }
    } catch (err) {
      setError("Failed to load purchase order: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [editPoId]);

  useEffect(() => { loadPO(); }, [loadPO]);

  const handlePaymentTermsChange = (val) => {
    const n = parseInt(val, 10);
    setPaymentTerms(n);
    const f = PAYMENT_TERMS.find((pt) => pt.value === n);
    setPaymentTermsLabel(f ? f.label : `Net ${n}`);
  };

  const validate = () => {
    const e = {};
    if (!poNumber.trim()) e.poNumber = "Purchase Order number is required.";
    if (!poDate) e.poDate = "Date is required.";
    if (!lineItems.some((r) => r.item_id && parseFloat(r.quantity) > 0 && parseFloat(r.rate) > 0))
      e.lineItems = "At least one valid line item is required.";
    setValidationErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (status) => {
    if (!validate()) return;
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
        ship_via: shipmentPreference || undefined,
        is_inclusive_tax: taxType === "true",
        is_item_level_tax_calc: taxLevel === "true",
        notes, terms,
        line_items: lineItems.filter((r) => r.item_id || r.name).map((r, i) => ({
          ...(r.line_item_id ? { line_item_id: r.line_item_id } : {}),
          item_id: r.item_id || undefined, name: r.name || undefined,
          account_id: r.account_id || undefined, description: r.description || undefined,
          quantity: parseFloat(r.quantity) || 1, rate: parseFloat(r.rate) || 0,
          tax_id: r.tax_id || undefined, item_order: i + 1,
        })),
      };

      const discNum = parseFloat(discountValue) || 0;
      if (discNum > 0) payload.discount = discountType === "percent" ? `${discNum}%` : discNum;
      const adj = parseFloat(adjustmentValue) || 0;
      if (adj !== 0) { payload.adjustment = adj; payload.adjustment_description = adj > 0 ? "Adjustment (add)" : "Adjustment (deduct)"; }

      if (isEdit) {
        await updatePurchaseOrder(editPoId, payload);
        setSnackbar({ open: true, message: "Purchase Order updated!", severity: "success" });
      } else {
        await createPurchaseOrder(payload, status);
        setSnackbar({ open: true, message: "Purchase Order created!", severity: "success" });
      }
      setTimeout(() => onBack(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>{isEdit ? "Edit Purchase Order" : "New Purchase Order"}</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: "1px solid #e0e0e0", borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField label="Purchase Order#" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
              fullWidth size="small" error={!!validationErrors.poNumber} helperText={validationErrors.poNumber} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Reference#" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} fullWidth size="small" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Shipment Preference" value={shipmentPreference} onChange={(e) => setShipmentPreference(e.target.value)}
              fullWidth size="small" placeholder="e.g. FedEx, DHL" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Date" type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)}
              fullWidth size="small" InputLabelProps={{ shrink: true }} error={!!validationErrors.poDate} helperText={validationErrors.poDate} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Delivery Date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
              fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Payment Terms" select value={paymentTerms} onChange={(e) => handlePaymentTermsChange(e.target.value)} fullWidth size="small">
              {PAYMENT_TERMS.map((pt) => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField select label="Tax Type" value={taxType} onChange={(e) => setTaxType(e.target.value)} fullWidth size="small">
              <MenuItem value="false">Exclusive</MenuItem><MenuItem value="true">Inclusive</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField select label="Tax Level" value={taxLevel} onChange={(e) => setTaxLevel(e.target.value)} fullWidth size="small">
              <MenuItem value="true">Item Level</MenuItem><MenuItem value="false">Transaction</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {validationErrors.lineItems && <Alert severity="error" sx={{ mb: 1 }}>{validationErrors.lineItems}</Alert>}
      <LineItemTable lineItems={lineItems} setLineItems={setLineItems} items={items} taxes={taxes} accounts={accounts} />

      <TotalsSection lineItems={lineItems} taxes={taxes} discountValue={discountValue} setDiscountValue={setDiscountValue}
        discountType={discountType} setDiscountType={setDiscountType} adjustmentValue={adjustmentValue}
        setAdjustmentValue={setAdjustmentValue} isInclusiveTax={taxType === "true"} isItemLevelTax={taxLevel === "true"} />

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid #e0e0e0", borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Notes" multiline rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              fullWidth size="small" placeholder="Displayed on purchase order" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Terms & Conditions" multiline rows={2} value={terms} onChange={(e) => setTerms(e.target.value)}
              fullWidth size="small" placeholder="Terms and conditions" />
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", mb: 4 }}>
        <Button variant="outlined" onClick={onBack} disabled={submitting}>Cancel</Button>
        {isEdit ? (
          <Button variant="contained" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => handleSubmit()} disabled={submitting}>{submitting ? "Saving..." : "Update PO"}</Button>
        ) : (<>
          <Button variant="contained" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => handleSubmit("draft")} disabled={submitting}>{submitting ? "Saving..." : "Save as Draft"}</Button>
          <Button variant="contained" color="success" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={() => handleSubmit("open")} disabled={submitting}>{submitting ? "Saving..." : "Save as Open"}</Button>
        </>)}
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
