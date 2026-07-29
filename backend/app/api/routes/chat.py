from fastapi import APIRouter
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])

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
