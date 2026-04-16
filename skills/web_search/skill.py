"""
Skill: web_search
Pesquisa na web usando DuckDuckGo (sem API key necessária).
"""

import httpx


async def run(params: dict, config: dict) -> str:
    """
    params:  {"query": "..."}           — vem do LLM
    config:  {"max_results": 5}         — vem da configuração do agente
    returns: string com os resultados formatados
    """
    query       = params.get("query", "")
    max_results = config.get("max_results", 5)

    if not query:
        return "Erro: query em falta."

    try:
        results = await _search_duckduckgo(query, max_results)
        if not results:
            return f"Sem resultados para: {query}"

        lines = [f"Resultados para '{query}':\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. {r['title']}")
            lines.append(f"   {r['url']}")
            lines.append(f"   {r['snippet']}\n")

        return "\n".join(lines)

    except Exception as e:
        return f"Erro na pesquisa: {e}"


async def _search_duckduckgo(query: str, max_results: int) -> list[dict]:
    """
    Usa a API instant answers do DuckDuckGo.
    Para produção considera usar SerpAPI ou Brave Search API.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
        )
        data = resp.json()

    results = []

    # Resultado principal
    if data.get("AbstractText"):
        results.append({
            "title":   data.get("Heading", query),
            "url":     data.get("AbstractURL", ""),
            "snippet": data["AbstractText"][:300],
        })

    # Resultados relacionados
    for item in data.get("RelatedTopics", [])[:max_results]:
        if isinstance(item, dict) and item.get("Text"):
            results.append({
                "title":   item.get("Text", "")[:80],
                "url":     item.get("FirstURL", ""),
                "snippet": item.get("Text", "")[:300],
            })

    return results[:max_results]
