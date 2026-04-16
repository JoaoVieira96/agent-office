"""
Skill: code_runner
Executa código Python num subprocess isolado com timeout.
"""

import asyncio
import sys
import textwrap


async def run(params: dict, config: dict) -> str:
    """
    params:  {"code": "...", "description": "..."}
    config:  {"timeout_seconds": 10}
    returns: stdout/stderr da execução
    """
    code    = params.get("code", "")
    timeout = config.get("timeout_seconds", 10)

    if not code:
        return "Erro: código em falta."

    # Envolve o código para capturar output
    wrapped = textwrap.dedent(f"""
import sys, io, traceback
_out = io.StringIO()
sys.stdout = _out
sys.stderr = _out
try:
{textwrap.indent(code, '    ')}
except Exception:
    traceback.print_exc()
finally:
    sys.stdout = sys.__stdout__
    print(_out.getvalue(), end='')
""")

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", wrapped,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )

        output = (stdout or b"").decode("utf-8", errors="replace")
        errors = (stderr or b"").decode("utf-8", errors="replace")

        result = output
        if errors:
            result += f"\n[stderr]\n{errors}"

        return result.strip() or "(sem output)"

    except asyncio.TimeoutError:
        return f"Timeout: o código demorou mais de {timeout}s a executar."
    except Exception as e:
        return f"Erro ao executar código: {e}"
