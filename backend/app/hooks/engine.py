"""
Hook Engine — dispara hooks quando ocorrem eventos num agente.
"""

import httpx
from sqlalchemy.orm import Session
from app.db.models import Agent, Hook, HookEvent


async def fire_hook(agent: Agent, event: HookEvent, payload: dict, db: Session):
    """
    Procura hooks activos para o evento e executa-os.
    Falhas nos hooks não interrompem o fluxo principal.
    """
    hooks = (
        db.query(Hook)
        .filter(
            Hook.agent_id == agent.id,
            Hook.event == event,
            Hook.is_active == True,
        )
        .all()
    )

    for hook in hooks:
        try:
            await _execute_hook(hook, payload)
        except Exception as e:
            print(f"[hooks] Erro no hook '{hook.name}': {e}")


async def _execute_hook(hook: Hook, payload: dict):
    action = hook.action_type

    if action == "webhook":
        # Chama uma URL externa com o payload
        url     = hook.config.get("url")
        headers = hook.config.get("headers", {})
        if url:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(url, json={**payload, "hook": hook.name}, headers=headers)

    elif action == "notify":
        # Por agora apenas loga — pode ser expandido para email, Slack, etc.
        channel = hook.config.get("channel", "console")
        print(f"[notify:{channel}] Hook '{hook.name}' disparado: {payload}")

    elif action == "skill":
        # Executa uma skill como reacção ao evento
        from app.skills.registry import execute_skill
        slug   = hook.config.get("skill_slug")
        params = {**payload, **hook.config.get("params", {})}
        if slug:
            result = await execute_skill(slug, params, hook.config)
            print(f"[hooks] Skill '{slug}' executada: {result[:100]}")
