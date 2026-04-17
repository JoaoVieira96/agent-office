"""
Skill: delegate_to_agent
Delega uma tarefa a outro agente e devolve o resultado.

O agente worker recebe a tarefa numa conversa temporária,
executa-a (incluindo as suas próprias skills) e devolve a resposta.
"""

from app.db.session import SessionLocal
from app.db.models import Agent, Conversation


async def run(params: dict, config: dict) -> str:
    agent_name: str = params.get("agent_name", "").strip()
    task: str       = params.get("task", "").strip()

    if not agent_name or not task:
        return "[erro] São necessários 'agent_name' e 'task'."

    # Importação tardia para evitar ciclos no carregamento
    from app.agents.engine import run_agent_stream

    db = SessionLocal()
    try:
        # Procurar o agente pelo nome (case-insensitive)
        worker: Agent = (
            db.query(Agent)
            .filter(Agent.is_active == True)
            .all()
        )
        worker = next(
            (a for a in worker if a.name.lower() == agent_name.lower()),
            None,
        )

        if not worker:
            available = db.query(Agent).filter(Agent.is_active == True).all()
            names = ", ".join(f"'{a.name}'" for a in available)
            return f"[erro] Agente '{agent_name}' não encontrado. Agentes disponíveis: {names}"

        # Criar conversa temporária para a delegação
        conv = Conversation(
            agent_id=worker.id,
            title=f"[Delegação] {task[:80]}",
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

        # Correr o worker em silêncio (chunks descartados — o manager incorpora o resultado)
        async def _noop(text: str) -> None:
            pass

        result = await run_agent_stream(
            agent_id=worker.id,
            conversation_id=conv.id,
            user_message=task,
            db=db,
            on_chunk=_noop,
        )

        return f"[{worker.name}]: {result}"

    except Exception as e:
        return f"[erro na delegação] {e}"

    finally:
        db.close()
