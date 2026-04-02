from fastapi import APIRouter

from .admin import router as admin_router
from .auth import router as auth_router
from .categories import router as categories_router
from .documents import router as documents_router


router = APIRouter()


@router.get("/")
def api_root():
    return {"message": "Smart Scan Storage API"}


router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(categories_router)
router.include_router(documents_router)
