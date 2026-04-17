"""
Git Push Skill — Agent Office
Escreve ficheiros no repo, faz commit e push para um novo branch.
Requer que o volume do repo esteja montado sem :ro no docker-compose.yml.
"""

import subprocess
from pathlib import Path


def _git(args: list[str], cwd: str, timeout: int = 30) -> str:
    result = subprocess.run(
        ["git"] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


async def run(params: dict, config: dict) -> str:
    repo_path    = config.get("repo_path", "/app/repo")
    token        = config.get("github_token", "")
    owner        = config.get("github_owner", "")
    repo         = config.get("github_repo", "")
    base_branch  = config.get("base_branch", "main")
    git_user     = config.get("git_user", "Agent Office")
    git_email    = config.get("git_email", "agent@office.local")

    branch         = params.get("branch", "").strip()
    commit_message = params.get("commit_message", "chore: changes by agent").strip()
    files          = params.get("files", [])

    # Validações
    if not branch:
        return "[erro] Parâmetro 'branch' é obrigatório."
    if not files:
        return "[erro] Lista de ficheiros vazia."
    if not token or not owner or not repo:
        return "[erro] Config incompleta: github_token, github_owner e github_repo são obrigatórios."

    try:
        # Configurar identidade git
        _git(["config", "user.name", git_user], repo_path)
        _git(["config", "user.email", git_email], repo_path)

        # Voltar ao base branch e actualizar
        _git(["checkout", base_branch], repo_path)
        _git(["pull", f"https://{token}@github.com/{owner}/{repo}.git", base_branch], repo_path)

        # Criar novo branch
        _git(["checkout", "-b", branch], repo_path)

        # Escrever ficheiros
        written = []
        for f in files:
            file_path = Path(repo_path) / f["path"]
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(f["content"], encoding="utf-8")
            written.append(f["path"])

        # Stage e commit
        _git(["add"] + written, repo_path)
        _git(["commit", "-m", commit_message], repo_path)

        # Push com token
        remote_url = f"https://{token}@github.com/{owner}/{repo}.git"
        _git(["push", remote_url, branch], repo_path)

        # Voltar ao base branch para não deixar o repo num estado inesperado
        _git(["checkout", base_branch], repo_path)

        return (
            f"Branch '{branch}' pushed com sucesso.\n"
            f"Ficheiros: {', '.join(written)}\n"
            f"Commit: {commit_message}"
        )

    except RuntimeError as e:
        # Tentar limpar estado do git em caso de erro
        try:
            _git(["checkout", base_branch], repo_path)
            _git(["branch", "-D", branch], repo_path)
        except Exception:
            pass
        return f"[erro git] {e}"

    except Exception as e:
        return f"[erro] {e}"
