from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Config
from app.api import router as api_router

app = FastAPI(
    title=Config.API_TITLE,
    description="Smart scan storage: OCR, search by names/dates/amounts, auto-stitch pages",
    version=Config.API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=Config.API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
