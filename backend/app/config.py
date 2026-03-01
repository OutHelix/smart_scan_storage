class Settings:
    API_TITLE = "Smart Scan Storage API"
    API_VERSION = "0.0.1"
    API_PREFIX = "/api/v1"
    DATABASE_URL = "postgresql://postgres:127576@localhost/smart_scan_storage"
    CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

settings = Settings()