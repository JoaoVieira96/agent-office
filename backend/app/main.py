"""
Agent Office — Backend
Entry point da aplicação FastAPI.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db.session import create_tables
from app.api import agents, conversations, skills, hooks, ws
from app.auth import router as auth_router
from app.auth.deps import get_current_user
from app.skills.loader import load_skills_from_disk


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_tables()
    await load_skills_from_disk()
    yield
    # Shutdown (limpar recursos se necessário)


app = FastAPI(
    title="Agent Office API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # em produção, restringir ao domínio do frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth (público — sem protecção)
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])

# Routers protegidos por JWT
_auth = [Depends(get_current_user)]

app.include_router(agents.router,        prefix="/api/agents",       tags=["agents"],        dependencies=_auth)
app.include_router(skills.router,        prefix="/api/skills",        tags=["skills"],        dependencies=_auth)
app.include_router(hooks.router,         prefix="/api/hooks",         tags=["hooks"],         dependencies=_auth)

# Conversas REST
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])

# WebSocket sem prefixo — acessível em /ws/{id} (nginx faz upgrade neste path)
app.include_router(ws.router, tags=["websocket"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "agent-office"}
