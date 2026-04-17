"""
Modelos de base de dados — Agent Office
Tabelas: Agent, Conversation, Message, Skill, Hook
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, DateTime,
    ForeignKey, JSON, Integer, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class LLMProvider(str, enum.Enum):
    anthropic = "anthropic"
    openai    = "openai"
    ollama    = "ollama"


class MessageRole(str, enum.Enum):
    user      = "user"
    assistant = "assistant"
    system    = "system"


class HookEvent(str, enum.Enum):
    on_message_received  = "on_message_received"   # antes de o agente responder
    on_message_sent      = "on_message_sent"        # depois de responder
    on_task_complete     = "on_task_complete"       # quando o agente marca tarefa como feita
    on_error             = "on_error"               # se o agente falhar
    on_conversation_start = "on_conversation_start"
    on_conversation_end   = "on_conversation_end"


# ---------------------------------------------------------------------------
# Agent — o "colaborador" que defines e configurares
# ---------------------------------------------------------------------------

class Agent(Base):
    __tablename__ = "agents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(120), nullable=False)
    description = Column(Text, default="")
    avatar      = Column(String(10), default="🤖")          # emoji ou URL
    system_prompt = Column(Text, nullable=False)             # personalidade / função

    # LLM
    llm_provider = Column(SAEnum(LLMProvider), default=LLMProvider.anthropic)
    llm_model    = Column(String(80), default="claude-opus-4-6")
    temperature  = Column(Integer, default=70)               # 0–100 → divide por 100 no engine

    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relações
    conversations = relationship("Conversation", back_populates="agent", cascade="all, delete-orphan")
    agent_skills  = relationship("AgentSkill",   back_populates="agent", cascade="all, delete-orphan")
    hooks         = relationship("Hook",          back_populates="agent", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Agent {self.name}>"


# ---------------------------------------------------------------------------
# Skill — uma ferramenta que um agente pode usar
# ---------------------------------------------------------------------------

class Skill(Base):
    """
    Definição global de uma skill (ex: web_search, code_runner).
    Carregada automaticamente da pasta /skills.
    """
    __tablename__ = "skills"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug        = Column(String(80), unique=True, nullable=False)   # ex: "web_search"
    name        = Column(String(120), nullable=False)
    description = Column(Text, default="")
    version     = Column(String(20), default="1.0.0")
    config_schema = Column(JSON, default=dict)    # JSON Schema dos parâmetros de config
    is_enabled  = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    agent_skills = relationship("AgentSkill", back_populates="skill")


class AgentSkill(Base):
    """
    Atribuição de uma skill a um agente específico, com config própria.
    Ex: o agente 'Dev' tem web_search com max_results=10.
    """
    __tablename__ = "agent_skills"

    id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    config   = Column(JSON, default=dict)          # overrides de config por agente
    is_active = Column(Boolean, default=True)

    agent = relationship("Agent", back_populates="agent_skills")
    skill = relationship("Skill", back_populates="agent_skills")


# ---------------------------------------------------------------------------
# Hook — eventos que disparam ações automáticas
# ---------------------------------------------------------------------------

class Hook(Base):
    """
    Ex: quando o agente termina uma tarefa → envia notificação / chama webhook.
    """
    __tablename__ = "hooks"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id    = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    name        = Column(String(120), nullable=False)
    event       = Column(SAEnum(HookEvent), nullable=False)
    action_type = Column(String(40), nullable=False)    # "webhook" | "skill" | "notify"
    config      = Column(JSON, default=dict)             # URL, headers, payload template...
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="hooks")


# ---------------------------------------------------------------------------
# Conversation + Message — o histórico de cada chat
# ---------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id   = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    title      = Column(String(200), default="Nova conversa")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent    = relationship("Agent",   back_populates="conversations")
    messages = relationship("Message", back_populates="conversation",
                            cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    role            = Column(SAEnum(MessageRole), nullable=False)
    content         = Column(Text, nullable=False)
    message_metadata = Column(JSON, default=dict)    # skills usadas, tokens, duração...
    created_at      = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
