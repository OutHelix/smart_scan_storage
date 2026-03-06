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
    created_at: datetime

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    message: str
    user: UserOut
    access_token: str


class DocumentOut(BaseModel):
    id: int
    user_id: int
    original_filename: str
    stored_filename: str
    mime_type: str | None
    file_size: int | None
    created_at: datetime

    class Config:
        from_attributes = True