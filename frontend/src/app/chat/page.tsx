"use client";

import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { streamChatReply, type ChatTurn } from "@/lib/chat-client";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  async function handleSend() {
    const message = input.trim();
    if (!message || isStreaming) return;

    const history = messages;
    setMessages([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      await streamChatReply(message, history, (token) => {
        setMessages((current) => {
          const updated = [...current];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + token };
          return updated;
        });
      });
    } catch {
      setMessages((current) => {
        const updated = [...current];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong reaching the assistant. Is the backend running?",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <Stack sx={{ height: "calc(100vh - 128px)" }} spacing={2}>
      <Typography variant="h4">AI Chat Assistant</Typography>

      <Stack
        spacing={1.5}
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          p: 2,
        }}
      >
        {messages.length === 0 && (
          <Typography color="text.secondary">Ask something to start the conversation.</Typography>
        )}

        {messages.map((turn, index) => (
          <Box
            key={index}
            sx={{
              alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "75%",
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                py: 1,
                bgcolor: turn.role === "user" ? "primary.main" : "background.paper",
                color: turn.role === "user" ? "primary.contrastText" : "text.primary",
              }}
            >
              <Typography sx={{ whiteSpace: "pre-wrap" }}>
                {turn.content || (isStreaming && index === messages.length - 1 ? "…" : "")}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Stack>

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          placeholder="Type a message..."
          value={input}
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <IconButton color="primary" onClick={handleSend} disabled={isStreaming || !input.trim()}>
          {isStreaming ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
      </Stack>
    </Stack>
  );
}
