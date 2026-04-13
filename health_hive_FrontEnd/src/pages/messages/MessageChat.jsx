import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPUser } from "../../api/authapi";
import { avatarSrc } from "../../utils/avatarsrc";
import EmojiPicker from "emoji-picker-react";
import ImageLightbox from "../../components/ImageLightBox";
import {
  getMessages, sendMessage, deleteMessage,
  deleteConversation, toggleMute, blockUser, unblockUser
} from "../../api/messageApi";
import "./MessageChat.css";
import { BsImage, BsFileEarmarkText, BsMusicNote, BsDownload } from "react-icons/bs";
import { getSocket } from "../../utils/socket";
import { saveMessages, getMessages as getIDBMessages } from "../../utils/chatDB";
import { exportChatAsPDF } from "../../utils/exportChat";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function formatTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date) {
  if (!date) return "";
  const d    = new Date(date);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentBubble({ attachment, onImageClick }) {
  const url     = `${BASE_URL}${attachment.url}`;
  const isImage = attachment.mimeType?.startsWith("image/");
  const isPDF   = attachment.mimeType === "application/pdf";
  const isAudio = attachment.mimeType?.startsWith("audio/");

  if (isImage) return (
    // ❌ old — opens in new tab
    // <a href={url} target="_blank" rel="noreferrer">

    // ✅ new — opens lightbox
    <img src={url} alt={attachment.name}
      style={{ maxWidth: "220px", maxHeight: "220px", borderRadius: "10px",
        objectFit: "cover", display: "block", cursor: "pointer" }}
      onClick={onImageClick}
    />
  );
  // ... rest stays the same

  if (isAudio) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "12px", opacity: 0.7 }}>🎵 {attachment.name}</span>
      <audio controls src={url} style={{ maxWidth: "220px" }} />
    </div>
  );

  return (
    <a href={url} target="_blank" rel="noreferrer" download={attachment.name}
      style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
        background: "rgba(0,0,0,0.1)", borderRadius: "10px", textDecoration: "none",
        color: "inherit", minWidth: "180px" }}>
      <span style={{ fontSize: "24px" }}>{isPDF ? "📄" : "📎"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {attachment.name}
        </div>
        <div style={{ fontSize: "11px", opacity: 0.6 }}>{formatSize(attachment.size)}</div>
      </div>
      <BsDownload size={14} />
    </a>
  );
}

export default function MessageChat() {
  const { conversationId } = useParams();
  const navigate           = useNavigate();
  const currentUser        = getPUser();
  const uid                = (currentUser?._id || currentUser?.id)?.toString();

  const [messages,      setMessages]      = useState([]);
  const [other,         setOther]         = useState(null);
  const [text,          setText]          = useState("");
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [showMenu,      setShowMenu]      = useState(false);
  const [selectedMsg,   setSelectedMsg]   = useState(null);
  const [isMuted,       setIsMuted]       = useState(false);
  const [isBlocked,     setIsBlocked]     = useState(false);
  const [attachFiles,   setAttachFiles]   = useState([]);
  const [attachPreview, setAttachPreview] = useState([]);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [showAttach,    setShowAttach]    = useState(false);
  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ── all refs declared at top level ──
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const menuRef      = useRef(null);   // header ⋯ menu
  const msgMenuRef   = useRef(null);   // message context menu
  const emojiRef     = useRef(null);
  const fileInputRef = useRef(null);
  const countRef     = useRef(0);

  const allChatImages = messages
  .flatMap(m => m.attachments || [])
  .filter(a => a.mimeType?.startsWith("image/"))
  .map(a => ({ path: `${BASE_URL}${a.url}` }));

  /* ── Load messages ── */
  const load = useCallback(async (before = null) => {
    try {
      if (!before) {
        const cached = await getIDBMessages(conversationId);
        if (cached.length > 0) setMessages(cached);
      }

      const res   = await getMessages(conversationId, before);
      const msgs  = res.data.messages || [];
      const convo = res.data.conversation;

      if (before) {
        setMessages(prev => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
        countRef.current = msgs.length;
        await saveMessages(msgs);
        if (convo?.participants) {
          const otherUser = convo.participants.find(p => p._id?.toString() !== uid);
          if (otherUser) setOther(otherUser);
        }
      }
      setHasMore(res.data.hasMore);
    } catch { }
    finally { setLoading(false); setLoadingMore(false); }
  }, [conversationId, uid]);

  useEffect(() => {
    if (!currentUser) { navigate("/login"); return; }
    load();
  }, [conversationId]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ── Socket ── */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit("convo:join", conversationId);

    socket.on("message:new", (msg) => {
      if (msg.sender?.username === currentUser?.username) return;
      setMessages(prev => {
        if (prev.find(m => m._id === msg._id)) return prev;
        countRef.current = prev.length + 1;
        const updated = [...prev, msg];
        saveMessages([msg]);
        return updated;
      });
    });

    socket.on("message:deleted", ({ msgId, forEveryone }) => {
      if (forEveryone) {
        setMessages(prev => prev.map(m =>
          m._id === msgId ? { ...m, text: "This message was deleted", type: "system" } : m
        ));
      } else {
        setMessages(prev => prev.filter(m => m._id !== msgId));
      }
    });

    return () => {
      socket.emit("convo:leave", conversationId);
      socket.off("message:new");
      socket.off("message:deleted");
    };
  }, [conversationId]);

  /* ── ESC key to close context menu ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setSelectedMsg(null);
        setShowMenu(false);
        setShowEmoji(false);
        setShowAttach(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* ── Outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))    setShowMenu(false);
      if (msgMenuRef.current && !msgMenuRef.current.contains(e.target)) setSelectedMsg(null);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
        setShowAttach(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── File selection ── */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const toAdd = files.slice(0, 5 - attachFiles.length);
    setAttachFiles(prev => [...prev, ...toAdd]);
    setAttachPreview(prev => [...prev, ...toAdd.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      url:  f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }))]);
    e.target.value = "";
    setShowAttach(false);
  };

  const removeAttach = (index) => {
    setAttachFiles(prev => prev.filter((_, i) => i !== index));
    setAttachPreview(prev => {
      if (prev[index]?.url) URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  /* ── Send ── */
  const handleSend = async () => {
    const hasText  = text.trim().length > 0;
    const hasFiles = attachFiles.length > 0;
    if ((!hasText && !hasFiles) || sending) return;

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

      const res    = await sendMessage(conversationId, fd);
      const newMsg = res.data.message;
      setMessages(prev => {
        if (prev.find(m => m._id === newMsg._id)) return prev;
        countRef.current = prev.length + 1;
        return [...prev, newMsg];
      });
      await saveMessages([newMsg]);
    } catch (err) {
      setText(t);
      setAttachFiles(filesToSend);
      alert(err.response?.data?.message || "Failed to send");
    } finally { setSending(false); }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true);
    await load(messages[0].createdAt);
  };

  const handleDeleteMsg = async (msg, forEveryone) => {
    try {
      await deleteMessage(conversationId, msg._id, forEveryone);
      if (forEveryone) {
        setMessages(prev => prev.map(m =>
          m._id === msg._id ? { ...m, text: "This message was deleted", type: "system" } : m
        ));
      } else {
        setMessages(prev => prev.filter(m => m._id !== msg._id));
        countRef.current -= 1;
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete");
    }
    setSelectedMsg(null);
  };

  const handleMute = async () => {
    const res = await toggleMute(conversationId);
    setIsMuted(res.data.muted);
    setShowMenu(false);
  };

  const handleBlock = async () => {
    if (!other) return;
    if (!window.confirm(`Block ${other.name}? They won't be able to message you.`)) return;
    await blockUser(other._id);
    setIsBlocked(true);
    setShowMenu(false);
  };

  const handleUnblock = async () => {
    if (!other) return;
    await unblockUser(other._id);
    setIsBlocked(false);
    setShowMenu(false);
  };

  const handleDeleteChat = async () => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    await deleteConversation(conversationId);
    navigate("/messages");
  };

  const handleExport = () => exportChatAsPDF(messages, [currentUser, other]);

  /* ── Group messages by date ── */
  const grouped = [];
  let lastDate   = null;
  let lastSender = null;
  messages.forEach(msg => {
    const label         = formatDateLabel(msg.createdAt);
    const senderId      = msg.sender?._id?.toString();
    const senderChanged = senderId !== lastSender;
    if (label !== lastDate) {
      grouped.push({ type: "date", label });
      lastDate   = label;
      lastSender = null;
    }
    grouped.push({ type: "msg", msg, senderChanged });
    lastSender = senderId;
  });

  if (!currentUser) return null;

  return (
    <div className="mc-page">

      {/* ── Header ── */}
      <div className="mc-header">
        <button className="mc-back" onClick={() => navigate("/messages")}>←</button>

        {other && (
          <div className="mc-header-user" onClick={() => navigate(`/profile/${other.username}`)}>
            <div className="mc-header-avatar">
              {other.avatar
                ? <img src={avatarSrc(other.avatar)} alt={other.name} />
                : <span>{other.name?.[0]?.toUpperCase()}</span>}
              {other.isOnline && <span className="mc-online-dot" />}
            </div>
            <div>
              <div className="mc-header-name">{other.name}</div>
              <div className="mc-header-status" style={{ color: other.isOnline ? "#22c55e" : "var(--color-3)" }}>
                {other.isOnline ? "● Online" : "Offline"}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginLeft: "auto", position: "relative" }} ref={menuRef}>
          <button className="mc-menu-btn" onClick={() => setShowMenu(s => !s)}>⋯</button>
          {showMenu && (
            <div className="mc-dropdown">
              <button onClick={handleMute}>{isMuted ? "🔔 Unmute" : "🔇 Mute notifications"}</button>
              <button onClick={() => { navigate(`/profile/${other?.username}`); setShowMenu(false); }}>👤 View profile</button>
              <button onClick={handleExport}>📄 Export as PDF</button>
              <button onClick={isBlocked ? handleUnblock : handleBlock} className="danger">
                🚫 {isBlocked ? "Unblock" : "Block"} user
              </button>
              <button className="danger" onClick={() => { setShowMenu(false); alert("Report submitted"); }}>⚑ Report</button>
              <button className="danger" onClick={handleDeleteChat}>🗑 Delete chat</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Load more ── */}
      {hasMore && (
        <div className="mc-load-more">
          <button onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="mc-messages">
        {loading && <div className="mc-loading">Loading…</div>}
        {!loading && messages.length === 0 && (
          <div className="mc-empty">No messages yet. Say hello! 👋</div>
        )}

        {grouped.map((item, i) => {
          if (item.type === "date") return (
            <div key={`date-${i}`} className="mc-date-label">{item.label}</div>
          );

          const msg      = item.msg;
          const isMe     = msg.sender?.username === currentUser?.username;
          const isSystem = msg.type === "system";

          if (isSystem) return (
            <div key={msg._id} className="mc-system-msg">🚫 This message was deleted</div>
          );

          return (
            <div
              key={msg._id}
              className={`mc-row ${isMe ? "me" : "them"}`}
              style={{ marginTop: item.senderChanged ? "12px" : "2px" }}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMsg(msg); }}
            >
              <div className={`mc-bubble ${isMe ? "me" : "them"}`}>

                {msg.attachments?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: msg.text ? "8px" : "0" }}>
                    {msg.attachments.map((att, idx) => {
                    // find the index of this image in allChatImages
                    const imageIndex = allChatImages.findIndex(
                      img => img.path === `${BASE_URL}${att.url}`
                    );
                    return (
                      <AttachmentBubble key={idx} attachment={att}
                        onImageClick={att.mimeType?.startsWith("image/") ? (e) => {
                          e.stopPropagation();
                          setLightboxIndex(imageIndex >= 0 ? imageIndex : 0);
                          setLightboxOpen(true);
                        } : undefined}
                      />
                    );
                  })}
                  </div>
                )}

                {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}

                <div className="mc-meta">
                  <span className="mc-time">{formatTime(msg.createdAt)}</span>
                  {isMe && <span className="mc-read">{msg.readBy?.length > 1 ? "✓✓" : "✓"}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Message context menu ── */}
      {selectedMsg && (
        <div className="mc-msg-menu" ref={msgMenuRef}>
          <div className="mc-msg-menu-inner">
            {selectedMsg.sender?.username === currentUser?.username ? (
              <>
                <button onClick={() => handleDeleteMsg(selectedMsg, false)}>Delete for me</button>
                <button onClick={() => handleDeleteMsg(selectedMsg, true)} className="danger">Delete for everyone</button>
              </>
            ) : (
              <button onClick={() => handleDeleteMsg(selectedMsg, false)}>Delete for me</button>
            )}
            <button onClick={() => setSelectedMsg(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Input area ── */}
      {isBlocked ? (
        <div className="mc-blocked-bar">You have blocked this user.</div>
      ) : (
        <div className="mc-input-area">

          {attachPreview.length > 0 && (
            <div style={{ display: "flex", gap: "8px", padding: "8px 12px",
              borderTop: "1px solid var(--border-color)", flexWrap: "wrap" }}>
              {attachPreview.map((p, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {p.url ? (
                    <img src={p.url} alt={p.name}
                      style={{ width: "60px", height: "60px", objectFit: "cover",
                        borderRadius: "8px", border: "1px solid var(--border-color)" }} />
                  ) : (
                    <div style={{ width: "60px", height: "60px", borderRadius: "8px",
                      background: "var(--bg-2)", border: "1px solid var(--border-color)",
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: "2px", padding: "4px" }}>
                      <span style={{ fontSize: "20px" }}>📎</span>
                      <span style={{ fontSize: "9px", color: "var(--color-muted)",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: "52px" }}>{p.name}</span>
                    </div>
                  )}
                  <button onClick={() => removeAttach(i)} style={{
                    position: "absolute", top: "-6px", right: "-6px",
                    background: "#ef4444", color: "white", border: "none",
                    borderRadius: "50%", width: "18px", height: "18px",
                    fontSize: "10px", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="mc-input-row">
            <div style={{ position: "relative" }} ref={emojiRef}>
              <button className="mc-emoji-btn" onClick={() => setShowEmoji(s => !s)}>😊</button>
              {showEmoji && (
                <div style={{ position: "absolute", bottom: "48px", left: 0, zIndex: 300 }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setText(prev => prev + emojiData.emoji);
                      inputRef.current?.focus();
                    }}
                    theme="auto"
                    height={380}
                    width={320}
                    searchPlaceholder="Search emoji…"
                    previewConfig={{ showPreview: false }}
                  />
                </div>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <button className="mc-emoji-btn" onClick={() => setShowAttach(s => !s)}
                disabled={attachFiles.length >= 5} title="Attach file">＋</button>
                {showAttach && (
                  <div className="mc-attach-menu">
                    <button onMouseDown={(e) => {
                      e.preventDefault();
                      fileInputRef.current.accept = "image/*";
                      fileInputRef.current.click();
                      setShowAttach(false);
                    }}>
                      <span className="mc-attach-icon" style={{ background: "#dcfce7", color: "#16a34a" }}><BsImage /></span>
                      Photo
                    </button>
                    <button onMouseDown={(e) => {
                      e.preventDefault();
                      fileInputRef.current.accept = ".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx";
                      fileInputRef.current.click();
                      setShowAttach(false);
                    }}>
                      <span className="mc-attach-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}><BsFileEarmarkText /></span>
                      Document
                    </button>
                    <button onMouseDown={(e) => {
                      e.preventDefault();
                      fileInputRef.current.accept = ".mp3";
                      fileInputRef.current.click();
                      setShowAttach(false);
                    }}>
                      <span className="mc-attach-icon" style={{ background: "#fce7f3", color: "#be185d" }}><BsMusicNote /></span>
                      Audio
                    </button>
                  </div>
                )}
              <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileSelect} />
            </div>

            <textarea
              ref={inputRef}
              className="mc-input"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message…"
              rows={1}
              maxLength={4000}
            />

            <button
              className="mc-send-btn"
              onClick={handleSend}
              disabled={sending || (!text.trim() && attachFiles.length === 0)}
            >
              {sending ? "…" : "➤"}
            </button>
          </div>
          
        </div>
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