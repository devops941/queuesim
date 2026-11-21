from app.api.v1.routers.auth import router as auth_router
from app.api.v1.routers.scenarios import router as scenarios_router
from app.api.v1.routers.imports import router as imports_router
from app.api.v1.routers.runs import router as runs_router
from app.api.v1.routers.analytics import router as analytics_router
from app.api.v1.routers.comparisons import router as comparisons_router
from app.api.v1.routers.reports import router as reports_router
from app.api.v1.routers.admin import router as admin_router

__all__ = [
    "auth_router",
    "scenarios_router",
    "imports_router",
    "runs_router",
    "analytics_router",
    "comparisons_router",
    "reports_router",
    "admin_router",
]
