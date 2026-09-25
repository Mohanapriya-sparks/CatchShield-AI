"""
Simple role-based access control helper.
In a production system this would validate a signed JWT.
For this hackathon MVP, the role is passed in the X-Role header
and validated server-side per endpoint.
"""
from fastapi import HTTPException


def require_role(provided: str, *allowed_roles: str) -> None:
    """Raise HTTP 403 if provided role is not in allowed_roles."""
    if provided.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{provided}' is not authorised for this action. "
                   f"Required: {list(allowed_roles)}.",
        )
