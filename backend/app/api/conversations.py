"""
API — Conversas e Chat
Endpoints REST para gestão de conversas e mensagens.
O WebSocket está em app/api/ws.py (registado sem prefixo em /ws/{id}).
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.db.models import Conversation, Message, MessageRole
from app.auth.deps import get_current_user

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
