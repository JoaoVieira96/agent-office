"""
Agent Engine
Responsável por correr um agente: montar contexto, chamar o LLM,
executar skills e guardar o resultado.
"""

from uuid import UUID
from sqlalchemy.orm import Session

from app.db.models import Agent, Conversation, Message, MessageRole
from app.db.session import SessionLocal
from app.llm.anthropic import call_anthropic
from app.skills.registry import get_tools_for_agent
from app.hooks.engine import fire_hook, HookEvent


async def run_agent(
    agent_id: UUID,
    conversation_id: UUID,
    user_message: str,
    db: Session,
) -> str:
    """
    Ponto de entrada principal para correr um agente.
    1. Carrega o agente e o histórico da conversa
    2. Obtém as tools disponíveis para o agente
    3. Chama o LLM
    4. Guarda a resposta
    5. Dispara hooks
    """

    # 1. Carregar agente
    agent: Agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError(f"Agente {agent_id} não encontrado")

    # 2. Guardar mensagem do utilizador
    await fire_hook(agent, HookEvent.on_message_received, {"message": user_message}, db)

    user_msg = Message(
        conversation_id=conversation_id,
        role=MessageRole.user,
        content=user_message,
    )
    db.add(user_msg)
    db.commit()

    # 3. Montar histórico (últimas 40 mensagens para não exceder contexto)
    conversation: Conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    history = [
        {"role": m.role.value, "content": m.content}
        for m in conversation.messages[-40:]
    ]

    # 4. Obter tools activas para este agente
    tools = await get_tools_for_agent(agent_id, db)

    # 5. Chamar o LLM
    response_text = await call_anthropic(
        system_prompt=agent.system_prompt,
        messages=history,
        tools=tools,
        model=agent.llm_model,
        temperature=agent.temperature / 100,
    )

    # 6. Guardar resposta do agente
    assistant_msg = Message(
        conversation_id=conversation_id,
        role=MessageRole.assistant,
        content=response_text,
    )
    db.add(assistant_msg)
    db.commit()

    # 7. Disparar hook pós-resposta
    await fire_hook(agent, HookEvent.on_message_sent, {"response": response_text}, db)

    return response_text
