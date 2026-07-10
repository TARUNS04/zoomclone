"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, Video, Users, MapPin, AlignLeft, Paperclip, ChevronDown, Check, Info, X } from "lucide-react";
import { isAuthenticated, getUser, apiFetch } from "@/lib/auth";
import styles from "./page.module.css";

export default function ScheduleMeeting() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteeInput, setInviteeInput] = useState("");
  const [activeTab, setActiveTab] = useState("Event");

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    setTitle(`${currentUser?.username || "Guest"}'s Zoom Meeting`);
    
    // Set default times (e.g. nearest half hour)
    const now = new Date();
    now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    const end = new Date(now.getTime() + 30 * 60000);
    
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    
    setStartDate(fmtDate(now));
    setStartTime(fmtTime(now));
    setEndDate(fmtDate(end));
    setEndTime(fmtTime(end));

    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, []);

  const handleAddInvitee = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inviteeInput.trim()) {
      e.preventDefault();
      const email = inviteeInput.trim();
      if (!invitees.includes(email) && /^\S+@\S+\.\S+$/.test(email)) {
        setInvitees([...invitees, email]);
        setInviteeInput("");
      }
    }
  };

  const removeInvitee = (email: string) => {
    setInvitees(invitees.filter(i => i !== email));
  };

  const handleSave = async () => {
    try {
      const scheduled_datetime = new Date(`${startDate.replace(/\//g, "-")}T${startTime}:00`);
      const end_datetime = new Date(`${endDate.replace(/\//g, "-")}T${endTime}:00`);
      let duration = Math.round((end_datetime.getTime() - scheduled_datetime.getTime()) / 60000);
      if (duration < 0) duration = 60; // fallback
      
      // Include any pending invitee in the input box
      const finalInvitees = [...invitees];
      const pendingEmail = inviteeInput.trim();
      if (pendingEmail && !invitees.includes(pendingEmail) && /^\S+@\S+\.\S+$/.test(pendingEmail)) {
        finalInvitees.push(pendingEmail);
      }
      
      await apiFetch("/meetings/", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          scheduled_date: scheduled_datetime.toISOString(),
          duration,
          invitees: finalInvitees,
        }),
      });
      router.push("/");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.container}>
      {/* OS Window Header area */}
      <div className={styles.windowHeader}>
        <div className={styles.windowControls}>
          <div className={`${styles.dot} ${styles.red}`}></div>
          <div className={`${styles.dot} ${styles.yellow}`}></div>
          <div className={`${styles.dot} ${styles.green}`}></div>
        </div>
        <div className={styles.windowTitle}>New event</div>
      </div>

      {/* Main Content Area */}
      <div className={styles.mainArea}>
        <div className={styles.leftPanel}>
          <input 
            type="text" 
            className={styles.titleInput} 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
          
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === "Event" ? styles.activeTab : ""}`} onClick={() => setActiveTab("Event")}>Event</button>
            <button className={`${styles.tab} ${activeTab === "Focus time" ? styles.activeTab : ""}`} onClick={() => setActiveTab("Focus time")}>Focus time</button>
            <button className={`${styles.tab} ${activeTab === "Out of office" ? styles.activeTab : ""}`} onClick={() => setActiveTab("Out of office")}>Out of office</button>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><Clock size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <div className={styles.timeRow}>
                <input type="text" className={styles.dateInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input type="time" className={styles.timeInput} value={startTime} onChange={e => setStartTime(e.target.value)} />
                <span className={styles.arrow}>→</span>
                <input type="time" className={styles.timeInput} value={endTime} onChange={e => setEndTime(e.target.value)} />
                <input type="text" className={styles.dateInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className={styles.optionsRow}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} />
                  All Day
                </label>
                <div className={styles.timezone}>
                  (GMT+05:30) Mumbai, Kolkata,... <ChevronDown size={14} />
                </div>
              </div>
              <div className={styles.repeatRow}>
                Repeat 
                <button className={styles.dropdownBtn}>
                  Never <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.separator} />

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><Video size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <div className={styles.zoomRow}>
                <button className={styles.dropdownBtn}>
                  Zoom Meeting <ChevronDown size={14} />
                </button>
                <a href="#" className={styles.link}>Settings</a>
              </div>
              <div className={styles.optionsRow}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" />
                  Automatically start Zoom AI <Info size={14} />
                </label>
              </div>
              <a href="#" className={styles.link}>Attach workflow to this meeting</a>
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><Users size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <div className={styles.inputBox}>
                <span>Add a room</span>
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><MapPin size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <div className={styles.inputBox}>
                <span>Add a location</span>
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><AlignLeft size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <a href="#" className={styles.link}>Create agenda</a>
              <textarea 
                className={styles.textarea} 
                placeholder="Add description"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <div className={styles.iconCol}><Paperclip size={18} color="#aaa" /></div>
            <div className={styles.contentCol}>
              <a href="#" className={styles.link}>Add attachments <Info size={14} /></a>
            </div>
          </div>
          
          <div className={styles.separator} />
          
          <div className={styles.formGroup}>
            <div className={styles.iconCol}><div className={styles.calendarIcon}></div></div>
            <div className={styles.contentCol}>
              <div className={styles.profileRow}>
                {user?.username} <div className={styles.blueDot} /> <ChevronDown size={14} />
              </div>
            </div>
          </div>

        </div>

        <div className={styles.rightPanel}>
          <div className={styles.inviteesHeader}>Invitees</div>
          <div className={styles.inviteeInputWrap}>
            <div className={styles.inviteePills}>
              {invitees.map(email => (
                <div key={email} className={styles.pill}>
                  {email}
                  <button type="button" onClick={() => removeInvitee(email)}><X size={12} /></button>
                </div>
              ))}
              <input 
                type="email" 
                className={styles.inviteeInput}
                placeholder={invitees.length === 0 ? "Add invitees" : ""}
                value={inviteeInput}
                onChange={(e) => setInviteeInput(e.target.value)}
                onKeyDown={handleAddInvitee}
              />
            </div>
          </div>
          {invitees.length > 0 && (
            <div className={styles.inviteeList}>
              {invitees.map(email => (
                <div key={email} className={styles.inviteeRow}>
                  <div className={styles.inviteeAvatar}>{email[0].toUpperCase()}</div>
                  <div className={styles.inviteeEmail}>{email}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.cancelBtn} onClick={() => router.push("/")}>Cancel</button>
        <button className={styles.saveBtn} onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
