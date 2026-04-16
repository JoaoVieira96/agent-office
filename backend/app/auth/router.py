"""
Auth — Login
Emite um JWT de longa duração para o utilizador admin definido no .env.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.config import settings

router = APIRouter()

ACCESS_TOKEN_EXPIRE_DAYS = 30


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """Autentica o utilizador admin e devolve um JWT."""
    if body.username != settings.ADMIN_USERNAME or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    token = jwt.encode(
        {"sub": body.username, "exp": expire},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    return TokenResponse(access_token=token)
