import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Paper, IconButton, Tooltip, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RefreshIcon from "@mui/icons-material/Refresh";

import BillForm from "./BillForm";
import RecordPaymentForm from "./RecordPaymentForm";
import {
  getCurrentVendor, fetchItems, fetchTaxes, fetchChartOfAccounts, listBills, deleteBill,
} from "../services/zohoService";

const STATUS_COLORS = {
  draft: "default", pending_approval: "warning", rejected: "error", open: "primary",
  paid: "success", overdue: "error", partially_paid: "warning", void: "default",
};

function StatusChip({ status }) {
  const label = (status || "unknown").replace(/_/g, " ");
  return (
    <Chip label={label} size="small" color={STATUS_COLORS[status] || "default"}
      sx={{ fontWeight: 600, fontSize: 11, textTransform: "capitalize" }} />
  );
}

export default function Dashboard({ entityId }) {
  const [view, setView] = useState("list"); // "list" | "bill-form" | "payment"
  const [editId, setEditId] = useState(null);
  const [paymentBillId, setPaymentBillId] = useState(null);

  // Data
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);

  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // -- Load vendor + reference data --
  const loadInitial = useCallback(async () => {
    try {
      setInitialLoading(true);
      setError(null);

      const v = await getCurrentVendor(entityId);
      setVendor(v);

      if (!v.booksVendorId) {
        setError("This vendor is not linked to Zoho Books. Please sync the vendor first.");
        setInitialLoading(false);
        return;
      }

      const [it, tx, ac] = await Promise.allSettled([fetchItems(), fetchTaxes(), fetchChartOfAccounts()]);
      if (it.status === "fulfilled") setItems(it.value);
      if (tx.status === "fulfilled") setTaxes(tx.value);
      if (ac.status === "fulfilled") setAccounts(ac.value);

      await loadBills(v.booksVendorId);
    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const loadBills = async (vendorId) => {
    const vid = vendorId || vendor?.booksVendorId;
    if (!vid) return;
    setListLoading(true);
    try {
      const b = await listBills(vid);
      setBills(b);
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to refresh bills.", severity: "error" });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // -- Delete --
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteBill(deleteConfirm.bill_id);
      setSnackbar({ open: true, message: `Bill "${deleteConfirm.bill_number}" deleted.`, severity: "success" });
      setDeleteConfirm(null);
      await loadBills();
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to delete bill: " + err.message, severity: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // -- Navigation --
  const openBillForm = (id = null) => { setEditId(id); setView("bill-form"); };
  const openPayment = (billId) => { setPaymentBillId(billId); setView("payment"); };
  const backToList = () => { setView("list"); setEditId(null); setPaymentBillId(null); loadBills(); };

  // -- Loading screen --
  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 2 }}>
        <CircularProgress size={36} />
        <Typography color="text.secondary">Loading Bill data...</Typography>
      </Box>
    );
  }

  // -- Form views --
  if (view === "bill-form") {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
        <BillForm vendor={vendor} items={items} taxes={taxes} accounts={accounts} editBillId={editId} onBack={backToList} />
      </Box>
    );
  }
  if (view === "payment") {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", p: 2 }}>
        <RecordPaymentForm billId={paymentBillId} onBack={backToList} />
      </Box>
    );
  }

  // -- Dashboard list view --
  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 2 }}>
      {/* Header */}
      <Paper elevation={0} sx={{
        p: 2.5, mb: 3, borderRadius: 3,
        background: "linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%)",
        color: "#fff",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>{vendor?.vendorName}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
              Zoho Books &middot; Bills
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="contained" startIcon={<ReceiptLongIcon />}
              onClick={() => openBillForm()}
              sx={{ bgcolor: "#fff", color: "#1565c0", fontWeight: 700, "&:hover": { bgcolor: "#e3f2fd" }, textTransform: "none" }}>
              New Bill
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Bills Table */}
      <Paper elevation={0} sx={{ border: "1px solid #e0e0e0", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: "1px solid #e0e0e0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ReceiptLongIcon sx={{ fontSize: 20, color: "#1565c0" }} />
            <Typography fontWeight={700} fontSize={14}>Bills ({bills.length})</Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => loadBills()} disabled={listLoading}>
              {listLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer>
          {bills.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <ReceiptLongIcon sx={{ fontSize: 48, color: "#ccc", mb: 1 }} />
              <Typography color="text.secondary">No bills found for this vendor.</Typography>
              <Button variant="text" startIcon={<AddIcon />} onClick={() => openBillForm()} sx={{ mt: 1, textTransform: "none" }}>
                Create your first bill
              </Button>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8f9fb" }}>
                  <TableCell sx={thStyle}>Date</TableCell>
                  <TableCell sx={thStyle}>Bill#</TableCell>
                  <TableCell sx={thStyle}>Reference</TableCell>
                  <TableCell sx={thStyle}>Status</TableCell>
                  <TableCell sx={thStyle}>Due Date</TableCell>
                  <TableCell sx={thStyle} align="right">Total</TableCell>
                  <TableCell sx={thStyle} align="right">Balance</TableCell>
                  <TableCell sx={{ ...thStyle, width: 120 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.bill_id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" }, cursor: "pointer" }}>
                    <TableCell sx={tdStyle}>{b.date}</TableCell>
                    <TableCell sx={{ ...tdStyle, fontWeight: 600, color: "#1565c0", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                      onClick={() => window.open(`https://books.zoho.com/app/771340721#/bills/${b.bill_id}`, "_blank")}>{b.bill_number}</TableCell>
                    <TableCell sx={tdStyle}>{b.reference_number || "—"}</TableCell>
                    <TableCell><StatusChip status={b.status} /></TableCell>
                    <TableCell sx={tdStyle}>{b.due_date}</TableCell>
                    <TableCell sx={tdStyle} align="right">{formatCurrency(b.total)}</TableCell>
                    <TableCell sx={tdStyle} align="right">{formatCurrency(b.balance)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {(b.status === "open" || b.status === "partially_paid" || b.status === "overdue") && (
                          <Tooltip title="Record Payment">
                            <IconButton size="small" color="success" onClick={() => openPayment(b.bill_id)}>
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit Bill">
                          <IconButton size="small" color="primary" onClick={() => openBillForm(b.bill_id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Bill">
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirm(b)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => !deleting && setDeleteConfirm(null)}>
        <DialogTitle>Delete Bill</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete bill <strong>"{deleteConfirm?.bill_number}"</strong>? This will permanently remove it from Zoho Books and cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

const thStyle = { fontWeight: 700, fontSize: 11, color: "#5f6368", letterSpacing: 0.5, py: 1.2 };
const tdStyle = { fontSize: 13, py: 1.2 };

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
