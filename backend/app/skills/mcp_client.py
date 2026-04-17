"""
MCP Client — gere ligações a servidores MCP (Model Context Protocol).
Permite que qualquer skill com campo 'mcp_server' no manifest seja tratada
como um servidor MCP em vez de um skill.py local.
"""

import os
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class MCPContext:
    """
    Gere as ligações a um ou mais servidores MCP durante a execução de um agente.
    Uso típico no engine:

        ctx = MCPContext(mcp_skills)
        tools = await ctx.start()        # arranca servidores, devolve tools
        result = await ctx.call_tool(name, input)
        await ctx.close()                # termina processos
    """

    def __init__(self, mcp_skills: list[dict]):
        """
        mcp_skills: lista de dicts com:
          - slug: str
          - mcp_server: dict (command, args, env, env_from_config)
          - config: dict (config do agente para esta skill)
        """
        self._skills = mcp_skills
        self._tools_by_name: dict[str, tuple[str, ClientSession]] = {}
        self._exit_stack = AsyncExitStack()
        self._all_tools: list[dict] = []
        self._started = False

    async def start(self) -> list[dict]:
        """Arranca todos os servidores MCP e devolve a lista combinada de tools."""
        await self._exit_stack.__aenter__()
        self._started = True

        for skill in self._skills:
            try:
                tools = await self._connect(skill)
                self._all_tools.extend(tools)
                print(f"[mcp] {skill['slug']}: {len(tools)} tool(s) carregada(s)")
            except Exception as e:
                print(f"[mcp] Erro ao ligar a '{skill['slug']}': {e}")

        return self._all_tools

    async def _connect(self, skill: dict) -> list[dict]:
        slug       = skill["slug"]
        mcp_cfg    = skill["mcp_server"]
        skill_cfg  = skill.get("config", {})

        # Construir env vars para o subprocess
        env = {**os.environ}
        for env_key, cfg_key in mcp_cfg.get("env_from_config", {}).items():
            val = skill_cfg.get(cfg_key)
            if val is not None:
                env[env_key] = str(val)
        for env_key, val in mcp_cfg.get("env", {}).items():
            env[env_key] = str(val)

        server_params = StdioServerParameters(
            command=mcp_cfg["command"],
            args=mcp_cfg.get("args", []),
            env=env,
        )

        read, write = await self._exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        session: ClientSession = await self._exit_stack.enter_async_context(
            ClientSession(read, write)
        )
        await session.initialize()

        # Obter lista de tools do servidor
        tools_result = await session.list_tools()
        tools = []
        for tool in tools_result.tools:
            self._tools_by_name[tool.name] = (slug, session)
            tools.append({
                "name": tool.name,
                "description": tool.description or f"Tool MCP de '{slug}'",
                "input_schema": tool.inputSchema or {"type": "object", "properties": {}},
            })

        return tools

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self._tools_by_name

    async def call_tool(self, tool_name: str, tool_input: dict) -> str:
        if tool_name not in self._tools_by_name:
            return f"[erro] Tool MCP '{tool_name}' não encontrada."

        _, session = self._tools_by_name[tool_name]
        result = await session.call_tool(tool_name, tool_input)

        parts = []
        for item in result.content:
            if hasattr(item, "text"):
                parts.append(item.text)
            else:
                parts.append(str(item))

        return "\n".join(parts) if parts else "(sem resultado)"

    async def close(self):
        if self._started:
            await self._exit_stack.aclose()
            self._started = False
