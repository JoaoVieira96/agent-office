"""
Cliente Anthropic — chama a API do Claude.
"""

from typing import Callable, Awaitable
import anthropic
from anthropic.types import Message as AnthropicMessage
from app.config import settings

_client = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def _build_kwargs(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict] | None,
    model: str,
    temperature: float,
    max_tokens: int,
) -> dict:
    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=messages,
        temperature=temperature,
    )
    if tools:
        kwargs["tools"] = tools
    return kwargs


async def stream_anthropic(
    system_prompt: str,
    messages: list[dict],
    on_chunk: Callable[[str], Awaitable[None]],
    tools: list[dict] | None = None,
    model: str = "claude-opus-4-6",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AnthropicMessage:
    """
    Faz streaming da resposta do Claude.
    Chama on_chunk(text) para cada fragmento de texto recebido.
    Devolve o AnthropicMessage final (pode conter tool_use blocks).
    """
    client = get_client()
    kwargs = _build_kwargs(system_prompt, messages, tools, model, temperature, max_tokens)

    async with client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            await on_chunk(text)
        return await stream.get_final_message()


def _serialize_content(content_blocks) -> list[dict]:
    """Converte os blocos de conteúdo do SDK para dicts compatíveis com a API."""
    result = []
    for block in content_blocks:
        if block.type == "text":
            result.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            result.append({
                "type": "tool_use",
                "id": block.id,
                "name": block.name,
                "input": block.input,
            })
    return result
