import React from "react";
import { Box, TextField, MenuItem, Typography, Tooltip, Divider } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function TotalsSection({
  lineItems, taxes, discountValue, setDiscountValue,
  discountType, setDiscountType, adjustmentValue, setAdjustmentValue,
  isInclusiveTax, isItemLevelTax, accounts, discountAccountId, setDiscountAccountId,
}) {
  const subTotal = lineItems.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0);
  const discNum = parseFloat(discountValue) || 0;
  const discountAmt = discountType === "percent" ? (subTotal * discNum) / 100 : discNum;

  let taxTotal = 0;
  lineItems.forEach((r) => {
    if (!r.tax_id) return;
    const t = taxes.find((tx) => tx.tax_id === r.tax_id);
    if (!t) return;
    const la = (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);
    taxTotal += isInclusiveTax ? la - la / (1 + t.tax_percentage / 100) : (la * t.tax_percentage) / 100;
  });

  const adj = parseFloat(adjustmentValue) || 0;
  const total = isInclusiveTax ? subTotal - discountAmt + adj : subTotal - discountAmt + taxTotal + adj;

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ width: "100%", border: 1, borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "surface.alt" }}>
        <Row label="Sub Total" value={subTotal.toFixed(2)} bold />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
          <Typography variant="body2" sx={{ width: 100, textAlign: "right", color: "text.secondary" }}>Discount</Typography>
          <TextField type="number" size="small" value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }} sx={{ width: 80 }} />
          <TextField select size="small" value={discountType}
            onChange={(e) => setDiscountType(e.target.value)} sx={{ width: 80 }}>
            <MenuItem value="percent">%</MenuItem>
            <MenuItem value="amount">Amt</MenuItem>
          </TextField>
          <Typography variant="body2" sx={{ flex: 1, textAlign: "right", fontWeight: 500 }}>{discountAmt.toFixed(2)}</Typography>
        </Box>
        {discNum > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="body2" sx={{ width: 100, textAlign: "right", color: "text.secondary" }}>Discount A/c</Typography>
            <TextField select size="small" value={discountAccountId || ""}
              onChange={(e) => setDiscountAccountId(e.target.value)}
              sx={{ flex: 1 }} error={discNum > 0 && !discountAccountId}
              helperText={discNum > 0 && !discountAccountId ? "Required when discount is applied" : ""}>
              <MenuItem value="">-- Select --</MenuItem>
              {(accounts || []).map((a) => (
                <MenuItem key={a.account_id} value={a.account_id}>{a.account_name}</MenuItem>
              ))}
            </TextField>
          </Box>
        )}
        {!isInclusiveTax && taxTotal > 0 && <Row label="Tax" value={taxTotal.toFixed(2)} />}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", width: 100, justifyContent: "flex-end", gap: 0.3 }}>
            <Typography variant="body2" color="text.secondary">Adjustment</Typography>
            <Tooltip title="Can be +/-" arrow><InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} /></Tooltip>
          </Box>
          <TextField type="number" size="small" value={adjustmentValue}
            onChange={(e) => setAdjustmentValue(e.target.value)}
            inputProps={{ step: "0.01" }} sx={{ width: 80 }} />
          <Typography variant="body2" sx={{ flex: 1, textAlign: "right", fontWeight: 500 }}>{adj.toFixed(2)}</Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Row label="Total" value={total.toFixed(2)} bold large />
      </Box>
    </Box>
  );
}

function Row({ label, value, bold, large }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", my: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400, fontSize: large ? 16 : 13, color: "text.primary" }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 500, fontSize: large ? 16 : 13, color: "text.primary" }}>{value}</Typography>
    </Box>
  );
}
