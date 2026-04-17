# Agent Office

Escritório pessoal de agentes de IA. Cria, configura e conversa com agentes especializados, cada um com as suas skills, hooks e personalidade própria.

---

## Arranque rápido

```bash
# 1. Clonar e entrar na pasta
git clone <repo> agent-office && cd agent-office

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edita .env: define ANTHROPIC_API_KEY, ADMIN_USERNAME, ADMIN_PASSWORD

# 3. Levantar tudo
docker compose up --build

# 4. Abrir no browser
open http://localhost
```

Login com as credenciais definidas em `ADMIN_USERNAME` / `ADMIN_PASSWORD` no `.env`.

> Acesso remoto (iPhone, iPad, outro PC na rede): instala [Tailscale](https://tailscale.com) e acede via IP Tailscale.

---

## Funcionalidades

- **Agentes** — cria agentes com nome, avatar, system prompt, modelo LLM e temperatura
- **Templates** — arranca de um template pré-configurado (Frontend Developer, Backend Developer) ou do zero
- **Chat em tempo real** — WebSocket com streaming chunk a chunk e suporte a tool use
- **Skills** — plugins que os agentes podem usar como ferramentas (web search, código, ficheiros, GitHub, etc.)
- **Skills MCP** — suporte a servidores MCP genéricos via stdio (ex: jCodeMunch)
- **Hooks** — eventos automáticos que disparam webhooks ou outras acções
- **Multi-LLM** — Anthropic Claude, OpenAI GPT, Ollama (local)
- **Autenticação JWT** — login com token de 30 dias, guard no frontend

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Base de dados | PostgreSQL 16 |
| Cache / filas | Redis 7 |
| Reverse proxy | Nginx |
| Infra | Docker Compose |
| LLM principal | Anthropic Claude (via `anthropic` SDK) |

---

## Estrutura do projeto

```
agent-office/
├── docker-compose.yml
├── .env                        ← variáveis de ambiente (não commitar)
├── .env.example
├── data/                       ← montado em /data no backend (skill file_access)
│
├── backend/
│   └── app/
│       ├── main.py             ← FastAPI app, routers, lifespan
│       ├── agents/engine.py    ← run_agent_stream(): LLM + skills + hooks + streaming
│       ├── api/                ← endpoints REST + WebSocket
│       ├── auth/               ← JWT login + guards
│       ├── db/models.py        ← Agent, Skill, AgentSkill, Hook, Conversation, Message
│       ├── hooks/engine.py     ← sistema de eventos
│       ├── llm/anthropic.py    ← stream_anthropic() com tool use loop
│       └── skills/
│           ├── loader.py       ← carrega manifests da pasta /skills
│           ├── registry.py     ← get_tools_for_agent(), execute_skill()
│           └── mcp_client.py   ← MCPContext: arranca/gere servidores MCP
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                    ← homepage: lista de agentes
│       │   ├── agents/new/page.tsx         ← criação em 3 passos (template → config → skills)
│       │   ├── agents/[id]/page.tsx        ← edição com tabs
│       │   ├── agents/[id]/skills/         ← gerir skills do agente
│       │   ├── agents/[id]/hooks/          ← gerir hooks do agente
│       │   └── chat/[agentId]/page.tsx     ← chat WebSocket
│       ├── components/
│       │   ├── Sidebar.tsx                 ← navegação + logout
│       │   └── AppShell.tsx                ← guard de autenticação
│       └── lib/
│           ├── api.ts                      ← cliente HTTP + types + createChatSocket()
│           └── auth.ts                     ← getToken / setToken / clearToken
│
└── skills/                     ← plugins instalados (ver secção Skills)
```

---

## Skills disponíveis

| Slug | Tipo | Descrição |
|------|------|-----------|
| `web_search` | Regular | Pesquisa DuckDuckGo (sem API key) |
| `code_runner` | Regular | Executa Python com timeout (subprocess) |
| `file_access` | Regular | Lê/lista ficheiros — `base_dir` configurável, anti path-traversal |
| `github` | Regular | GitHub completo: repos, ficheiros, issues, PRs, branches, commits |
| `delegate_to_agent` | Regular | Delega uma tarefa a outro agente por nome |
| `anthropic_web_search` | Nativa Anthropic | Web search nativa (requer Claude; sem skill.py) |
| `anthropic_code_execution` | Nativa Anthropic | Execução de código nativa (ver aviso abaixo) |
| `jcodemunch` | MCP | Indexa e analisa código-fonte de forma token-eficiente |

> **Aviso `anthropic_code_execution`**: NÃO atribuir a `claude-opus-4-6` nem `claude-sonnet-4-6`. Estes modelos injectam `code_execution` automaticamente, causando conflito de nomes (erro 400).

---

## Criar uma nova skill (regular)

```bash
cp -r skills/_template skills/minha_skill
```

**`skills/minha_skill/manifest.json`:**
```json
{
  "slug": "minha_skill",
  "name": "Minha Skill",
  "description": "O que esta skill faz",
  "version": "1.0.0",
  "config_schema": {
    "type": "object",
    "properties": {
      "opcao": { "type": "string", "default": "valor", "description": "..." }
    }
  },
  "tool_schema": {
    "name": "minha_skill",
    "description": "Descrição para o LLM decidir quando usar",
    "input_schema": {
      "type": "object",
      "properties": {
        "input": { "type": "string", "description": "..." }
      },
      "required": ["input"]
    }
  }
}
```

**`skills/minha_skill/skill.py`:**
```python
async def run(params: dict, config: dict) -> str:
    input_text = params.get("input", "")
    # lógica da skill
    return "resultado"
```

Reinicia o backend para carregar a skill:
```bash
docker compose restart backend
```

---

## Criar uma skill MCP

Uma skill MCP não tem `skill.py` — liga-se a um servidor MCP externo via stdio.

**`skills/minha_mcp/manifest.json`:**
```json
{
  "slug": "minha_mcp",
  "name": "Nome",
  "description": "...",
  "version": "1.0.0",
  "config_schema": {
    "type": "object",
    "properties": {
      "param": { "type": "string", "default": "valor", "description": "..." }
    }
  },
  "mcp_server": {
    "command": "nome-do-binario-mcp",
    "args": [],
    "env_from_config": {
      "ENV_VAR": "param"
    }
  }
}
```

O binário MCP tem de estar instalado na imagem Docker do backend. Adiciona-o ao `backend/requirements.txt` (se for um pacote Python) ou ao `backend/Dockerfile`.

Faz rebuild após adicionar:
```bash
docker compose up --build backend -d
```

---

## Criar uma skill nativa Anthropic

Para ferramentas nativas da API Anthropic (sem execução local), omite o `skill.py` e usa `type` no `tool_schema`:

```json
{
  "slug": "anthropic_web_search",
  "name": "Anthropic Web Search",
  "description": "...",
  "tool_schema": {
    "type": "web_search_20260209",
    "name": "web_search"
  }
}
```

> O campo `name` é obrigatório mesmo em skills nativas — a API retorna erro 400 sem ele.

---

## Hooks

Eventos que disparam acções automáticas quando algo acontece numa conversa.

| Evento | Quando dispara |
|--------|---------------|
| `on_message_received` | Antes do agente responder |
| `on_message_sent` | Depois de o agente responder |
| `on_task_complete` | Quando o agente marca tarefa como concluída |
| `on_error` | Se o agente falhar |
| `on_conversation_start` | Início de conversa |
| `on_conversation_end` | Fim de conversa |

Tipos de acção: `webhook`, `skill`, `notify`.

---

## WebSocket

```
Cliente → WS:  { "message": "texto" }

Servidor → WS: { "type": "thinking" }
Servidor → WS: { "type": "chunk", "content": "..." }   ← streaming
Servidor → WS: { "type": "done",  "content": "resposta completa" }
Servidor → WS: { "type": "error", "content": "..." }
```

Endpoint: `ws://localhost/ws/{conversation_id}?token=JWT`

---

## API REST

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login → JWT 30 dias |
| GET/POST | `/api/agents/` | Listar / criar agentes |
| GET/PATCH/DELETE | `/api/agents/{id}` | Ler / editar / arquivar |
| GET/POST | `/api/conversations/agent/{id}` | Listar / criar conversas |
| GET | `/api/conversations/{id}/messages` | Histórico |
| WS | `/ws/{conv_id}?token=...` | Chat em tempo real |
| GET | `/api/skills/` | Skills disponíveis |
| GET/POST | `/api/skills/agent/{id}` | Skills do agente |
| DELETE | `/api/skills/agent/{id}/{skill_id}` | Remover skill |
| GET/POST | `/api/hooks/agent/{id}` | Hooks do agente |
| PATCH/DELETE | `/api/hooks/{id}` | Editar / apagar hook |

Swagger UI interactivo: `http://localhost:8000/docs`

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | Sim | Chave da API do Claude |
| `ADMIN_USERNAME` | Sim | Username de login |
| `ADMIN_PASSWORD` | Sim | Password de login |
| `SECRET_KEY` | Sim | Segredo para assinar tokens JWT (muda em produção) |
| `OPENAI_API_KEY` | Não | Chave OpenAI (necessária para modelos GPT) |
| `ENVIRONMENT` | Não | `development` (default) ou `production` |

---

## Comandos úteis

```bash
# Levantar tudo (primeira vez ou após mudanças de código)
docker compose up --build

# Reiniciar só o backend (após adicionar/alterar skills)
docker compose restart backend

# Reiniciar só o frontend (após mudanças de UI sem rebuild)
docker compose restart frontend

# Rebuild só do backend (após alterar requirements.txt ou Dockerfile)
docker compose up --build backend -d

# Limpar base de dados (apaga todos os agentes, conversas, etc.)
docker compose exec postgres psql -U agentoffice -d agentoffice \
  -c "TRUNCATE agents, conversations, messages, agent_skills, hooks RESTART IDENTITY CASCADE;"

# Ver logs em tempo real
docker compose logs -f backend
docker compose logs -f frontend
```
