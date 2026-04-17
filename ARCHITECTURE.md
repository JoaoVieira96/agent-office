# Arquitectura — Agent Office

---

## 1. Visão geral do sistema

Agent Office corre como um conjunto de serviços Docker. Todo o tráfego entra pelo Nginx (porta 80) que faz proxy para o frontend Next.js ou para o backend FastAPI conforme o path.

```mermaid
graph TB
    Browser["🌐 Browser / Cliente"]

    subgraph Docker["Docker Compose"]
        Nginx["Nginx\n:80\nreverse proxy"]

        subgraph FE["Frontend"]
            Next["Next.js 15\nApp Router\nTypeScript"]
        end

        subgraph BE["Backend"]
            FastAPI["FastAPI\n(Python 3.12)"]
            Engine["Agent Engine"]
            LLM["LLM Client\n(Anthropic / OpenAI)"]
            Skills["Skills Registry"]
            MCP["MCP Client"]
            Hooks["Hooks Engine"]
        end

        subgraph Data["Dados"]
            PG["PostgreSQL 16\nagentes, conversas,\nmensagens, skills, hooks"]
            Redis["Redis 7\ncache / filas"]
        end

        subgraph SkillsDir["Skills (ficheiros)"]
            S1["web_search"]
            S2["github"]
            S3["file_access"]
            S4["code_runner"]
            S5["delegate_to_agent"]
            S6["jcodemunch (MCP)"]
            S7["anthropic_*"]
        end
    end

    Ext1["🤖 Anthropic API\n(Claude)"]
    Ext2["🌍 APIs externas\n(GitHub, DuckDuckGo...)"]

    Browser -->|"HTTP / WS"| Nginx
    Nginx -->|"/  (SSR + assets)"| Next
    Nginx -->|"/api/*  /ws/*"| FastAPI
    Next -->|"REST calls"| FastAPI

    FastAPI --> Engine
    Engine --> LLM
    Engine --> Skills
    Engine --> MCP
    Engine --> Hooks
    Engine --> PG

    LLM -->|"streaming"| Ext1
    Skills -->|"HTTP"| Ext2
    MCP -->|"stdio"| S6

    FastAPI --> Redis
    FastAPI --> PG
    Skills --> SkillsDir
```

---

## 2. Routing HTTP e WebSocket

O Nginx decide para onde encaminhar cada pedido:

```mermaid
graph LR
    Client["Cliente"]

    subgraph Nginx["Nginx :80"]
        R1{"/api/*"}
        R2{"/ws/*"}
        R3{"tudo o resto"}
    end

    FE["Frontend :3000\nNext.js"]
    BE["Backend :8000\nFastAPI"]

    Client --> Nginx
    R1 -->|"proxy_pass"| BE
    R2 -->|"upgrade WebSocket"| BE
    R3 -->|"proxy_pass"| FE
```

---

## 3. Fluxo de autenticação

```mermaid
sequenceDiagram
    actor U as Utilizador
    participant FE as Frontend
    participant BE as Backend (FastAPI)
    participant DB as PostgreSQL

    U->>FE: POST /api/auth/login {username, password}
    FE->>BE: POST /api/auth/login
    BE->>DB: verifica credenciais (ADMIN_USERNAME/PASSWORD no .env)
    DB-->>BE: ok
    BE-->>FE: { access_token: "JWT" }  (validade 30 dias)
    FE->>FE: guarda token em localStorage

    Note over FE,BE: Pedidos seguintes

    FE->>BE: GET /api/agents/  Authorization: Bearer JWT
    BE->>BE: valida JWT (SECRET_KEY)
    BE-->>FE: lista de agentes
```

---

## 4. Fluxo de uma mensagem de chat (WebSocket)

```mermaid
sequenceDiagram
    actor U as Utilizador
    participant FE as Frontend
    participant WS as WebSocket Handler
    participant ENG as Agent Engine
    participant LLM as LLM Client
    participant SK as Skills / MCP
    participant DB as PostgreSQL

    U->>FE: escreve mensagem + Enter
    FE->>WS: connect /ws/{conv_id}?token=JWT
    FE->>WS: { "message": "texto do utilizador" }

    WS->>ENG: run_agent_stream(agent_id, conv_id, message)
    ENG->>DB: fire_hook(on_message_received)
    ENG->>DB: guarda mensagem do utilizador
    ENG->>DB: carrega histórico (últimas 40 msgs)
    ENG->>SK: get_tools_for_agent()
    ENG->>SK: get_mcp_configs_for_agent()
    SK-->>ENG: lista de tools

    WS-->>FE: { "type": "thinking" }

    loop Tool Use Loop
        ENG->>LLM: stream_anthropic(system, messages, tools)
        LLM-->>WS: chunks de texto (streaming)
        WS-->>FE: { "type": "chunk", "content": "..." }

        alt stop_reason == "tool_use"
            ENG->>SK: execute_skill(slug, params, config)
            SK-->>ENG: resultado da tool
            ENG->>ENG: adiciona tool_result ao histórico
        else stop_reason == "end_turn"
            ENG->>ENG: sai do loop
        end
    end

    ENG->>DB: guarda resposta completa
    ENG->>DB: fire_hook(on_message_sent)
    WS-->>FE: { "type": "done", "content": "resposta completa" }
```

---

## 5. Agent Engine — fluxo detalhado

```mermaid
flowchart TD
    A([run_agent_stream chamado]) --> B[Carregar agente da DB]
    B --> C[fire_hook: on_message_received]
    C --> D[Guardar mensagem do utilizador na DB]
    D --> E[Carregar histórico — últimas 40 mensagens]
    E --> F[get_tools_for_agent — skills regulares]
    F --> G{Existem skills MCP?}

    G -->|Sim| H[MCPContext.start\narrancar subprocessos MCP via stdio\ndescobrir tools disponíveis]
    G -->|Não| I

    H --> I[Juntar tools regulares + MCP]
    I --> J[[Loop LLM]]

    J --> K[stream_anthropic\nchamar API + streaming]
    K --> L{stop_reason?}

    L -->|end_turn| M[Acumular texto final]
    L -->|tool_use| N[Para cada bloco tool_use]

    N --> O{É tool MCP?}
    O -->|Sim| P[MCPContext.call_tool]
    O -->|Não| Q[execute_skill — importar skill.py e correr run]

    P --> R[Adicionar tool_result ao histórico]
    Q --> R
    R --> J

    M --> S[MCPContext.close — terminar subprocessos]
    S --> T[Guardar resposta completa na DB]
    T --> U[fire_hook: on_message_sent]
    U --> V([Devolver resposta])

    style H fill:#4f46e5,color:#fff
    style P fill:#4f46e5,color:#fff
    style S fill:#4f46e5,color:#fff
```

---

## 6. Sistema de skills

### Três tipos de skills

```mermaid
graph TB
    subgraph Regular["🐍 Skill Regular"]
        direction TB
        R1["manifest.json\ntool_schema + config_schema"]
        R2["skill.py\nasync def run(params, config) → str"]
        R1 --- R2
    end

    subgraph MCP["🔌 Skill MCP"]
        direction TB
        M1["manifest.json\nmcp_server: command, args, env_from_config"]
        M2["Servidor MCP externo\n(binário instalado na imagem Docker)"]
        M1 -.->|"stdio"| M2
    end

    subgraph Native["⚡ Skill Nativa Anthropic"]
        direction TB
        N1["manifest.json\ntool_schema.type = 'web_search_20260209'"]
        N2["Infraestrutura Anthropic\n(sem execução local)"]
        N1 -.->|"API"| N2
    end

    ENG["Agent Engine"]
    ENG -->|"execute_skill()"| Regular
    ENG -->|"MCPContext"| MCP
    ENG -->|"passado directamente\npara a API"| Native
```

### Ciclo de vida das skills MCP

```mermaid
sequenceDiagram
    participant ENG as Agent Engine
    participant REG as Registry
    participant CTX as MCPContext
    participant PROC as Processo MCP (stdio)
    participant LLM as LLM

    ENG->>REG: get_mcp_configs_for_agent()
    REG-->>ENG: [{ slug, mcp_server, config }]

    ENG->>CTX: MCPContext(configs)
    ENG->>CTX: start()
    CTX->>PROC: spawn subprocess (command + args + env)
    CTX->>PROC: session.list_tools()
    PROC-->>CTX: lista de tools disponíveis
    CTX-->>ENG: tools em formato Anthropic

    ENG->>LLM: stream com tools regulares + MCP
    LLM-->>ENG: tool_use block (nome da tool MCP)

    ENG->>CTX: has_tool(name) → True
    ENG->>CTX: call_tool(name, input)
    CTX->>PROC: session.call_tool(name, input)
    PROC-->>CTX: resultado
    CTX-->>ENG: resultado como string

    Note over ENG,PROC: No fim da conversa (try/finally)
    ENG->>CTX: close()
    CTX->>PROC: terminar subprocesso
```

---

## 7. Sistema de hooks

```mermaid
flowchart LR
    subgraph Eventos["Eventos disponíveis"]
        E1[on_message_received]
        E2[on_message_sent]
        E3[on_task_complete]
        E4[on_error]
        E5[on_conversation_start]
        E6[on_conversation_end]
    end

    FH["fire_hook(agent, event, payload)"]

    E1 & E2 & E3 & E4 & E5 & E6 --> FH

    FH --> DB["Procura hooks activos\npara este agente + evento"]

    DB --> A1["action_type: webhook\nHTTP POST para URL externa\ncom payload"]
    DB --> A2["action_type: notify\nLog / console\n(expansível: email, Slack)"]
    DB --> A3["action_type: skill\nexecuta uma skill como reacção"]

    style A1 fill:#059669,color:#fff
    style A2 fill:#d97706,color:#fff
    style A3 fill:#4f46e5,color:#fff
```

---

## 8. Modelo de dados

```mermaid
erDiagram
    Agent {
        uuid id PK
        string name
        string description
        string avatar
        text system_prompt
        enum llm_provider
        string llm_model
        int temperature
        bool is_active
        datetime created_at
    }

    Skill {
        uuid id PK
        string slug
        string name
        text description
        string version
        json config_schema
        bool is_enabled
    }

    AgentSkill {
        uuid id PK
        uuid agent_id FK
        uuid skill_id FK
        json config
        bool is_active
    }

    Hook {
        uuid id PK
        uuid agent_id FK
        string name
        enum event
        string action_type
        json config
        bool is_active
    }

    Conversation {
        uuid id PK
        uuid agent_id FK
        string title
        datetime created_at
        datetime updated_at
    }

    Message {
        uuid id PK
        uuid conversation_id FK
        enum role
        text content
        json message_metadata
        datetime created_at
    }

    Agent ||--o{ AgentSkill : "tem"
    Skill  ||--o{ AgentSkill : "atribuída via"
    Agent ||--o{ Hook : "tem"
    Agent ||--o{ Conversation : "tem"
    Conversation ||--o{ Message : "contém"
```

---

## 9. Estrutura do frontend

```mermaid
graph TD
    subgraph Layout["layout.tsx (root)"]
        AppShell["AppShell\nguard de autenticação\n↓ redireciona para /login se sem token"]
        Sidebar["Sidebar\nnavegação + logout"]
    end

    subgraph Pages["Páginas"]
        Home["/ — página principal\nlista de agentes\natalhos: chat, skills, hooks, editar"]
        Login["/login — autenticação"]
        NewAgent["/agents/new\n3 passos: template → config → skills"]
        EditAgent["/agents/[id]\neditar agente + tabs"]
        SkillsPage["/agents/[id]/skills\ngerir skills + config inline"]
        HooksPage["/agents/[id]/hooks\ngerir hooks"]
        Chat["/chat/[agentId]\nchat WebSocket + streaming"]
    end

    AppShell --> Sidebar
    AppShell --> Pages

    Home -->|"Contratar Agente"| NewAgent
    Home -->|"Chat"| Chat
    Home -->|"Skills"| SkillsPage
    Home -->|"Hooks"| HooksPage
    Home -->|"Editar"| EditAgent
    EditAgent --> SkillsPage
    EditAgent --> HooksPage
    EditAgent --> Chat
```

---

## 10. Criação de um agente — fluxo de 3 passos

```mermaid
sequenceDiagram
    actor U as Utilizador
    participant FE as Frontend
    participant BE as Backend

    Note over U,FE: Passo 0 — Escolher template
    U->>FE: selecciona template (ex: Backend Developer)\nou "Começar do zero"
    FE->>FE: pré-preenche formulário com\nnome, avatar, system prompt, modelo

    Note over U,FE: Passo 1 — Configurar agente
    U->>FE: ajusta / confirma campos
    U->>FE: clica "Continuar"
    FE->>BE: POST /api/agents/ { name, system_prompt, llm_model, ... }
    BE-->>FE: { id: "uuid", ... }
    FE->>BE: GET /api/skills/  (carrega skills disponíveis)

    Note over U,FE: Passo 2 — Atribuir skills
    U->>FE: selecciona skills (checkboxes)
    U->>FE: clica "Concluir"
    FE->>BE: POST /api/skills/agent/{id}  (para cada skill seleccionada)
    BE-->>FE: ok
    FE->>FE: redireciona para /chat/{id}
```
