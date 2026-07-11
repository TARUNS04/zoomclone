"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, Video, MessageCircle, Calendar,
  Settings, LogOut, MoreHorizontal, ChevronDown
} from "lucide-react";
import { isAuthenticated, getUser, logout, apiFetch } from "@/lib/auth";
import homeStyles from "../page.module.css";
import localStyles from "./page.module.css";

// Merge styles: local overrides home
const styles = { ...homeStyles, ...localStyles };

interface Meeting {
  id: string;
  title: string;
  scheduled_date: string | null;
  duration: number | null;
  invite_link: string;
  organizer_name?: string;
  created_by?: string;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const closeDropdown = () => setActiveDropdown(null);
    window.addEventListener("click", closeDropdown);
    return () => window.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const data = await apiFetch("/meetings/");
      setMeetings(data);
    } catch {}
  };

  const handleDeleteMeeting = async (id: string, createdBy?: string) => {
    if (createdBy !== user?.id) {
      alert("You cannot delete a meeting you did not create.");
      return;
    }
    if (confirm("Are you sure you want to delete this meeting?")) {
      try {
        await apiFetch(`/meetings/${id}`, { method: "DELETE" });
        fetchMeetings();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const now = new Date();
  const upcomingMeetings = meetings.filter(
    m => m.scheduled_date && new Date(m.scheduled_date) > now
  );
  const pastMeetings = meetings.filter(
    m => !m.scheduled_date || new Date(m.scheduled_date) <= now
  );

  return (
    <div className={styles.appContainer}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarItem} onClick={() => router.push("/")}>
          <Home className={styles.sidebarIcon} />
          <span>Home</span>
        </div>
        <div className={`${styles.sidebarItem} ${styles.active}`}>
          <Video className={styles.sidebarIcon} />
          <span>Meetings</span>
        </div>
        <div className={styles.sidebarItem}>
          <MessageCircle className={styles.sidebarIcon} />
          <span>Chat</span>
        </div>
        <div className={styles.sidebarItem} onClick={() => router.push("/schedule")}>
          <Calendar className={styles.sidebarIcon} />
          <span>Scheduler</span>
        </div>
        <div className={styles.spacer}></div>
        <div className={styles.sidebarItem} onClick={() => router.push("/settings")}>
          <Settings className={styles.sidebarIcon} />
          <span>Settings</span>
        </div>
        <div className={styles.sidebarItem} onClick={handleLogout}>
          <LogOut className={styles.sidebarIcon} />
          <span>Logout</span>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.mainContent}>
        <div className={styles.meetingsPageContainer}>
          <h1 className={styles.meetingsPageTitle}>Meetings</h1>

          {/* Upcoming */}
          <section className={styles.meetingsSection}>
            <h2 className={styles.meetingsSectionTitle}>
              Upcoming ({upcomingMeetings.length})
            </h2>
            {upcomingMeetings.length === 0 ? (
              <div className={styles.meetingsEmptyRow}>No upcoming meetings.</div>
            ) : (
              <div className={styles.meetingsGrid}>
                {upcomingMeetings.map(m => {
                  const dateObj = m.scheduled_date ? new Date(m.scheduled_date) : null;
                  let timeStr = "Instant meeting";
                  let dateStr = "";
                  if (dateObj) {
                    const endObj = new Date(dateObj.getTime() + (m.duration || 60) * 60000);
                    timeStr = `${dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${endObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                    dateStr = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                  }
                  return (
                    <div key={m.id} className={styles.meetingCard}>
                      <div className={styles.meetingCardContent}>
                        <div className={styles.meetingCardTitle}>{m.title}</div>
                        {dateStr && <div className={styles.meetingCardText}>{dateStr}</div>}
                        <div className={styles.meetingCardText}>{timeStr}</div>
                        <div className={styles.meetingCardText}>Organizer: {m.organizer_name || "Unknown"}</div>
                      </div>
                      <div className={styles.meetingCardFooter}>
                        <button className={styles.startMeetingBtn} onClick={() => router.push(`/join/${m.id}/preview`)}>
                          Start
                        </button>
                        <div className={styles.dropdownContainer}>
                          <button
                            className={`${styles.moreBtn} ${activeDropdown === m.id ? styles.moreBtnActive : ""}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === m.id ? null : m.id); }}
                          >
                            <MoreHorizontal size={18} color="#aaa" />
                          </button>
                          {activeDropdown === m.id && (
                            <div className={styles.dropdownMenu}>
                              <div className={styles.dropdownItem} onClick={() => navigator.clipboard.writeText(m.invite_link)}>
                                Copy invitation
                              </div>
                              <div className={styles.dropdownDivider} />
                              <div className={`${styles.dropdownItem} ${styles.dropdownDanger}`} onClick={() => handleDeleteMeeting(m.id, m.created_by)}>
                                Delete
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past */}
          <section className={styles.meetingsSection}>
            <h2 className={styles.meetingsSectionTitle}>
              Past ({pastMeetings.length})
            </h2>
            {pastMeetings.length === 0 ? (
              <div className={styles.meetingsEmptyRow}>No past meetings.</div>
            ) : (
              <div className={styles.meetingsGrid}>
                {pastMeetings.map(m => (
                  <div key={m.id} className={styles.meetingCard} style={{ opacity: 0.6 }}>
                    <div className={styles.meetingCardContent}>
                      <div className={styles.meetingCardTitle}>{m.title}</div>
                      <div className={styles.meetingCardText}>
                        {m.scheduled_date ? new Date(m.scheduled_date).toLocaleString() : "Instant meeting"}
                      </div>
                      <div className={styles.meetingCardText}>Organizer: {m.organizer_name || "Unknown"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
