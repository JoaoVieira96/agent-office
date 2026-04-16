# CONTEXT.md — Agent Office
> Ficheiro de briefing para Claude Code. Cola o conteúdo deste ficheiro no início de uma sessão.

---

## O que é este projeto

**Agent Office** é uma plataforma pessoal de agentes de IA, construída de raiz pelo utilizador com ajuda do Claude.
O conceito é um "escritório virtual" onde o utilizador é o manager e os agentes são colaboradores especializados.

Funcionalidades principais:
- Criar e configurar agentes (nome, avatar, system prompt, modelo LLM)
- Conversar com cada agente via chat em tempo real (WebSocket)
- Atribuir **skills** (ferramentas/plugins) a cada agente
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
├── docker-compose.yml          ← entry point, levanta todos os serviços
├── .env                        ← variáveis de ambiente (ANTHROPIC_API_KEY, etc.)
├── .env.example                ← template do .env
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             ← FastAPI app, routers, lifespan
│       ├── config.py           ← Settings via pydantic-settings
│       ├── agents/
│       │   └── engine.py       ← run_agent(): orquestra LLM + skills + hooks
│       ├── api/
│       │   ├── agents.py       ← CRUD de agentes (REST)
│       │   ├── conversations.py← conversas + WebSocket /ws/{conv_id}
│       │   ├── skills.py       ← atribuição de skills a agentes
│       │   └── hooks.py        ← CRUD de hooks
│       ├── db/
│       │   ├── models.py       ← SQLAlchemy: Agent, Skill, AgentSkill, Hook, Conversation, Message
│       │   └── session.py      ← engine, SessionLocal, get_db(), create_tables()
│       ├── hooks/
│       │   └── engine.py       ← fire_hook(): executa webhook / skill / notify
│       ├── llm/
│       │   └── anthropic.py    ← call_anthropic(): chama a API do Claude
│       └── skills/
│           ├── loader.py       ← carrega skills da pasta /skills em startup
│           └── registry.py     ← get_tools_for_agent(), execute_skill()
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json            ← Next.js 15, lucide-react, clsx, tailwind
│   ├── tailwind.config.js      ← tema dark: surface=#0f0f10, panel=#18181b, accent=#6366f1
│   ├── next.config.js          ← rewrite /api/* → backend:8000
│   └── src/
│       ├── app/
│       │   ├── layout.tsx      ← root layout com Sidebar
│       │   ├── page.tsx        ← homepage: grid de agentes
│       │   ├── globals.css     ← design tokens, .input-base, animações
│       │   ├── agents/
│       │   │   ├── page.tsx            ← lista de agentes
│       │   │   ├── new/page.tsx        ← formulário criar agente
│       │   │   └── [id]/
│       │   │       ├── page.tsx        ← editar agente
│       │   │       ├── skills/page.tsx ← gerir skills do agente
│       │   │       └── hooks/page.tsx  ← gerir hooks do agente
│       │   ├── chat/
│       │   │   └── [agentId]/page.tsx  ← chat em tempo real (WebSocket)
│       │   ├── skills/page.tsx         ← lista global de skills
│       │   ├── hooks/page.tsx          ← documentação de hooks
│       │   └── settings/page.tsx       ← definições e comandos úteis
│       ├── components/
│       │   └── Sidebar.tsx     ← navegação lateral (ícones)
│       └── lib/
│           └── api.ts          ← cliente HTTP + types + createChatSocket()
│
├── skills/                     ← plugins carregados automaticamente pelo backend
│   ├── _template/              ← base para criar novas skills
│   │   ├── manifest.json
│   │   └── skill.py
│   ├── web_search/             ← pesquisa DuckDuckGo (sem API key)
│   │   ├── manifest.json
│   │   └── skill.py
│   └── code_runner/            ← executa Python num subprocess com timeout
│       ├── manifest.json
│       └── skill.py
│
└── infra/
    └── nginx/
        └── nginx.conf          ← proxy: /api/* → backend, /ws/* → backend (WS), /* → frontend
```

---

## Modelos de dados principais

```python
# Agent — o colaborador
Agent(id, name, description, avatar, system_prompt,
      llm_provider, llm_model, temperature, is_active)

# Skill — ferramenta global disponível
Skill(id, slug, name, description, version, config_schema, is_enabled)

# AgentSkill — atribuição skill↔agente com config própria
AgentSkill(id, agent_id, skill_id, config, is_active)

# Hook — evento → acção automática
Hook(id, agent_id, name, event, action_type, config, is_active)
# events: on_message_received, on_message_sent, on_task_complete,
#         on_error, on_conversation_start, on_conversation_end
# action_types: webhook, skill, notify

# Conversation + Message — histórico de chat
Conversation(id, agent_id, title)
Message(id, conversation_id, role, content, metadata)
```

---

## API REST (backend em localhost:8000)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/agents/` | Listar / criar agentes |
| GET/PATCH/DELETE | `/api/agents/{id}` | Ler / editar / arquivar |
| GET/POST | `/api/conversations/agent/{id}` | Listar / criar conversas |
| GET | `/api/conversations/{id}/messages` | Histórico de mensagens |
| WS | `/ws/{conv_id}` | Chat em tempo real |
| GET | `/api/skills/` | Skills disponíveis |
| GET/POST | `/api/skills/agent/{id}` | Skills do agente |
| DELETE | `/api/skills/agent/{id}/{skill_id}` | Remover skill |
| GET/POST | `/api/hooks/agent/{id}` | Hooks do agente |
| PATCH/DELETE | `/api/hooks/{id}` | Editar / apagar hook |

Swagger UI: `http://localhost:8000/docs`

---

## Como o sistema de skills funciona

Cada skill é uma pasta em `skills/` com dois ficheiros:

**manifest.json** — define o nome, descrição e `tool_schema` (o que o LLM vê):
```json
{
  "slug": "minha_skill",
  "name": "Nome",
  "description": "...",
  "tool_schema": {
    "name": "minha_skill",
    "description": "Descrição para o LLM decidir quando usar",
    "input_schema": { "type": "object", "properties": { ... } }
  }
}
```

**skill.py** — implementação com função `run()`:
```python
async def run(params: dict, config: dict) -> str:
    # params = o que o LLM enviou
    # config = configuração do agente para esta skill
    return "resultado em string"
```

No startup, o backend varre a pasta `skills/` e regista cada skill na DB.
Ao correr um agente, as skills activas são passadas como `tools` à API do Claude.

---

## Como o WebSocket de chat funciona

```
Cliente → WS: {"message": "texto do utilizador"}
Servidor → WS: {"type": "thinking"}
Servidor → WS: {"type": "done", "content": "resposta do agente"}
# ou em caso de erro:
Servidor → WS: {"type": "error", "content": "mensagem de erro"}
```

O endpoint é `/ws/{conversation_id}` — o Nginx faz upgrade para WebSocket.

---

## Design system do frontend

- Tema: **dark** exclusivo
- Cores principais: `surface=#0f0f10`, `panel=#18181b`, `border=#27272a`, `muted=#71717a`, `accent=#6366f1`
- Classe CSS reutilizável: `.input-base` (inputs e selects)
- Animações: `.fade-up` (entradas), `.thinking-dot` (indicador de resposta)
- Ícones: `lucide-react`
- Navegação: sidebar com ícones à esquerda (58px de largura)

---

## Estado actual do projeto

- [x] Arquitectura completa definida e implementada
- [x] Backend FastAPI com todos os endpoints
- [x] Frontend Next.js com todas as páginas
- [x] Sistema de skills funcional (web_search, code_runner)
- [x] Sistema de hooks (webhook, skill, notify)
- [x] Chat em tempo real via WebSocket
- [x] Docker Compose funcional (testado em Windows)
- [ ] Autenticação (próximo passo acordado com o utilizador)
- [ ] Agentes a delegar tarefas a outros agentes
- [ ] Streaming de respostas do LLM (chunk a chunk)
- [ ] Skill: acesso a ficheiros locais
- [ ] Skill: integração GitHub

---

## Próximo passo acordado

Implementar **autenticação** — login simples para proteger o acesso,
especialmente para uso remoto via iOS fora da rede local.
Opção discutida: NextAuth.js no frontend + JWT no backend.

---

## Notas importantes para desenvolvimento

1. **Adicionar uma skill** — criar pasta em `skills/`, depois `docker compose restart backend`
2. **Variáveis de ambiente** — estão no `.env` na raiz; nunca hardcoded
3. **Base de dados** — as tabelas são criadas automaticamente no startup (`create_tables()`); para migrações usar Alembic
4. **Porta de entrada** — sempre `http://localhost` (porta 80, Nginx); o frontend (3000) e backend (8000) não estão expostos directamente
5. **WebSocket** — o Nginx faz o upgrade; o path é `/ws/` não `/api/ws/`