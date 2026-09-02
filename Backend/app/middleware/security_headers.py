"""Baseline response hardening headers."""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config.settings import settings

# The API returns JSON and never renders attacker-controlled HTML, so the policy
# can be maximally restrictive without affecting the documented endpoints.
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Swagger UI and ReDoc pull their assets from a CDN and use inline styles.
_DOCS_CSP = (
    "default-src 'self'; img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' "
    "https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' "
    "https://cdn.jsdelivr.net https://fonts.gstatic.com; frame-ancestors 'none'"
)
_DOCS_PATHS = ("/docs", "/redoc", "/docs/oauth2-redirect")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
        )
        headers.setdefault(
            "Content-Security-Policy",
            _DOCS_CSP if request.url.path in _DOCS_PATHS else _API_CSP,
        )
        # Clinical data must not be retained by shared caches.
        headers.setdefault("Cache-Control", "no-store")
        if not settings.is_development:
            headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response
