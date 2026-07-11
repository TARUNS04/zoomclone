"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, Video as VideoIcon, VideoOff, ChevronDown, UserSquare2, Info } from "lucide-react";
import { isAuthenticated, getUser } from "@/lib/auth";
import styles from "./page.module.css";

interface Device {
  deviceId: string;
  label: string;
}

export default function Preview() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [alwaysShow, setAlwaysShow] = useState(true);

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [micDevices, setMicDevices] = useState<Device[]>([]);
  const [camDevices, setCamDevices] = useState<Device[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Show/hide device dropdowns
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [showCamDropdown, setShowCamDropdown] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Use a ref for stopStream so event listeners always call the latest version
  const stopStreamRef = useRef<() => void>(() => {});

  // Auth check
  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!isAuthenticated()) {
      router.push(`/login?next=/join/${meetingId}/preview`);
    }
  }, [meetingId]);

  // Start camera + mic preview
  const startStream = async (micId?: string, camId?: string) => {
    // Stop any existing tracks first
    localStreamRef.current?.getTracks().forEach(t => t.stop());

    try {
      const constraints: MediaStreamConstraints = {
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: camId ? { deviceId: { exact: camId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // After getting permission, enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter(d => d.kind === "audioinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      const cams = devices
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

      setMicDevices(mics);
      setCamDevices(cams);

      // Set defaults if not already selected
      if (!micId && mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (!camId && cams.length > 0) setSelectedCam(cams[0].deviceId);

      // Apply current muted/video-off state to new tracks
      stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
      stream.getVideoTracks().forEach(t => { t.enabled = !isVideoOff; });

      setPermissionDenied(false);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionDenied(true);
      }
      setIsVideoOff(true);
    }
  };

  const stopStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        t.stop();
        t.enabled = false;
      });
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Keep stopStreamRef always up to date
  stopStreamRef.current = stopStream;

  useEffect(() => {
    let cancelled = false;

    const initStream = async () => {
      await startStream();
      if (cancelled) {
        stopStreamRef.current();
      }
    };
    initStream();

    const onLeave = () => stopStreamRef.current();
    
    // Force a hard redirect when user clicks browser back button
    // This guarantees the camera light turns off
    const handlePopState = () => {
      stopStreamRef.current();
      window.location.href = "/";
    };

    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("popstate", handlePopState);

    return () => {
      cancelled = true;
      stopStreamRef.current();
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("popstate", handlePopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks?.length) {
      tracks.forEach(t => { t.enabled = isMuted; }); // if currently muted, enable
      setIsMuted(m => !m);
    }
  };

  const toggleVideo = () => {
    const tracks = localStreamRef.current?.getVideoTracks();
    if (tracks?.length) {
      tracks.forEach(t => { t.enabled = isVideoOff; }); // if currently off, enable
      setIsVideoOff(v => !v);
    }
  };

  const switchMic = (deviceId: string) => {
    setSelectedMic(deviceId);
    setShowMicDropdown(false);
    startStream(deviceId, selectedCam);
  };

  const switchCam = (deviceId: string) => {
    setSelectedCam(deviceId);
    setShowCamDropdown(false);
    startStream(selectedMic, deviceId);
  };

  const handleCancel = () => {
    stopStream();
    window.location.href = "/";
  };

  const handleStart = () => {
    // Stop preview stream — the meeting room will start its own stream
    stopStream();
    window.location.href = `/meeting/${meetingId}?audio=${!isMuted}&video=${!isVideoOff}&micId=${selectedMic}&camId=${selectedCam}`;
  };

  const selectedMicLabel = micDevices.find(d => d.deviceId === selectedMic)?.label || "Default Microphone";
  const selectedCamLabel = camDevices.find(d => d.deviceId === selectedCam)?.label || "Default Camera";

  return (
    <div className={styles.previewContainer} onClick={() => { setShowMicDropdown(false); setShowCamDropdown(false); }}>
      <div className={styles.topBar}>
        <h3>{user?.username || "Guest"}'s Zoom Meeting</h3>
      </div>

      <div className={styles.mainCard}>
        {/* Video Preview Box */}
        <div className={styles.videoBox}>
          {/* Always render video, just hide it when off */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={styles.videoEl}
            style={{ display: isVideoOff || permissionDenied ? "none" : "block" }}
          />

          {/* Avatar shown when video is off */}
          {(isVideoOff || permissionDenied) && (
            <div className={styles.avatar}>
              {user?.username?.[0]?.toUpperCase() || "G"}
            </div>
          )}

          {/* Permission denied banner */}
          {permissionDenied && (
            <div className={styles.permissionBanner}>
              Camera/mic blocked. Please allow access in browser settings.
            </div>
          )}

          {/* Audio / Video floating toggle buttons */}
          <div className={styles.floatingControls}>
            <button
              className={`${styles.controlBtn} ${isMuted ? styles.controlOff : ""}`}
              onClick={e => { e.stopPropagation(); toggleMic(); }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={26} /> : <Mic size={26} />}
              <span>Audio</span>
            </button>

            <button
              className={`${styles.controlBtn} ${isVideoOff ? styles.controlOff : ""}`}
              onClick={e => { e.stopPropagation(); toggleVideo(); }}
              title={isVideoOff ? "Start video" : "Stop video"}
            >
              {isVideoOff ? <VideoOff size={26} /> : <VideoIcon size={26} />}
              <span>Video</span>
            </button>
          </div>

          <button className={styles.bgBtn}>
            <UserSquare2 size={16} /> Backgrounds
          </button>
        </div>

        {/* Device Selectors */}
        <div className={styles.dropdowns}>
          {/* Mic selector */}
          <div className={styles.dropdownWrapper} onClick={e => e.stopPropagation()}>
            <div className={styles.selectBox} onClick={() => { setShowMicDropdown(s => !s); setShowCamDropdown(false); }}>
              <div className={styles.selectLeft}>
                {isMuted ? <MicOff size={16} color="#e02828" /> : <Mic size={16} />}
                <span className={styles.deviceLabel}>{selectedMicLabel}</span>
              </div>
              <ChevronDown size={16} className={showMicDropdown ? styles.chevronOpen : ""} />
            </div>
            {showMicDropdown && micDevices.length > 0 && (
              <div className={styles.deviceMenu}>
                {micDevices.map(d => (
                  <div
                    key={d.deviceId}
                    className={`${styles.deviceOption} ${d.deviceId === selectedMic ? styles.deviceSelected : ""}`}
                    onClick={() => switchMic(d.deviceId)}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Camera selector */}
          <div className={styles.dropdownWrapper} onClick={e => e.stopPropagation()}>
            <div className={styles.selectBox} onClick={() => { setShowCamDropdown(s => !s); setShowMicDropdown(false); }}>
              <div className={styles.selectLeft}>
                {isVideoOff ? <VideoOff size={16} color="#e02828" /> : <VideoIcon size={16} />}
                <span className={styles.deviceLabel}>{selectedCamLabel}</span>
              </div>
              <ChevronDown size={16} className={showCamDropdown ? styles.chevronOpen : ""} />
            </div>
            {showCamDropdown && camDevices.length > 0 && (
              <div className={styles.deviceMenu}>
                {camDevices.map(d => (
                  <div
                    key={d.deviceId}
                    className={`${styles.deviceOption} ${d.deviceId === selectedCam ? styles.deviceSelected : ""}`}
                    onClick={() => switchCam(d.deviceId)}
                  >
                    {d.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <label className={styles.checkboxWrapper}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={alwaysShow}
              onChange={e => setAlwaysShow(e.target.checked)}
            />
            Always show this preview when joining
            <Info size={15} />
          </label>
          <div className={styles.footerButtons}>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button className={styles.startBtn} onClick={handleStart}>
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
