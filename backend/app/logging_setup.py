import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config import settings

LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
MAX_LOG_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 5


def configure_logging() -> None:
    """Configure a single shared logger pipeline for console and file output."""
    root_logger = logging.getLogger()
    if getattr(root_logger, "_smart_scan_configured", False):
        return

    log_path = Path(settings.SERVICE_LOG_PATH)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(LOG_FORMAT)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=MAX_LOG_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(stream_handler)
    root_logger.addHandler(file_handler)
    setattr(root_logger, "_smart_scan_configured", True)

    for logger_name in ("uvicorn", "uvicorn.error", "sqlalchemy", "httpx"):
        named_logger = logging.getLogger(logger_name)
        named_logger.setLevel(logging.INFO)
        named_logger.propagate = True


def read_service_log_tail(limit: int = 500) -> list[str]:
    log_path = Path(settings.SERVICE_LOG_PATH)
    if not log_path.exists():
        return []

    with log_path.open("r", encoding="utf-8", errors="replace") as handle:
        lines = handle.readlines()
    return [line.rstrip("\n") for line in lines[-max(1, min(limit, 2000)):]]
