from sqlalchemy.orm import Session
from sqlalchemy import text
import bcrypt
from pydantic import ValidationError
from app import models, schemas
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.checkpw(password_bytes, hashed.encode('utf-8'))

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = hash_password(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_admin=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def ensure_user_schema(db: Session):
    columns = db.execute(text("PRAGMA table_info(users)")).fetchall()
    column_names = {column[1] for column in columns}
    if "is_admin" not in column_names:
        logger.info("Adding is_admin column to users table")
        db.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"))
        db.commit()


def ensure_default_admin(db: Session):
    """Create the default admin account or repair it if it already exists."""
    ensure_user_schema(db)
    admin_user = get_user_by_username(db, settings.DEFAULT_ADMIN_USERNAME)
    if admin_user:
        admin_updated = False
        if not admin_user.is_admin:
            admin_user.is_admin = True
            admin_updated = True
            logger.info("Existing default admin promoted to admin: %s", admin_user.username)
        try:
            schemas.UserOut.model_validate(admin_user)
        except ValidationError:
            admin_user.email = settings.DEFAULT_ADMIN_EMAIL
            admin_updated = True
            logger.info("Existing default admin email reset to a valid address: %s", admin_user.email)
        if admin_updated:
            db.commit()
            db.refresh(admin_user)
        return admin_user

    admin_user = models.User(
        username=settings.DEFAULT_ADMIN_USERNAME,
        email=settings.DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
        is_admin=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    logger.info("Created default admin user: %s", admin_user.username)
    return admin_user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def update_user_profile(db: Session, user_id: int, username: str, email: str):
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    user.username = username
    user.email = email
    db.commit()
    db.refresh(user)
    return user


def create_document(
    db: Session,
    user_id: int,
    original_filename: str,
    stored_filename: str,
    mime_type: str | None = None,
    file_size: int | None = None,
    category_id: int | None = None,
    ocr_text: str | None = None,
    predicted_confidence: float | None = None,
    predicted_category_name: str | None = None,
):
    doc = models.Document(
        user_id=user_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        mime_type=mime_type,
        file_size=file_size,
        ocr_text=ocr_text,
        predicted_confidence=predicted_confidence,
        predicted_category_name=predicted_category_name,
    )
    db.add(doc)
    db.flush()
    
    if category_id is not None:
        link = models.DocumentCategory(document_id=doc.id, category_id=category_id)
        db.add(link)
    
    db.commit()
    db.refresh(doc)
    
    if category_id is not None:
        category = db.query(models.Category).filter(models.Category.id == category_id).first()
        if category:
            doc.category = category
    
    return doc


def get_documents_by_user(db: Session, user_id: int):
    docs = db.query(models.Document).filter(models.Document.user_id == user_id).order_by(models.Document.created_at.desc()).all()
    for doc in docs:
        if doc.category_link:
            doc.category = doc.category_link.category
    return docs


def get_document_by_id(db: Session, doc_id: int, user_id: int):
    doc = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.user_id == user_id).first()
    if doc and doc.category_link:
        doc.category = doc.category_link.category
    return doc


def delete_document(db: Session, doc_id: int, user_id: int):
    doc = get_document_by_id(db, doc_id=doc_id, user_id=user_id)
    if doc:
        db.delete(doc)
        db.commit()
        return True
    return False


def get_categories(db: Session):
    return db.query(models.Category).order_by(models.Category.name.asc()).all()


def get_category_by_id(db: Session, category_id: int):
    return db.query(models.Category).filter(models.Category.id == category_id).first()


def get_category_by_name(db: Session, name: str):
    return db.query(models.Category).filter(models.Category.name == name).first()


def get_or_create_category(db: Session, name: str) -> models.Category:
    category = get_category_by_name(db, name)
    if not category:
        category = models.Category(name=name)
        db.add(category)
        db.commit()
        db.refresh(category)
        logger.info(f"Created new category: {name}")
    return category


def ensure_default_categories(db: Session):
    defaults = [
        "Advertisement", "Budget", "Email", "File Folder", "Form",
        "Handwritten", "Invoices", "Letter", "Memo", "News Article",
        "Presentation", "Questionnaire", "Resume", "Scientific Publication",
        "Scientific Report", "Specification", "Contracts", "Receipts",
        "ID Documents", "Misc"
    ]
    for name in defaults:
        if not get_category_by_name(db, name):
            db.add(models.Category(name=name))
    db.commit()


def update_document_ocr_and_confidence(
    db: Session,
    doc_id: int,
    user_id: int,
    ocr_text: str,
    predicted_confidence: float,
    predicted_category_name: str,
):
    doc = get_document_by_id(db, doc_id=doc_id, user_id=user_id)
    if doc:
        doc.ocr_text = ocr_text
        doc.predicted_confidence = predicted_confidence
        doc.predicted_category_name = predicted_category_name
        db.commit()
        db.refresh(doc)
    return doc
