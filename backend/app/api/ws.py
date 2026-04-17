"""
WebSocket — Chat em tempo real
Registado sem prefixo para ficar acessível em /ws/{conversation_id},
que é o caminho que o nginx faz upgrade para WebSocket.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.db.session import get_db
from app.db.models import Conversation
from app.agents.engine import run_agent_stream
from app.auth.deps import ws_auth
from sqlalchemy.orm import Session

router = APIRouter()


@router.websocket("/ws/{conversation_id}")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: str = Depends(ws_auth),
):
    """
    WebSocket de chat em tempo real.
    O token JWT é passado como query param: /ws/{conv_id}?token=<jwt>

    Cliente envia: {"message": "..."}
    Servidor responde:
      {"type": "thinking"}               — a processar
      {"type": "chunk", "content": "…"}  — fragmento de texto (streaming)
      {"type": "done",  "content": "…"}  — resposta completa
      {"type": "error", "content": "…"}  — erro
    """
    await websocket.accept()

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        await websocket.send_json({"type": "error", "content": "Conversa não encontrada"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "").strip()

            if not user_message:
                continue

            await websocket.send_json({"type": "thinking"})

            try:
                async def on_chunk(text: str) -> None:
                    await websocket.send_json({"type": "chunk", "content": text})

                response = await run_agent_stream(
                    agent_id=conv.agent_id,
                    conversation_id=conversation_id,
                    user_message=user_message,
                    db=db,
                    on_chunk=on_chunk,
                )
                await websocket.send_json({"type": "done", "content": response})

            except Exception as e:
                await websocket.send_json({"type": "error", "content": str(e)})

    except WebSocketDisconnect:
        pass
