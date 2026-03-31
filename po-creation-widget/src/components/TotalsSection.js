import React from "react";
import { Box, TextField, MenuItem, Typography, Tooltip, Paper } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function TotalsSection({
  lineItems,
  taxes,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  adjustmentValue,
  setAdjustmentValue,
  isInclusiveTax,
  isItemLevelTax,
}) {
  const subTotal = lineItems.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    return sum + qty * rate;
  }, 0);

  const discountNum = parseFloat(discountValue) || 0;
  const discountAmt = discountType === "percent"
    ? (subTotal * discountNum) / 100
    : discountNum;

  let taxTotal = 0;
  lineItems.forEach((row) => {
    if (!row.tax_id) return;
    const tax = taxes.find((t) => t.tax_id === row.tax_id);
    if (!tax) return;
    const qty = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    const lineAmount = qty * rate;
    if (isInclusiveTax) {
      taxTotal += lineAmount - lineAmount / (1 + tax.tax_percentage / 100);
    } else {
      taxTotal += (lineAmount * tax.tax_percentage) / 100;
    }
  });

  const afterDiscount = subTotal - discountAmt;
  const adjustment = parseFloat(adjustmentValue) || 0;
  const grandTotal = isInclusiveTax
    ? afterDiscount + adjustment
    : afterDiscount + taxTotal + adjustment;

  return (
    <Paper variant="outlined" sx={{ mt: 2, mb: 2, p: 2 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1.5 }}>
        <Row label="Sub Total" value={subTotal.toFixed(2)} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ width: 120, textAlign: "right" }}>Discount</Typography>
          <TextField
            type="number"
            size="small"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            sx={{ width: 100 }}
          />
          <TextField
            select
            size="small"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            sx={{ width: 90 }}
          >
            <MenuItem value="percent">%</MenuItem>
            <MenuItem value="amount">Amount</MenuItem>
          </TextField>
          <Typography variant="body2" sx={{ width: 100, textAlign: "right", fontWeight: 500 }}>
            {discountAmt.toFixed(2)}
          </Typography>
        </Box>

        {!isInclusiveTax && taxTotal > 0 && (
          <Row label="Tax" value={taxTotal.toFixed(2)} />
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", width: 120, justifyContent: "flex-end", gap: 0.5 }}>
            <Typography variant="body2">Adjustment</Typography>
            <Tooltip title="Adjustments can be positive or negative" arrow>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: "#888" }} />
            </Tooltip>
          </Box>
          <TextField
            type="number"
            size="small"
            value={adjustmentValue}
            onChange={(e) => setAdjustmentValue(e.target.value)}
            inputProps={{ step: "0.01" }}
            sx={{ width: 100 }}
          />
          <Typography variant="body2" sx={{ width: 100, textAlign: "right", fontWeight: 500 }}>
            {adjustment.toFixed(2)}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, borderTop: "2px solid #333", pt: 1.5, mt: 0.5 }}>
          <Typography variant="body1" sx={{ width: 120, textAlign: "right", fontWeight: 700 }}>Total</Typography>
          <Typography variant="body1" sx={{ width: 210, textAlign: "right", fontWeight: 700, fontSize: "1.1rem" }}>
            {grandTotal.toFixed(2)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2" sx={{ width: 120, textAlign: "right" }}>{label}</Typography>
      <Typography variant="body2" sx={{ width: 210, textAlign: "right", fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}
