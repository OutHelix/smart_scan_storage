from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import router as api_router
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.API_TITLE,
    description="Smart scan storage: OCR, search by names/dates/amounts, auto-stitch pages",
    version=settings.API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

@app.get("/health")
def health():
    return {"status": "ok"}