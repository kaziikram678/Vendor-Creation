import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, TextField, MenuItem, Typography, Button, Alert, CircularProgress,
  Snackbar, Paper, IconButton, ButtonGroup, Popper, Grow, ClickAwayListener,
  MenuList, Stepper, Step, StepLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";

import LineItemTable, { createEmptyRow } from "./LineItemTable";
import TotalsSection from "./TotalsSection";
import CustomFieldsSection, { customFieldsToPayload, customFieldsFromRecord } from "./CustomFieldsSection";
import { getBill, createBill, updateBill, submitBillForApproval, approveBill, uploadBillAttachment, deleteBillAttachment } from "../services/zohoService";
import AttachmentsSection from "./AttachmentsSection";

const PAYMENT_TERMS = [
  { value: 0, label: "Due on Receipt" }, { value: 15, label: "Net 15" },
  { value: 30, label: "Net 30" }, { value: 45, label: "Net 45" }, { value: 60, label: "Net 60" },
];

const STEPS = ["Basic Info", "Items", "Totals & Notes", "Attachments"];

export default function BillForm({
  vendor, items, taxes, accounts, editBillId, onBack, customFieldsMeta = [],
}) {
  const isEdit = !!editBillId;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [step, setStep] = useState(0);

  const [billNumber, setBillNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [billDate, setBillDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dueDate, setDueDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentTerms, setPaymentTerms] = useState(0);
  const [paymentTermsLabel, setPaymentTermsLabel] = useState("Due on Receipt");
  const [taxType, setTaxType] = useState("false");
  const [taxLevel, setTaxLevel] = useState("true");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState([createEmptyRow()]);
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent");
  const [discountAccountId, setDiscountAccountId] = useState("");
  const [adjustmentValue, setAdjustmentValue] = useState("0");
  const [customValues, setCustomValues] = useState({});
  const [editStatus, setEditStatus] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);

  const loadBill = useCallback(async () => {
    if (!editBillId) return;
    try {
      setLoading(true);
      const bill = await getBill(editBillId);
      setEditStatus(bill.status || "");
      setBillNumber(bill.bill_number || "");
      setOrderNumber(bill.reference_number || "");
      setBillDate(bill.date || dayjs().format("YYYY-MM-DD"));
      setDueDate(bill.due_date || "");
      setPaymentTerms(bill.payment_terms || 0);
      setPaymentTermsLabel(bill.payment_terms_label || "Due on Receipt");
      setTaxType(bill.is_inclusive_tax ? "true" : "false");
      setTaxLevel(bill.is_item_level_tax_calc ? "true" : "false");
      setNotes(bill.notes || "");
      setAdjustmentValue(String(bill.adjustment || 0));

      const disc = bill.discount || 0;
      const discStr = String(disc).replace("%", "");
      setDiscountValue(discStr === "0" ? "0" : discStr);
      if (String(disc).includes("%")) setDiscountType("percent");
      else if (disc && !String(disc).includes("%")) setDiscountType("amount");
      setDiscountAccountId(bill.discount_account_id || "");

      setCustomValues(customFieldsFromRecord(customFieldsMeta, bill));
      setAttachments(bill.documents || []);

      if (bill.line_items?.length) {
        setLineItems(bill.line_items.map((li) => ({
          item_id: li.item_id || "", name: li.name || "", account_id: li.account_id || "",
          quantity: li.quantity || 1, rate: li.rate || 0, tax_id: li.tax_id || "",
          description: li.description || "", line_item_id: li.line_item_id || "",
        })));
      }
    } catch (err) {
      setError("Failed to load bill: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [editBillId, customFieldsMeta]);

  useEffect(() => { loadBill(); }, [loadBill]);

  useEffect(() => {
    if (!isEdit && billDate && paymentTerms >= 0) {
      setDueDate(dayjs(billDate).add(paymentTerms, "day").format("YYYY-MM-DD"));
    }
  }, [billDate, paymentTerms, isEdit]);

  const handleAddFiles = (valid, oversized) => {
    if (oversized.length > 0) {
      setSnackbar({ open: true, message: `${oversized.length} file(s) exceed 10MB and were skipped.`, severity: "warning" });
    }
    setPendingFiles((prev) => {
      const remaining = 5 - attachments.length - prev.length;
      return [...prev, ...valid.slice(0, remaining)];
    });
  };

  const handleDeleteExisting = async (docId) => {
    try {
      await deleteBillAttachment(editBillId, docId);
      setAttachments((prev) => prev.filter((a) => a.doc_id !== docId));
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to delete attachment: " + err.message, severity: "error" });
    }
  };

  const handleDeletePending = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaymentTermsChange = (val) => {
    const n = parseInt(val, 10);
    setPaymentTerms(n);
    const f = PAYMENT_TERMS.find((pt) => pt.value === n);
    setPaymentTermsLabel(f ? f.label : `Net ${n}`);
  };

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!billNumber.trim()) e.billNumber = "Bill number is required.";
      if (!billDate) e.billDate = "Bill date is required.";
      if (dueDate && dayjs(dueDate).isBefore(dayjs(billDate)))
        e.dueDate = "Due date cannot be before bill date.";
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
  const handleBackStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async (action) => {
    for (let i = 0; i <= 2; i++) {
      if (!validateStep(i)) { setStep(i); return; }
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        vendor_id: vendor.booksVendorId,
        bill_number: billNumber.trim(),
        reference_number: orderNumber.trim(),
        date: billDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        payment_terms_label: paymentTermsLabel,
        is_inclusive_tax: taxType === "true",
        is_item_level_tax_calc: taxLevel === "true",
        notes,
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

      let savedBillId = editBillId;
      let successMessage = "";

      if (isEdit) {
        await updateBill(editBillId, payload);
        if (action === "submit" && editStatus === "draft") {
          await submitBillForApproval(editBillId);
          successMessage = "Bill updated and submitted for approval!";
        } else {
          successMessage = "Bill updated successfully!";
        }
      } else if (action === "submit") {
        const bill = await createBill(payload, "draft");
        savedBillId = bill.bill_id;
        await submitBillForApproval(savedBillId);
        successMessage = "Bill submitted for approval!";
      } else if (action === "approve") {
        const bill = await createBill(payload, "draft");
        savedBillId = bill.bill_id;
        await approveBill(savedBillId);
        successMessage = "Bill created and approved!";
      } else {
        const bill = await createBill(payload, action || "draft");
        savedBillId = bill.bill_id;
        successMessage = "Bill created successfully!";
      }

      if (pendingFiles.length > 0 && savedBillId) {
        let failed = 0;
        const errors = [];
        for (const file of pendingFiles) {
          try { await uploadBillAttachment(savedBillId, file, vendor.crmId); }
          catch (err) {
            console.error("[BillForm] attachment upload failed:", file.name, err.message);
            errors.push(file.name + ": " + err.message);
            failed++;
          }
        }
        if (failed > 0) successMessage += ` (${failed} attachment(s) failed to upload)`;
        if (errors.length) console.error("[BillForm] upload errors:", errors);
      }

      setSnackbar({ open: true, message: successMessage, severity: "success" });
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>{isEdit ? "Edit Bill" : "New Bill"}</Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((l) => (<Step key={l}><StepLabel>{l}</StepLabel></Step>))}
        </Stepper>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ flex: 1, overflowX: "hidden", pr: 0.5 }}>
        {step === 0 && (
          <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Bill#" required value={billNumber} onChange={(e) => setBillNumber(e.target.value)}
                  fullWidth size="small" error={!!validationErrors.billNumber} helperText={validationErrors.billNumber} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Order Number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Payment Terms" select value={paymentTerms} onChange={(e) => handlePaymentTermsChange(e.target.value)} fullWidth size="small">
                  {PAYMENT_TERMS.map((pt) => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Bill Date" type="date" required value={billDate} onChange={(e) => setBillDate(e.target.value)}
                  fullWidth size="small" InputLabelProps={{ shrink: true }} error={!!validationErrors.billDate} helperText={validationErrors.billDate} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  fullWidth size="small" InputLabelProps={{ shrink: true }} inputProps={{ min: billDate }}
                  error={!!validationErrors.dueDate} helperText={validationErrors.dueDate} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField select label="Tax Type" value={taxType} onChange={(e) => setTaxType(e.target.value)} fullWidth size="small">
                  <MenuItem value="false">Exclusive</MenuItem><MenuItem value="true">Inclusive</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <TextField select label="Tax Level" value={taxLevel} onChange={(e) => setTaxLevel(e.target.value)} fullWidth size="small">
                  <MenuItem value="true">Item Level</MenuItem><MenuItem value="false">Transaction</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Paper>
        )}

        {step === 1 && (
          <>
            {validationErrors.lineItems && <Alert severity="error" sx={{ mb: 1 }}>{validationErrors.lineItems}</Alert>}
            <LineItemTable lineItems={lineItems} setLineItems={setLineItems} items={items} taxes={taxes} accounts={accounts} />
          </>
        )}

        {step === 2 && (
          <>
            <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Notes" multiline minRows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                    fullWidth size="small" placeholder="Notes (not shown in PDF)" />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TotalsSection lineItems={lineItems} taxes={taxes}
                    discountValue={discountValue} setDiscountValue={setDiscountValue}
                    discountType={discountType} setDiscountType={setDiscountType}
                    adjustmentValue={adjustmentValue} setAdjustmentValue={setAdjustmentValue}
                    isInclusiveTax={taxType === "true"} isItemLevelTax={taxLevel === "true"}
                    accounts={accounts} discountAccountId={discountAccountId} setDiscountAccountId={setDiscountAccountId} />
                </Grid>
              </Grid>
            </Paper>

            <CustomFieldsSection customFields={customFieldsMeta} values={customValues} setValues={setCustomValues} />
          </>
        )}

        {step === 3 && (
          <AttachmentsSection
            attachments={attachments}
            pendingFiles={pendingFiles}
            onAddFiles={handleAddFiles}
            onDeleteExisting={handleDeleteExisting}
            onDeletePending={handleDeletePending}
          />
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "space-between", pt: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Button variant="outlined" onClick={onBack} disabled={submitting}>Cancel</Button>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {step > 0 && (
            <Button variant="outlined" onClick={handleBackStep} startIcon={<ArrowBackIcon />} disabled={submitting}>Back</Button>
          )}
          {step < STEPS.length - 1 && (
            <Button variant="contained" onClick={handleNext} endIcon={<ArrowForwardIcon />} disabled={submitting}>Next</Button>
          )}
          {step === STEPS.length - 1 && (
            isEdit ? (
              <EditBillActions submitting={submitting} onSubmit={handleSubmit} canSubmitForApproval={editStatus === "draft"} />
            ) : (
              <CreateBillActions submitting={submitting} onSubmit={handleSubmit} />
            )
          )}
        </Box>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function CreateBillActions({ submitting, onSubmit }) {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
  const options = [
    { label: "Save and Submit", status: "submit" },
    { label: "Save and Approve", status: "approve" },
  ];
  const [selectedIdx, setSelectedIdx] = React.useState(0);

  return (
    <>
      <Button variant="outlined"
        startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        onClick={() => onSubmit("draft")} disabled={submitting}>
        {submitting ? "Saving..." : "Save as Draft"}
      </Button>
      <ButtonGroup variant="contained" color="primary" ref={anchorRef} disabled={submitting}>
        <Button
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={() => onSubmit(options[selectedIdx].status)}>
          {submitting ? "Saving..." : options[selectedIdx].label}
        </Button>
        <Button size="small" onClick={() => setOpen((prev) => !prev)}>
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef.current} transition placement="top-end" sx={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps}>
            <Paper elevation={4}>
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList>
                  {options.map((opt, idx) => (
                    <MenuItem key={opt.label} selected={idx === selectedIdx}
                      onClick={() => { setSelectedIdx(idx); setOpen(false); }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}

function EditBillActions({ submitting, onSubmit, canSubmitForApproval }) {
  return (
    <>
      <Button variant="outlined"
        startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        onClick={() => onSubmit("update")} disabled={submitting}>
        {submitting ? "Saving..." : "Update Bill"}
      </Button>
      {canSubmitForApproval && (
        <Button variant="contained" color="primary"
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={() => onSubmit("submit")} disabled={submitting}>
          {submitting ? "Saving..." : "Submit for Approval"}
        </Button>
      )}
    </>
  );
}
