"""
Agent Engine
Responsavel por correr um agente: montar contexto, chamar o LLM,
executar skills e guardar o resultado.
"""

from typing import Callable, Awaitable
from uuid import UUID
from sqlalchemy.orm import Session

from app.db.models import Agent, Conversation, Message, MessageRole, AgentSkill, Skill as SkillModel
from app.db.session import SessionLocal
from app.llm.anthropic import stream_anthropic, _serialize_content
from app.skills.registry import get_tools_for_agent, get_mcp_configs_for_agent, execute_skill
from app.skills.mcp_client import MCPContext
from app.hooks.engine import fire_hook, HookEvent


async def run_agent_stream(
    agent_id: UUID,
    conversation_id: UUID,
    user_message: str,
    db: Session,
    on_chunk: Callable[[str], Awaitable[None]],
) -> str:
    """
    Corre o agente com streaming.
    - Chama on_chunk(text) para cada fragmento de texto do LLM.
    - Trata tool use: skills regulares via execute_skill(), skills MCP via MCPContext.
    - Guarda a resposta completa na base de dados.
    - Devolve o texto completo da resposta.
    """

    # 1. Carregar agente
    agent: Agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError(f"Agente {agent_id} nao encontrado")

    # 2. Hook de entrada + guardar mensagem do utilizador
    await fire_hook(agent, HookEvent.on_message_received, {"message": user_message}, db)

    user_msg = Message(
        conversation_id=conversation_id,
        role=MessageRole.user,
        content=user_message,
    )
    db.add(user_msg)
    db.commit()

    # 3. Montar historico (ultimas 40 mensagens)
    conversation: Conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()

    current_messages = [
        {"role": m.role.value, "content": m.content}
        for m in conversation.messages[-40:]
    ]

    # 4. Obter tools regulares
    tools = await get_tools_for_agent(agent_id, db)

    # 5. Iniciar servidores MCP (se existirem) e adicionar as suas tools
    mcp_context: MCPContext | None = None
    mcp_configs = await get_mcp_configs_for_agent(agent_id, db)
    if mcp_configs:
        mcp_context = MCPContext(mcp_configs)
        mcp_tools = await mcp_context.start()
        tools = tools + mcp_tools

    # 6. Loop LLM — repete se o modelo quiser usar tools
    full_text = ""

    try:
        while True:
            final_message = await stream_anthropic(
                system_prompt=agent.system_prompt,
                messages=current_messages,
                tools=tools or None,
                model=agent.llm_model,
                temperature=agent.temperature / 100,
                on_chunk=on_chunk,
            )

            # Acumular texto desta ronda
            text_parts = [b.text for b in final_message.content if b.type == "text"]
            if text_parts:
                full_text += "\n".join(text_parts)

            # Se nao ha tool use, terminar o loop
            if final_message.stop_reason != "tool_use":
                break

            # Executar as tools pedidas pelo modelo
            tool_results = []
            for block in final_message.content:
                if block.type != "tool_use":
                    continue

                # Tool MCP?
                if mcp_context and mcp_context.has_tool(block.name):
                    result = await mcp_context.call_tool(block.name, block.input)
                else:
                    # Skill regular — obter config especifica do agente
                    agent_skill = (
                        db.query(AgentSkill)
                        .join(SkillModel)
                        .filter(
                            AgentSkill.agent_id == agent_id,
                            SkillModel.slug == block.name,
                        )
                        .first()
                    )
                    config = agent_skill.config if agent_skill else {}
                    result = await execute_skill(block.name, block.input, config)

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

            # Adicionar resposta do assistente + resultados das tools ao historico
            current_messages = list(current_messages) + [
                {"role": "assistant", "content": _serialize_content(final_message.content)},
                {"role": "user",      "content": tool_results},
            ]

    finally:
        # Garantir que os servidores MCP sao sempre terminados
        if mcp_context:
            await mcp_context.close()

    # 7. Guardar resposta completa
    assistant_msg = Message(
        conversation_id=conversation_id,
        role=MessageRole.assistant,
        content=full_text,
    )
    db.add(assistant_msg)
    db.commit()

    # 8. Hook de saida
    await fire_hook(agent, HookEvent.on_message_sent, {"response": full_text}, db)

    return full_text
