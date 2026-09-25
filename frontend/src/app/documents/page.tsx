"use client";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import { processDocument, type ProcessDocumentResponse } from "@/lib/documents-client";

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessDocumentResponse | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await processDocument(file);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong processing the file.");
    } finally {
      setIsProcessing(false);
      event.target.value = "";
    }
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Document Processing</Typography>
        <Typography color="text.secondary">
          Upload a PDF, Word doc, or text file to extract and chunk its text.
        </Typography>
      </Stack>

      <Box>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          hidden
          onChange={handleFileSelected}
        />
        <Button
          variant="contained"
          startIcon={isProcessing ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Upload a file"}
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {result && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            <strong>{result.filename}</strong> — split into {result.chunk_count} chunk
            {result.chunk_count === 1 ? "" : "s"}
          </Typography>

          <Stack spacing={1.5}>
            {result.chunks.map((chunk) => (
              <Paper key={chunk.chunk_index} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Chip label={`Chunk ${chunk.chunk_index}`} size="small" />
                  {chunk.page_number !== null && (
                    <Chip label={`Page ${chunk.page_number}`} size="small" variant="outlined" />
                  )}
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {chunk.content}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
