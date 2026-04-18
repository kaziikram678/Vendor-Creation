import React from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, TextField, Autocomplete, Typography, Button, Box,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

const EMPTY_ROW = { item_id: "", name: "", account_id: "", quantity: 1, rate: 0, tax_id: "", description: "" };
export function createEmptyRow() { return { ...EMPTY_ROW }; }

export default function LineItemTable({ lineItems, setLineItems, items, taxes, accounts }) {
  const set = (idx, field, value) => {
    setLineItems((prev) => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

  const selectItem = (idx, item) => {
    if (!item) { set(idx, "item_id", ""); return; }
    setLineItems((prev) => {
      const u = [...prev];
      u[idx] = { ...u[idx], item_id: item.item_id, name: item.name, rate: item.rate || 0,
        description: item.description || "", tax_id: item.tax_id || "",
        account_id: item.account_id || u[idx].account_id };
      return u;
    });
  };

  const addRow = () => setLineItems((p) => [...p, createEmptyRow()]);
  const removeRow = (i) => setLineItems((p) => p.length <= 1 ? p : p.filter((_, j) => j !== i));
  const amt = (r) => ((parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0)).toFixed(2);

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden", mb: 2, width: "100%" }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: "surface.main", borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">ITEM TABLE</Typography>
      </Box>
      <TableContainer sx={{ width: "100%" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "surface.alt" }}>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: "28%" }}>ITEM DETAILS</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: "18%" }}>ACCOUNT</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: 80 }}>QUANTITY</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: 90 }}>RATE</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: "15%" }}>TAX</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 11, color: "text.secondary", width: 90 }} align="right">AMOUNT</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((row, idx) => (
              <TableRow key={idx} sx={{ "&:hover": { bgcolor: "surface.hover" }, verticalAlign: "top" }}>
                <TableCell>
                  <Autocomplete size="small" options={items} getOptionLabel={(o) => o.name || ""}
                    value={items.find((i) => i.item_id === row.item_id) || null}
                    onChange={(_, v) => selectItem(idx, v)}
                    isOptionEqualToValue={(a, b) => a.item_id === b.item_id}
                    renderInput={(p) => <TextField {...p} placeholder="Select an item" variant="outlined" size="small" />}
                  />
                  <TextField
                    placeholder="Add a description to your item"
                    value={row.description || ""}
                    onChange={(e) => set(idx, "description", e.target.value)}
                    size="small"
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={3}
                    variant="standard"
                    sx={{ mt: 0.5, "& .MuiInput-root": { fontSize: 12, color: "text.secondary" } }}
                    InputProps={{ disableUnderline: true }}
                  />
                </TableCell>
                <TableCell>
                  <Autocomplete size="small" options={accounts} getOptionLabel={(o) => o.account_name || ""}
                    value={accounts.find((a) => a.account_id === row.account_id) || null}
                    onChange={(_, v) => set(idx, "account_id", v?.account_id || "")}
                    isOptionEqualToValue={(a, b) => a.account_id === b.account_id}
                    renderInput={(p) => <TextField {...p} placeholder="Account" variant="outlined" size="small" />}
                  />
                </TableCell>
                <TableCell>
                  <TextField type="number" size="small" value={row.quantity}
                    onChange={(e) => set(idx, "quantity", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }} fullWidth />
                </TableCell>
                <TableCell>
                  <TextField type="number" size="small" value={row.rate}
                    onChange={(e) => set(idx, "rate", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }} fullWidth />
                </TableCell>
                <TableCell>
                  <Autocomplete size="small" options={taxes}
                    getOptionLabel={(o) => `${o.tax_name} (${o.tax_percentage}%)`}
                    value={taxes.find((t) => t.tax_id === row.tax_id) || null}
                    onChange={(_, v) => set(idx, "tax_id", v?.tax_id || "")}
                    isOptionEqualToValue={(a, b) => a.tax_id === b.tax_id}
                    renderInput={(p) => <TextField {...p} placeholder="Tax" variant="outlined" size="small" />}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600} sx={{ pt: 1 }}>{amt(row)}</Typography>
                </TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => removeRow(idx)} disabled={lineItems.length <= 1}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button startIcon={<AddCircleOutlineIcon />} onClick={addRow}
        sx={{ m: 1.5, textTransform: "none", fontWeight: 600 }} size="small" color="primary">
        Add New Row
      </Button>
    </Box>
  );
}
