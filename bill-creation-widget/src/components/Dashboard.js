import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Paper, IconButton, Tooltip, Snackbar,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import RefreshIcon from "@mui/icons-material/Refresh";

import BillForm from "./BillForm";
import PurchaseOrderForm from "./PurchaseOrderForm";
import {
  getCurrentVendor, fetchItems, fetchTaxes, fetchChartOfAccounts,
  listBills, listPurchaseOrders,
} from "../services/zohoService";

const STATUS_COLORS = {
  draft: "default", open: "primary", paid: "success", overdue: "error",
  partially_paid: "warning", void: "default", billed: "info", cancelled: "default",
};

function StatusChip({ status }) {
  const label = (status || "unknown").replace(/_/g, " ");
  return (
    <Chip label={label} size="small" color={STATUS_COLORS[status] || "default"}
      sx={{ fontWeight: 600, fontSize: 11, textTransform: "capitalize" }} />
  );
}

export default function Dashboard({ entityId }) {
  const [tab, setTab] = useState(0);
  const [view, setView] = useState("list"); // "list" | "bill-form" | "po-form"
  const [editId, setEditId] = useState(null);

  // Data
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [pos, setPos] = useState([]);

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

      // Load lists
      await loadLists(v.booksVendorId);
    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [entityId]);

  const loadLists = async (vendorId) => {
    const vid = vendorId || vendor?.booksVendorId;
    if (!vid) return;
    setListLoading(true);
    try {
      const [b, p] = await Promise.allSettled([listBills(vid), listPurchaseOrders(vid)]);
      if (b.status === "fulfilled") setBills(b.value);
      if (p.status === "fulfilled") setPos(p.value);
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to refresh lists.", severity: "error" });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // -- Navigation --
  const openBillForm = (id = null) => { setEditId(id); setView("bill-form"); };
  const openPoForm = (id = null) => { setEditId(id); setView("po-form"); };
  const backToList = () => { setView("list"); setEditId(null); loadLists(); };

  // -- Loading screen --
  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 2 }}>
        <CircularProgress size={36} />
        <Typography color="text.secondary">Loading vendor data...</Typography>
      </Box>
    );
  }

  // -- Form views --
  if (view === "bill-form") {
    return (
      <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
        <BillForm vendor={vendor} items={items} taxes={taxes} accounts={accounts} editBillId={editId} onBack={backToList} />
      </Box>
    );
  }
  if (view === "po-form") {
    return (
      <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
        <PurchaseOrderForm vendor={vendor} items={items} taxes={taxes} accounts={accounts} editPoId={editId} onBack={backToList} />
      </Box>
    );
  }

  // -- Dashboard list view --
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
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
              Zoho Books &middot; Bills & Purchase Orders
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="contained" startIcon={<ReceiptLongIcon />}
              onClick={() => openBillForm()}
              sx={{ bgcolor: "#fff", color: "#1565c0", fontWeight: 700, "&:hover": { bgcolor: "#e3f2fd" }, textTransform: "none" }}>
              New Bill
            </Button>
            <Button variant="contained" startIcon={<ShoppingCartIcon />}
              onClick={() => openPoForm()}
              sx={{ bgcolor: "#fff", color: "#1565c0", fontWeight: 700, "&:hover": { bgcolor: "#e3f2fd" }, textTransform: "none" }}>
              New Purchase Order
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: "1px solid #e0e0e0", borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, borderBottom: "1px solid #e0e0e0" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { fontWeight: 700, textTransform: "none" } }}>
            <Tab icon={<ReceiptLongIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Bills (${bills.length})`} />
            <Tab icon={<ShoppingCartIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Purchase Orders (${pos.length})`} />
          </Tabs>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => loadLists()} disabled={listLoading}>
              {listLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Bills Tab */}
        {tab === 0 && (
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
                    <TableCell sx={{ ...thStyle, width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bills.map((b) => (
                    <TableRow key={b.bill_id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" }, cursor: "pointer" }}>
                      <TableCell sx={tdStyle}>{b.date}</TableCell>
                      <TableCell sx={{ ...tdStyle, fontWeight: 600, color: "#1565c0" }}>{b.bill_number}</TableCell>
                      <TableCell sx={tdStyle}>{b.reference_number || "—"}</TableCell>
                      <TableCell><StatusChip status={b.status} /></TableCell>
                      <TableCell sx={tdStyle}>{b.due_date}</TableCell>
                      <TableCell sx={tdStyle} align="right">{formatCurrency(b.total)}</TableCell>
                      <TableCell sx={tdStyle} align="right">{formatCurrency(b.balance)}</TableCell>
                      <TableCell>
                        <Tooltip title="Edit Bill">
                          <IconButton size="small" color="primary" onClick={() => openBillForm(b.bill_id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        )}

        {/* Purchase Orders Tab */}
        {tab === 1 && (
          <TableContainer>
            {pos.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <ShoppingCartIcon sx={{ fontSize: 48, color: "#ccc", mb: 1 }} />
                <Typography color="text.secondary">No purchase orders found for this vendor.</Typography>
                <Button variant="text" startIcon={<AddIcon />} onClick={() => openPoForm()} sx={{ mt: 1, textTransform: "none" }}>
                  Create your first purchase order
                </Button>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8f9fb" }}>
                    <TableCell sx={thStyle}>Date</TableCell>
                    <TableCell sx={thStyle}>PO#</TableCell>
                    <TableCell sx={thStyle}>Reference</TableCell>
                    <TableCell sx={thStyle}>Status</TableCell>
                    <TableCell sx={thStyle}>Delivery Date</TableCell>
                    <TableCell sx={thStyle} align="right">Total</TableCell>
                    <TableCell sx={{ ...thStyle, width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pos.map((p) => (
                    <TableRow key={p.purchaseorder_id} hover sx={{ "&:hover": { bgcolor: "#f5f7ff" }, cursor: "pointer" }}>
                      <TableCell sx={tdStyle}>{p.date}</TableCell>
                      <TableCell sx={{ ...tdStyle, fontWeight: 600, color: "#1565c0" }}>{p.purchaseorder_number}</TableCell>
                      <TableCell sx={tdStyle}>{p.reference_number || "—"}</TableCell>
                      <TableCell><StatusChip status={p.status} /></TableCell>
                      <TableCell sx={tdStyle}>{p.delivery_date || "—"}</TableCell>
                      <TableCell sx={tdStyle} align="right">{formatCurrency(p.total)}</TableCell>
                      <TableCell>
                        <Tooltip title="Edit Purchase Order">
                          <IconButton size="small" color="primary" onClick={() => openPoForm(p.purchaseorder_id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        )}
      </Paper>

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
