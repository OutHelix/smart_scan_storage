import os

class Settings:
    API_TITLE = "Smart Scan Storage API"
    API_VERSION = "1.0.0"
    API_PREFIX = "/api/v1"
    DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./smart_scan_storage.db")
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production-use-env")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
    LOG_DIR = os.environ.get("LOG_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs"))
    SERVICE_LOG_PATH = os.environ.get("SERVICE_LOG_PATH", os.path.join(LOG_DIR, "service.log"))
    DEFAULT_ADMIN_USERNAME = os.environ.get("DEFAULT_ADMIN_USERNAME", "admin")
    DEFAULT_ADMIN_PASSWORD = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin")
    DEFAULT_ADMIN_EMAIL = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@example.com")

settings = Settings()
