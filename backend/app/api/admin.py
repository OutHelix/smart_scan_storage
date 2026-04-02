from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_admin
from app import schemas
from app.config import settings
from app.logging_setup import read_service_log_tail
from app.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=schemas.ServiceLogsResponse)
def get_service_logs(
    limit: int = Query(300, ge=1, le=2000),
    current_user: User = Depends(get_current_admin),
):
    """Return the most recent lines from the centralized service log."""
    lines = read_service_log_tail(limit=limit)
    return schemas.ServiceLogsResponse(
        source=settings.SERVICE_LOG_PATH,
        line_count=len(lines),
        lines=lines,
    )
