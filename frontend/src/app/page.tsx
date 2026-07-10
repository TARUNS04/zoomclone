"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Home, Video, MessageCircle, Calendar, Grid, CheckSquare,
  MoreHorizontal, Settings, Search, Plus, MonitorUp, Wand2, Bell, CalendarCheck, LogOut, ChevronDown
} from "lucide-react";
import { isAuthenticated, getUser, logout, apiFetch } from "@/lib/auth";
import styles from "./page.module.css";

interface Meeting {
  id: string;
  title: string;
  scheduled_date: string | null;
  duration: number | null;
  invite_link: string;
  organizer_name?: string;
  created_by?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeDropdown = () => setActiveDropdown(null);
    window.addEventListener("click", closeDropdown);
    return () => window.removeEventListener("click", closeDropdown);
  }, []);

  useEffect(() => {
    // Load user client-side only to avoid SSR/client hydration mismatch
    const currentUser = getUser();
    setUser(currentUser);

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchMeetings();
    return () => clearInterval(timer);
  }, []);

  const fetchMeetings = async () => {
    try {
      const data = await apiFetch("/meetings/");
      setMeetings(data);
    } catch {}
  };

  const handleNewMeeting = async () => {
    setCreating(true);
    try {
      const meeting = await apiFetch("/meetings/", {
        method: "POST",
        body: JSON.stringify({ title: `${user?.username}'s Meeting` }),
      });
      router.push(`/join/${meeting.id}/preview`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    if (!joinId.trim()) return;
    // Support pasting the full invite URL or just the meeting ID
    let id = joinId.trim();
    try {
      const url = new URL(id);
      // Extract the ID segment from /join/<id>/preview
      const parts = url.pathname.split("/").filter(Boolean);
      const joinIdx = parts.indexOf("join");
      if (joinIdx !== -1 && parts[joinIdx + 1]) {
        id = parts[joinIdx + 1];
      }
    } catch {
      // Not a URL, use as-is
    }
    router.push(`/join/${id}/preview`);
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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const upcomingMeetings = meetings.filter(m => m.scheduled_date && new Date(m.scheduled_date) > new Date());

  return (
    <div className={styles.appContainer}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={`${styles.sidebarItem} ${styles.active}`}>
          <Home className={styles.sidebarIcon} />
          <span>Home</span>
        </div>
        <div className={styles.sidebarItem}>
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
        <div className={styles.sidebarItem}>
          <Grid className={styles.sidebarIcon} />
          <span>Canvas</span>
        </div>
        <div className={styles.sidebarItem}>
          <CheckSquare className={styles.sidebarIcon} />
          <span>Tasks</span>
        </div>
        <div className={styles.sidebarItem}>
          <MoreHorizontal className={styles.sidebarIcon} />
          <span>More</span>
        </div>
        <div className={styles.spacer}></div>
        <div className={styles.sidebarItem}>
          <Settings className={styles.sidebarIcon} />
          <span>Settings</span>
        </div>
        <div className={styles.sidebarItem} onClick={handleLogout}>
          <LogOut className={styles.sidebarIcon} />
          <span>Logout</span>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div className={styles.logoArea}>
            <Video size={20} color="#0b5cff" />
            <span>zoom Workplace</span>
          </div>
          <div className={styles.searchBar}>
            <Search size={16} />
            <span>Search (⌘E)</span>
          </div>
          <div className={styles.topRight}>
            <Bell size={20} color="#ccc" />
            <CalendarCheck size={20} color="#ccc" />
            <div className={styles.profileAvatar}>{user?.username?.[0]?.toUpperCase() || "U"}</div>
          </div>
        </div>

        {/* Time Widget */}
        <div className={styles.timeWidget}>
          <div className={styles.timeText}>{formatTime(currentTime)}</div>
          <div className={styles.dateText}>{formatDate(currentTime)}</div>
        </div>

        {/* Action Grid */}
        <div className={styles.actionGrid}>
          <div className={styles.actionWrapper}>
            <button className={`${styles.actionBtn} ${styles.btnOrange}`} onClick={handleNewMeeting} disabled={creating}>
              <Video size={32} />
            </button>
            <span className={styles.actionLabel}>{creating ? "Starting..." : "New meeting"}</span>
          </div>

          <div className={styles.actionWrapper}>
            <button className={`${styles.actionBtn} ${styles.btnBlue}`} onClick={() => setShowJoinModal(true)}>
              <Plus size={32} />
            </button>
            <span className={styles.actionLabel}>Join</span>
          </div>

          <div className={styles.actionWrapper}>
            <button className={`${styles.actionBtn} ${styles.btnBlue}`} onClick={() => router.push("/schedule")}>
              <Calendar size={28} />
            </button>
            <span className={styles.actionLabel}>Schedule</span>
          </div>

          <div className={styles.actionWrapper}>
            <button className={`${styles.actionBtn} ${styles.btnBlue}`}>
              <MonitorUp size={28} />
            </button>
            <span className={styles.actionLabel}>Share screen</span>
          </div>

          <div className={styles.actionWrapper}>
            <button className={`${styles.actionBtn} ${styles.btnBlue}`}>
              <Wand2 size={28} />
            </button>
            <span className={styles.actionLabel}>My Notes</span>
          </div>
        </div>

        {/* Today Widget */}
        <div className={styles.todayWidget}>
          <div className={styles.todayHeader}>
            <Plus size={18} color="#ccc" />
            <h3>Today, {currentTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</h3>
            <MoreHorizontal size={18} color="#ccc" />
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className={styles.emptyState}>
              <Image src="/umbrella.png" alt="No meetings" width={120} height={120} className={styles.umbrellaImg} />
              <span>No meetings scheduled.</span>
            </div>
          ) : (
            <div className={styles.meetingList}>
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
                      <div className={styles.askAiChip}>
                        ✨ Ask AI <ChevronDown size={14} />
                      </div>
                      <div className={styles.meetingCardActions}>
                        <MessageCircle size={18} color="#aaa" />
                        <div className={styles.dropdownContainer}>
                          <button 
                            className={`${styles.moreBtn} ${activeDropdown === m.id ? styles.moreBtnActive : ""}`}
                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === m.id ? null : m.id); }}
                          >
                            <MoreHorizontal size={18} color="#aaa" />
                          </button>
                          {activeDropdown === m.id && (
                            <div className={styles.dropdownMenu}>
                              <div className={styles.dropdownItem} onClick={() => router.push(`/join/${m.id}/preview`)}>
                                Start meeting
                              </div>
                              <div className={styles.dropdownItem} onClick={() => alert("Invite people not implemented yet")}>
                                Invite people
                              </div>
                              <div className={styles.dropdownItem} onClick={() => navigator.clipboard.writeText(m.invite_link)}>
                                Copy invitation
                              </div>
                              <div className={styles.dropdownDivider} />
                              <div className={styles.dropdownItem} onClick={() => alert("Edit not implemented yet")}>
                                Edit
                              </div>
                              <div className={styles.dropdownItem} onClick={() => alert("Duplicate not implemented yet")}>
                                Duplicate
                              </div>
                              <div className={`${styles.dropdownItem} ${styles.dropdownDanger}`} onClick={() => handleDeleteMeeting(m.id, m.created_by)}>
                                Delete
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>Open recordings {">"}</div>
        </div>
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>Join a Meeting</h2>
            <input className={styles.modalInput} placeholder="Enter Meeting ID or Link" value={joinId}
              onChange={e => setJoinId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} />
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowJoinModal(false)}>Cancel</button>
              <button className={styles.confirmBtn} onClick={handleJoin}>Join</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
