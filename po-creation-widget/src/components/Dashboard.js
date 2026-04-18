import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Paper, IconButton, Tooltip, Snackbar, Popover, Link,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

import PurchaseOrderForm from "./PurchaseOrderForm";
import ConvertToBillForm from "./ConvertToBillForm";
import {
  getCurrentVendor, fetchItems, fetchTaxes, fetchChartOfAccounts, fetchCustomFields,
  listPurchaseOrders, deletePurchaseOrder, markPoAsIssued, getPurchaseOrder,
  getLocallyBilledPoIds,
} from "../services/zohoService";

const STATUS_COLORS = {
  draft: "default", open: "primary", issued: "info", billed: "success",
  cancelled: "default", closed: "default", partially_paid: "warning", paid: "success",
};

const BILLED_STATUSES = new Set(["billed", "closed"]);

function StatusChip({ status }) {
  const label = (status || "unknown").replace(/_/g, " ");
  return (
    <Chip label={label} size="small" color={STATUS_COLORS[status] || "default"}
      sx={{ fontWeight: 600, fontSize: 11, textTransform: "capitalize" }} />
  );
}

export default function Dashboard({ entityId, mode = "light", onToggleMode = () => {} }) {
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [convertPoId, setConvertPoId] = useState(null);

  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [pos, setPos] = useState([]);
  const [poCustomFields, setPoCustomFields] = useState([]);
  const [billCustomFields, setBillCustomFields] = useState([]);
  const [locallyBilled, setLocallyBilled] = useState(() => new Set());

  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

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

      const [it, tx, ac, poCf, billCf] = await Promise.allSettled([
        fetchItems(), fetchTaxes(), fetchChartOfAccounts(),
        fetchCustomFields("purchaseorder"), fetchCustomFields("bill"),
      ]);
      if (it.status === "fulfilled") setItems(it.value);
      if (tx.status === "fulfilled") setTaxes(tx.value);
      if (ac.status === "fulfilled") setAccounts(ac.value);
      if (poCf.status === "fulfilled") setPoCustomFields(poCf.value);
      if (billCf.status === "fulfilled") setBillCustomFields(billCf.value);

      setLocallyBilled(getLocallyBilledPoIds(v.booksVendorId));
      await loadPOs(v.booksVendorId);
    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const loadPOs = async (vendorId) => {
    const vid = vendorId || vendor?.booksVendorId;
    if (!vid) return;
    setListLoading(true);
    try {
      const p = await listPurchaseOrders(vid);
      setPos(p);
      setLocallyBilled(getLocallyBilledPoIds(vid));
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to refresh purchase orders.", severity: "error" });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deletePurchaseOrder(deleteConfirm.purchaseorder_id);
      setSnackbar({ open: true, message: `Purchase Order "${deleteConfirm.purchaseorder_number}" deleted.`, severity: "success" });
      setDeleteConfirm(null);
      await loadPOs();
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to delete purchase order: " + err.message, severity: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const [issueConfirm, setIssueConfirm] = useState(null);
  const [issuing, setIssuing] = useState(false);

  const handleMarkAsIssued = async () => {
    if (!issueConfirm) return;
    setIssuing(true);
    try {
      await markPoAsIssued(issueConfirm.purchaseorder_id);
      setSnackbar({ open: true, message: `Purchase Order "${issueConfirm.purchaseorder_number}" marked as issued.`, severity: "success" });
      setIssueConfirm(null);
      await loadPOs();
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to mark as issued: " + err.message, severity: "error" });
    } finally {
      setIssuing(false);
    }
  };

  const [billsAnchor, setBillsAnchor] = useState(null);
  const [billsList, setBillsList] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);

  const handleViewBills = async (event, poId) => {
    setBillsAnchor(event.currentTarget);
    setBillsLoading(true);
    try {
      const po = await getPurchaseOrder(poId);
      setBillsList(po.bills || []);
    } catch {
      setBillsList([]);
    } finally {
      setBillsLoading(false);
    }
  };

  const openPoForm = (id = null, readOnly = false) => {
    setEditId(id);
    setViewOnlyMode(readOnly);
    setView("po-form");
  };
  const openConvertToBill = (poId) => { setConvertPoId(poId); setView("convert-to-bill"); };
  const backToList = () => {
    setView("list"); setEditId(null); setViewOnlyMode(false); setConvertPoId(null);
    loadPOs();
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 2 }}>
        <CircularProgress size={36} />
        <Typography color="text.secondary">Loading Purchase Order data...</Typography>
      </Box>
    );
  }

  if (view === "po-form") {
    return (
      <PageShell>
        <PurchaseOrderForm vendor={vendor} items={items} taxes={taxes} accounts={accounts}
          editPoId={editId} onBack={backToList} readOnly={viewOnlyMode}
          customFieldsMeta={poCustomFields}
          mode={mode} onToggleMode={onToggleMode} />
      </PageShell>
    );
  }
  if (view === "convert-to-bill") {
    return (
      <PageShell>
        <ConvertToBillForm vendor={vendor} items={items} taxes={taxes} accounts={accounts}
          poId={convertPoId} onBack={backToList} billCustomFieldsMeta={billCustomFields}
          mode={mode} onToggleMode={onToggleMode} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Paper elevation={0} sx={{
        p: 2.5, mb: 2, borderRadius: 3,
        background: "linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%)",
        color: "#fff",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={800}>{vendor?.vendorName}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
              Zoho Books &middot; Purchase Orders
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            <Tooltip title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              <IconButton onClick={onToggleMode} sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.15)", "&:hover": { bgcolor: "rgba(255,255,255,0.25)" } }}>
                {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<ShoppingCartIcon />}
              onClick={() => openPoForm()}
              sx={{ bgcolor: "#fff", color: "#1565c0", fontWeight: 700, "&:hover": { bgcolor: "#e3f2fd" }, textTransform: "none" }}>
              New Purchase Order
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper elevation={0} sx={{
        border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden",
        flex: 1, display: "flex", flexDirection: "column", bgcolor: "background.paper",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ShoppingCartIcon sx={{ fontSize: 20, color: "#1565c0" }} />
            <Typography fontWeight={700} fontSize={14}>Purchase Orders ({pos.length})</Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => loadPOs()} disabled={listLoading}>
              {listLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer sx={{ flex: 1, overflowY: "auto" }}>
          {pos.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <ShoppingCartIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">No purchase orders found for this vendor.</Typography>
              <Button variant="text" startIcon={<AddIcon />} onClick={() => openPoForm()} sx={{ mt: 1, textTransform: "none" }}>
                Create your first purchase order
              </Button>
            </Box>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: "surface.main" }}>
                  <TableCell sx={thStyle}>Date</TableCell>
                  <TableCell sx={thStyle}>PO#</TableCell>
                  <TableCell sx={thStyle}>Reference</TableCell>
                  <TableCell sx={thStyle}>Status</TableCell>
                  <TableCell sx={thStyle}>Delivery Date</TableCell>
                  <TableCell sx={thStyle} align="right">Total</TableCell>
                  <TableCell sx={{ ...thStyle, width: 160 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {pos.map((p) => {
                  const isBilled = BILLED_STATUSES.has(p.status) || locallyBilled.has(p.purchaseorder_id);
                  const displayStatus = isBilled ? "billed" : p.status;
                  return (
                    <TableRow key={p.purchaseorder_id} hover sx={{ "&:hover": { bgcolor: "surface.hover" } }}>
                      <TableCell sx={tdStyle}>{p.date}</TableCell>
                      <TableCell sx={{ ...tdStyle, fontWeight: 600, color: "#1565c0", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                        onClick={() => window.open(`https://books.zoho.com/app/771340721#/purchaseorders/${p.purchaseorder_id}`, "_blank")}>{p.purchaseorder_number}</TableCell>
                      <TableCell sx={tdStyle}>{p.reference_number || "—"}</TableCell>
                      <TableCell><StatusChip status={displayStatus} /></TableCell>
                      <TableCell sx={tdStyle}>{p.delivery_date || "—"}</TableCell>
                      <TableCell sx={tdStyle} align="right">{formatCurrency(p.total)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {isBilled && (
                            <Tooltip title="View Bills">
                              <IconButton size="small" color="primary" onClick={(e) => handleViewBills(e, p.purchaseorder_id)}>
                                <ReceiptLongIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isBilled && p.status === "draft" && (
                            <Tooltip title="Mark as Issued">
                              <IconButton size="small" color="info" onClick={() => setIssueConfirm(p)}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isBilled && (p.status === "issued" || p.status === "open") && (
                            <Tooltip title="Convert to Bill">
                              <IconButton size="small" color="success" onClick={() => openConvertToBill(p.purchaseorder_id)}>
                                <ReceiptLongIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isBilled ? (
                            <Tooltip title="View Purchase Order">
                              <IconButton size="small" color="primary" onClick={() => openPoForm(p.purchaseorder_id, true)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Edit Purchase Order">
                              <IconButton size="small" color="primary" onClick={() => openPoForm(p.purchaseorder_id, false)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isBilled && (
                            <Tooltip title="Delete Purchase Order">
                              <IconButton size="small" color="error" onClick={() => setDeleteConfirm(p)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>

      <Dialog open={!!issueConfirm} onClose={() => !issuing && setIssueConfirm(null)}>
        <DialogTitle>Mark as Issued</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Mark purchase order <strong>"{issueConfirm?.purchaseorder_number}"</strong> as issued? This will change its status from Draft to Issued.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueConfirm(null)} disabled={issuing}>Cancel</Button>
          <Button onClick={handleMarkAsIssued} color="info" variant="contained" disabled={issuing}
            startIcon={issuing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}>
            {issuing ? "Processing..." : "Mark as Issued"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => !deleting && setDeleteConfirm(null)}>
        <DialogTitle>Delete Purchase Order</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete purchase order <strong>"{deleteConfirm?.purchaseorder_number}"</strong>? This will permanently remove it from Zoho Books and cannot be undone.
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

      <Popover
        open={!!billsAnchor}
        anchorEl={billsAnchor}
        onClose={() => setBillsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Bills</Typography>
          {billsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={20} /></Box>
          ) : billsList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No bills linked to this purchase order.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Bill#</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {billsList.map((bill) => (
                  <TableRow key={bill.bill_id} hover>
                    <TableCell>
                      <Link
                        component="button"
                        variant="body2"
                        sx={{ fontWeight: 600, cursor: "pointer" }}
                        onClick={() => window.open(`https://books.zoho.com/app/771340721#/bills/${bill.bill_id}`, "_blank")}
                      >
                        {bill.bill_number}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{bill.date}</TableCell>
                    <TableCell><StatusChip status={bill.status} /></TableCell>
                    <TableCell align="right" sx={{ fontSize: 12 }}>{formatCurrency(bill.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Popover>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <Box sx={{
      height: "100vh", width: "100%",
      display: "flex", flexDirection: "column",
      p: 2, boxSizing: "border-box",
      maxWidth: 1400, mx: "auto",
    }}>
      {children}
    </Box>
  );
}

const thStyle = { fontWeight: 700, fontSize: 11, color: "text.secondary", letterSpacing: 0.5, py: 1.2, bgcolor: "surface.main" };
const tdStyle = { fontSize: 13, py: 1.2 };

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
