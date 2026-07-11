from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict
import uuid
import json
import os

import models
import schemas
from database import engine, get_db, SessionLocal
from auth import (
    get_password_hash, verify_password,
    create_access_token, get_current_user
)

# Create all tables (including new User table)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zoom Clone API")

# Public URL of the deployed frontend, e.g. https://zoomclone.vercel.app
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
# Comma-separated list of allowed origins (defaults to FRONTEND_URL)
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", FRONTEND_URL).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
        # meeting_ids that a host has started
        self.started: set = set()
        # meeting_id -> { socket_id -> (WebSocket, user_info) } for attendees
        # who arrived before the host started the meeting
        self.waiting: Dict[str, Dict[str, tuple]] = {}

    def is_started(self, meeting_id: str) -> bool:
        return meeting_id in self.started

    def mark_started(self, meeting_id: str):
        self.started.add(meeting_id)

    def mark_ended(self, meeting_id: str):
        # Reset so a future session again requires the host to start it
        self.started.discard(meeting_id)

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

    def add_waiting(self, meeting_id: str, socket_id: str, ws: WebSocket, user_info: dict):
        if meeting_id not in self.waiting:
            self.waiting[meeting_id] = {}
        self.waiting[meeting_id][socket_id] = (ws, user_info)

    async def admit_waiting(self, meeting_id: str):
        """Move every waiting attendee into the live room (host just started)."""
        waiting = self.waiting.pop(meeting_id, {})
        for sid, (ws, info) in waiting.items():
            try:
                await ws.send_json({"type": "meeting-started"})
                await self.join(meeting_id, sid, ws, info)
            except Exception:
                pass

    def in_room(self, meeting_id: str, socket_id: str) -> bool:
        return socket_id in self.rooms.get(meeting_id, {})

    async def disconnect(self, meeting_id: str, socket_id: str):
        """Unified cleanup for both waiting and in-room sockets."""
        # Remove from waiting list if present
        w = self.waiting.get(meeting_id)
        if w and socket_id in w:
            w.pop(socket_id, None)
            if not w:
                self.waiting.pop(meeting_id, None)

        # Remove from live room if present
        room = self.rooms.get(meeting_id)
        was_in_room = bool(room) and socket_id in room
        if was_in_room:
            room.pop(socket_id, None)
            if not room:
                self.rooms.pop(meeting_id, None)
        self.user_info.pop(socket_id, None)

        if was_in_room:
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

def get_meeting_host_id(meeting_id: str):
    """Look up the creator (host) id for a meeting."""
    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        return meeting.created_by if meeting else None
    finally:
        db.close()

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

@app.put("/auth/me", response_model=schemas.UserOut)
def update_me(update_data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if update_data.username is not None and update_data.username != current_user.username:
        existing = db.query(models.User).filter(models.User.username == update_data.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = update_data.username
    if update_data.email is not None and update_data.email != current_user.email:
        existing = db.query(models.User).filter(models.User.email == update_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = update_data.email
    if update_data.phone_number is not None:
        current_user.phone_number = update_data.phone_number
    db.commit()
    db.refresh(current_user)
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
    db_meeting.invite_link = f"{FRONTEND_URL}/join/{db_meeting.id}/preview"
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
    is_host = False

    HOST_ACTIONS = {
        "host-mute-all", "host-video-off-all",
        "host-mute-one", "host-video-off-one", "end-meeting"
    }

    try:
        # First message must be "join" with user info
        data = await websocket.receive_json()
        if data.get("type") == "join":
            user_id = data.get("userId", "")
            host_id = get_meeting_host_id(meeting_id)
            is_host = bool(host_id) and host_id == user_id
            user_info = {
                "username": data.get("username", "Guest"),
                "userId": user_id,
                "isHost": is_host,
            }
            # Confirm the socket_id and host status back to the client
            await websocket.send_json({"type": "joined", "socketId": socket_id, "isHost": is_host})

            if is_host:
                # Host joining starts the meeting and admits anyone waiting
                manager.mark_started(meeting_id)
                await manager.join(meeting_id, socket_id, websocket, user_info)
                await manager.admit_waiting(meeting_id)
            elif manager.is_started(meeting_id):
                await manager.join(meeting_id, socket_id, websocket, user_info)
            else:
                # Attendee arrived before the host started — hold in waiting room
                manager.add_waiting(meeting_id, socket_id, websocket, user_info)
                await websocket.send_json({"type": "waiting-for-host"})

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
            elif msg_type in HOST_ACTIONS:
                # Only the verified host may perform these actions
                if not user_info.get("isHost"):
                    continue
                if msg_type == "host-mute-all":
                    await manager.broadcast(meeting_id, {"type": "force-mute"}, exclude=socket_id)
                elif msg_type == "host-video-off-all":
                    await manager.broadcast(meeting_id, {"type": "force-video-off"}, exclude=socket_id)
                elif msg_type == "host-mute-one" and target_id:
                    await manager.send_to(meeting_id, target_id, {"type": "force-mute"})
                elif msg_type == "host-video-off-one" and target_id:
                    await manager.send_to(meeting_id, target_id, {"type": "force-video-off"})
                elif msg_type == "end-meeting":
                    manager.mark_ended(meeting_id)
                    await manager.broadcast(meeting_id, {"type": "meeting-ended"})

    except WebSocketDisconnect:
        await manager.disconnect(meeting_id, socket_id)
    except Exception:
        await manager.disconnect(meeting_id, socket_id)
