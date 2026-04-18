import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, TextField, MenuItem, Typography, Button, Alert, CircularProgress,
  Snackbar, Paper, IconButton, Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PaymentIcon from "@mui/icons-material/Payment";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";

import { getBill, recordBillPayment, fetchPaidThroughAccounts } from "../services/zohoService";

const PAYMENT_MODES = [
  "Cash", "Bank Transfer", "Check", "Credit Card", "Bank Remittance", "Online Payment", "Others",
];

export default function RecordPaymentForm({ billId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Bill info
  const [bill, setBill] = useState(null);

  // Paid through accounts
  const [paidThroughAccounts, setPaidThroughAccounts] = useState([]);

  // Form fields
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paidThroughAccountId, setPaidThroughAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bankCharges, setBankCharges] = useState("");
  const [notes, setNotes] = useState("");

  // Validation
  const [validationErrors, setValidationErrors] = useState({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [billData, accountsData] = await Promise.allSettled([
        getBill(billId),
        fetchPaidThroughAccounts(),
      ]);

      if (billData.status === "fulfilled") {
        const b = billData.value;
        setBill(b);
        setAmount(String(b.balance || b.total || ""));
      } else {
        setError("Failed to load bill: " + billData.reason?.message);
      }

      if (accountsData.status === "fulfilled") {
        setPaidThroughAccounts(accountsData.value);
        if (accountsData.value.length > 0) {
          const pettyCash = accountsData.value.find((a) =>
            a.account_name.toLowerCase() === "petty cash"
          );
          setPaidThroughAccountId(
            pettyCash ? pettyCash.account_id : accountsData.value[0].account_id
          );
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useEffect(() => { loadData(); }, [loadData]);

  const validate = () => {
    const e = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = "Payment amount must be greater than 0.";
    if (amt > parseFloat(bill?.balance || bill?.total || 0)) e.amount = "Amount cannot exceed the balance due.";
    if (!paymentDate) e.paymentDate = "Payment date is required.";
    if (!paidThroughAccountId) e.paidThrough = "Paid through account is required.";
    setValidationErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        vendor_id: bill.vendor_id,
        amount: parseFloat(amount),
        payment_mode: paymentMode,
        date: paymentDate,
        paid_through_account_id: paidThroughAccountId,
      };
      if (paymentNumber.trim()) payload.payment_number = paymentNumber.trim();
      if (referenceNumber.trim()) payload.reference_number = referenceNumber.trim();
      if (notes.trim()) payload.description = notes.trim();
      const bc = parseFloat(bankCharges);
      if (bc > 0) payload.bank_charges = bc;

      await recordBillPayment(billId, payload);
      setSnackbar({ open: true, message: "Payment recorded successfully!", severity: "success" });
      setTimeout(() => onBack(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading bill details...</Typography>
      </Box>
    );
  }

  const balanceDue = parseFloat(bill?.balance || bill?.total || 0);

  return (
    <Box>
      {/* Title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        <PaymentIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Payment for {bill?.bill_number || "Bill"}</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Bill Summary */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "surface.main" }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Bill Number</Typography>
            <Typography fontWeight={600}>{bill?.bill_number}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Bill Date</Typography>
            <Typography>{bill?.date}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Bill Total</Typography>
            <Typography fontWeight={600}>{formatCurrency(bill?.total)}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">Balance Due</Typography>
            <Typography fontWeight={700} color="error.main">{formatCurrency(balanceDue)}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      {/* Payment Amount */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Payment Made *"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: "0.01" }}
              error={!!validationErrors.amount}
              helperText={validationErrors.amount}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Bank Charges (if any)"
              type="number"
              value={bankCharges}
              onChange={(e) => setBankCharges(e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: "0.01" }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Payment Details */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Payment Mode"
              select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              fullWidth
            >
              {PAYMENT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Paid Through *"
              select
              value={paidThroughAccountId}
              onChange={(e) => setPaidThroughAccountId(e.target.value)}
              fullWidth
              error={!!validationErrors.paidThrough}
              helperText={validationErrors.paidThrough}
            >
              {paidThroughAccounts.map((a) => (
                <MenuItem key={a.account_id} value={a.account_id}>{a.account_name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Payment Date *"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={!!validationErrors.paymentDate}
              helperText={validationErrors.paymentDate}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Payment #"
              value={paymentNumber}
              onChange={(e) => setPaymentNumber(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Reference #"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Notes */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
        <TextField
          label="Notes"
          multiline
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
        />
      </Paper>

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", mb: 4 }}>
        <Button variant="outlined" onClick={onBack} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSubmit}
          disabled={submitting || balanceDue <= 0}
        >
          {submitting ? "Saving..." : "Save as Paid"}
        </Button>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
