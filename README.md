# Zoom Clone Video Conferencing Platform

A fully functional, full-stack video conferencing web application clone of Zoom, featuring secure authentication, real-time WebRTC video/audio streaming, live chat, and a complete meeting scheduling system.

## Features
- **Modern Zoom UI:** Pixel-perfect, clean, and professional dark-themed interface mirroring the Zoom Desktop application.
- **JWT Authentication:** Secure user registration and login system with encrypted passwords (`sha256_crypt`) and JWT tokens.
- **Real-Time Video Calling (WebRTC):** Full peer-to-peer video and audio streaming using `RTCPeerConnection` and STUN servers, with a custom WebSocket signaling backend.
- **Live Chat:** Real-time text chat synchronized across all participants in a meeting room via WebSockets.
- **Pre-Join Preview Room:** A waiting screen that allows users to test their camera and microphone, enumerate their hardware devices, and toggle audio/video before entering the live call.
- **Meeting Scheduler & Invitee System:** 
  - Dedicated scheduling page with date/time pickers and custom UI matching the desktop app.
  - Ability to invite other users via email.
  - The dashboard dynamically displays upcoming meetings that you created OR that you were invited to.
- **Backend API:** FastAPI application providing asynchronous REST endpoints and WebSocket relays.
- **Database:** SQLite database integrated via SQLAlchemy, storing Users, Meetings, and Invitees.

## Tech Stack
- **Frontend:** Next.js (App Router), React, Vanilla CSS Modules
- **Backend:** Python, FastAPI, WebSockets
- **Database:** SQLite & SQLAlchemy
- **Security:** passlib (sha256_crypt), python-jose (JWT)
- **Networking:** WebRTC APIs, WebSockets

## Setup Instructions

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install fastapi uvicorn sqlalchemy pydantic python-jose passlib websockets
   ```
4. Run the FastAPI development server. (The SQLite database and tables will be generated automatically on startup):
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Concurrently
For convenience, you can run both the frontend and backend simultaneously from the root directory if a package script is configured, or simply open two terminal tabs following the instructions above.

## Usage Guide
1. **Register:** Start by creating a new account.
2. **Dashboard:** Once logged in, you will see your upcoming meetings. You can click **Schedule** to plan a new meeting.
3. **Invite Users:** On the schedule page, type an email in the invitees box and hit `Enter`. When that user registers with that email, they will see the meeting on their dashboard.
4. **Join a Meeting:** Click **Start Meeting** from the dashboard dropdown, or paste a meeting link into the **Join** modal.
5. **Video Call:** After setting up your devices in the preview screen, enter the room to stream your video/audio and chat with participants!
