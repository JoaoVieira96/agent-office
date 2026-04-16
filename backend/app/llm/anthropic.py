"""
Cliente Anthropic — chama a API do Claude.
"""

import anthropic
from app.config import settings

_client = None

def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def call_anthropic(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict] | None = None,
    model: str = "claude-opus-4-6",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """
    Chama o Claude e devolve o texto da resposta.
    Se tools estiver preenchido, o agente pode usar skills.
    """
    client = get_client()

    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
        temperature=temperature,
    )

    if tools:
        kwargs["tools"] = tools

    response = await client.messages.create(**kwargs)

    # Extrai texto da resposta (pode vir misturado com tool_use blocks)
    text_parts = [
        block.text
        for block in response.content
        if block.type == "text"
    ]
    return "\n".join(text_parts)
