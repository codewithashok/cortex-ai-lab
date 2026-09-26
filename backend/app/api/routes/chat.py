import logging
from collections.abc import Generator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])
logger = logging.getLogger("cortex")

# Hidden instruction sent before every conversation, shaping how the AI behaves.
SYSTEM_PROMPT = (
    "You are the assistant embedded in Cortex AI Lab, a learning project. "
    "Answer clearly and concisely."
)

UNAVAILABLE_MESSAGE = "The AI assistant is temporarily unavailable. Please try again."


# Creates a fresh OpenAI chat client using the model/key from settings (.env).
def get_llm() -> ChatOpenAI:
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)


# Turns the request (system prompt + prior turns + new message) into the
# message list format LangChain/OpenAI expects.
def build_messages(request: ChatRequest) -> list[BaseMessage]:
    messages: list[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in request.history:
        if turn.role == "user":
            messages.append(HumanMessage(content=turn.content))
        else:
            messages.append(AIMessage(content=turn.content))
    messages.append(HumanMessage(content=request.message))
    return messages


# Non-streaming endpoint: waits for the full reply, then returns it all at once.
@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        # <-- This is where the actual call to the LLM happens.
        response = get_llm().invoke(build_messages(request))
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=502, detail=UNAVAILABLE_MESSAGE) from exc

    return ChatResponse(reply=str(response.content))


# Generator that talks to the LLM and yields each piece of the reply as it
# arrives, formatted as an SSE ("data: ...") event.
def stream_tokens(request: ChatRequest) -> Generator[str, None, None]:
    messages = build_messages(request)
    try:
        # <-- This is where the actual call to the LLM happens (streaming version).
        for chunk in get_llm().stream(messages):
            if chunk.content:
                escaped = str(chunk.content).replace("\n", "\ndata: ")
                yield f"data: {escaped}\n\n"
    except Exception:
        logger.exception("Chat stream failed")
        yield f"data: {UNAVAILABLE_MESSAGE}\n\n"
    yield "data: [DONE]\n\n"


# Streaming endpoint: returns the reply piece-by-piece via stream_tokens above.
@router.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(stream_tokens(request), media_type="text/event-stream")
