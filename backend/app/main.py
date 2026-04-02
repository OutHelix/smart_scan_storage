import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import pytesseract
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app import crud
from app.api import router as api_router
from app.database import engine, Base, SessionLocal
from app.logging_setup import configure_logging
from app.ml.predictor import initialize_models, get_model_health

configure_logging()
logger = logging.getLogger(__name__)


class IgnoreNoisyAccessRoutes(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        noisy_paths = (
            "/api/v1/documents/upload-status/",
        )
        return not any(path in message for path in noisy_paths)


logging.getLogger("uvicorn.access").addFilter(IgnoreNoisyAccessRoutes())


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")

    Base.metadata.create_all(bind=engine)

    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.LOG_DIR).mkdir(parents=True, exist_ok=True)

    with SessionLocal() as db:
        crud.ensure_default_categories(db)
        crud.ensure_default_admin(db)

    initialize_models()

    yield

    logger.info("Shutting down...")


app = FastAPI(
    title=settings.API_TITLE,
    description="Smart scan storage: OCR, search by names/dates/amounts, auto-stitch pages",
    version=settings.API_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    path = request.url.path
    try:
        response = await call_next(request)
    except Exception:
        if not path.startswith("/api/v1/documents/upload-status/"):
            logger.exception(
                "request_failed method=%s path=%s duration_ms=%.2f",
                request.method,
                path,
                (time.perf_counter() - started_at) * 1000,
            )
        raise
    if not path.startswith("/api/v1/documents/upload-status/"):
        logger.info(
            "request_completed method=%s path=%s status=%s duration_ms=%.2f",
            request.method,
            path,
            response.status_code,
            (time.perf_counter() - started_at) * 1000,
        )
    return response


@app.get("/health")
def health():
    database_status = {"ok": False}
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database_status = {
            "ok": True,
            "database_url": settings.DATABASE_URL,
            "dialect": engine.dialect.name,
        }
    except Exception as exc:
        database_status = {
            "ok": False,
            "database_url": settings.DATABASE_URL,
            "error": str(exc),
        }

    upload_dir = Path(settings.UPLOAD_DIR)
    try:
        tesseract_version = str(pytesseract.get_tesseract_version())
        tesseract_ok = True
    except Exception as exc:
        tesseract_version = None
        tesseract_ok = False
        tesseract_error = str(exc)

    response = {
        "status": "ok" if database_status["ok"] else "degraded",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "api": {
            "title": settings.API_TITLE,
            "version": settings.API_VERSION,
            "prefix": settings.API_PREFIX,
        },
        "database": database_status,
        "storage": {
            "upload_dir": str(upload_dir.resolve()),
            "exists": upload_dir.exists(),
            "is_dir": upload_dir.is_dir(),
        },
        "ml": get_model_health(),
        "monitoring": {"request_logging": True},
        "logging": {
            "service_log_path": settings.SERVICE_LOG_PATH,
        },
        "ocr_runtime": {
            "tesseract_ok": tesseract_ok,
            "tesseract_version": tesseract_version,
        },
        "cors": {
            "allowed_origins": settings.CORS_ORIGINS,
        },
    }
    if not tesseract_ok:
        response["ocr_runtime"]["tesseract_error"] = tesseract_error
    return response
