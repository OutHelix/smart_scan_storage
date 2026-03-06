import os

class Settings:
    API_TITLE = "Smart Scan Storage API"
    API_VERSION = "0.0.1"
    API_PREFIX = "/api/v1"
    DATABASE_URL = "postgresql://postgres:127576@localhost/smart_scan_storage"
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production-use-env")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))

settings = Settings()