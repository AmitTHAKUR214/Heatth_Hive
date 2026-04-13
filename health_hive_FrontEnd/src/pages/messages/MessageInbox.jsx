import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getPUser } from "../../api/authapi";
import { getInbox, startConversation } from "../../api/messageApi";
import { avatarSrc } from "../../utils/avatarsrc";
import { getSocket } from "../../utils/socket";
import "./MessageInbox.css";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return "now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  if (d < 7)     return `${d}d`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function MessageInbox() {
  const navigate    = useNavigate();
  const currentUser = getPUser();

  const [conversations, setConversations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getInbox();
      setConversations(res.data.conversations || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();

    // socket — refresh inbox on new message
    const socket = getSocket();
    if (socket) {
      socket.on("inbox:update", load);
      socket.on("message:new",  load);
    }
    return () => {
      if (socket) {
        socket.off("inbox:update", load);
        socket.off("message:new",  load);
      }
    };
  }, [load]);

  // search users to start new conversation
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${BASE}/api/search?q=${encodeURIComponent(search)}&type=users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        setSearchResults(data.users || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openConversation = async (userId) => {
    try {
      const res = await startConversation(userId);
      navigate(`/messages/${res.data.conversationId}`);
    } catch (err) {
      alert(err.response?.data?.message || "Could not start conversation");
    }
  };

  const filtered = conversations.filter(c =>
    c.other?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.other?.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (!currentUser) { navigate("/login"); return null; }

  return (
    <>
      <Navbar />
      <div className="mi-page">

        {/* Header */}
        <div className="mi-header">
          <h1 className="mi-title">Messages</h1>
          <button className="mi-new-btn" onClick={() => setShowSearch(s => !s)} title="New message">
            ✏️
          </button>
        </div>

        {/* Search bar */}
        <div className="mi-search-wrap">
          <input
            className="mi-search"
            placeholder={showSearch ? "Search users to message…" : "Search conversations…"}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* New conversation — user search results */}
        {showSearch && search.trim() && (
          <div className="mi-user-results">
            {searching && <div className="mi-hint">Searching…</div>}
            {!searching && searchResults.length === 0 && (
              <div className="mi-hint">No users found</div>
            )}
            {searchResults.map(u => (
              <div key={u._id} className="mi-user-row" onClick={() => openConversation(u._id)}>
                <div className="mi-avatar">
                  {u.avatar
                    ? <img src={avatarSrc(u.avatar)} alt={u.name} />
                    : <span>{u.name?.[0]?.toUpperCase()}</span>}
                </div>
                <div className="mi-user-info">
                  <span className="mi-name">{u.name}</span>
                  <span className="mi-username">@{u.username}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation list */}
        {loading && <div className="mi-loading">Loading…</div>}

        {!loading && filtered.length === 0 && !showSearch && (
          <div className="mi-empty">
            <p>No messages yet.</p>
            <p>Tap ✏️ to start a conversation.</p>
          </div>
        )}

        <div className="mi-list">
          {filtered.map(c => {
            const other    = c.other;
            const lastMsg  = c.lastMessage;
            const isUnread = c.unread > 0;

            return (
              <div
                key={c._id}
                className={`mi-row ${isUnread ? "unread" : ""}`}
                onClick={() => navigate(`/messages/${c._id}`)}
              >
                {/* Avatar + online dot */}
                <div className="mi-avatar">
                  {other?.avatar
                    ? <img src={avatarSrc(other.avatar)} alt={other?.name} />
                    : <span>{other?.name?.[0]?.toUpperCase() || "?"}</span>}
                  {other?.isOnline && <span className="mi-online-dot" />}
                </div>

                {/* Info */}
                <div className="mi-row-info">
                  <div className="mi-row-top">
                    <span className="mi-name">{other?.name || "Unknown"}</span>
                    <span className="mi-time">{timeAgo(lastMsg?.sentAt)}</span>
                  </div>
                  <div className="mi-row-bottom">
                    <span className={`mi-preview ${isUnread ? "bold" : ""}`}>
                      {lastMsg?.isMedia
                        ? "📎 Media"
                        : lastMsg?.text || "Say hello!"}
                    </span>
                    {isUnread && (
                      <span className="mi-unread-badge">{c.unread > 99 ? "99+" : c.unread}</span>
                    )}
                    {c.isMuted && <span className="mi-muted-icon">🔇</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}