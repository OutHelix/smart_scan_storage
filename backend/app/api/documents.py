import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import schemas, crud
from app.config import settings
from app.database import get_db
from app.core.security import get_current_user
from app.models import User

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@router.post("/upload", response_model=schemas.DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not _allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allowed formats: PDF, JPG, PNG, GIF, WEBP",
        )
    _ensure_upload_dir()
    ext = Path(file.filename).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / stored_name
    content = file.file.read()
    file_size = len(content)
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file")
    mime_type = file.content_type
    doc = crud.create_document(
        db=db,
        user_id=current_user.id,
        original_filename=file.filename,
        stored_filename=stored_name,
        mime_type=mime_type,
        file_size=file_size,
    )
    return doc


@router.get("", response_model=List[schemas.DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = crud.get_documents_by_user(db, user_id=current_user.id)
    return docs


@router.get("/{doc_id}", response_model=schemas.DocumentOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = crud.get_document_by_id(db, doc_id=doc_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = crud.get_document_by_id(db, doc_id=doc_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_path = UPLOAD_DIR / doc.stored_filename
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    return FileResponse(
        path=file_path,
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = crud.get_document_by_id(db, doc_id=doc_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_path = UPLOAD_DIR / doc.stored_filename
    if file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass
    crud.delete_document(db, doc_id=doc_id, user_id=current_user.id)
    return None
