# Zoom Clone Video Conferencing Platform

A functional video conferencing web application clone of Zoom, built as a Single Page Application (SPA).

## Features
- **Modern Zoom UI:** Clean and professional interface built with custom Vanilla CSS (Glassmorphism).
- **Landing Dashboard:** View upcoming and recent meetings, create instant meetings, or join existing ones.
- **Meeting Room Mockup:** A visually accurate meeting room with participant grid and control bars.
- **Backend API:** FastAPI application providing REST endpoints for meeting management.
- **Database:** SQLite database integrated via SQLAlchemy.

## Tech Stack
- **Frontend:** Next.js (App Router), React, Vanilla CSS
- **Backend:** Python, FastAPI, SQLAlchemy
- **Database:** SQLite

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
   pip install fastapi uvicorn sqlalchemy pydantic
   ```
4. Seed the database with sample data:
   ```bash
   python seed.py
   ```
5. Run the FastAPI development server:
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

## Assumptions & Simplifications
- **No Authentication:** A default user experience is assumed without login flows, per assignment instructions.
- **WebRTC functionality:** The meeting room provides a UI mockup. Full peer-to-peer video streaming requires WebRTC integration (e.g., via socket.io or livekit) which is beyond the current scope but the frontend architecture can easily accommodate it.
