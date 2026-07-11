# Zoom Clone Video Conferencing Platform

A fully functional, full-stack video conferencing web application clone of Zoom, featuring secure authentication, real-time WebRTC video/audio streaming, live chat, profile settings, and a complete meeting scheduling system.

## ✨ Features & Functionality

### User & Account Management
- **JWT Authentication:** Secure user registration and login system with encrypted passwords (`sha256_crypt`) and JWT tokens.
- **Profile Settings:** Dedicated settings page to update user details including Name, Email, and Phone Number.

### Meetings & Video Conferencing
- **Real-Time Video Calling (WebRTC):** Full peer-to-peer video and audio streaming using `RTCPeerConnection` and STUN servers, backed by a custom WebSocket signaling relay.
- **Dynamic Video Grid & Pagination:**
  - **Smart Layouts:** The video grid dynamically adjusts from 1x1 to 3x2 formats to prevent squashing or distorting videos, no matter how many people join.
  - **Carousel Pagination:** Limits the screen to a maximum of 6 participants at once. If a 7th person joins, an elegant sliding carousel (with `<` and `>`) lets you swipe through pages of participants.
  - **Mirrored Video:** Your local video feed operates as a true mirror, aligning with real-world video conferencing standards.
- **Hardware Device Management:** Users can enumerate and select their preferred Microphone and Camera directly from the Settings page.
- **Live Preview & Testing:** 
  - **Settings:** Test your camera and microphone on demand before joining any meeting.
  - **Pre-Join Screen:** A waiting room where users can toggle their audio/video and select devices before entering the live call.
- **Robust Media Cleanup:** Advanced camera and microphone resource management guarantees that hardware is released immediately when meetings end, tabs are closed, or the browser's back button is used.
- **Live Chat:** Real-time text chat synchronized across all participants in a meeting room via WebSockets.

### Host Controls
- **Host-Gated Entry (Waiting Room):** Attendees can't enter a meeting before it starts. Anyone who arrives early is held on a "Waiting for the host" screen and is admitted automatically the moment the host joins.
- **Mute & Video Controls Over Participants:** The host can mute or turn off video for everyone at once ("Host tools"), or for a single participant from the participants list.
- **End Meeting for Everyone:** The host can end the meeting for all participants (including themselves) with a single action, tearing down all WebRTC connections safely.

---

## 🏗 Technical Architecture & Approaches

### Audio and Video Exchange (WebRTC & WebSockets)
The core of this application relies on a **Mesh Architecture** using **WebRTC** (Web Real-Time Communication) to handle the transmission of video and audio streams directly between browsers.

1. **Signaling (WebSockets via FastAPI):** Before two peers can send video to each other, they must discover each other and negotiate a connection. We use WebSockets to act as the "Signaling Server". When a user joins a room, they send an alert through the WebSocket. 
2. **SDP Exchange:** The peers use the WebSocket to exchange **SDP (Session Description Protocol)** offers and answers. This tells each peer what video/audio codecs the other supports.
3. **ICE Candidates:** Peers also exchange **ICE Candidates** over the WebSocket. These candidates contain network routing information (IP addresses and ports) gathered via Google's STUN servers (`stun.l.google.com`) so the browsers can punch through NAT routers and firewalls.
4. **Peer-to-Peer Streaming:** Once the signaling is complete, the `RTCPeerConnection` is established. Audio and video streams are transmitted **directly** between the participants' browsers, bypassing the backend server entirely. This ensures the lowest possible latency for high-quality video exchange.

### Why this Tech Stack?

- **Frontend: Next.js & React**
  - *Why:* Next.js App Router provides excellent routing, server-side rendering, and API capabilities. React is uniquely suited for managing complex state (like managing multiple `RTCPeerConnection` objects, device IDs, and local media streams) while keeping the UI snappy and modular.
  - *Styling:* Vanilla CSS Modules were used to maintain complete, granular control over the complex grid math and carousel animations without relying on bloated UI libraries.

- **Backend: Python & FastAPI**
  - *Why:* FastAPI is inherently asynchronous, making it one of the fastest and most efficient frameworks for handling thousands of persistent WebSocket connections. It natively supports Python's `asyncio`, which is crucial for routing real-time signaling data instantly without blocking the server.

- **Database: SQLite & SQLAlchemy**
  - *Why:* SQLite provides a lightweight, frictionless development experience. Paired with SQLAlchemy (a powerful ORM), it allows for rapid prototyping of the User and Meeting schema while being easily swappable for PostgreSQL in a production environment (like on Render).

---

## 🚀 Deployment (Vercel & Render)

The platform is designed to be easily deployed to production using Vercel (for the frontend) and Render (for the backend WebSocket/API server).

1. **Backend on Render:** Deploy the `backend` folder as a Python Web Service. Use `pip install -r requirements.txt` as the build command and `uvicorn main:app --host 0.0.0.0 --port 10000` as the start command.
2. **Frontend on Vercel:** Deploy the GitHub repo to Vercel, explicitly setting the **Root Directory** to `frontend`.
3. **Environment Variables:**
   - In Vercel, add `NEXT_PUBLIC_API_URL` (e.g. `https://your-backend.onrender.com`) and `NEXT_PUBLIC_WS_URL` (e.g. `wss://your-backend.onrender.com`).
   - In Render, add `FRONTEND_URL` (e.g. `https://your-frontend.vercel.app`) to bypass CORS restrictions.

## 💻 Local Setup Instructions

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies: `pip install -r requirements.txt`
4. Run the FastAPI development server: `uvicorn main:app --reload --port 8000`

### Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Run the Next.js development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser.
