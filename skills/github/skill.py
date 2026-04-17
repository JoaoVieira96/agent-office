"""
Skill: github
Integração completa com a API REST do GitHub v3.

Suporta:
  - Repositórios: list_repos, get_repo
  - Ficheiros:    list_files, read_file, search_code
  - Commits:      list_commits
  - Branches:     list_branches, create_branch
  - Issues:       list_issues, get_issue, create_issue, comment_issue, close_issue
  - Pull Requests: list_prs, get_pr, create_pr, merge_pr
"""

import base64
import httpx

API = "https://api.github.com"


async def run(params: dict, config: dict) -> str:
    action  = params.get("action", "").strip()
    token   = config.get("token", "").strip()
    owner   = params.get("owner", "").strip() or config.get("default_owner", "").strip()
    repo    = params.get("repo", "").strip()

    if not action:
        return "[erro] Parâmetro 'action' em falta."

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(headers=headers, timeout=15) as client:
        try:
            return await _dispatch(action, params, owner, repo, client)
        except httpx.HTTPStatusError as e:
            body = e.response.text[:300]
            return f"[erro GitHub {e.response.status_code}] {body}"
        except Exception as e:
            return f"[erro] {e}"


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

async def _dispatch(action: str, p: dict, owner: str, repo: str, client: httpx.AsyncClient) -> str:
    match action:
        case "list_repos":
            return await _list_repos(p, owner, client)
        case "get_repo":
            return await _get_repo(_require(owner, "owner"), _require(repo, "repo"), client)
        case "list_files":
            return await _list_files(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "read_file":
            return await _read_file(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "write_file":
            return await _write_file(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "search_code":
            return await _search_code(p, owner, repo, client)
        case "list_commits":
            return await _list_commits(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "list_branches":
            return await _list_branches(_require(owner, "owner"), _require(repo, "repo"), client)
        case "create_branch":
            return await _create_branch(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "list_issues":
            return await _list_issues(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "get_issue":
            return await _get_issue(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "create_issue":
            return await _create_issue(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "comment_issue":
            return await _comment_issue(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "close_issue":
            return await _close_issue(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "list_prs":
            return await _list_prs(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "get_pr":
            return await _get_pr(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "create_pr":
            return await _create_pr(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case "merge_pr":
            return await _merge_pr(_require(owner, "owner"), _require(repo, "repo"), p, client)
        case _:
            return f"[erro] Action desconhecida: '{action}'"


def _require(value: str, name: str) -> str:
    if not value:
        raise ValueError(f"Parâmetro '{name}' é obrigatório para esta action.")
    return value


# ---------------------------------------------------------------------------
# Repositórios
# ---------------------------------------------------------------------------

async def _list_repos(p: dict, owner: str, client: httpx.AsyncClient) -> str:
    per_page = min(p.get("per_page", 30), 100)
    if owner:
        r = await client.get(f"{API}/users/{owner}/repos", params={"per_page": per_page, "sort": "updated"})
    else:
        r = await client.get(f"{API}/user/repos", params={"per_page": per_page, "sort": "updated"})
    r.raise_for_status()
    repos = r.json()
    if not repos:
        return "Sem repositórios."
    lines = [f"Repositórios ({len(repos)}):"]
    for repo in repos:
        private = "🔒" if repo["private"] else "🌐"
        desc = f" — {repo['description']}" if repo.get("description") else ""
        lines.append(f"  {private} {repo['full_name']}{desc}")
        lines.append(f"     ⭐ {repo['stargazers_count']}  🍴 {repo['forks_count']}  Branch padrão: {repo['default_branch']}")
    return "\n".join(lines)


async def _get_repo(owner: str, repo: str, client: httpx.AsyncClient) -> str:
    r = await client.get(f"{API}/repos/{owner}/{repo}")
    r.raise_for_status()
    d = r.json()
    lines = [
        f"📦 {d['full_name']}",
        f"Descrição: {d.get('description') or '—'}",
        f"Visibilidade: {'Privado' if d['private'] else 'Público'}",
        f"Branch padrão: {d['default_branch']}",
        f"Linguagem: {d.get('language') or '—'}",
        f"⭐ {d['stargazers_count']}  🍴 {d['forks_count']}  Issues abertas: {d['open_issues_count']}",
        f"URL: {d['html_url']}",
        f"Criado: {d['created_at'][:10]}  Atualizado: {d['updated_at'][:10]}",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Ficheiros
# ---------------------------------------------------------------------------

async def _list_files(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    path   = p.get("path", "").strip("/")
    branch = p.get("branch", "")
    url    = f"{API}/repos/{owner}/{repo}/contents/{path}"
    params = {"ref": branch} if branch else {}
    r = await client.get(url, params=params)
    r.raise_for_status()
    items = r.json()
    if isinstance(items, dict):
        return f"[erro] '{path}' é um ficheiro, não uma pasta. Usa 'read_file' para ler."
    if not items:
        return "Pasta vazia."
    lines = [f"Conteúdo de /{path or ''} em {owner}/{repo}:"]
    for item in sorted(items, key=lambda x: (x["type"] != "dir", x["name"].lower())):
        icon = "📁" if item["type"] == "dir" else "📄"
        size = f"  ({_human_size(item['size'])})" if item["type"] == "file" else ""
        lines.append(f"  {icon} {item['name']}{size}")
    return "\n".join(lines)


async def _write_file(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    path    = p.get("path", "").strip().lstrip("/")
    content = p.get("content", "")
    message = p.get("commit_message", "").strip() or "chore: update file via agent"
    branch  = p.get("branch", "").strip()

    if not path:
        return "[erro] Parâmetro 'path' é obrigatório para write_file."
    if content is None:
        return "[erro] Parâmetro 'content' é obrigatório para write_file."

    url    = f"{API}/repos/{owner}/{repo}/contents/{path}"
    params = {"ref": branch} if branch else {}

    # Obter SHA do ficheiro existente (necessário para update)
    sha = None
    r = await client.get(url, params=params)
    if r.status_code == 200:
        sha = r.json().get("sha")
    elif r.status_code != 404:
        r.raise_for_status()

    import base64 as _b64
    encoded = _b64.b64encode(content.encode("utf-8")).decode("ascii")

    body: dict = {"message": message, "content": encoded}
    if branch:
        body["branch"] = branch
    if sha:
        body["sha"] = sha

    cr = await client.put(url, json=body)
    cr.raise_for_status()
    data   = cr.json()
    action = "actualizado" if sha else "criado"
    commit = data.get("commit", {})
    return (
        f"Ficheiro {action}: {owner}/{repo}/{path}\n"
        f"Commit: {commit.get('sha','?')[:7]} — {commit.get('message','').splitlines()[0]}\n"
        f"URL: {data.get('content',{}).get('html_url','')}"
    )


async def _read_file(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    path   = p.get("path", "").strip()
    branch = p.get("branch", "")
    if not path:
        return "[erro] Parâmetro 'path' é obrigatório para read_file."
    url    = f"{API}/repos/{owner}/{repo}/contents/{path}"
    params = {"ref": branch} if branch else {}
    r = await client.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    if data.get("type") == "dir":
        return f"[erro] '{path}' é uma pasta. Usa 'list_files' para listar."
    if data.get("encoding") != "base64":
        return f"[erro] Encoding não suportado: {data.get('encoding')}"
    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    size    = _human_size(data.get("size", 0))
    lines_n = len(content.splitlines())
    header  = f"Ficheiro: {owner}/{repo}/{path}  ({lines_n} linhas, {size})\n" + "─" * 50
    return header + "\n" + content


async def _search_code(p: dict, owner: str, repo: str, client: httpx.AsyncClient) -> str:
    query = p.get("query", "").strip()
    if not query:
        return "[erro] Parâmetro 'query' é obrigatório para search_code."
    if repo and owner:
        query += f" repo:{owner}/{repo}"
    elif owner:
        query += f" user:{owner}"
    per_page = min(p.get("per_page", 10), 30)
    r = await client.get(f"{API}/search/code", params={"q": query, "per_page": per_page})
    r.raise_for_status()
    data  = r.json()
    items = data.get("items", [])
    if not items:
        return f"Sem resultados para: {query}"
    lines = [f"Resultados de código ({data['total_count']} total, a mostrar {len(items)}):"]
    for item in items:
        lines.append(f"\n  📄 {item['repository']['full_name']}/{item['path']}")
        lines.append(f"     URL: {item['html_url']}")
        for match in item.get("text_matches", []):
            fragment = match.get("fragment", "").strip()[:200]
            if fragment:
                lines.append(f"     …{fragment}…")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Commits
# ---------------------------------------------------------------------------

async def _list_commits(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    params: dict = {"per_page": min(p.get("per_page", 20), 100)}
    if p.get("branch"):
        params["sha"] = p["branch"]
    r = await client.get(f"{API}/repos/{owner}/{repo}/commits", params=params)
    r.raise_for_status()
    commits = r.json()
    if not commits:
        return "Sem commits."
    lines = [f"Commits em {owner}/{repo}:"]
    for c in commits:
        sha  = c["sha"][:7]
        msg  = c["commit"]["message"].splitlines()[0][:80]
        date = c["commit"]["author"]["date"][:10]
        auth = c["commit"]["author"]["name"]
        lines.append(f"  {sha}  {date}  {auth}: {msg}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Branches
# ---------------------------------------------------------------------------

async def _list_branches(owner: str, repo: str, client: httpx.AsyncClient) -> str:
    r = await client.get(f"{API}/repos/{owner}/{repo}/branches", params={"per_page": 50})
    r.raise_for_status()
    branches = r.json()
    if not branches:
        return "Sem branches."
    lines = [f"Branches em {owner}/{repo}:"]
    for b in branches:
        protected = " 🔒" if b.get("protected") else ""
        lines.append(f"  • {b['name']}{protected}")
    return "\n".join(lines)


async def _create_branch(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    branch      = p.get("branch", "").strip()
    base_branch = p.get("base_branch", "").strip()
    if not branch:
        return "[erro] Parâmetro 'branch' (nome do novo branch) é obrigatório."
    # Obter SHA do branch base
    base_ref = base_branch or "HEAD"
    r = await client.get(f"{API}/repos/{owner}/{repo}/git/ref/heads/{base_ref}")
    if r.status_code == 404 and not base_branch:
        # Tentar obter o branch padrão
        repo_r = await client.get(f"{API}/repos/{owner}/{repo}")
        repo_r.raise_for_status()
        default = repo_r.json()["default_branch"]
        r = await client.get(f"{API}/repos/{owner}/{repo}/git/ref/heads/{default}")
    r.raise_for_status()
    sha = r.json()["object"]["sha"]
    # Criar branch
    cr = await client.post(
        f"{API}/repos/{owner}/{repo}/git/refs",
        json={"ref": f"refs/heads/{branch}", "sha": sha},
    )
    cr.raise_for_status()
    return f"Branch '{branch}' criado em {owner}/{repo} a partir de '{base_branch or 'branch padrão'}' ({sha[:7]})."


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

async def _list_issues(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    params = {
        "state":    p.get("state", "open"),
        "per_page": min(p.get("per_page", 20), 100),
    }
    r = await client.get(f"{API}/repos/{owner}/{repo}/issues", params=params)
    r.raise_for_status()
    issues = [i for i in r.json() if "pull_request" not in i]  # excluir PRs
    if not issues:
        return f"Sem issues {params['state']}s em {owner}/{repo}."
    lines = [f"Issues {params['state']}s em {owner}/{repo} ({len(issues)}):"]
    for i in issues:
        labels = ", ".join(l["name"] for l in i.get("labels", []))
        label_str = f"  [{labels}]" if labels else ""
        lines.append(f"  #{i['number']} {i['title']}{label_str}")
        lines.append(f"     {i['html_url']}")
    return "\n".join(lines)


async def _get_issue(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    number = p.get("number")
    if not number:
        return "[erro] Parâmetro 'number' é obrigatório para get_issue."
    r = await client.get(f"{API}/repos/{owner}/{repo}/issues/{number}")
    r.raise_for_status()
    i = r.json()
    lines = [
        f"Issue #{i['number']}: {i['title']}",
        f"Estado: {i['state']}",
        f"Autor: {i['user']['login']}  |  Criada: {i['created_at'][:10]}",
        f"Labels: {', '.join(l['name'] for l in i.get('labels', [])) or '—'}",
        f"URL: {i['html_url']}",
        "",
        i.get("body") or "(sem descrição)",
    ]
    return "\n".join(lines)


async def _create_issue(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    title = p.get("title", "").strip()
    body  = p.get("body", "").strip()
    if not title:
        return "[erro] Parâmetro 'title' é obrigatório para create_issue."
    r = await client.post(
        f"{API}/repos/{owner}/{repo}/issues",
        json={"title": title, "body": body},
    )
    r.raise_for_status()
    i = r.json()
    return f"Issue criada: #{i['number']} — {i['title']}\n{i['html_url']}"


async def _comment_issue(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    number = p.get("number")
    body   = p.get("body", "").strip()
    if not number:
        return "[erro] Parâmetro 'number' é obrigatório para comment_issue."
    if not body:
        return "[erro] Parâmetro 'body' (texto do comentário) é obrigatório."
    r = await client.post(
        f"{API}/repos/{owner}/{repo}/issues/{number}/comments",
        json={"body": body},
    )
    r.raise_for_status()
    c = r.json()
    return f"Comentário adicionado na issue #{number}.\n{c['html_url']}"


async def _close_issue(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    number = p.get("number")
    if not number:
        return "[erro] Parâmetro 'number' é obrigatório para close_issue."
    r = await client.patch(
        f"{API}/repos/{owner}/{repo}/issues/{number}",
        json={"state": "closed"},
    )
    r.raise_for_status()
    return f"Issue #{number} fechada."


# ---------------------------------------------------------------------------
# Pull Requests
# ---------------------------------------------------------------------------

async def _list_prs(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    params = {
        "state":    p.get("state", "open"),
        "per_page": min(p.get("per_page", 20), 100),
    }
    r = await client.get(f"{API}/repos/{owner}/{repo}/pulls", params=params)
    r.raise_for_status()
    prs = r.json()
    if not prs:
        return f"Sem pull requests {params['state']}s em {owner}/{repo}."
    lines = [f"Pull Requests {params['state']}s em {owner}/{repo} ({len(prs)}):"]
    for pr in prs:
        lines.append(f"  #{pr['number']} {pr['title']}")
        lines.append(f"     {pr['head']['label']} → {pr['base']['label']}  |  {pr['html_url']}")
    return "\n".join(lines)


async def _get_pr(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    number = p.get("number")
    if not number:
        return "[erro] Parâmetro 'number' é obrigatório para get_pr."
    r = await client.get(f"{API}/repos/{owner}/{repo}/pulls/{number}")
    r.raise_for_status()
    pr = r.json()
    lines = [
        f"PR #{pr['number']}: {pr['title']}",
        f"Estado: {pr['state']}  |  Mergeable: {pr.get('mergeable', '?')}",
        f"Autor: {pr['user']['login']}  |  Criado: {pr['created_at'][:10]}",
        f"Branches: {pr['head']['label']} → {pr['base']['label']}",
        f"Commits: {pr['commits']}  |  Ficheiros alterados: {pr['changed_files']}",
        f"+{pr['additions']} / -{pr['deletions']}",
        f"URL: {pr['html_url']}",
        "",
        pr.get("body") or "(sem descrição)",
    ]
    return "\n".join(lines)


async def _create_pr(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    title = p.get("title", "").strip()
    head  = p.get("head", "").strip()
    base  = p.get("base_branch", "").strip()
    body  = p.get("body", "").strip()
    if not title:
        return "[erro] Parâmetro 'title' é obrigatório para create_pr."
    if not head:
        return "[erro] Parâmetro 'head' (branch de origem) é obrigatório para create_pr."
    if not base:
        return "[erro] Parâmetro 'base_branch' (branch de destino) é obrigatório para create_pr."
    r = await client.post(
        f"{API}/repos/{owner}/{repo}/pulls",
        json={"title": title, "head": head, "base": base, "body": body},
    )
    r.raise_for_status()
    pr = r.json()
    return f"Pull Request criado: #{pr['number']} — {pr['title']}\n{pr['html_url']}"


async def _merge_pr(owner: str, repo: str, p: dict, client: httpx.AsyncClient) -> str:
    number = p.get("number")
    if not number:
        return "[erro] Parâmetro 'number' é obrigatório para merge_pr."
    r = await client.put(
        f"{API}/repos/{owner}/{repo}/pulls/{number}/merge",
        json={"merge_method": "merge"},
    )
    r.raise_for_status()
    data = r.json()
    return f"PR #{number} merged com sucesso.\nSHA: {data.get('sha', '?')}"


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _human_size(size: int) -> str:
    for unit in ("B", "KB", "MB"):
        if size < 1024:
            return f"{size:.0f} {unit}"
        size //= 1024
    return f"{size:.0f} GB"
