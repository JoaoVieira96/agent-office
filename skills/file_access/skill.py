"""
Skill: file_access
Lista e lê ficheiros no servidor dentro de um diretório base configurado.

Segurança:
- Todos os acessos são restritos ao base_dir configurado por agente.
- Path traversal (../../etc/passwd) é bloqueado via resolução de caminho absoluto.
"""

import os


async def run(params: dict, config: dict) -> str:
    """
    params:  {"action": "list"|"read", "path": "caminho/relativo"}
    config:  {"base_dir": "/data"}
    """
    action   = params.get("action", "").strip()
    rel_path = params.get("path", "").strip()
    base_dir = config.get("base_dir", "/data").rstrip("/")

    if action not in ("list", "read"):
        return "[erro] 'action' tem de ser 'list' ou 'read'."

    # Resolver caminho absoluto e verificar que está dentro do base_dir
    target = os.path.realpath(os.path.join(base_dir, rel_path))
    if not target.startswith(os.path.realpath(base_dir)):
        return f"[erro] Acesso negado: o caminho está fora do diretório base."

    if action == "list":
        return _list_dir(target, base_dir)
    else:
        return _read_file(target)


def _list_dir(path: str, base_dir: str) -> str:
    if not os.path.exists(path):
        return f"[erro] Pasta não encontrada: {_rel(path, base_dir)}"
    if not os.path.isdir(path):
        return f"[erro] '{_rel(path, base_dir)}' não é uma pasta. Usa 'read' para ler ficheiros."

    try:
        entries = sorted(os.scandir(path), key=lambda e: (not e.is_dir(), e.name.lower()))
    except PermissionError:
        return f"[erro] Sem permissão para listar: {_rel(path, base_dir)}"

    if not entries:
        return f"Pasta vazia: {_rel(path, base_dir)}"

    lines = [f"Conteúdo de /{_rel(path, base_dir)}:"]
    for entry in entries:
        if entry.is_dir():
            lines.append(f"  📁 {entry.name}/")
        else:
            size = _human_size(entry.stat().st_size)
            lines.append(f"  📄 {entry.name}  ({size})")

    return "\n".join(lines)


def _read_file(path: str) -> str:
    if not os.path.exists(path):
        return f"[erro] Ficheiro não encontrado: {path}"
    if os.path.isdir(path):
        return f"[erro] '{path}' é uma pasta. Usa 'list' para listar pastas."

    size = os.path.getsize(path)
    if size > 1_000_000:  # 1 MB
        return f"[erro] Ficheiro demasiado grande ({_human_size(size)}). Máximo: 1 MB."

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        lines = content.splitlines()
        header = f"Ficheiro: {path}  ({len(lines)} linhas, {_human_size(size)})\n"
        return header + "─" * 40 + "\n" + content
    except PermissionError:
        return f"[erro] Sem permissão para ler: {path}"


def _rel(path: str, base_dir: str) -> str:
    """Devolve o caminho relativo ao base_dir para exibição."""
    real_base = os.path.realpath(base_dir)
    try:
        return os.path.relpath(path, real_base)
    except ValueError:
        return path


def _human_size(size: int) -> str:
    for unit in ("B", "KB", "MB"):
        if size < 1024:
            return f"{size:.0f} {unit}"
        size //= 1024
    return f"{size:.0f} GB"
