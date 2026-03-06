from fastapi import APIRouter

from .auth import router as auth_router
from .documents import router as documents_router


router = APIRouter()


@router.get("/")
def api_root():
    return {"message": "Smart Scan Storage API"}


router.include_router(auth_router)
router.include_router(documents_router)

