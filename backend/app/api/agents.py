"""
API — Agentes
CRUD: listar, criar, editar, apagar agentes.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.db.models import Agent, LLMProvider

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas Pydantic
# ---------------------------------------------------------------------------

class AgentCreate(BaseModel):
    name: str
    description: str = ""
    avatar: str = "🤖"
    system_prompt: str
    llm_provider: LLMProvider = LLMProvider.anthropic
    llm_model: str = "claude-opus-4-6"
    temperature: int = 70


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_provider: Optional[LLMProvider] = None
    llm_model: Optional[str] = None
    temperature: Optional[int] = None
    is_active: Optional[bool] = None


class AgentOut(BaseModel):
    id: UUID
    name: str
    description: str
    avatar: str
    system_prompt: str
    llm_provider: LLMProvider
    llm_model: str
    temperature: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    """Lista todos os agentes activos."""
    return db.query(Agent).filter(Agent.is_active == True).all()


@router.post("/", response_model=AgentOut, status_code=201)
def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    """Contrata um novo agente."""
    agent = Agent(**body.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: UUID, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: UUID, body: AgentUpdate, db: Session = Depends(get_db)):
    """Edita as propriedades de um agente."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(agent, field, value)

    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: UUID, db: Session = Depends(get_db)):
    """Despede um agente (soft delete)."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    agent.is_active = False
    db.commit()
