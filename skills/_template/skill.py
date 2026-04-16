"""
Template de Skill — Agent Office
Copia esta pasta para skills/<nome_da_skill>/ e implementa a função run().
"""


async def run(params: dict, config: dict) -> str:
    """
    Ponto de entrada da skill. Chamado pelo agent engine quando o LLM decide usar esta ferramenta.

    Args:
        params: Parâmetros enviados pelo LLM (definidos em manifest.json > tool_schema > input_schema)
        config: Configuração do agente para esta skill (definida em manifest.json > config_schema)

    Returns:
        String com o resultado — o LLM vai receber este texto como output da ferramenta
    """

    # Exemplo: lê o parâmetro "query" enviado pelo LLM
    query = params.get("query", "")

    # Lê configuração do agente (com fallback para o valor default)
    max_results = config.get("max_results", 5)

    # --- Implementa a tua lógica aqui ---
    result = f"Skill executada com query='{query}' e max_results={max_results}"

    return result
