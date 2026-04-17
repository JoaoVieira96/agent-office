# Skills — Guia de desenvolvimento

Uma skill é um plugin que um agente pode usar como ferramenta. Quando o LLM decide que precisa de informação ou de executar uma acção, chama a skill correspondente e recebe o resultado como texto.

Existem três tipos de skills:

| Tipo | Tem `skill.py`? | Tem `mcp_server`? | Execução |
|------|-----------------|--------------------|----------|
| **Regular** | Sim | Não | Código Python no backend |
| **MCP** | Não | Sim | Servidor MCP externo via stdio |
| **Nativa Anthropic** | Não | Não | Infraestrutura da Anthropic |

---

## Skills regulares

A forma mais comum. O backend executa a função `run()` directamente quando o LLM chama a skill.

### Estrutura

```
skills/minha_skill/
├── manifest.json   ← definição da skill e schema da ferramenta
└── skill.py        ← lógica de execução
```

### Criar uma nova skill regular

```bash
cp -r skills/_template skills/minha_skill
```

Edita os dois ficheiros:

**`manifest.json`** — define o que a skill é e como o LLM a deve usar:

```json
{
  "slug": "minha_skill",
  "name": "Nome legível",
  "description": "O que esta skill faz, numa frase.",
  "version": "1.0.0",
  "config_schema": {
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "default": "",
        "description": "Chave da API (configurada por agente)"
      }
    }
  },
  "tool_schema": {
    "name": "minha_skill",
    "description": "Descrição detalhada que o LLM vai ler para decidir quando usar esta skill.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "O que pesquisar"
        }
      },
      "required": ["query"]
    }
  }
}
```

**`skill.py`** — implementa a lógica:

```python
async def run(params: dict, config: dict) -> str:
    """
    params  — parâmetros enviados pelo LLM (definidos em tool_schema > input_schema)
    config  — configuração do agente para esta skill (definida em config_schema)
    return  — string com o resultado; o LLM recebe este texto como output da ferramenta
    """
    query   = params.get("query", "")
    api_key = config.get("api_key", "")

    # lógica aqui
    return "resultado"
```

Após criar a skill, reinicia o backend:

```bash
docker compose restart backend
```

A skill aparece automaticamente na lista de skills disponíveis no frontend.

### Notas sobre `manifest.json`

- **`slug`** — tem de ser único; é o nome que o LLM usa para chamar a skill
- **`config_schema`** — campos configuráveis por agente (ex: tokens, chaves de API, directórios). Aparecem como formulário na página de skills do agente
- **`tool_schema.description`** — a descrição mais importante: é o texto que o LLM lê para decidir quando e como usar a skill. Quanto mais precisa, melhor o comportamento
- **`tool_schema.name`** — tem de coincidir com o `slug`

---

## Skills MCP

Ligam-se a um servidor MCP externo via stdio. Útil para ferramentas que já existem como servidores MCP (ex: jCodeMunch, filesystem MCP, Playwright MCP).

Não têm `skill.py` — a execução fica do lado do servidor MCP.

### Estrutura

```
skills/minha_mcp/
└── manifest.json   ← sem skill.py
```

### Criar uma nova skill MCP

```bash
cp -r skills/_template_mcp skills/minha_mcp
```

**`manifest.json`:**

```json
{
  "slug": "minha_mcp",
  "name": "Nome legível",
  "description": "O que este servidor MCP faz.",
  "version": "1.0.0",
  "config_schema": {
    "type": "object",
    "properties": {
      "param_configuravel": {
        "type": "string",
        "default": "valor_padrao",
        "description": "Parâmetro passado ao servidor MCP via env var"
      }
    }
  },
  "mcp_server": {
    "command": "nome-do-binario-mcp",
    "args": ["--arg-opcional"],
    "env_from_config": {
      "NOME_ENV_VAR": "param_configuravel"
    }
  }
}
```

### Campo `mcp_server`

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `command` | Sim | Binário ou comando a executar (tem de estar instalado na imagem Docker) |
| `args` | Não | Argumentos fixos passados ao processo |
| `env_from_config` | Não | Mapeia campos do `config_schema` para variáveis de ambiente do servidor MCP |

### Como funciona em runtime

1. No início de cada conversa, o engine chama `MCPContext.start()`
2. Para cada skill MCP atribuída ao agente, arranca um subprocesso com `command` + `args`
3. Comunica com o processo via stdio (protocolo MCP)
4. Lista as ferramentas disponíveis no servidor e adiciona-as ao conjunto de tools do LLM
5. Quando o LLM chama uma tool MCP, o engine encaminha para `MCPContext.call_tool()`
6. No fim da conversa, `MCPContext.close()` termina todos os subprocessos

### Instalar o binário MCP na imagem Docker

O binário tem de existir dentro do container do backend. Adiciona ao `backend/requirements.txt` se for um pacote Python:

```
jcodemunch-mcp>=1.0.0
```

Ou ao `backend/Dockerfile` se for outro tipo de instalação:

```dockerfile
RUN npm install -g @nome/mcp-server
```

Após alterar `requirements.txt` ou `Dockerfile`, faz rebuild (não basta restart):

```bash
docker compose up --build backend -d
```

### Exemplo real: jCodeMunch

```json
{
  "slug": "jcodemunch",
  "name": "jCodeMunch - Análise de Código",
  "description": "Indexa e analisa código-fonte com precisão token-eficiente.",
  "version": "1.0.0",
  "config_schema": {
    "type": "object",
    "properties": {
      "repo_path": {
        "type": "string",
        "default": "/app/repo",
        "description": "Caminho para o repositório a indexar dentro do container"
      }
    }
  },
  "mcp_server": {
    "command": "jcodemunch-mcp",
    "args": [],
    "env_from_config": {
      "REPO_PATH": "repo_path"
    }
  }
}
```

O repositório está montado em `/app/repo` no container via `docker-compose.yml`:

```yaml
volumes:
  - ./:/app/repo:ro
```

---

## Skills nativas Anthropic

Ferramentas built-in da API da Anthropic. Sem `skill.py` nem `mcp_server` — a execução é feita pela infraestrutura da Anthropic.

### Estrutura

```
skills/anthropic_web_search/
└── manifest.json   ← só o manifest, sem código
```

**`manifest.json`:**

```json
{
  "slug": "anthropic_web_search",
  "name": "Web Search (Anthropic)",
  "description": "Pesquisa na web usando a infraestrutura nativa da Anthropic.",
  "version": "1.0.0",
  "tool_schema": {
    "type": "web_search_20260209",
    "name": "web_search"
  }
}
```

### Regras importantes

- O campo `name` em `tool_schema` é **obrigatório** — a API retorna erro 400 sem ele, mesmo em tools com `type`
- `anthropic_code_execution` **não deve ser atribuída** a `claude-opus-4-6` nem `claude-sonnet-4-6`: estes modelos injectam `code_execution` automaticamente, causando conflito de nomes (erro 400)
- Skills nativas só funcionam com modelos Anthropic Claude

### Skills nativas disponíveis

| Slug | `tool_schema.type` | `tool_schema.name` |
|------|-------------------|-------------------|
| `anthropic_web_search` | `web_search_20260209` | `web_search` |
| `anthropic_code_execution` | `code_execution_20250522` | `code_execution` |

---

## Referência rápida

```
# Adicionar skill regular
cp -r skills/_template skills/<slug>
# edita manifest.json e skill.py
docker compose restart backend

# Adicionar skill MCP
cp -r skills/_template_mcp skills/<slug>
# edita manifest.json, instala binário em requirements.txt ou Dockerfile
docker compose up --build backend -d

# Remover skill
rm -rf skills/<slug>
docker compose restart backend
```
