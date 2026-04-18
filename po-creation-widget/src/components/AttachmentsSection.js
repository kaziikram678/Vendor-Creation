import React, { useRef } from "react";
import {
  Box, Typography, Button, List, ListItem, ListItemText,
  ListItemSecondaryAction, IconButton, Paper, Chip, Tooltip,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const MAX_FILES = 5;
const MAX_SIZE_MB = 10;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentsSection({
  attachments = [],
  pendingFiles = [],
  onAddFiles,
  onDeleteExisting,
  onDeletePending,
  readOnly = false,
  label = "Attach File(s) to Purchase Order",
}) {
  const fileInputRef = useRef(null);
  const totalCount = attachments.length + pendingFiles.length;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const valid = [];
    const oversized = [];
    for (const f of files) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) oversized.push(f);
      else valid.push(f);
    }
    onAddFiles(valid, oversized);
    e.target.value = "";
  };

  return (
    <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
        {label}
      </Typography>

      {!readOnly && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
          <Tooltip title={totalCount >= MAX_FILES ? `Maximum ${MAX_FILES} files allowed` : ""}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={totalCount >= MAX_FILES}
              >
                Upload File
              </Button>
            </span>
          </Tooltip>
          <Typography variant="caption" color="text.secondary">
            You can upload a maximum of {MAX_FILES} files, {MAX_SIZE_MB}MB each
          </Typography>
        </Box>
      )}

      {attachments.length > 0 || pendingFiles.length > 0 ? (
        <List dense disablePadding>
          {attachments.map((doc) => (
            <ListItem key={doc.doc_id} sx={{ px: 0, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
              <AttachFileIcon fontSize="small" sx={{ mr: 1, color: "text.secondary", flexShrink: 0 }} />
              <ListItemText
                primary={<Typography variant="body2">{doc.file_name}</Typography>}
                secondary={doc.file_size ? formatSize(doc.file_size) : null}
              />
              {!readOnly && (
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => onDeleteExisting(doc.doc_id)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
          {pendingFiles.map((file, idx) => (
            <ListItem key={`pending-${idx}`} sx={{ px: 0, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
              <AttachFileIcon fontSize="small" sx={{ mr: 1, color: "primary.main", flexShrink: 0 }} />
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="body2">{file.name}</Typography>
                    <Chip label="pending upload" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                }
                secondary={formatSize(file.size)}
              />
              {!readOnly && (
                <ListItemSecondaryAction>
                  <IconButton edge="end" size="small" onClick={() => onDeletePending(idx)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          No files attached
        </Typography>
      )}
    </Paper>
  );
}
