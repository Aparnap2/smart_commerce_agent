# Port of apps/web/lib/auth/jwt.ts — same validation logic

from jose import jwt, JWTError
from pydantic import BaseModel
import os


class TokenPayload(BaseModel):
    userId: str
    email: str
    role: str  # SHOPPER | MERCHANT | SUPPORT | ADMIN


def verify_token(token: str) -> TokenPayload:
    if not token:
        raise ValueError("Token is required")
    try:
        payload = jwt.decode(
            token,
            os.environ["JWT_SECRET"],
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return TokenPayload(**payload)
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
    except KeyError:
        raise ValueError("JWT_SECRET not configured")
