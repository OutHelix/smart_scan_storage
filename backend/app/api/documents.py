import logging
from pathlib import Path
from threading import Lock
import time
from typing import Any, Dict, List
import uuid

import pytesseract
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from app import schemas, crud, models
from app.config import settings
from app.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.ml.predictor import predict_category_with_confidence, extract_ocr_text, is_models_ready

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
UPLOAD_PROGRESS: Dict[str, Dict[str, Any]] = {}
UPLOAD_PROGRESS_LOCK = Lock()


def _ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _is_image_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_IMAGE_EXTENSIONS


def _is_pdf_file(filename: str) -> bool:
    return Path(filename).suffix.lower() == ".pdf"


def _parse_use_ml(value: str | None) -> bool:
    return str(value).lower() in ("true", "1", "yes") if value else False


def _cleanup_old_progress_entries(max_age_seconds: int = 3600):
    cutoff = time.time() - max_age_seconds
    with UPLOAD_PROGRESS_LOCK:
        stale_ids = [
            upload_id
            for upload_id, state in UPLOAD_PROGRESS.items()
            if state.get("updated_at", 0) < cutoff
        ]
        for upload_id in stale_ids:
            UPLOAD_PROGRESS.pop(upload_id, None)


def _set_upload_progress(upload_id: str, percent: int, stage: str, details: Dict[str, Any] | None = None):
    with UPLOAD_PROGRESS_LOCK:
        current = UPLOAD_PROGRESS.get(upload_id, {})
        UPLOAD_PROGRESS[upload_id] = {
            **current,
            "upload_id": upload_id,
            "percent": max(0, min(percent, 100)),
            "stage": stage,
            "details": details or {},
            "updated_at": time.time(),
        }


def _get_upload_progress(upload_id: str) -> Dict[str, Any] | None:
    _cleanup_old_progress_entries()
    with UPLOAD_PROGRESS_LOCK:
        state = UPLOAD_PROGRESS.get(upload_id)
        return dict(state) if state else None


def _normalize_category_name(name: str) -> str:
    if not name:
        return "Misc"
    special = {
        "invoice": "Invoices",
        "contract": "Contracts",
        "receipt": "Receipts",
        "id_document": "ID Documents",
        "id document": "ID Documents",
        "advertisement": "Advertisement",
        "budget": "Budget",
        "email": "Email",
        "file_folder": "File Folder",
        "form": "Form",
        "handwritten": "Handwritten",
        "letter": "Letter",
        "memo": "Memo",
        "news_article": "News Article",
        "presentation": "Presentation",
        "questionnaire": "Questionnaire",
        "resume": "Resume",
        "scientific_publication": "Scientific Publication",
        "scientific_report": "Scientific Report",
        "specification": "Specification",
    }
    name_lower = name.lower()
    if name_lower in special:
        return special[name_lower]
    return name.capitalize()


def _get_or_create_category(db: Session, category_name: str) -> models.Category:
    normalized_name = _normalize_category_name(category_name)
    category = crud.get_category_by_name(db, normalized_name)
    if not category:
        logger.info("Creating new category: %s", normalized_name)
        category = models.Category(name=normalized_name)
        db.add(category)
        db.commit()
        db.refresh(category)
    return category


def _process_image_ml(file_path: Path, original_filename: str, upload_id: str | None = None):
    started_at = time.perf_counter()
    try:
        logger.info("Starting ML inference for: %s", original_filename)
        img = Image.open(file_path).convert("RGB")
        if upload_id:
            _set_upload_progress(upload_id, 25, "image_loaded", {"image_size": list(img.size)})

        def progress_callback(percent: int, stage: str, details: Dict[str, Any] | None = None):
            if upload_id:
                _set_upload_progress(upload_id, percent, stage, details)

        classifier_started_at = time.perf_counter()
        pred_category, confidence = predict_category_with_confidence(img, progress_callback=progress_callback)
        logger.info(
            "Predicted category: %s with confidence: %.4f (classifier_time=%.2fs)",
            pred_category,
            confidence,
            time.perf_counter() - classifier_started_at,
        )
        
        logger.info("Starting OCR text extraction...")
        ocr_started_at = time.perf_counter()
        ocr_text = extract_ocr_text(img, progress_callback=progress_callback)
        logger.info(
            "OCR text extracted, length: %s (ocr_time=%.2fs, total_ml_time=%.2fs)",
            len(ocr_text) if ocr_text else 0,
            time.perf_counter() - ocr_started_at,
            time.perf_counter() - started_at,
        )
        if upload_id:
            _set_upload_progress(
                upload_id,
                93,
                "ml_complete",
                {
                    "predicted_category": pred_category,
                    "confidence": confidence,
                    "ocr_text_length": len(ocr_text) if ocr_text else 0,
                },
            )
        
        return pred_category, confidence, ocr_text
    except Exception as e:
        logger.error("ML inference failed: %s", e, exc_info=True)
        if upload_id:
            _set_upload_progress(upload_id, 100, "error", {"message": str(e)})
        return None, None, None


def _process_pdf_fallback(file_path: Path, original_filename: str):
    try:
        filename_lower = original_filename.lower()
        if "invoice" in filename_lower or "bill" in filename_lower:
            pred_category = "Invoices"
            confidence = 0.7
        elif "contract" in filename_lower or "agreement" in filename_lower:
            pred_category = "Contracts"
            confidence = 0.7
        elif "receipt" in filename_lower:
            pred_category = "Receipts"
            confidence = 0.7
        elif "id" in filename_lower or "passport" in filename_lower or "driver" in filename_lower:
            pred_category = "ID Documents"
            confidence = 0.7
        else:
            pred_category = "Misc"
            confidence = 0.5
        
        ocr_text = None
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(file_path, first_page=1, last_page=1)
            if images:
                ocr_text = pytesseract.image_to_string(images[0])
                logger.info("PDF OCR extracted, length: %s", len(ocr_text) if ocr_text else 0)
        except ImportError:
            logger.warning("pdf2image not installed, PDF OCR skipped")
        except Exception as e:
            logger.warning("PDF OCR failed: %s", e)
        
        return pred_category, confidence, ocr_text
    except Exception as e:
        logger.error("PDF fallback processing failed: %s", e)
        return None, None, None


@router.post("/upload", response_model=schemas.DocumentOut)
def upload_document(
    file: UploadFile = File(...),
    category_id: int | None = Form(None),
    use_ml: str | None = Form(None),
    upload_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_started_at = time.perf_counter()
    resolved_upload_id = upload_id or uuid.uuid4().hex
    _set_upload_progress(
        resolved_upload_id,
        5,
        "request_received",
        {"filename": file.filename},
    )
    if not file.filename or not _allowed_file(file.filename):
        _set_upload_progress(resolved_upload_id, 100, "error", {"message": "Unsupported file format"})
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
    except OSError:
        _set_upload_progress(resolved_upload_id, 100, "error", {"message": "Failed to save file"})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file")
    mime_type = file.content_type
    _set_upload_progress(
        resolved_upload_id,
        15,
        "file_saved",
        {"stored_filename": stored_name, "size_bytes": file_size},
    )

    ocr_text = None
    predicted_confidence = None
    predicted_category_name = None

    use_ml_flag = _parse_use_ml(use_ml)
    logger.info(
        "Upload received: filename=%s, use_ml=%s, is_image=%s, size_bytes=%s",
        file.filename,
        use_ml_flag,
        _is_image_file(file.filename),
        file_size,
    )
    
    if use_ml_flag:
        if _is_image_file(file.filename):
            if is_models_ready():
                logger.info("ML models ready, running inference...")
                _set_upload_progress(resolved_upload_id, 20, "ml_start", {"message": "ML models ready"})
                pred_category, confidence, extracted_text = _process_image_ml(file_path, file.filename, resolved_upload_id)
                if pred_category and confidence is not None:
                    predicted_category_name = _normalize_category_name(pred_category)
                    predicted_confidence = confidence
                    ocr_text = extracted_text
                    
                    category = _get_or_create_category(db, predicted_category_name)
                    category_id = category.id
                    logger.info(
                        "ML assigned category: %s with confidence %.4f",
                        predicted_category_name,
                        confidence,
                    )
                else:
                    logger.warning("ML inference returned None, using Misc")
                    category = _get_or_create_category(db, "Misc")
                    category_id = category.id
            else:
                logger.warning("ML models not ready, using Misc")
                _set_upload_progress(resolved_upload_id, 20, "ml_unavailable", {"message": "ML models not ready"})
                category = _get_or_create_category(db, "Misc")
                category_id = category.id
        elif _is_pdf_file(file.filename):
            logger.info("Processing PDF file with fallback")
            _set_upload_progress(resolved_upload_id, 30, "pdf_fallback", {"message": "Processing PDF fallback"})
            pred_category, confidence, extracted_text = _process_pdf_fallback(file_path, file.filename)
            if pred_category and confidence is not None:
                predicted_category_name = _normalize_category_name(pred_category)
                predicted_confidence = confidence
                ocr_text = extracted_text
                
                category = _get_or_create_category(db, predicted_category_name)
                category_id = category.id
                logger.info(
                    "PDF fallback assigned category: %s with confidence %.4f",
                    predicted_category_name,
                    confidence,
                )
            else:
                category = _get_or_create_category(db, "Misc")
                category_id = category.id
        else:
            logger.info("Unsupported file type for ML: %s", file.filename)
            _set_upload_progress(resolved_upload_id, 20, "unsupported_type", {"message": "Unsupported file type for ML"})
            category = _get_or_create_category(db, "Misc")
            category_id = category.id
    elif category_id is not None:
        if not crud.get_category_by_id(db, category_id=category_id):
            _set_upload_progress(resolved_upload_id, 100, "error", {"message": "Category not found"})
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    else:
        category = _get_or_create_category(db, "Misc")
        category_id = category.id
    _set_upload_progress(
        resolved_upload_id,
        95,
        "saving_document",
        {"category_id": category_id, "predicted_category_name": predicted_category_name},
    )

    doc = crud.create_document(
        db=db,
        user_id=current_user.id,
        original_filename=file.filename,
        stored_filename=stored_name,
        mime_type=mime_type,
        file_size=file_size,
        category_id=category_id,
        ocr_text=ocr_text,
        predicted_confidence=predicted_confidence,
        predicted_category_name=predicted_category_name,
    )
    
    db.refresh(doc)

    logger.info(
        "Document uploaded successfully: id=%s, category_id=%s, total_request_time=%.2fs",
        doc.id,
        category_id,
        time.perf_counter() - request_started_at,
    )
    _set_upload_progress(
        resolved_upload_id,
        100,
        "completed",
        {
            "document_id": doc.id,
            "category_id": category_id,
            "predicted_category_name": predicted_category_name,
            "total_request_time_sec": round(time.perf_counter() - request_started_at, 2),
        },
    )
    return doc


@router.get("", response_model=List[schemas.DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = crud.get_documents_by_user(db, user_id=current_user.id)
    for doc in docs:
        if doc.category_link:
            doc.category = doc.category_link.category
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
    if doc.category_link:
        doc.category = doc.category_link.category
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


@router.get("/{doc_id}/ocr")
def get_document_ocr(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = crud.get_document_by_id(db, doc_id=doc_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return {
        "ocr_text": doc.ocr_text,
        "predicted_confidence": doc.predicted_confidence,
        "predicted_category_name": doc.predicted_category_name,
    }


@router.get("/ml/status")
def get_ml_status(
    current_user: User = Depends(get_current_user),
):
    return {
        "ml_ready": is_models_ready(),
        "supported_formats": list(ALLOWED_IMAGE_EXTENSIONS)
    }


@router.get("/upload-status/{upload_id}")
def get_upload_status(
    upload_id: str,
    current_user: User = Depends(get_current_user),
):
    status_state = _get_upload_progress(upload_id)
    if not status_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload status not found")
    return status_state
