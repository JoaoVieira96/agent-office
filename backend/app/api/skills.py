"""API — Skills (atribuição a agentes)"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import AgentSkill, Skill

router = APIRouter()


class AssignSkill(BaseModel):
    skill_id: UUID
    config: dict = {}


@router.get("/", summary="Lista todas as skills disponíveis")
def list_skills(db: Session = Depends(get_db)):
    return db.query(Skill).filter(Skill.is_enabled == True).all()


@router.get("/agent/{agent_id}", summary="Skills atribuídas a um agente")
def agent_skills(agent_id: UUID, db: Session = Depends(get_db)):
    return db.query(AgentSkill).filter(AgentSkill.agent_id == agent_id).all()


@router.post("/agent/{agent_id}", status_code=201, summary="Atribui skill a um agente")
def assign_skill(agent_id: UUID, body: AssignSkill, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.id == body.skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill não encontrada")

    agent_skill = AgentSkill(
        agent_id=agent_id,
        skill_id=body.skill_id,
        config=body.config,
    )
    db.add(agent_skill)
    db.commit()
    return {"ok": True}


@router.delete("/agent/{agent_id}/{skill_id}", status_code=204)
def remove_skill(agent_id: UUID, skill_id: UUID, db: Session = Depends(get_db)):
    row = (
        db.query(AgentSkill)
        .filter(AgentSkill.agent_id == agent_id, AgentSkill.skill_id == skill_id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
