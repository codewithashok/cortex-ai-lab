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

SYSTEM_PROMPT = (
    "You are the assistant embedded in Cortex AI Lab, a learning project. "
    "Answer clearly and concisely."
)

UNAVAILABLE_MESSAGE = "The AI assistant is temporarily unavailable. Please try again."


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)


def build_messages(request: ChatRequest) -> list[BaseMessage]:
    messages: list[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in request.history:
        if turn.role == "user":
            messages.append(HumanMessage(content=turn.content))
        else:
            messages.append(AIMessage(content=turn.content))
    messages.append(HumanMessage(content=request.message))
    return messages


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        response = get_llm().invoke(build_messages(request))
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=502, detail=UNAVAILABLE_MESSAGE) from exc

    return ChatResponse(reply=str(response.content))


def stream_tokens(request: ChatRequest) -> Generator[str, None, None]:
    messages = build_messages(request)
    try:
        for chunk in get_llm().stream(messages):
            if chunk.content:
                escaped = str(chunk.content).replace("\n", "\ndata: ")
                yield f"data: {escaped}\n\n"
    except Exception:
        logger.exception("Chat stream failed")
        yield f"data: {UNAVAILABLE_MESSAGE}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(stream_tokens(request), media_type="text/event-stream")
