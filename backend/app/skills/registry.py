"""
Skills Registry — devolve as tools activas para um agente,
no formato esperado pela API do Claude (tools=[...]).
"""

import json
import importlib.util
from pathlib import Path
from uuid import UUID
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AgentSkill, Skill


async def get_tools_for_agent(agent_id: UUID, db: Session) -> list[dict]:
    """
    Devolve a lista de tool definitions no formato Anthropic
    para todas as skills activas do agente.
    """
    agent_skills = (
        db.query(AgentSkill)
        .join(Skill)
        .filter(
            AgentSkill.agent_id == agent_id,
            AgentSkill.is_active == True,
            Skill.is_enabled == True,
        )
        .all()
    )

    tools = []
    for agent_skill in agent_skills:
        tool_def = _load_tool_definition(agent_skill.skill.slug)
        if tool_def:
            tools.append(tool_def)

    return tools


def _load_tool_definition(slug: str) -> dict | None:
    """
    Lê o manifest.json da skill e constrói a tool definition.
    """
    skill_path = Path(settings.SKILLS_DIR) / slug / "manifest.json"
    if not skill_path.exists():
        return None

    manifest = json.loads(skill_path.read_text())
    tool_schema = manifest.get("tool_schema")
    if not tool_schema:
        return None

    return tool_schema


async def execute_skill(slug: str, params: dict, config: dict) -> str:
    """
    Executa a skill pelo slug, passando params (do LLM) e config (do agente).
    Devolve o resultado como string.
    """
    skill_file = Path(settings.SKILLS_DIR) / slug / "skill.py"
    if not skill_file.exists():
        return f"[erro] Skill '{slug}' não encontrada em disco."

    spec = importlib.util.spec_from_file_location(f"skill_{slug}", skill_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, "run"):
        return f"[erro] Skill '{slug}' não tem função run()."

    return await module.run(params=params, config=config)
