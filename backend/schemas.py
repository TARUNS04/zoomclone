from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

from typing import Optional, List

# --- Meeting Schemas ---
class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    duration: Optional[int] = None
    invitees: Optional[List[str]] = []

class MeetingCreate(MeetingBase):
    pass

class Meeting(MeetingBase):
    id: str
    created_at: datetime
    invite_link: str
    created_by: Optional[str] = None
    organizer_name: Optional[str] = None

    class Config:
        from_attributes = True
