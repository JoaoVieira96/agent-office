"""API — Hooks"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.db.models import Hook, HookEvent

router = APIRouter()


class HookCreate(BaseModel):
    agent_id: UUID
    name: str
    event: HookEvent
    action_type: str   # "webhook" | "skill" | "notify"
    config: dict = {}


class HookUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict] = None
    is_active: Optional[bool] = None


@router.get("/agent/{agent_id}")
def list_hooks(agent_id: UUID, db: Session = Depends(get_db)):
    return db.query(Hook).filter(Hook.agent_id == agent_id).all()


@router.post("/", status_code=201)
def create_hook(body: HookCreate, db: Session = Depends(get_db)):
    hook = Hook(**body.model_dump())
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return hook


@router.patch("/{hook_id}")
def update_hook(hook_id: UUID, body: HookUpdate, db: Session = Depends(get_db)):
    hook = db.query(Hook).filter(Hook.id == hook_id).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Hook não encontrado")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(hook, field, value)
    db.commit()
    db.refresh(hook)
    return hook


@router.delete("/{hook_id}", status_code=204)
def delete_hook(hook_id: UUID, db: Session = Depends(get_db)):
    hook = db.query(Hook).filter(Hook.id == hook_id).first()
    if hook:
        db.delete(hook)
        db.commit()
