import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.database import connect_db, close_db
from app.core.logging import setup_logging, get_logger
from app.core.errors import (
    validation_exception_handler,
    generic_exception_handler,
    app_error_handler,
    AppError,
)
from app.api.v1.routers import (
    auth_router,
    scenarios_router,
    imports_router,
    runs_router,
    analytics_router,
    comparisons_router,
    reports_router,
    admin_router,
)

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting QueueSim API...")
    await connect_db()
    logger.info("MongoDB connected and indexes ensured.")
    yield
    await close_db()
    logger.info("MongoDB disconnected.")


app = FastAPI(
    title="QueueSim API",
    version="1.0.0",
    description="Service Counter Congestion & Waiting-Time Simulation Engine",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

prefix = settings.API_PREFIX
app.include_router(auth_router, prefix=prefix)
app.include_router(scenarios_router, prefix=prefix)
app.include_router(imports_router, prefix=prefix)
app.include_router(runs_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)
app.include_router(comparisons_router, prefix=prefix)
app.include_router(reports_router, prefix=prefix)
app.include_router(admin_router, prefix=prefix)


@app.get("/health", tags=["ops"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/ready", tags=["ops"])
async def ready():
    return {"status": "ready", "version": settings.ENGINE_VERSION}


@app.get("/version", tags=["ops"])
async def version():
    return {"version": settings.ENGINE_VERSION, "env": settings.APP_ENV}
