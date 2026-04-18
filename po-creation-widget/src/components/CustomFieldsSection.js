import React from "react";
import { Grid, TextField, MenuItem, Typography, Paper } from "@mui/material";

export default function CustomFieldsSection({ customFields, values, setValues, readOnly }) {
  if (!customFields || customFields.length === 0) return null;

  const handleChange = (api_name, value) => {
    setValues((prev) => ({ ...prev, [api_name]: value }));
  };

  const renderField = (field) => {
    const value = values[field.api_name] ?? "";
    const common = {
      fullWidth: true,
      size: "small",
      label: field.label,
      required: field.is_mandatory,
      value,
      onChange: (e) => handleChange(field.api_name, e.target.value),
      InputProps: readOnly ? { readOnly: true } : undefined,
    };
    const dt = field.data_type;
    if (dt === "date") {
      return <TextField {...common} type="date" InputLabelProps={{ shrink: true }} />;
    }
    if (dt === "number" || dt === "decimal" || dt === "amount" || dt === "percent") {
      return <TextField {...common} type="number" />;
    }
    if (dt === "email") return <TextField {...common} type="email" />;
    if (dt === "url") return <TextField {...common} type="url" />;
    if (dt === "multi_line" || dt === "multiline") {
      return <TextField {...common} multiline minRows={2} />;
    }
    if (dt === "dropdown" && field.values?.length) {
      return (
        <TextField {...common} select>
          <MenuItem value="">-- Select --</MenuItem>
          {field.values.map((v) => {
            const val = typeof v === "string" ? v : v.value || v.label;
            const lbl = typeof v === "string" ? v : v.label || v.value;
            return <MenuItem key={val} value={val}>{lbl}</MenuItem>;
          })}
        </TextField>
      );
    }
    if (dt === "check_box" || dt === "checkbox") {
      return (
        <TextField {...common} select>
          <MenuItem value="">-- Select --</MenuItem>
          <MenuItem value="true">Yes</MenuItem>
          <MenuItem value="false">No</MenuItem>
        </TextField>
      );
    }
    return <TextField {...common} />;
  };

  return (
    <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5 }}>
        CUSTOM FIELDS
      </Typography>
      <Grid container spacing={2}>
        {customFields.map((f) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f.api_name || f.customfield_id}>
            {renderField(f)}
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export function customFieldsToPayload(customFields, values) {
  return customFields
    .map((f) => {
      const v = values[f.api_name];
      if (v === undefined || v === null || v === "") return null;
      return { api_name: f.api_name, value: v };
    })
    .filter(Boolean);
}

export function customFieldsFromRecord(customFields, record) {
  const vals = {};
  const list = record?.custom_fields || [];
  list.forEach((cf) => {
    vals[cf.api_name] = cf.value ?? "";
  });
  customFields.forEach((f) => {
    if (vals[f.api_name] === undefined) vals[f.api_name] = "";
  });
  return vals;
}
