"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Home, Video, MessageCircle, Calendar,
  Settings, LogOut, User, Phone, Mail, Mic, Camera, Save, Check
} from "lucide-react";
import { isAuthenticated, getUser, logout, apiFetch } from "@/lib/auth";
import homeStyles from "../page.module.css";
import styles from "./page.module.css";

const merged = { ...homeStyles, ...styles };

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  // Profile fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Device settings
  const [micDevices, setMicDevices] = useState<DeviceInfo[]>([]);
  const [camDevices, setCamDevices] = useState<DeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadProfile();
    loadDevices();

    return () => {
      previewStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Assign stream to video element whenever cameraActive turns on
  useEffect(() => {
    if (cameraActive && previewStreamRef.current && previewVideoRef.current) {
      previewVideoRef.current.srcObject = previewStreamRef.current;
    }
  }, [cameraActive]);

  const loadProfile = async () => {
    try {
      const data = await apiFetch("/auth/me");
      setUsername(data.username || "");
      setEmail(data.email || "");
      setPhoneNumber(data.phone_number || "");
    } catch {}
  };

  const loadDevices = async () => {
    try {
      // Only request a brief permission to enumerate labeled devices, then stop immediately
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Stop all tracks immediately — don't keep camera/mic on
      tempStream.getTracks().forEach(t => t.stop());

      setMicDevices(devices.filter(d => d.kind === "audioinput").map((d, i) => ({
        deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}`
      })));
      setCamDevices(devices.filter(d => d.kind === "videoinput").map((d, i) => ({
        deviceId: d.deviceId, label: d.label || `Camera ${i + 1}`
      })));
      setSpeakerDevices(devices.filter(d => d.kind === "audiooutput").map((d, i) => ({
        deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}`
      })));

      // Set defaults from the temp stream
      const activeAudioTrack = tempStream.getAudioTracks()[0];
      const activeVideoTrack = tempStream.getVideoTracks()[0];
      if (activeAudioTrack) {
        const s = activeAudioTrack.getSettings();
        if (s.deviceId) setSelectedMic(s.deviceId);
      }
      if (activeVideoTrack) {
        const s = activeVideoTrack.getSettings();
        if (s.deviceId) setSelectedCam(s.deviceId);
      }
    } catch {
      // Permission denied or no devices
    }
  };

  const updateMicLevel = () => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setMicLevel(Math.min(100, Math.round(avg * 1.5)));
    animFrameRef.current = requestAnimationFrame(updateMicLevel);
  };

  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
        video: selectedCam ? { deviceId: { exact: selectedCam } } : true,
      });
      previewStreamRef.current = stream;
      setCameraActive(true);

      // Set up mic level meter
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      updateMicLevel();
    } catch {}
  };

  const stopCameraPreview = () => {
    previewStreamRef.current?.getTracks().forEach(t => t.stop());
    previewStreamRef.current = null;
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setMicLevel(0);
    setCameraActive(false);
  };

  const switchDevice = async (type: "mic" | "cam", deviceId: string) => {
    if (type === "mic") setSelectedMic(deviceId);
    else setSelectedCam(deviceId);

    // Only restart stream if preview is currently active
    if (!cameraActive) return;

    previewStreamRef.current?.getTracks().forEach(t => t.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: type === "mic" ? deviceId : selectedMic } },
        video: { deviceId: { exact: type === "cam" ? deviceId : selectedCam } },
      });
      previewStreamRef.current = stream;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
    } catch {}
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      await apiFetch("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ username, email, phone_number: phoneNumber }),
      });
      setSaveMsg("Profile saved successfully!");
      // Update local storage user data
      const updatedUser = await apiFetch("/auth/me");
      const token = localStorage.getItem("token");
      if (token) {
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err: any) {
      setSaveMsg(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDevices = () => {
    localStorage.setItem("zc_mic", selectedMic);
    localStorage.setItem("zc_cam", selectedCam);
    localStorage.setItem("zc_speaker", selectedSpeaker);
    setSaveMsg("Device settings saved!");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className={merged.appContainer}>
      {/* Sidebar */}
      <div className={merged.sidebar}>
        <div className={merged.sidebarItem} onClick={() => router.push("/")}>
          <Home className={merged.sidebarIcon} />
          <span>Home</span>
        </div>
        <div className={merged.sidebarItem} onClick={() => router.push("/meetings")}>
          <Video className={merged.sidebarIcon} />
          <span>Meetings</span>
        </div>
        <div className={merged.sidebarItem}>
          <MessageCircle className={merged.sidebarIcon} />
          <span>Chat</span>
        </div>
        <div className={merged.sidebarItem} onClick={() => router.push("/schedule")}>
          <Calendar className={merged.sidebarIcon} />
          <span>Scheduler</span>
        </div>
        <div className={merged.spacer}></div>
        <div className={`${merged.sidebarItem} ${merged.active}`}>
          <Settings className={merged.sidebarIcon} />
          <span>Settings</span>
        </div>
        <div className={merged.sidebarItem} onClick={handleLogout}>
          <LogOut className={merged.sidebarIcon} />
          <span>Logout</span>
        </div>
      </div>

      {/* Main content */}
      <div className={merged.mainContent}>
        <div className={styles.settingsContainer}>
          <h1 className={styles.settingsTitle}>Settings</h1>

          {saveMsg && (
            <div className={styles.saveNotice}>
              <Check size={16} /> {saveMsg}
            </div>
          )}

          {/* Profile Section */}
          <section className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>
              <User size={20} /> Profile
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Display Name</label>
                <input
                  className={styles.input}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <Mail size={14} /> Email
                </label>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <Phone size={14} /> Phone Number
                </label>
                <input
                  className={styles.input}
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <button className={styles.saveBtn} onClick={handleSaveProfile} disabled={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save Profile"}
            </button>
          </section>

          {/* Audio Section */}
          <section className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>
              <Mic size={20} /> Audio
            </h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Microphone</label>
                <select
                  className={styles.select}
                  value={selectedMic}
                  onChange={e => switchDevice("mic", e.target.value)}
                >
                  {micDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
                <div className={styles.meterContainer}>
                  <div className={styles.meterLabel}>Input Level</div>
                  <div className={styles.meterTrack}>
                    <div className={styles.meterFill} style={{ width: `${micLevel}%` }} />
                  </div>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Speaker</label>
                <select
                  className={styles.select}
                  value={selectedSpeaker}
                  onChange={e => setSelectedSpeaker(e.target.value)}
                >
                  {speakerDevices.length === 0 && <option value="">Default</option>}
                  {speakerDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Video Section */}
          <section className={styles.settingsSection}>
            <h2 className={styles.sectionTitle}>
              <Camera size={20} /> Video
            </h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>Camera</label>
              <select
                className={styles.select}
                value={selectedCam}
                onChange={e => switchDevice("cam", e.target.value)}
              >
                {camDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.cameraPreview}>
              {cameraActive ? (
                <>
                  <video ref={previewVideoRef} autoPlay muted playsInline className={styles.previewVideo} />
                  <button className={styles.stopPreviewBtn} onClick={stopCameraPreview}>Stop Preview</button>
                </>
              ) : (
                <div className={styles.previewPlaceholder}>
                  <Camera size={32} color="#555" />
                  <button className={styles.testCameraBtn} onClick={startCameraPreview}>Test Camera & Mic</button>
                </div>
              )}
            </div>
          </section>

          <button className={styles.saveBtn} onClick={handleSaveDevices}>
            <Save size={16} /> Save Device Settings
          </button>
        </div>
      </div>
    </div>
  );
}
