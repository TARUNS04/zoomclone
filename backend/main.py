from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict
import uuid
import json

import models
import schemas
from database import engine, get_db
from auth import (
    get_password_hash, verify_password,
    create_access_token, get_current_user
)

# Create all tables (including new User table)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zoom Clone API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory WebSocket room manager ───────────────────────────────────────

class RoomManager:
    def __init__(self):
        # meeting_id -> { socket_id -> WebSocket }
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # socket_id -> user info
        self.user_info: Dict[str, dict] = {}

    def get_room_peers(self, meeting_id: str, exclude_id: str = None):
        room = self.rooms.get(meeting_id, {})
        return [sid for sid in room if sid != exclude_id]

    async def join(self, meeting_id: str, socket_id: str, ws: WebSocket, user_info: dict):
        if meeting_id not in self.rooms:
            self.rooms[meeting_id] = {}
        self.rooms[meeting_id][socket_id] = ws
        self.user_info[socket_id] = user_info

        # Notify the new joiner of all existing peers
        existing_peers = self.get_room_peers(meeting_id, socket_id)
        await ws.send_json({"type": "room-peers", "peers": [
            {"socketId": pid, **self.user_info[pid]} for pid in existing_peers
        ]})

        # Notify existing peers about the new joiner
        await self.broadcast(meeting_id, {
            "type": "peer-joined",
            "socketId": socket_id,
            **user_info
        }, exclude=socket_id)

    async def leave(self, meeting_id: str, socket_id: str):
        if meeting_id in self.rooms:
            self.rooms[meeting_id].pop(socket_id, None)
            if not self.rooms[meeting_id]:
                del self.rooms[meeting_id]
        self.user_info.pop(socket_id, None)

        await self.broadcast(meeting_id, {
            "type": "peer-left",
            "socketId": socket_id
        })

    async def send_to(self, meeting_id: str, target_id: str, message: dict):
        room = self.rooms.get(meeting_id, {})
        ws = room.get(target_id)
        if ws:
            await ws.send_json(message)

    async def broadcast(self, meeting_id: str, message: dict, exclude: str = None):
        room = self.rooms.get(meeting_id, {})
        dead = []
        for sid, ws in list(room.items()):
            if sid != exclude:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(sid)
        # Clean up any dead connections discovered during broadcast
        for sid in dead:
            room.pop(sid, None)
            self.user_info.pop(sid, None)

manager = RoomManager()

# ─── Auth Routes ────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=schemas.Token)
def register(user_data: schemas.UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# ─── Meeting Routes ──────────────────────────────────────────────────────────

@app.post("/meetings/", response_model=schemas.Meeting)
def create_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_meeting = models.Meeting(
        title=meeting.title,
        description=meeting.description,
        scheduled_date=meeting.scheduled_date,
        duration=meeting.duration,
        created_by=current_user.id,
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    db_meeting.invite_link = f"http://localhost:3000/join/{db_meeting.id}/preview"
    db.commit()
    
    if meeting.invitees:
        for email in meeting.invitees:
            invitee = models.MeetingInvitee(meeting_id=db_meeting.id, email=email)
            db.add(invitee)
        db.commit()

    db.refresh(db_meeting)
    
    # Create dict for response to include invitees
    res = schemas.Meeting.model_validate(db_meeting)
    res.invitees = meeting.invitees or []
    res.organizer_name = current_user.username
    return res

@app.get("/meetings/", response_model=List[schemas.Meeting])
def read_meetings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Meetings created by user
    created = db.query(models.Meeting).filter(models.Meeting.created_by == current_user.id).all()
    
    # Meetings user is invited to
    invited_meeting_ids = db.query(models.MeetingInvitee.meeting_id).filter(models.MeetingInvitee.email == current_user.email).all()
    invited_meeting_ids = [m[0] for m in invited_meeting_ids]
    invited = db.query(models.Meeting).filter(models.Meeting.id.in_(invited_meeting_ids)).all()
    
    all_meetings = list({m.id: m for m in created + invited}.values())
    all_meetings.sort(key=lambda x: x.created_at, reverse=True)
    
    res_meetings = []
    for m in all_meetings:
        invitee_records = db.query(models.MeetingInvitee.email).filter(models.MeetingInvitee.meeting_id == m.id).all()
        creator = db.query(models.User).filter(models.User.id == m.created_by).first()
        sm = schemas.Meeting.model_validate(m)
        sm.invitees = [r[0] for r in invitee_records]
        sm.organizer_name = creator.username if creator else "Unknown"
        res_meetings.append(sm)
        
    return res_meetings

@app.get("/meetings/{meeting_id}", response_model=schemas.Meeting)
def read_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    invitee_records = db.query(models.MeetingInvitee.email).filter(models.MeetingInvitee.meeting_id == meeting.id).all()
    creator = db.query(models.User).filter(models.User.id == meeting.created_by).first()
    sm = schemas.Meeting.model_validate(meeting)
    sm.invitees = [r[0] for r in invitee_records]
    sm.organizer_name = creator.username if creator else "Unknown"
    return sm

@app.delete("/meetings/{meeting_id}")
def delete_meeting(meeting_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this meeting")
        
    # Delete associated invitees
    db.query(models.MeetingInvitee).filter(models.MeetingInvitee.meeting_id == meeting_id).delete()
    db.delete(meeting)
    db.commit()
    return {"message": "Meeting deleted"}

# ─── WebSocket Signaling ─────────────────────────────────────────────────────

@app.websocket("/ws/meeting/{meeting_id}")
async def meeting_ws(websocket: WebSocket, meeting_id: str):
    await websocket.accept()
    socket_id = str(uuid.uuid4())
    user_info = {}

    try:
        # First message must be "join" with user info
        data = await websocket.receive_json()
        if data.get("type") == "join":
            user_info = {"username": data.get("username", "Guest"), "userId": data.get("userId", "")}
            await manager.join(meeting_id, socket_id, websocket, user_info)
            # Confirm the socket_id back to the client
            await websocket.send_json({"type": "joined", "socketId": socket_id})

        # Relay loop
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")
            target_id = msg.get("targetId")

            if msg_type in ("offer", "answer", "ice-candidate") and target_id:
                msg["fromId"] = socket_id
                await manager.send_to(meeting_id, target_id, msg)
            elif msg_type == "chat":
                # Broadcast chat message to everyone else in the room
                msg["fromId"] = socket_id
                msg["username"] = user_info.get("username", "Guest")
                await manager.broadcast(meeting_id, msg, exclude=socket_id)

    except WebSocketDisconnect:
        await manager.leave(meeting_id, socket_id)
    except Exception as e:
        await manager.leave(meeting_id, socket_id)
