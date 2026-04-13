import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { avatarSrc } from "../utils/avatarsrc";
import { getInbox, getMessages, sendMessage } from "../api/messageApi";
import { getPUser } from "../api/authapi";
import { getSocket } from "../utils/socket";
import EmojiPicker from "emoji-picker-react";
import { BsImage, BsFileEarmarkText, BsMusicNote } from "react-icons/bs";
import "./MessengerWidget.css";
import ImageLightbox from "./ImageLightBox";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return "now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function formatTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function MessengerWidget({ open, onClose }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const currentUser = getPUser();

  const [conversations, setConversations] = useState([]);
  const [inboxLoading,  setInboxLoading]  = useState(false);
  const [activeConvo,   setActiveConvo]   = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [chatLoading,   setChatLoading]   = useState(false);
  const [text,          setText]          = useState("");
  const [sending,       setSending]       = useState(false);
  const [dragging,      setDragging]      = useState(false);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [showAttach,    setShowAttach]    = useState(false);
  const [attachFiles,   setAttachFiles]   = useState([]);
  const [attachPreview, setAttachPreview] = useState([]);
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const widgetRef  = useRef(null);
  const dragStart  = useRef(null);
  const bottomRef  = useRef(null);
  const countRef   = useRef(0);
  const pollRef    = useRef(null);
  const inputRef   = useRef(null);
  const fileInputRef = useRef(null);
  const emojiRef   = useRef(null);
  const attachRef  = useRef(null);

  const allChatImages = messages
  .flatMap(m => m.attachments || [])
  .filter(a => a.mimeType?.startsWith("image/"))
  .map(a => ({ path: `${BASE_URL}${a.url}` }));

  const isMessagesPage = location.pathname.startsWith("/messages");
  const shouldHide     = isMessagesPage || !currentUser || !open;

  /* ── inbox ── */
  const loadInbox = useCallback(async () => {
    if (shouldHide) return;
    setInboxLoading(true);
    try {
      const res    = await getInbox();
      const convos = res.data.conversations || [];
      setConversations(convos);
      const total  = convos.reduce((sum, c) => sum + (c.unread || 0), 0);
      window.dispatchEvent(new CustomEvent("unread-count", { detail: total }));
    } catch { }
    finally { setInboxLoading(false); }
  }, [shouldHide]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || shouldHide) return;
    socket.on("inbox:update", loadInbox);
    socket.on("message:new",  loadInbox);
    return () => {
      socket.off("inbox:update", loadInbox);
      socket.off("message:new",  loadInbox);
    };
  }, [shouldHide, loadInbox]);

  /* ── chat load ── */
  const loadChat = useCallback(async (convoId) => {
    if (!convoId) return;
    setChatLoading(true);
    try {
      const res  = await getMessages(convoId);
      const msgs = res.data.messages || [];
      setMessages(msgs);
      countRef.current = msgs.length;
    } catch { }
    finally { setChatLoading(false); }
  }, []);

  /* ── poll every 1.5s ── */
  useEffect(() => {
    if (!activeConvo) { clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(async () => {
      try {
        const res  = await getMessages(activeConvo._id);
        const msgs = res.data.messages || [];
        if (msgs.length !== countRef.current) {
          countRef.current = msgs.length;
          setMessages(msgs);
        }
      } catch { }
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeConvo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── close emoji/attach on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current  && !emojiRef.current.contains(e.target))  setShowEmoji(false);
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── drag ── */
  const onMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest(".mw-row") ||
        e.target.closest(".mw-input-area") || e.target.closest(".mw-messages")) return;
    setDragging(true);
    const rect = widgetRef.current.getBoundingClientRect();
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, rectX: rect.left, rectY: rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      const w  = widgetRef.current?.offsetWidth  || 320;
      const h  = widgetRef.current?.offsetHeight || 460;
      const cx = Math.max(0, Math.min(window.innerWidth  - w, dragStart.current.rectX + dx));
      const cy = Math.max(0, Math.min(window.innerHeight - h, dragStart.current.rectY + dy));
      widgetRef.current.style.left   = `${cx}px`;
      widgetRef.current.style.top    = `${cy}px`;
      widgetRef.current.style.right  = "auto";
      widgetRef.current.style.bottom = "auto";
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [dragging]);

  /* ── send ── */
  const handleSend = async () => {
    const hasText  = text.trim().length > 0;
    const hasFiles = attachFiles.length > 0;
    if ((!hasText && !hasFiles) || sending || !activeConvo) return;
    const t = text.trim();
    setText("");
    const filesToSend = [...attachFiles];
    setAttachFiles([]);
    setAttachPreview([]);
    setSending(true);
    try {
      const fd = new FormData();
      if (t) fd.append("text", t);
      filesToSend.forEach(f => fd.append("attachments", f));
      const res    = await sendMessage(activeConvo._id, fd);
      const newMsg = res.data.message;
      setMessages(prev => {
        if (prev.find(m => m._id === newMsg._id)) return prev;
        countRef.current = prev.length + 1;
        return [...prev, newMsg];
      });
      loadInbox();
    } catch { setText(t); setAttachFiles(filesToSend); }
    finally { setSending(false); }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openChat = (convo) => {
    setActiveConvo(convo);
    setMessages([]);
    countRef.current = 0;
    setText("");
    loadChat(convo._id);
  };

  const backToInbox = () => {
    setActiveConvo(null);
    setMessages([]);
    clearInterval(pollRef.current);
    loadInbox();
  };

  if (shouldHide) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <div className="mw-widget" ref={widgetRef} onMouseDown={onMouseDown}>

      {/* Header */}
      <div className="mw-header">
        {activeConvo ? (
          <>
            <button className="mw-icon-btn" onClick={backToInbox}>←</button>
            <div className="mw-chat-header-info"
              onClick={() => { onClose(); navigate(`/profile/${activeConvo.other?.username}`); }}>
              <div className="mw-sm-avatar">
                {activeConvo.other?.avatar
                  ? <img src={avatarSrc(activeConvo.other.avatar)} alt={activeConvo.other.name} />
                  : <span>{activeConvo.other?.name?.[0]?.toUpperCase()}</span>}
                {activeConvo.other?.isOnline && <span className="mw-online-dot-sm" />}
              </div>
              <div>
                <div className="mw-chat-name">{activeConvo.other?.name}</div>
                <div className="mw-chat-status" style={{ color: activeConvo.other?.isOnline ? "#22c55e" : "var(--color-3)" }}>
                  {activeConvo.other?.isOnline ? "● Online" : "Offline"}
                </div>
              </div>
            </div>
          </>
        ) : (
          <span className="mw-title">
            Messages
            {totalUnread > 0 && <span className="mw-badge">{totalUnread}</span>}
          </span>
        )}
        <div className="mw-header-actions">
          <button className="mw-icon-btn" title="Open full page"
            onClick={() => { onClose(); navigate(activeConvo ? `/messages/${activeConvo._id}` : "/messages"); }}>
            ⤢
          </button>
          <button className="mw-icon-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Inbox */}
      {!activeConvo && (
        <div className="mw-list">
          {inboxLoading && <div className="mw-hint">Loading…</div>}
          {!inboxLoading && conversations.length === 0 && <div className="mw-hint">No messages yet.</div>}
          {conversations.map(c => {
            const other    = c.other;
            const isUnread = c.unread > 0;
            return (
              <div key={c._id} className={`mw-row ${isUnread ? "unread" : ""}`} onClick={() => openChat(c)}>
                <div className="mw-avatar">
                  {other?.avatar
                    ? <img src={avatarSrc(other.avatar)} alt={other?.name} />
                    : <span>{other?.name?.[0]?.toUpperCase() || "?"}</span>}
                  {other?.isOnline && <span className="mw-online-dot" />}
                </div>
                <div className="mw-info">
                  <div className="mw-row-top">
                    <span className="mw-name">{other?.name || "Unknown"}</span>
                    <span className="mw-time">{timeAgo(c.lastMessage?.sentAt)}</span>
                  </div>
                  <div className="mw-row-bottom">
                    <span className={`mw-preview ${isUnread ? "bold" : ""}`}>
                      {c.lastMessage?.text || "Say hello!"}
                    </span>
                    {isUnread && <span className="mw-unread-dot" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mw-footer">
            <button className="mw-new-btn" onClick={() => { onClose(); navigate("/messages"); }}>
              ✏️ New Message
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      {activeConvo && (
        <>
          <div className="mw-messages">
            {chatLoading && <div className="mw-hint">Loading…</div>}
            {!chatLoading && messages.length === 0 && <div className="mw-hint">Say hello! 👋</div>}
            {messages.map(msg => {
              const isMe = msg.sender?.username === currentUser?.username;
              if (msg.type === "system") return <div key={msg._id} className="mw-system-msg">{msg.text}</div>;
              return (
                <div key={msg._id} className={`mw-bubble-row ${isMe ? "me" : "them"}`}>
                  <div className={`mw-bubble ${isMe ? "me" : "them"}`}>
                    {/* attachments */}
                    {msg.attachments?.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: msg.text ? "6px" : 0 }}>
                        {msg.attachments.map((att, idx) => {
                          const url = `${BASE_URL}${att.url}`;
                          if (att.mimeType?.startsWith("image/")) return (
                            <img key={idx} src={url} alt={att.name}
                              style={{ maxWidth: "180px", borderRadius: "8px", display: "block", cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const imageIdx = allChatImages.findIndex(img => img.path === url);
                                setLightboxIndex(imageIdx >= 0 ? imageIdx : 0);
                                setLightboxOpen(true);
                              }}
                            />
                          );
                          return (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" download={att.name}
                              style={{ fontSize: "12px", color: "inherit", display: "flex",
                                alignItems: "center", gap: "6px", opacity: 0.8 }}>
                              📎 {att.name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {msg.text && <p>{msg.text}</p>}
                    <span className="mw-time-sm">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="mw-input-area">

            {/* Attach preview strip */}
            {attachPreview.length > 0 && (
              <div style={{ display: "flex", gap: "6px", padding: "6px 8px",
                borderTop: "1px solid var(--border-color)", flexWrap: "wrap" }}>
                {attachPreview.map((p, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {p.url ? (
                      <img src={p.url} alt={p.name}
                        style={{ width: "48px", height: "48px", objectFit: "cover",
                          borderRadius: "6px", border: "1px solid var(--border-color)" }} />
                    ) : (
                      <div style={{ width: "48px", height: "48px", borderRadius: "6px",
                        background: "var(--bg-2)", border: "1px solid var(--border-color)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                        📎
                      </div>
                    )}
                    <button onClick={() => {
                      setAttachFiles(prev => prev.filter((_, j) => j !== i));
                      setAttachPreview(prev => {
                        if (prev[i]?.url) URL.revokeObjectURL(prev[i].url);
                        return prev.filter((_, j) => j !== i);
                      });
                    }} style={{
                      position: "absolute", top: "-5px", right: "-5px",
                      background: "#ef4444", color: "white", border: "none",
                      borderRadius: "50%", width: "16px", height: "16px",
                      fontSize: "9px", cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 8px" }}>
              {/* Emoji */}
              <div style={{ position: "relative" }} ref={emojiRef}>
                <button className="mw-tool-btn" onClick={() => { setShowEmoji(s => !s); setShowAttach(false); }}>😊</button>
                {showEmoji && (
                  <div style={{ position: "absolute", bottom: "38px", left: 0, zIndex: 400 }}>
                    <EmojiPicker
                      onEmojiClick={(e) => { setText(prev => prev + e.emoji); inputRef.current?.focus(); }}
                      theme="auto" height={300} width={280}
                      previewConfig={{ showPreview: false }}
                    />
                  </div>
                )}
              </div>

              {/* Attach */}
              <div style={{ position: "relative" }} ref={attachRef}>
                <button className="mw-tool-btn"
                  onClick={() => { setShowAttach(s => !s); setShowEmoji(false); }}
                  disabled={attachFiles.length >= 5}>＋</button>
                {showAttach && (
                  <div className="mw-attach-menu">
                    <button onMouseDown={(e) => { e.preventDefault(); fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); setShowAttach(false); }}>
                      <span className="mw-attach-icon" style={{ background: "#dcfce7", color: "#16a34a" }}><BsImage /></span> Photo
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); fileInputRef.current.accept = ".pdf,.doc,.docx,.txt"; fileInputRef.current.click(); setShowAttach(false); }}>
                      <span className="mw-attach-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}><BsFileEarmarkText /></span> Document
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); fileInputRef.current.accept = "audio/*"; fileInputRef.current.click(); setShowAttach(false); }}>
                      <span className="mw-attach-icon" style={{ background: "#fce7f3", color: "#be185d" }}><BsMusicNote /></span> Audio
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    if (!files.length) return;
                    const toAdd = files.slice(0, 5 - attachFiles.length);
                    setAttachFiles(prev => [...prev, ...toAdd]);
                    setAttachPreview(prev => [...prev, ...toAdd.map(f => ({
                      name: f.name, size: f.size, type: f.type,
                      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
                    }))]);
                    e.target.value = "";
                    setShowAttach(false);
                  }}
                />
              </div>

              <textarea ref={inputRef} className="mw-input" value={text}
                onChange={e => setText(e.target.value)} onKeyDown={handleKey}
                placeholder="Message…" rows={1} maxLength={2000} />

              <button className="mw-send-btn" onClick={handleSend}
                disabled={sending || (!text.trim() && attachFiles.length === 0)}>➤</button>
            </div>
          </div>
        </>
      )}
    {lightboxOpen && allChatImages.length > 0 && (
      <ImageLightbox
        images={allChatImages}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    )}  
    </div>
  );
}