# Feature 1: AI Chat Assistant

**What we're building:** a chat page where you type a message and get an AI reply — the "Hello World" of AI apps, and the pattern almost every other feature reuses.

---

## #AI Chat Assistant: #Step 1: Pick an LLM provider

Before writing any code, we needed to decide which AI service actually generates the replies. Options were OpenAI, Anthropic (Claude), or a free local model via Ollama.

**Decision: OpenAI.** It's the most common enterprise choice and has simple, well-documented streaming support.

---

## #AI Chat Assistant: #Step 2: Install LangChain's OpenAI package

```bash
pip install langchain-openai
```

**What is LangChain?** A library that gives you a consistent way to talk to different AI models (OpenAI, Anthropic, local models, etc.) without rewriting your code for each one. `langchain-openai` is the piece that specifically knows how to talk to OpenAI.

**Why use it instead of calling OpenAI directly?** Later features (RAG, Agents) reuse LangChain's building blocks — prompt templates, tool calling, streaming. Learning it here means you don't relearn it from scratch each feature.

**Good to know:** this installed LangChain version 1.x, a recent major rewrite. We double-checked the real installed code before writing anything against it (some internal field names changed, like `model_name` instead of `model` — but both still work as of writing because of aliases).

---

## #AI Chat Assistant: #Step 3: Add settings for the API key and model

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

## #AI Chat Assistant: #Step 4: Define the request/response shape

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

## #AI Chat Assistant: #Step 5: Build the `/api/chat` endpoint (non-streaming first)

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

## #AI Chat Assistant: #Step 6: Wire the route into the app

In `backend/app/main.py`:

```python
from app.api.routes import chat, health
...
app.include_router(chat.router, prefix="/api")
```

Now `POST /api/chat` exists on the running server.

---

## #AI Chat Assistant: #Step 7: Set up the real API key

Created `backend/.env` (a copy of `.env.example`, but this one is gitignored and holds real secrets) and added a real OpenAI key to it: `OPENAI_API_KEY=sk-...`.

**A note on OpenAI billing** (not code, but part of actually getting this working): OpenAI's API requires a "pay as you go" credit balance — the free trial credit was $0 on this account. We added $10 of credit manually, with auto-recharge turned **off**. That means if the balance ever hits $0, API calls simply stop working with an error (safe, predictable) instead of silently charging the card again — a reasonable choice while learning, since it avoids any surprise charges. `gpt-4o-mini` (what we're using) is cheap enough that $10 goes a long way for 1-2 hours/day of use.

**Never paste a real API key into chat** — only ever into the `.env` file directly, since chat history isn't a safe place for secrets.

---

## #AI Chat Assistant: #Step 8: Test the endpoint end-to-end

With the real key in place, we started the backend and sent it a real request:

```bash
uvicorn app.main:app --port 8000

curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Say hello in exactly 5 words."}'
```

Response:

```json
{"reply":"Hello! How are you today?"}
```

It worked — a real round trip through FastAPI → LangChain → OpenAI → back to us.

**Bonus: the observability we added earlier paid off immediately.** The server logs showed both the outbound call to OpenAI and our own request log:

```
INFO HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 200 OK"
INFO POST /api/chat -> 200 (3391.0ms)
```

That `3391.0ms` (3.4 seconds) is worth noticing: a non-streaming reply means the user stares at a blank screen for the entire time the AI is "thinking." That's exactly the problem streaming solves next.

---

## What's next

- Add streaming (SSE) so replies appear token-by-token instead of all at once after a multi-second wait
- Build the chat UI on the frontend `/chat` page
- Wire the frontend to the streaming endpoint
- Add conversation history so the AI remembers earlier turns in the same chat
