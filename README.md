# Zoom Clone Video Conferencing Platform

A fully functional, full-stack video conferencing web application clone of Zoom, featuring secure authentication, real-time WebRTC video/audio streaming, live chat, profile settings, and a complete meeting scheduling system.

## ✨ Features & Functionality

### User & Account Management
- **JWT Authentication:** Secure user registration and login system with encrypted passwords (`sha256_crypt`) and JWT tokens.
- **Profile Settings:** Dedicated settings page to update user details including Name, Email, and Phone Number.

### Meetings & Video Conferencing
- **Real-Time Video Calling (WebRTC):** Full peer-to-peer video and audio streaming using `RTCPeerConnection` and STUN servers, backed by a custom WebSocket signaling relay.
- **Multi-Participant Ready:** Architecture supports multiple users joining the same meeting room.
- **Hardware Device Management:** Users can enumerate and select their preferred Microphone and Camera directly from the Settings page.
- **Live Preview & Testing:** 
  - **Settings:** Test your camera and microphone on demand before joining any meeting.
  - **Pre-Join Screen:** A waiting room where users can toggle their audio/video and select devices before entering the live call.
- **Robust Media Cleanup:** Advanced camera and microphone resource management guarantees that hardware is released immediately when meetings end, tabs are closed, or the browser's back button is used.
- **Live Chat:** Real-time text chat synchronized across all participants in a meeting room via WebSockets.

### Host Controls
- **Host-Gated Entry (Waiting Room):** Attendees can't enter a meeting before it starts. Anyone who arrives early is held on a "Waiting for the host" screen and is admitted automatically the moment the host joins. The host is verified server-side against the meeting's creator.
- **Mute & Video Controls Over Participants:** The host can mute or turn off video for everyone at once ("Host tools"), or for a single participant from the participants list. By design the host can only turn these **off** — participants keep control of turning their own mic/camera back on.
- **End Meeting for Everyone:** The host can end the meeting for all participants (including themselves) with a single action. A confirmation dialog is shown before ending, and every participant is disconnected and redirected once confirmed. Non-hosts see a **Leave** action instead, which only removes them.

### Scheduling & Dashboard
- **Modern Zoom UI:** Pixel-perfect, minimalist, flat dark-themed interface mirroring the Zoom Desktop application.
- **Responsive Meeting Grid:** Upcoming and ongoing meetings are displayed in a clean, scrollable CSS grid layout.
- **Meeting Scheduler & Invitee System:** 
  - Dedicated scheduling page with date/time pickers.
  - Ability to invite other users via email.
  - The dashboard dynamically displays upcoming meetings that you created OR that you were invited to.

## 🛠 Tech Stack
- **Frontend:** Next.js (App Router), React, Vanilla CSS Modules, Lucide Icons
- **Backend:** Python, FastAPI, WebSockets
- **Database:** SQLite & SQLAlchemy
- **Security:** passlib (sha256_crypt), python-jose (JWT)
- **Networking:** WebRTC APIs, WebSockets

## 🚀 Setup Instructions

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

## 💡 Usage Guide
1. **Register:** Start by creating a new account.
2. **Setup Profile:** Go to **Settings** to update your phone number and test your camera/mic.
3. **Schedule:** Click **Scheduler** in the sidebar to plan a new meeting and invite users by email.
4. **Join a Meeting:** Click **Start** on any upcoming meeting from the **Meetings** page, or paste a link into the Join modal on the Home page.
5. **Video Call:** After setting up your devices in the preview screen, click **Start** to enter the room, stream your video/audio, and chat with participants!
6. **Host a Meeting:** As the meeting creator you are the host. The meeting starts when you join, and any waiting attendees are let in automatically. Use **Host tools** to mute all or turn off everyone's video, or manage individuals from the **Participants** panel. Click **End** to close the meeting for everyone (you'll be asked to confirm). Attendees who aren't the host see **Leave** instead.
