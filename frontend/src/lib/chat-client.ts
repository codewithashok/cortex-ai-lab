export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Calls the backend's SSE streaming endpoint and invokes `onToken` for each
 * piece of the reply as it arrives. Resolves once the server sends [DONE].
 */
export async function streamChatReply(
  message: string,
  history: ChatTurn[],
  onToken: (token: string) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const text = rawEvent
        .split("\n")
        .map((line) => line.replace(/^data: ?/, ""))
        .join("\n");

      if (text === "[DONE]") return;
      if (text) onToken(text);

      boundary = buffer.indexOf("\n\n");
    }
  }
}
