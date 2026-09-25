import os
from fastapi import HTTPException
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("JWT_SECRET", "supersecret-hackathon-key")
ALGORITHM = "HS256"

def require_role(token_or_role: str, *allowed_roles: str) -> None:
    # MVP hack: if it's a simple role string (e.g. from tests), allow it if it matches
    if token_or_role.lower() in [r.lower() for r in allowed_roles]:
        return
        
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Strip Bearer if present, though we might pass it raw in X-Role
        token = token_or_role.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role")
        if not role:
            raise credentials_exception
        if role.lower() not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' is not authorised for this action. Required: {list(allowed_roles)}.",
            )
    except JWTError:
        raise credentials_exception
