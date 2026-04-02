from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(UserBase):
    id: int
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: str
    email: EmailStr


class LoginResponse(BaseModel):
    message: str
    user: UserOut
    access_token: str


class ServiceLogsResponse(BaseModel):
    source: str
    line_count: int
    lines: list[str]


class CategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    mime_type: str | None
    file_size: int | None
    created_at: datetime
    category: CategoryOut | None = None
    ocr_text: str | None = None
    predicted_confidence: float | None = None
    predicted_category_name: str | None = None

    class Config:
        from_attributes = True
