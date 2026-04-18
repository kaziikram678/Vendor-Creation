import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, TextField, MenuItem, Typography, Button, Alert, CircularProgress,
  Snackbar, Paper, IconButton, Stepper, Step, StepLabel, Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityIcon from "@mui/icons-material/Visibility";
import dayjs from "dayjs";

import LineItemTable, { createEmptyRow } from "./LineItemTable";
import TotalsSection from "./TotalsSection";
import CustomFieldsSection, { customFieldsToPayload, customFieldsFromRecord } from "./CustomFieldsSection";
import { getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder } from "../services/zohoService";

const PAYMENT_TERMS = [
  { value: 0, label: "Due on Receipt" }, { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" }, { value: 45, label: "Net 45" }, { value: 60, label: "Net 60" },
];

const STEPS = ["Basic Info", "Items", "Totals & Notes"];

export default function PurchaseOrderForm({
  vendor, items, taxes, accounts, editPoId, onBack, readOnly = false, customFieldsMeta = [],
}) {
  const isEdit = !!editPoId;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [step, setStep] = useState(0);
  const [poStatus, setPoStatus] = useState("");

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
  const [discountAccountId, setDiscountAccountId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [customValues, setCustomValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  const loadPO = useCallback(async () => {
    if (!editPoId) return;
    try {
      setLoading(true);
      const po = await getPurchaseOrder(editPoId);
      setPoStatus(po.status || "");
      setPoNumber(po.purchaseorder_number || "");
      setReferenceNumber(po.reference_number || "");
      setPoDate(po.date || dayjs().format("YYYY-MM-DD"));
      setDeliveryDate(po.delivery_date || "");
      setPaymentTerms(po.payment_terms || 0);
      setPaymentTermsLabel(po.payment_terms_label || "Due on Receipt");
      setShipmentPreference(po.ship_via || "");
      setTaxType(po.is_inclusive_tax ? "true" : "false");
      setTaxLevel(po.is_item_level_tax_calc ? "true" : "false");
      setNotes(po.notes || "");
      setTerms(po.terms || "");
      setAdjustmentValue(String(po.adjustment || 0));

      const disc = po.discount || 0;
      const discStr = String(disc).replace("%", "");
      setDiscountValue(discStr === "0" ? "0" : discStr);
      if (String(disc).includes("%")) setDiscountType("percent");
      else if (disc && !String(disc).includes("%")) setDiscountType("amount");
      setDiscountAccountId(po.discount_account_id || "");

      setCustomValues(customFieldsFromRecord(customFieldsMeta, po));

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
  }, [editPoId, customFieldsMeta]);

  useEffect(() => { loadPO(); }, [loadPO]);

  const handlePaymentTermsChange = (val) => {
    const n = parseInt(val, 10);
    setPaymentTerms(n);
    const f = PAYMENT_TERMS.find((pt) => pt.value === n);
    setPaymentTermsLabel(f ? f.label : `Net ${n}`);
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!poNumber.trim()) e.poNumber = "Purchase Order number is required.";
      if (!poDate) e.poDate = "Date is required.";
      if (deliveryDate && dayjs(deliveryDate).isBefore(dayjs(poDate)))
        e.deliveryDate = "Delivery date cannot be before PO date.";
    }
    if (s === 1) {
      if (!lineItems.some((r) => r.item_id && parseFloat(r.quantity) > 0 && parseFloat(r.rate) > 0))
        e.lineItems = "At least one valid line item is required.";
    }
    if (s === 2) {
      if ((parseFloat(discountValue) || 0) > 0 && !discountAccountId)
        e.discountAccount = "Please select a discount account.";
    }
    setValidationErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (status) => {
    for (let i = 0; i <= 2; i++) {
      if (!validateStep(i)) { setStep(i); return; }
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

      const cfPayload = customFieldsToPayload(customFieldsMeta, customValues);
      if (cfPayload.length) payload.custom_fields = cfPayload;

      const discNum = parseFloat(discountValue) || 0;
      if (discNum > 0) {
        payload.discount = discountType === "percent" ? `${discNum}%` : discNum;
        if (discountAccountId) payload.discount_account_id = discountAccountId;
      }
      const adj = parseFloat(adjustmentValue) || 0;
      if (adj !== 0) { payload.adjustment = adj; payload.adjustment_description = adj > 0 ? "Adjustment (add)" : "Adjustment (deduct)"; }

      if (isEdit) {
        await updatePurchaseOrder(editPoId, payload);
        setSnackbar({ open: true, message: "Purchase Order updated!", severity: "success" });
      } else {
        await createPurchaseOrder(payload, status);
        setSnackbar({ open: true, message: "Purchase Order created!", severity: "success" });
      }
      setTimeout(() => onBack(), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  const title = readOnly
    ? `View Purchase Order${poNumber ? ` • ${poNumber}` : ""}`
    : isEdit ? "Edit Purchase Order" : "New Purchase Order";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        {readOnly && <VisibilityIcon color="primary" />}
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        {readOnly && poStatus && (
          <Chip label={poStatus.replace(/_/g, " ")} size="small" color="success"
            sx={{ ml: 1, fontWeight: 600, textTransform: "capitalize" }} />
        )}
      </Box>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((l) => (<Step key={l}><StepLabel>{l}</StepLabel></Step>))}
        </Stepper>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", pr: 0.5 }}>
        {step === 0 && (
          <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Purchase Order#" required value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
                  fullWidth size="small" error={!!validationErrors.poNumber} helperText={validationErrors.poNumber}
                  InputProps={{ readOnly }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Reference#" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                  fullWidth size="small" InputProps={{ readOnly }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Shipment Preference" value={shipmentPreference} onChange={(e) => setShipmentPreference(e.target.value)}
                  fullWidth size="small" placeholder="e.g. FedEx, DHL" InputProps={{ readOnly }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Date" type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)}
                  fullWidth size="small" InputLabelProps={{ shrink: true }}
                  error={!!validationErrors.poDate} helperText={validationErrors.poDate}
                  InputProps={{ readOnly }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Delivery Date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                  fullWidth size="small" InputLabelProps={{ shrink: true }}
                  inputProps={{ min: poDate }}
                  error={!!validationErrors.deliveryDate} helperText={validationErrors.deliveryDate}
                  InputProps={{ readOnly }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Payment Terms" select value={paymentTerms}
                  onChange={(e) => handlePaymentTermsChange(e.target.value)}
                  fullWidth size="small" disabled={readOnly}>
                  {PAYMENT_TERMS.map((pt) => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField select label="Tax Type" value={taxType} onChange={(e) => setTaxType(e.target.value)}
                  fullWidth size="small" disabled={readOnly}>
                  <MenuItem value="false">Exclusive</MenuItem><MenuItem value="true">Inclusive</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField select label="Tax Level" value={taxLevel} onChange={(e) => setTaxLevel(e.target.value)}
                  fullWidth size="small" disabled={readOnly}>
                  <MenuItem value="true">Item Level</MenuItem><MenuItem value="false">Transaction</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Paper>
        )}

        {step === 1 && (
          <>
            {validationErrors.lineItems && <Alert severity="error" sx={{ mb: 1 }}>{validationErrors.lineItems}</Alert>}
            <Box sx={{ pointerEvents: readOnly ? "none" : "auto", opacity: readOnly ? 0.85 : 1 }}>
              <LineItemTable lineItems={lineItems} setLineItems={setLineItems} items={items} taxes={taxes} accounts={accounts} />
            </Box>
          </>
        )}

        {step === 2 && (
          <>
            <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TextField label="Notes" multiline minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                      fullWidth size="small" placeholder="Displayed on purchase order"
                      InputProps={{ readOnly }} />
                    <TextField label="Terms & Conditions" multiline minRows={3} value={terms} onChange={(e) => setTerms(e.target.value)}
                      fullWidth size="small" placeholder="Terms and conditions"
                      InputProps={{ readOnly }} />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TotalsSection lineItems={lineItems} taxes={taxes}
                    discountValue={discountValue} setDiscountValue={setDiscountValue}
                    discountType={discountType} setDiscountType={setDiscountType}
                    adjustmentValue={adjustmentValue} setAdjustmentValue={setAdjustmentValue}
                    isInclusiveTax={taxType === "true"} isItemLevelTax={taxLevel === "true"}
                    accounts={accounts} discountAccountId={discountAccountId} setDiscountAccountId={setDiscountAccountId}
                    readOnly={readOnly} />
                </Grid>
              </Grid>
            </Paper>

            <CustomFieldsSection customFields={customFieldsMeta} values={customValues}
              setValues={setCustomValues} readOnly={readOnly} />
          </>
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "space-between", pt: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Button variant="outlined" onClick={onBack} disabled={submitting}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {step > 0 && (
            <Button variant="outlined" onClick={handleBack} startIcon={<ArrowBackIcon />} disabled={submitting}>Back</Button>
          )}
          {step < STEPS.length - 1 && (
            <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />} disabled={submitting}>Next</Button>
          )}
          {step === STEPS.length - 1 && !readOnly && (
            isEdit ? (
              <Button variant="contained" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={() => handleSubmit()} disabled={submitting}>{submitting ? "Saving..." : "Update PO"}</Button>
            ) : (<>
              <Button variant="outlined" color="primary"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={() => handleSubmit("draft")} disabled={submitting}>
                {submitting ? "Saving..." : "Save as Draft"}
              </Button>
              <Button variant="contained" color="success"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={() => handleSubmit("open")} disabled={submitting}>
                {submitting ? "Saving..." : "Save as Open"}
              </Button>
            </>)
          )}
        </Box>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
