# Copilot Instructions for Agent Office

## Big picture
- Agent Office is a two-app monorepo: `backend/` is FastAPI + SQLAlchemy, `frontend/` is Next.js App Router + Tailwind.
- The core flow is: UI loads agents/conversations → chat opens a WebSocket → backend `run_agent()` builds context → Anthropic is called → messages are persisted → hooks may fire.
- Skills are plugin folders under `skills/`; the backend scans them on startup and stores metadata in PostgreSQL.

## Backend patterns
- The API entry point is `backend/app/main.py`; it creates tables on startup and loads skills from disk before serving requests.
- DB models live in `backend/app/db/models.py`; sessions are in `backend/app/db/session.py`.
- Routes are split by domain in `backend/app/api/agents.py`, `conversations.py`, `skills.py`, and `hooks.py`.
- Chat is WebSocket-based at `/ws/{conversation_id}`; REST endpoints are prefixed with `/api/...`.
- Hooks are best-effort only: failures are logged and must not break the main agent flow.

## Skills and hooks
- New skills must follow the template in `skills/_template/`: a `manifest.json` plus an async `skill.py` exposing `run(params, config) -> str`.
- The manifest’s `tool_schema` is what the LLM sees; `config_schema` is stored on the skill record and passed as agent config.
- Skill execution is dynamic/import-by-path in `backend/app/skills/registry.py`; keep `slug` stable and match the folder name.
- Hooks currently support `webhook`, `notify`, and `skill` actions; see `backend/app/hooks/engine.py` for payload shape and event names.

## Frontend patterns
- Prefer the shared API client in `frontend/src/lib/api.ts` instead of ad-hoc fetch calls; it centralizes the base URL and WebSocket helper.
- Next.js server components often fetch directly from `http://backend:8000/api/...` for SSR pages, while client components use `api` and `createChatSocket()`.
- If you change route shapes or response payloads, update `frontend/src/lib/api.ts` and any pages that rely on the old contract.
- The UI uses Portuguese copy and a dark theme defined in `frontend/src/app/globals.css` and Tailwind classes.

## Dev workflow
- Local startup: `cp .env.example .env` then `docker compose up`.
- Backend docs: `http://localhost:8000/docs`; frontend: `http://localhost` when running through compose.
- After adding or changing a skill, restart only the backend: `docker compose restart backend`.
- Useful logs: `docker compose logs -f backend`.

## Important integration details
- `frontend/next.config.js` rewrites `/api/*` to `NEXT_PUBLIC_API_URL` or `http://localhost:8000`, so API changes should preserve that proxy path.
- Compose wires services by name: frontend talks to `backend:8000`, backend uses Postgres and Redis service hostnames.
- Required env vars are `ANTHROPIC_API_KEY` and `SECRET_KEY`; `OPENAI_API_KEY` is optional and currently not the primary LLM path.

## Editing guidance
- Keep changes minimal and consistent with the existing naming/style; do not introduce new frameworks or abstractions without need.
- Preserve the current data model behavior unless a task explicitly changes it, especially soft-delete on agents and skill loading from disk.
- When touching chat, agent, or skill code, trace the full flow across backend engine, API, and frontend consumer before editing.
