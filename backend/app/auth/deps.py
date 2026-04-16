"""
Auth — Dependências FastAPI
get_current_user: para endpoints REST (Bearer token no header)
ws_auth: para WebSocket (token como query param)
"""

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.config import settings

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Valida o JWT no header Authorization: Bearer <token>."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")


def ws_auth(token: str = Query(...)) -> str:
    """Valida o JWT passado como ?token=... num WebSocket."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=403, detail="Token inválido")
        return username
    except JWTError:
        raise HTTPException(status_code=403, detail="Token inválido ou expirado")
