"""
Skills Registry — devolve as tools activas para um agente,
no formato esperado pela API do Claude (tools=[...]).

Skills com 'mcp_server' no manifest sao tratadas como servidores MCP:
as suas tools sao descobertas em runtime pelo MCPContext.
"""

import json
import importlib.util
from pathlib import Path
from uuid import UUID
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AgentSkill, Skill

# Configuração global injectada em skills que a necessitam.
# O agent config tem prioridade — estes são apenas fallbacks.
_GLOBAL_CONFIG: dict[str, dict] = {
    "github": {
        "token":         lambda: settings.GITHUB_TOKEN,
        "default_owner": lambda: settings.GITHUB_DEFAULT_OWNER,
    },
}


def _build_config(slug: str, agent_config: dict) -> dict:
    """Merge global config (fallback) com config específica do agente (prioridade)."""
    global_defaults = {k: v() for k, v in _GLOBAL_CONFIG.get(slug, {}).items()}
    return {**global_defaults, **agent_config}


async def get_tools_for_agent(agent_id: UUID, db: Session) -> list[dict]:
    """
    Devolve tool definitions (formato Anthropic) para skills regulares activas.
    Skills MCP sao excluidas aqui — as suas tools sao geridas pelo MCPContext.
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
        manifest = _load_manifest(agent_skill.skill.slug)
        if manifest is None:
            continue
        if "mcp_server" in manifest:
            continue  # skills MCP sao tratadas pelo MCPContext
        tool_def = manifest.get("tool_schema")
        if tool_def:
            tools.append(tool_def)

    return tools


async def get_mcp_configs_for_agent(agent_id: UUID, db: Session) -> list[dict]:
    """
    Devolve configuracoes das skills MCP activas para este agente.
    Cada entry tem: slug, mcp_server (config do servidor), config (config do agente).
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

    mcp_skills = []
    for agent_skill in agent_skills:
        manifest = _load_manifest(agent_skill.skill.slug)
        if manifest is None:
            continue
        if "mcp_server" not in manifest:
            continue
        mcp_skills.append({
            "slug":       agent_skill.skill.slug,
            "mcp_server": manifest["mcp_server"],
            "config":     agent_skill.config or {},
        })

    return mcp_skills


def _load_manifest(slug: str) -> dict | None:
    manifest_path = Path(settings.SKILLS_DIR) / slug / "manifest.json"
    if not manifest_path.exists():
        return None
    return json.loads(manifest_path.read_text())


async def execute_skill(slug: str, params: dict, config: dict) -> str:
    """
    Executa uma skill regular pelo slug.
    Nao deve ser chamada para skills MCP (tratadas pelo MCPContext).
    """
    skill_file = Path(settings.SKILLS_DIR) / slug / "skill.py"
    if not skill_file.exists():
        return f"[erro] Skill '{slug}' nao tem skill.py."

    spec = importlib.util.spec_from_file_location(f"skill_{slug}", skill_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, "run"):
        return f"[erro] Skill '{slug}' nao tem funcao run()."

    return await module.run(params=params, config=_build_config(slug, config))
