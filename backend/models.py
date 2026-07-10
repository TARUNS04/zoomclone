from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from database import Base
import uuid
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    scheduled_date = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)  # in minutes
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    invite_link = Column(String, unique=True, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)

class MeetingInvitee(Base):
    __tablename__ = "meeting_invitees"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=False, index=True)
    email = Column(String, nullable=False, index=True)

