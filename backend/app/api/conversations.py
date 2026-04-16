"""
API — Conversas e Chat
Inclui endpoint REST e WebSocket para chat em tempo real.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models import Conversation, Message, MessageRole
from app.agents.engine import run_agent
from app.auth.deps import get_current_user, ws_auth

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConversationOut(BaseModel):
    id: UUID
    agent_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: UUID
    role: MessageRole
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# REST — Gestão de conversas
# ---------------------------------------------------------------------------

@router.get("/agent/{agent_id}", response_model=list[ConversationOut])
def list_conversations(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return (
        db.query(Conversation)
        .filter(Conversation.agent_id == agent_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )


@router.post("/agent/{agent_id}", response_model=ConversationOut, status_code=201)
def create_conversation(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    conv = Conversation(agent_id=agent_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def get_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conv.messages


# ---------------------------------------------------------------------------
# WebSocket — Chat em tempo real
# O token JWT é passado como query param: /ws/{conv_id}?token=<jwt>
# ---------------------------------------------------------------------------

@router.websocket("/ws/{conversation_id}")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(ws_auth),
):
    """
    WebSocket de chat.
    Cliente envia: {"message": "..."}
    Servidor responde: {"type": "thinking"}
                       {"type": "done",  "content": "resposta completa"}
                       {"type": "error", "content": "mensagem de erro"}
    """
    await websocket.accept()

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        await websocket.send_json({"type": "error", "content": "Conversa não encontrada"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "").strip()

            if not user_message:
                continue

            await websocket.send_json({"type": "thinking"})

            try:
                response = await run_agent(
                    agent_id=conv.agent_id,
                    conversation_id=conversation_id,
                    user_message=user_message,
                    db=db,
                )
                await websocket.send_json({"type": "done", "content": response})

            except Exception as e:
                await websocket.send_json({"type": "error", "content": str(e)})

    except WebSocketDisconnect:
        pass
