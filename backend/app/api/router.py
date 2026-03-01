from fastapi import APIRouter

from .auth import router as auth_router


router = APIRouter()


@router.get("/")
def api_root():
    return {"message": "Smart Scan Storage API"}


router.include_router(auth_router)

