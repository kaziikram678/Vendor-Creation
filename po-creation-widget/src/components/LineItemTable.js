import React from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, TextField, Autocomplete, Paper, Typography, Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

const EMPTY_ROW = {
  item_id: "",
  name: "",
  account_id: "",
  quantity: 1,
  rate: 0,
  tax_id: "",
  description: "",
};

export function createEmptyRow() {
  return { ...EMPTY_ROW };
}

export default function LineItemTable({
  lineItems,
  setLineItems,
  items,
  taxes,
  accounts,
}) {
  const handleFieldChange = (index, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleItemSelect = (index, selectedItem) => {
    if (!selectedItem) {
      handleFieldChange(index, "item_id", "");
      return;
    }
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        item_id: selectedItem.item_id,
        name: selectedItem.name,
        rate: selectedItem.rate || 0,
        description: selectedItem.description || "",
        tax_id: selectedItem.tax_id || "",
        account_id: selectedItem.account_id || updated[index].account_id,
      };
      return updated;
    });
  };

  const addRow = () => setLineItems((prev) => [...prev, createEmptyRow()]);

  const removeRow = (index) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const getAmount = (row) => {
    const qty = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    return (qty * rate).toFixed(2);
  };

  return (
    <Paper variant="outlined" sx={{ mt: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ p: 1.5, fontWeight: 600, borderBottom: "1px solid #e0e0e0" }}>
        Item Table
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#fafafa" }}>
              <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Item Details</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 150 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 90 }}>Quantity</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>Rate</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>Tax</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>Amount</TableCell>
              <TableCell sx={{ width: 50 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((row, idx) => (
              <TableRow key={idx} hover>
                <TableCell>
                  <Autocomplete
                    size="small"
                    options={items}
                    getOptionLabel={(o) => o.name || ""}
                    value={items.find((i) => i.item_id === row.item_id) || null}
                    onChange={(_, val) => handleItemSelect(idx, val)}
                    isOptionEqualToValue={(opt, val) => opt.item_id === val.item_id}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select an item" variant="outlined" size="small" />
                    )}
                    noOptionsText="No items found"
                  />
                </TableCell>

                <TableCell>
                  <Autocomplete
                    size="small"
                    options={accounts}
                    getOptionLabel={(o) => o.account_name || ""}
                    value={accounts.find((a) => a.account_id === row.account_id) || null}
                    onChange={(_, val) => handleFieldChange(idx, "account_id", val?.account_id || "")}
                    isOptionEqualToValue={(opt, val) => opt.account_id === val.account_id}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select an account" variant="outlined" size="small" />
                    )}
                    noOptionsText="No accounts found"
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={row.quantity}
                    onChange={(e) => handleFieldChange(idx, "quantity", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }}
                    fullWidth
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={row.rate}
                    onChange={(e) => handleFieldChange(idx, "rate", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }}
                    fullWidth
                  />
                </TableCell>

                <TableCell>
                  <Autocomplete
                    size="small"
                    options={taxes}
                    getOptionLabel={(o) => `${o.tax_name} (${o.tax_percentage}%)`}
                    value={taxes.find((t) => t.tax_id === row.tax_id) || null}
                    onChange={(_, val) => handleFieldChange(idx, "tax_id", val?.tax_id || "")}
                    isOptionEqualToValue={(opt, val) => opt.tax_id === val.tax_id}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Select a Tax" variant="outlined" size="small" />
                    )}
                    noOptionsText="No taxes found"
                  />
                </TableCell>

                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 500, pt: 1 }}>
                    {getAmount(row)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeRow(idx)}
                    disabled={lineItems.length <= 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddCircleOutlineIcon />}
        onClick={addRow}
        sx={{ m: 1.5, textTransform: "none" }}
        size="small"
      >
        Add New Row
      </Button>
    </Paper>
  );
}
