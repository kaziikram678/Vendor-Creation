import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { Box, Typography, CircularProgress, Alert, Button, GlobalStyles } from "@mui/material";
import Dashboard from "./components/Dashboard";
import { initZohoSDK } from "./services/zohoService";

const STORAGE_KEY = "bill-widget-theme";

function createAppTheme(mode) {
  const light = mode === "light";
  return createTheme({
    palette: {
      mode,
      primary: { main: light ? "#1565c0" : "#64b5f6" },
      success: { main: light ? "#2e7d32" : "#66bb6a" },
      background: {
        default: "transparent",
        paper: light ? "#ffffff" : "#1c2433",
      },
      divider: light ? "#e0e0e0" : "#2c3447",
      text: {
        primary: light ? "#1a1a1a" : "#e6e9f0",
        secondary: light ? "#5f6368" : "#9aa3b5",
      },
      surface: {
        main: light ? "#f8f9fb" : "#141a26",
        alt: light ? "#fafbfc" : "#181f2d",
        hover: light ? "#f5f7ff" : "#232c40",
      },
    },
    typography: { fontFamily: "'Inter', 'Roboto', 'Segoe UI', sans-serif" },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiPaper: { styleOverrides: { root: { borderRadius: 8, backgroundImage: "none" } } },
    },
  });
}

const buildBackground = (mode) => ({
  "html, body, #root": { height: "100%", margin: 0, padding: 0 },
  body: {
    background: mode === "light"
      ? `
        radial-gradient(1200px 600px at 10% -10%, rgba(21,101,192,0.08), transparent 60%),
        radial-gradient(900px 500px at 100% 0%, rgba(66,165,245,0.10), transparent 60%),
        linear-gradient(135deg, #f6f9fc 0%, #eef2f7 50%, #e6ecf4 100%)
      `
      : `
        radial-gradient(1200px 600px at 10% -10%, rgba(66,165,245,0.10), transparent 60%),
        radial-gradient(900px 500px at 100% 0%, rgba(21,101,192,0.12), transparent 60%),
        linear-gradient(135deg, #0b1120 0%, #101728 50%, #141c30 100%)
      `,
    backgroundAttachment: "fixed",
    minHeight: "100vh",
    color: mode === "light" ? "#1a1a1a" : "#e6e9f0",
  },
});

export default function App() {
  const [entityId, setEntityId] = useState(null);
  const [sdkError, setSdkError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "light"; } catch { return "light"; }
  });

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === "light" ? "dark" : "light";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    let mounted = true;
    initZohoSDK()
      .then((pageData) => {
        if (!mounted) return;
        const raw = pageData?.EntityId;
        const id = Array.isArray(raw) ? raw[0] : (raw || pageData?.id || null);
        if (!id) setSdkError("Could not determine the current Vendor record.");
        else setEntityId(String(id));
      })
      .catch((err) => { if (mounted) setSdkError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={buildBackground(mode)} />
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 2 }}>
          <CircularProgress />
          <Typography color="text.secondary">Initializing widget...</Typography>
        </Box>
      ) : sdkError ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Alert severity="error" sx={{ mb: 2 }}>{sdkError}</Alert>
          <Button variant="outlined" onClick={() => window.location.reload()}>Retry</Button>
        </Box>
      ) : (
        <Dashboard entityId={entityId} mode={mode} onToggleMode={toggleMode} />
      )}
    </ThemeProvider>
  );
}
