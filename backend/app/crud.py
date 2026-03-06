from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not pwd_context.verify(password, user.hashed_password):
        return False
    return user


def create_document(
    db: Session,
    user_id: int,
    original_filename: str,
    stored_filename: str,
    mime_type: str | None = None,
    file_size: int | None = None,
):
    doc = models.Document(
        user_id=user_id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        mime_type=mime_type,
        file_size=file_size,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_documents_by_user(db: Session, user_id: int):
    return db.query(models.Document).filter(models.Document.user_id == user_id).order_by(models.Document.created_at.desc()).all()


def get_document_by_id(db: Session, doc_id: int, user_id: int):
    return (
        db.query(models.Document)
        .filter(models.Document.id == doc_id, models.Document.user_id == user_id)
        .first()
    )


def delete_document(db: Session, doc_id: int, user_id: int):
    doc = get_document_by_id(db, doc_id=doc_id, user_id=user_id)
    if doc:
        db.delete(doc)
        db.commit()
        return True
    return False