import React, { useState, useEffect } from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { Box, Typography, CircularProgress, Alert, Button } from "@mui/material";
import PurchaseOrderForm from "./components/PurchaseOrderForm";
import { initZohoSDK } from "./services/zohoService";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    success: { main: "#2e7d32" },
  },
  typography: {
    fontFamily: "'Roboto', 'Segoe UI', sans-serif",
  },
});

export default function App() {
  const [entityId, setEntityId] = useState(null);
  const [sdkError, setSdkError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    initZohoSDK()
      .then((pageData) => {
        if (!mounted) return;
        console.log("SDK resolved with:", JSON.stringify(pageData));

        const raw = pageData?.EntityId;
        const id = Array.isArray(raw) ? raw[0] : (raw || pageData?.id || null);

        if (!id) {
          setSdkError(
            "Could not determine the current Vendor record. Received: " +
            JSON.stringify(pageData) +
            ". Please open this widget from a Vendor record."
          );
        } else {
          setEntityId(String(id));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setSdkError(err.message || "Failed to initialize Zoho SDK.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 2 }}>
          <CircularProgress />
          <Typography color="text.secondary">Initializing widget...</Typography>
        </Box>
      ) : sdkError ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Alert severity="error" sx={{ mb: 2 }}>{sdkError}</Alert>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Box>
      ) : (
        <PurchaseOrderForm entityId={entityId} />
      )}
    </ThemeProvider>
  );
}
