# CONTEXT.md — Agent Office
> Ficheiro de briefing para Claude Code. Cola o conteúdo deste ficheiro no início de uma sessão.

---

## O que é este projeto

**Agent Office** é uma plataforma pessoal de agentes de IA, construída de raiz pelo utilizador com ajuda do Claude.
O conceito é um "escritório virtual" onde o utilizador é o manager e os agentes são colaboradores especializados.

Funcionalidades principais:
- Criar e configurar agentes (nome, avatar, system prompt, modelo LLM)
- Conversar com cada agente via chat em tempo real (WebSocket)
- Atribuir **skills** (ferramentas/plugins) a cada agente, com configuração por agente
- Configurar **hooks** (eventos que disparam acções automáticas)

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Base de dados | PostgreSQL 16 |
| Cache / filas | Redis 7 |
| Reverse proxy | Nginx |
| Infra | Docker Compose (um único `docker compose up` levanta tudo) |
| LLM principal | Anthropic Claude (via `anthropic` SDK) |

---

## Estrutura de ficheiros

```
agent-office/
├── docker-compose.yml
├── .env
├── .env.example
├── README.md
├── data/                       <- pasta montada em /data no backend (skill file_access)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             <- FastAPI app, routers, lifespan
│       ├── config.py
│       ├── agents/
│       │   └── engine.py       <- run_agent_stream(): LLM + skills + hooks + streaming
│       ├── api/
│       │   ├── agents.py       <- CRUD de agentes
│       │   ├── conversations.py
│       │   ├── ws.py           <- WebSocket /ws/{conv_id} (sem prefixo)
│       │   ├── skills.py       <- atribuicao de skills a agentes
│       │   └── hooks.py
│       ├── auth/
│       │   ├── router.py       <- POST /api/auth/login -> JWT 30 dias
│       │   └── deps.py         <- get_current_user (REST) + ws_auth (WebSocket)
│       ├── db/
│       │   ├── models.py       <- Agent, Skill, AgentSkill, Hook, Conversation, Message
│       │   └── session.py
│       ├── hooks/
│       │   └── engine.py
│       ├── llm/
│       │   └── anthropic.py    <- stream_anthropic() com tool use loop
│       └── skills/
│           ├── loader.py
│           ├── registry.py     <- get_tools_for_agent(), get_mcp_configs_for_agent(), execute_skill()
│           └── mcp_client.py   <- MCPContext: arranca/gere servidores MCP via stdio
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js      <- surface=#0f0f10, panel=#18181b, accent=#6366f1
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx        <- homepage: lista de agentes (fusao com /agents)
│       │   ├── globals.css
│       │   ├── login/page.tsx
│       │   ├── agents/
│       │   │   ├── page.tsx            <- redireciona para / (redundante removida)
│       │   │   ├── new/page.tsx        <- criacao em 3 passos (template -> dados -> skills)
│       │   │   └── [id]/
│       │   │       ├── page.tsx        <- editar (com tabs Chat/Skills/Hooks)
│       │   │       ├── skills/page.tsx <- gerir skills (config inline por skill)
│       │   │       └── hooks/page.tsx
│       │   ├── chat/[agentId]/page.tsx <- chat WebSocket com streaming
│       │   ├── skills/page.tsx
│       │   ├── hooks/page.tsx
│       │   └── settings/page.tsx
│       ├── components/
│       │   ├── Sidebar.tsx     <- navegacao + logout
│       │   └── AppShell.tsx    <- guard de autenticacao
│       └── lib/
│           ├── api.ts          <- cliente HTTP + types + createChatSocket()
│           └── auth.ts         <- getToken/setToken/clearToken
│
├── skills/
│   ├── _template/
│   ├── web_search/             <- DuckDuckGo (sem API key)
│   ├── code_runner/            <- Python subprocess com timeout
│   ├── delegate_to_agent/      <- delega tarefa a outro agente por nome
│   ├── anthropic_web_search/   <- web search nativa Anthropic (sem skill.py)
│   ├── anthropic_code_execution/ <- code execution nativa Anthropic (sem skill.py)
│   ├── file_access/            <- le/lista ficheiros (base_dir configuravel, anti path-traversal)
│   └── github/                 <- GitHub completo (repos, ficheiros, issues, PRs, branches, commits)
│
└── infra/nginx/nginx.conf
```

---

## Modelos de dados principais

```python
Agent(id, name, description, avatar, system_prompt, llm_provider, llm_model, temperature, is_active)
Skill(id, slug, name, description, version, config_schema, is_enabled)
AgentSkill(id, agent_id, skill_id, config, is_active)
Hook(id, agent_id, name, event, action_type, config, is_active)
# events: on_message_received, on_message_sent, on_task_complete, on_error, on_conversation_start, on_conversation_end
# action_types: webhook, skill, notify
Conversation(id, agent_id, title)
Message(id, conversation_id, role, content, message_metadata)
```

---

## API REST

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login -> JWT 30 dias |
| GET/POST | `/api/agents/` | Listar / criar agentes |
| GET/PATCH/DELETE | `/api/agents/{id}` | Ler / editar / arquivar |
| GET/POST | `/api/conversations/agent/{id}` | Listar / criar conversas |
| GET | `/api/conversations/{id}/messages` | Historico |
| WS | `/ws/{conv_id}?token=...` | Chat em tempo real |
| GET | `/api/skills/` | Skills disponíveis |
| GET/POST | `/api/skills/agent/{id}` | Skills do agente |
| DELETE | `/api/skills/agent/{id}/{skill_id}` | Remover skill |
| GET/POST | `/api/hooks/agent/{id}` | Hooks do agente |
| PATCH/DELETE | `/api/hooks/{id}` | Editar / apagar hook |

Swagger UI: `http://localhost:8000/docs`

---

## Como o sistema de skills funciona

Cada skill é uma pasta em `skills/` com `manifest.json` e opcionalmente `skill.py`.

**manifest.json:**
```json
{
  "slug": "minha_skill",
  "name": "Nome",
  "description": "...",
  "config_schema": {
    "type": "object",
    "properties": {
      "opcao": { "type": "string", "default": "valor", "description": "..." }
    }
  },
  "tool_schema": {
    "name": "minha_skill",
    "description": "Descricao para o LLM",
    "input_schema": { "type": "object", "properties": {} }
  }
}
```

**skill.py:**
```python
async def run(params: dict, config: dict) -> str:
    return "resultado"
```

**Skills nativas Anthropic** (sem skill.py) — campo `name` obrigatorio:
```json
{ "tool_schema": { "type": "web_search_20260209", "name": "web_search" } }
```

---

## WebSocket

```
Cliente -> WS: {"message": "texto"}
Servidor -> WS: {"type": "thinking"}
Servidor -> WS: {"type": "chunk", "content": "..."}   <- streaming
Servidor -> WS: {"type": "done", "content": "resposta completa"}
Servidor -> WS: {"type": "error", "content": "..."}
```

Autenticacao: `/ws/{conversation_id}?token=JWT`

---

## Design system

- Tema dark exclusivo
- `surface=#0f0f10`, `panel=#18181b`, `border=#27272a`, `muted=#71717a`, `accent=#6366f1`
- `.input-base` para inputs/selects, `.fade-up` para entradas, `.thinking-dot` para loading
- Icones: `lucide-react`
- Sidebar 58px a esquerda
- **node_modules so existe no Docker** — erros de LS sobre lucide-react/next/link no host sao falsos positivos

---

## Estado actual

- [x] Arquitectura completa
- [x] Backend FastAPI com todos os endpoints
- [x] Frontend Next.js com todas as paginas
- [x] Autenticacao JWT (30 dias, guard no frontend, logout)
- [x] Streaming LLM chunk a chunk com tool use loop
- [x] Agent-to-agent delegation (skill delegate_to_agent)
- [x] Skills nativas Anthropic (web_search, code_execution)
- [x] Skill: file_access (base_dir configuravel, anti path-traversal)
- [x] Skill: GitHub completo (repos, ficheiros, issues, PRs, branches, commits)
- [x] Criacao de agente em 3 passos (template -> dados -> skills)
- [x] Templates de agente pre-configurados (Frontend Developer, Backend Developer)
- [x] Pagina de edicao com tabs (Chat / Skills / Hooks)
- [x] Skills config UI inline (formulario para skills com config_schema)
- [x] Homepage unificada com lista de agentes e atalhos (chat, skills, hooks, editar)
- [x] Suporte MCP generico no backend (MCPContext, mcp_client.py)
- [x] jCodeMunch MCP (leitura de codigo token-eficiente)
- [ ] **Prompt caching** — adicionar `cache_control` ao system prompt e tools no `stream_anthropic()`. Risco: zero. Reducao: ~90% dos tokens de system prompt+tools. Implementacao: 5 linhas em `backend/app/llm/anthropic.py`
- [ ] **Resumo de conversa** — quando conversa ultrapassa N mensagens, gerar resumo comprimido com Sonnet e guardar na DB. Enviar resumo + ultimas 5 mensagens em vez das 40 completas. Risco: medio (mitigavel com bom prompt de resumo que preserve decisoes tecnicas e erros). Reducao: 60-80% em conversas longas. Requer novo campo `summary` em `Conversation`
- [ ] **Memoria por agente** — cada agente tem factos persistentes na DB (ex: "usa useParams() no Next.js 15", "message_metadata nao metadata"). Injectados no system prompt como contexto estatico cached. Risco: baixo (requer manutencao quando factos mudam). Reducao: elimina redescoberta de contexto entre conversas. Requer novo modelo `AgentMemory`

---

## Notas importantes

1. **Adicionar skill regular** -> criar pasta em `skills/` com `manifest.json` + `skill.py`, depois `docker compose restart backend`
2. **Adicionar skill MCP** -> criar pasta em `skills/` com `manifest.json` com campo `mcp_server` (sem `skill.py`). O binario MCP tem de estar na imagem Docker. Requer `docker compose up --build backend`
3. **Skills nativas Anthropic** -> campo `name` obrigatorio no `tool_schema` (erro 400 sem ele)
4. **anthropic_code_execution** -> NAO atribuir a opus-4-6 ou sonnet-4-6: o modelo ja injeta `code_execution` automaticamente, causando conflito de nomes (erro 400)
5. **Variaveis de ambiente** -> `.env` na raiz, nunca hardcoded. Credenciais: `ADMIN_USERNAME` e `ADMIN_PASSWORD`
6. **Limpar dados de teste** -> `docker compose exec postgres psql -U agentoffice -d agentoffice -c "TRUNCATE agents, conversations, messages, agent_skills, hooks RESTART IDENTITY CASCADE;"`
7. **Porta de entrada** -> sempre `http://localhost` (porta 80, Nginx)
8. **WebSocket** -> `backend/app/api/ws.py`, sem prefixo, auth via `?token=JWT`
9. **Next.js 15** -> usar `useParams()` de `next/navigation` em componentes client
10. **Rebuild vs restart** -> `docker compose restart` para skills/configs; `docker compose up --build` para codigo frontend/backend
11. **pasta data/** -> montada em `/data` no container, directorio padrao da skill file_access
12. **jCodeMunch MCP** -> skill `jcodemunch` usa `mcp_server` no manifest (sem skill.py). MCPContext em `backend/app/skills/mcp_client.py` gere a ligacao. Config: `repo_path=/app/repo` (o repo esta montado em `/app/repo` no container)
13. **Skills MCP genericas** -> qualquer skill com `mcp_server` no manifest e tratada como servidor MCP. O registry separa-as das skills regulares. O engine arranca os servidores MCP no inicio de cada conversa e termina-os no final
14. **node_modules so existe no Docker** -> erros de LS sobre lucide-react/next/link no host sao falsos positivos
