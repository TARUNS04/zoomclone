"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function JoinMeeting() {
  const params = useParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const meetingId = params.id as string;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsJoining(true);
    // In a real app, we'd validate the meeting ID with the backend here
    // For now, redirect to the actual meeting room UI
    setTimeout(() => {
      router.push(`/meeting/${meetingId}?name=${encodeURIComponent(name)}`);
    }, 1000);
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <div className={styles.joinCard}>
        <div className={styles.header}>
          <h1>Join Meeting</h1>
          <p>Meeting ID: {meetingId}</p>
        </div>

        <form onSubmit={handleJoin} className={styles.formGroup}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              type="text"
              className={styles.input}
              placeholder="Enter your display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.joinButton}
            disabled={!name.trim() || isJoining}
          >
            {isJoining ? "Joining..." : "Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
