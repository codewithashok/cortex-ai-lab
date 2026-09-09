# Feature 1: AI Chat Assistant

**What we're building:** a chat page where you type a message and get an AI reply — the "Hello World" of AI apps, and the pattern almost every other feature reuses.

---

## Step 1: Pick an LLM provider

Before writing any code, we needed to decide which AI service actually generates the replies. Options were OpenAI, Anthropic (Claude), or a free local model via Ollama.

**Decision: OpenAI.** It's the most common enterprise choice and has simple, well-documented streaming support.

---

## Step 2: Install LangChain's OpenAI package

```bash
pip install langchain-openai
```

**What is LangChain?** A library that gives you a consistent way to talk to different AI models (OpenAI, Anthropic, local models, etc.) without rewriting your code for each one. `langchain-openai` is the piece that specifically knows how to talk to OpenAI.

**Why use it instead of calling OpenAI directly?** Later features (RAG, Agents) reuse LangChain's building blocks — prompt templates, tool calling, streaming. Learning it here means you don't relearn it from scratch each feature.

**Good to know:** this installed LangChain version 1.x, a recent major rewrite. We double-checked the real installed code before writing anything against it (some internal field names changed, like `model_name` instead of `model` — but both still work as of writing because of aliases).

---

## Step 3: Add settings for the API key and model

In `backend/app/core/config.py`:

```python
openai_api_key: str = ""
openai_model: str = "gpt-4o-mini"
```

And in `backend/.env.example` (the template file that gets committed to git, with no real secrets):

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

**Why a settings class instead of hardcoding the key?** So the real key only ever lives in `backend/.env` (which is in `.gitignore` — never committed), while the code just reads `settings.openai_api_key`.

---

## Step 4: Define the request/response shape

In `backend/app/schemas/chat.py`:

```python
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str
```

**Why define this before writing the endpoint?** FastAPI uses these Pydantic classes to automatically validate incoming requests (e.g. reject a request missing `message`) and to document the API. `history` is a list because later we'll send previous messages back so the AI remembers the conversation — empty for now.

---

## Step 5: Build the `/api/chat` endpoint (non-streaming first)

In `backend/app/api/routes/chat.py`:

```python
SYSTEM_PROMPT = (
    "You are the assistant embedded in Cortex AI Lab, a learning project. "
    "Answer clearly and concisely."
)

def get_llm() -> ChatOpenAI:
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)

@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in request.history:
        if turn.role == "user":
            messages.append(HumanMessage(content=turn.content))
        else:
            messages.append(AIMessage(content=turn.content))
    messages.append(HumanMessage(content=request.message))

    response = get_llm().invoke(messages)
    return ChatResponse(reply=str(response.content))
```

**What's a "system prompt"?** A hidden instruction sent before the user's message that sets the AI's behavior/personality. The user never sees it, but it shapes every reply.

**Why non-streaming first?** Streaming (replies appearing word-by-word) adds extra moving parts. Getting a plain request → reply round-trip working first means if something breaks, we know it's not the streaming part.

**Why a `get_llm()` function instead of one shared/global client?** Keeps it simple for now and easy to swap later (e.g. per-request model choice, or mocking it in tests).

---

## Step 6: Wire the route into the app

In `backend/app/main.py`:

```python
from app.api.routes import chat, health
...
app.include_router(chat.router, prefix="/api")
```

Now `POST /api/chat` exists on the running server.

---

## Step 7: Set up the real API key

Created `backend/.env` (a copy of `.env.example`, but this one is gitignored and holds real secrets) and added a real OpenAI key to it: `OPENAI_API_KEY=sk-...`.

**A note on OpenAI billing** (not code, but part of actually getting this working): OpenAI's API requires a "pay as you go" credit balance — the free trial credit was $0 on this account. We added $10 of credit manually, with auto-recharge turned **off**. That means if the balance ever hits $0, API calls simply stop working with an error (safe, predictable) instead of silently charging the card again — a reasonable choice while learning, since it avoids any surprise charges. `gpt-4o-mini` (what we're using) is cheap enough that $10 goes a long way for 1-2 hours/day of use.

**Never paste a real API key into chat** — only ever into the `.env` file directly, since chat history isn't a safe place for secrets.

---

## Step 8: Test the endpoint end-to-end

With the real key in place, we started the backend and sent it a real request:

```bash
uvicorn app.main:app --port 8000

curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Say hello in exactly 5 words."}'
```

Response:

```json
{ "reply": "Hello! How are you today?" }
```

It worked — a real round trip through FastAPI → LangChain → OpenAI → back to us.

**Bonus: the observability we added earlier paid off immediately.** The server logs showed both the outbound call to OpenAI and our own request log:

```
INFO HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 200 OK"
INFO POST /api/chat -> 200 (3391.0ms)
```

That `3391.0ms` (3.4 seconds) is worth noticing: a non-streaming reply means the user stares at a blank screen for the entire time the AI is "thinking." That's exactly the problem streaming solves next.

---

## Step 9: Add streaming (SSE)

We added a second endpoint, `POST /api/chat/stream`, that sends the reply piece-by-piece instead of making the caller wait for the whole thing.

**What's SSE (Server-Sent Events)?** A simple format where the server keeps the HTTP connection open and pushes small text messages over time, each one written as:

```
data: <some text>

```
(note: a blank line marks the end of each message)

We picked SSE instead of WebSockets because we only need one-way traffic (server → browser). WebSockets support two-way traffic but need more setup — unnecessary here.

To avoid duplicating the "build the list of messages to send to the AI" logic in two places, we pulled it into a shared helper:

```python
def build_messages(request: ChatRequest) -> list[BaseMessage]:
    messages: list[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in request.history:
        messages.append(HumanMessage(content=turn.content) if turn.role == "user" else AIMessage(content=turn.content))
    messages.append(HumanMessage(content=request.message))
    return messages
```

The streaming endpoint itself uses a **generator function** (a function that `yield`s pieces one at a time instead of returning everything at once) plugged into FastAPI's `StreamingResponse`:

```python
def stream_tokens(request: ChatRequest) -> Generator[str, None, None]:
    messages = build_messages(request)
    for chunk in get_llm().stream(messages):
        if chunk.content:
            escaped = str(chunk.content).replace("\n", "\ndata: ")
            yield f"data: {escaped}\n\n"
    yield "data: [DONE]\n\n"

@router.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(stream_tokens(request), media_type="text/event-stream")
```

**Why the `.replace("\n", "\ndata: ")` line?** The SSE format breaks if a chunk of text contains a real newline (e.g. the AI replies with a bulleted list) — each line of a multi-line message needs its own `data: ` prefix. This handles that edge case up front instead of it silently breaking later.

**Why a `[DONE]` marker?** So the frontend knows "the reply is finished, stop showing the typing indicator" — without it, there's no clean signal that the stream is over versus just a slow network.

**Tested it with:**

```bash
curl -N -X POST http://localhost:8000/api/chat/stream -H "Content-Type: application/json" -d '{"message": "Count from 1 to 5, one number per word."}'
```

and saw the words arrive as separate `data:` chunks in real time (the `-N` flag tells curl not to buffer, so we could actually see it stream instead of appearing all at once).

**Note:** we kept the old non-streaming `/api/chat` too — cheap to keep, useful for quick testing without dealing with a stream.

---

## Step 10: Build and wire up the chat UI

We built the real `/chat` page and connected it to the streaming endpoint in one pass, rather than building a fake/disconnected UI first and rewiring it right after (that would just mean throwing work away).

**The pieces:**

`src/lib/chat-client.ts` — a small function that calls the backend and hands back each piece of text as it arrives:

```ts
export async function streamChatReply(message: string, history: ChatTurn[], onToken: (token: string) => void) {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // split on the blank-line that marks the end of each SSE message,
    // strip the "data: " prefix from each line, and hand the text to onToken
    ...
  }
}
```

**Why not use the browser's built-in `EventSource` for SSE?** `EventSource` only supports `GET` requests — we need to `POST` a JSON body (the message + history), so we read the streaming response manually with `fetch` + `getReader()` instead. This is normal for chat apps; it's why we hand-wrote the parsing logic above instead of using a browser API.

`src/app/chat/page.tsx` — the actual page: a scrolling list of message bubbles (styled differently for "user" vs "assistant" using Material UI's `Paper`), a text input, and a send button. When you hit send:

```tsx
async function handleSend() {
  const history = messages; // everything said so far in this session
  setMessages([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
  await streamChatReply(message, history, (token) => {
    // append each token to the last (assistant) message as it streams in
  });
}
```

**Conversation memory came for free here.** Because `history` (the full list of prior turns) gets sent with every request, and the backend already reads `request.history` to rebuild context for the AI — we didn't need a separate step for "remember earlier messages." It's just a natural side effect of storing messages in React state and sending them along each time.

**Verified by:**
- `npm run build` — compiles and typechecks cleanly
- Started both servers for real and confirmed: the `/chat` page loads (`200`), a CORS preflight from `http://localhost:3000` to the backend succeeds, and a real streaming request returns the same `data: ...` chunks the frontend parser expects — then manually replayed the parser logic against that exact output to confirm it reconstructs the sentence correctly.

---

## Step 11: Add basic error handling

Before this, if OpenAI was down, the key was wrong, or you ran out of credit, the backend would crash with a raw, ugly error. We added a safety net around both endpoints:

```python
@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        response = get_llm().invoke(build_messages(request))
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=502, detail=UNAVAILABLE_MESSAGE) from exc
    return ChatResponse(reply=str(response.content))
```

**Why `502` specifically?** It means "this server got a bad response from another server it depends on" — accurate here, since the failure is OpenAI's API, not our own code.

**Streaming needed a different approach.** By the time an error happens inside a stream, the HTTP status code (`200`) has already been sent to the browser — you can't change your mind partway through a response. So instead of an HTTP error, we send the error as a normal chunk of text inside the stream:

```python
try:
    for chunk in get_llm().stream(messages):
        ...
except Exception:
    logger.exception("Chat stream failed")
    yield f"data: {UNAVAILABLE_MESSAGE}\n\n"
yield "data: [DONE]\n\n"
```

The frontend doesn't need any special handling for this — the error message just shows up as the assistant's reply text, which is good enough for now.

---

## Feature status: core loop complete

- ✅ Frontend chat UI
- ✅ Backend endpoints (non-streaming + streaming)
- ✅ AI integration (OpenAI via LangChain)
- ✅ Error handling
- ✅ Logging/observability
- ✅ Conversation memory (within a browser session — refreshing the page clears it)
- ⬜ Database (not needed for this feature — messages only live in the browser tab for now; persistence would be its own future improvement, not required by the original feature plan)

Per the project plan, this is enough to mark **Feature 1: AI Chat Assistant** complete and move to **Feature 2: Document Processing**.
