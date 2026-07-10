"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, Users, MessageSquare,
  Heart, ArrowUpSquare, ShieldCheck, MoreHorizontal, X,
  PenTool, Wand2, Grid, ChevronUp, Send, Mic2
} from "lucide-react";
import { getUser, isAuthenticated } from "@/lib/auth";
import styles from "./page.module.css";

const WS_BASE = "ws://localhost:8000";
const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface Participant {
  socketId: string;
  username: string;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  time: string;
  isSelf: boolean;
}

type SidePanel = "chat" | "participants" | null;

export default function MeetingRoom() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const setupDoneRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load user client-side only
  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!isAuthenticated()) {
      router.push(`/login?next=/meeting/${meetingId}`);
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Clear unread when chat is open
  useEffect(() => {
    if (sidePanel === "chat") setUnreadCount(0);
  }, [sidePanel, chatMessages]);

  const getLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        localStreamRef.current = stream;
        setIsVideoOff(true);
        return stream;
      } catch {
        setIsVideoOff(true);
        return null;
      }
    }
  };

  const createPeer = useCallback((targetSocketId: string, isInitiator: boolean) => {
    peersRef.current.get(targetSocketId)?.close();
    const peer = new RTCPeerConnection(STUN_SERVERS);

    localStreamRef.current?.getTracks().forEach(track => {
      peer.addTrack(track, localStreamRef.current!);
    });

    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev => {
        const next = new Map(prev);
        const existing = next.get(targetSocketId);
        if (existing) next.set(targetSocketId, { ...existing, stream: remoteStream });
        return next;
      });
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "ice-candidate",
          targetId: targetSocketId,
          candidate: event.candidate,
        }));
      }
    };

    if (isInitiator) {
      peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({ type: "offer", targetId: targetSocketId, sdp: offer }));
      });
    }

    peersRef.current.set(targetSocketId, peer);
    return peer;
  }, []);

  const handleWsMessage = useCallback(async (msg: any) => {
    switch (msg.type) {
      case "joined":
        setConnectionStatus("connected");
        break;
      case "room-peers":
        for (const peer of msg.peers) {
          setParticipants(prev => {
            const next = new Map(prev);
            next.set(peer.socketId, { socketId: peer.socketId, username: peer.username });
            return next;
          });
          createPeer(peer.socketId, true);
        }
        break;
      case "peer-joined":
        setParticipants(prev => {
          const next = new Map(prev);
          if (!next.has(msg.socketId)) {
            next.set(msg.socketId, { socketId: msg.socketId, username: msg.username });
          }
          return next;
        });
        break;
      case "peer-left":
        peersRef.current.get(msg.socketId)?.close();
        peersRef.current.delete(msg.socketId);
        setParticipants(prev => {
          const next = new Map(prev);
          next.delete(msg.socketId);
          return next;
        });
        break;
      case "offer": {
        const peer = createPeer(msg.fromId, false);
        await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({ type: "answer", targetId: msg.fromId, sdp: answer }));
        break;
      }
      case "answer": {
        const peer = peersRef.current.get(msg.fromId);
        if (peer && peer.signalingState !== "stable") {
          await peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
        break;
      }
      case "ice-candidate": {
        const peer = peersRef.current.get(msg.fromId);
        if (peer && msg.candidate) {
          try { await peer.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
        }
        break;
      }
      case "chat": {
        const newMsg: ChatMessage = {
          id: Date.now().toString(),
          username: msg.username,
          text: msg.text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isSelf: false,
        };
        setChatMessages(prev => [...prev, newMsg]);
        setUnreadCount(prev => prev + 1);
        break;
      }
    }
  }, [createPeer]);

  useEffect(() => {
    if (!user) return;
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    let ws: WebSocket;
    const setup = async () => {
      await getLocalStream();
      ws = new WebSocket(`${WS_BASE}/ws/meeting/${meetingId}`);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", username: user.username, userId: user.id }));
      };
      ws.onmessage = (event) => {
        try { handleWsMessage(JSON.parse(event.data)); } catch {}
      };
      ws.onerror = () => setConnectionStatus("error");
    };
    setup();

    return () => {
      ws?.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(p => p.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, meetingId]);

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ type: "chat", text }));

    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      username: user?.username || "You",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isSelf: true,
    };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput("");
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? null : panel);
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(m => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
    setIsVideoOff(v => !v);
  };

  const handleEnd = () => {
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    router.push("/");
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${meetingId}/preview`);
  };

  const participantList = Array.from(participants.values());
  const totalCount = participantList.length + 1;
  const hasSidePanel = sidePanel !== null;
  const gridCols = hasSidePanel
    ? (totalCount <= 1 ? 1 : 2)
    : (totalCount <= 1 ? 1 : totalCount <= 4 ? 2 : 3);

  return (
    <div className={styles.roomContainer}>
      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.statusDot} style={{
            background: connectionStatus === "connected" ? "#00d366" : connectionStatus === "error" ? "#e02828" : "#ffbd2e"
          }} />
          <span className={styles.meetingIdText}>{meetingId.slice(0, 8)}...</span>
          <button className={styles.copyBtn} onClick={copyInviteLink}>Copy invite link</button>
        </div>
        <div className={styles.topRightIcons}>
          <div className={`${styles.iconWrap} ${styles.greenShield}`}><ShieldCheck size={14} color="white" /></div>
          <div className={styles.iconWrap}><PenTool size={18} color="#aaa" /></div>
          <div className={styles.iconWrap}><Wand2 size={18} color="#aaa" /></div>
          <div className={styles.iconWrap}><Grid size={18} color="#aaa" /></div>
        </div>
      </header>

      {/* Body = video area + side panel */}
      <div className={styles.body}>
        <main className={styles.mainArea}>
          <div className={styles.videoGrid} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
            {/* Local tile */}
            <div className={styles.videoCard}>
              {isVideoOff
                ? <div className={styles.avatarCircle}>{user?.username?.[0]?.toUpperCase() || "Y"}</div>
                : <video ref={localVideoRef} autoPlay muted playsInline className={styles.videoEl} />
              }
              <div className={styles.participantName}>
                {user?.username || "You"} (You) {isMuted && <MicOff size={12} />}
              </div>
            </div>
            {participantList.map(p => <RemoteVideo key={p.socketId} participant={p} />)}
          </div>
        </main>

        {/* Side panel */}
        {sidePanel && (
          <aside className={styles.sidePanel}>
            {/* Panel header */}
            <div className={styles.panelHeader}>
              <span>{sidePanel === "chat" ? "In-meeting chat" : "Participants"}</span>
              <button className={styles.closePanel} onClick={() => setSidePanel(null)}><X size={18} /></button>
            </div>

            {sidePanel === "participants" && (
              <div className={styles.participantsList}>
                {/* Self */}
                <div className={styles.participantRow}>
                  <div className={styles.pAvatar}>{user?.username?.[0]?.toUpperCase() || "Y"}</div>
                  <div className={styles.pInfo}>
                    <span className={styles.pName}>{user?.username || "You"} (Host, Me)</span>
                  </div>
                  <div className={styles.pIcons}>
                    {isMuted ? <MicOff size={16} color="#e02828" /> : <Mic2 size={16} color="#aaa" />}
                    {isVideoOff ? <VideoOff size={16} color="#e02828" /> : <VideoIcon size={16} color="#aaa" />}
                  </div>
                </div>
                {/* Remote */}
                {participantList.map(p => (
                  <div key={p.socketId} className={styles.participantRow}>
                    <div className={styles.pAvatar}>{p.username?.[0]?.toUpperCase() || "?"}</div>
                    <div className={styles.pInfo}>
                      <span className={styles.pName}>{p.username}</span>
                    </div>
                    <div className={styles.pIcons}>
                      <Mic2 size={16} color="#aaa" />
                      <VideoIcon size={16} color="#aaa" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidePanel === "chat" && (
              <div className={styles.chatPanel}>
                <div className={styles.chatMessages}>
                  {chatMessages.length === 0 && (
                    <div className={styles.chatEmpty}>
                      <MessageSquare size={32} color="#555" />
                      <p>No messages yet</p>
                      <p className={styles.chatEmptyHint}>Messages are only visible to people in the call</p>
                    </div>
                  )}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`${styles.chatMsg} ${msg.isSelf ? styles.chatMsgSelf : ""}`}>
                      {!msg.isSelf && <div className={styles.chatSender}>{msg.username}</div>}
                      <div className={styles.chatBubble}>{msg.text}</div>
                      <div className={styles.chatTime}>{msg.time}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className={styles.chatInputRow}>
                  <input
                    className={styles.chatInput}
                    placeholder="Send a message to everyone"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChatMessage())}
                  />
                  <button className={styles.chatSendBtn} onClick={sendChatMessage} disabled={!chatInput.trim()}>
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className={styles.controlsBar}>
        <div className={styles.leftControls}>
          <button className={styles.controlBtn} onClick={toggleMute}>
            <div className={styles.controlIconWrap}>
              {isMuted ? <MicOff size={22} color="#e02828" /> : <Mic size={22} />}
              <ChevronUp size={14} className={styles.chevron} />
            </div>
            <span>Audio</span>
          </button>
          <button className={styles.controlBtn} onClick={toggleVideo}>
            <div className={styles.controlIconWrap}>
              {isVideoOff ? <VideoOff size={22} color="#e02828" /> : <VideoIcon size={22} />}
              <ChevronUp size={14} className={styles.chevron} />
            </div>
            <span>Video</span>
          </button>
        </div>

        <div className={styles.centerControls}>
          <button
            className={`${styles.controlBtn} ${sidePanel === "participants" ? styles.activeControl : ""}`}
            onClick={() => togglePanel("participants")}
          >
            <div className={styles.controlIconWrap}>
              <Users size={22} />
              <div className={styles.badge}>{totalCount}</div>
            </div>
            <span>Participants</span>
          </button>
          <button
            className={`${styles.controlBtn} ${sidePanel === "chat" ? styles.activeControl : ""}`}
            onClick={() => togglePanel("chat")}
          >
            <div className={styles.controlIconWrap}>
              <MessageSquare size={22} />
              {unreadCount > 0 && sidePanel !== "chat" && <div className={styles.badge}>{unreadCount}</div>}
            </div>
            <span>Chat</span>
          </button>
          <button className={styles.controlBtn}>
            <div className={styles.controlIconWrap}><Heart size={22} /></div>
            <span>React</span>
          </button>
          <button className={styles.controlBtn}>
            <div className={styles.controlIconWrap}><ArrowUpSquare size={22} /></div>
            <span>Share</span>
          </button>
          <button className={styles.controlBtn}>
            <div className={styles.controlIconWrap}><ShieldCheck size={22} /></div>
            <span>Host tools</span>
          </button>
          <button className={styles.controlBtn}>
            <div className={styles.controlIconWrap}><MoreHorizontal size={22} /></div>
            <span>More</span>
          </button>
        </div>

        <div className={styles.rightControls}>
          <button className={styles.endBtn} onClick={handleEnd}>
            <div className={styles.endIcon}><X size={16} /></div>
            <span>End</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function RemoteVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (participant.stream && videoRef.current) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);
  return (
    <div className={styles.videoCard}>
      {participant.stream
        ? <video ref={videoRef} autoPlay playsInline className={styles.videoEl} />
        : <div className={styles.avatarCircle}>{participant.username?.[0]?.toUpperCase() || "?"}</div>
      }
      <div className={styles.participantName}>{participant.username}</div>
    </div>
  );
}
