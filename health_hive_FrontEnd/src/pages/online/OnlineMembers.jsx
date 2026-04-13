import { useState, useEffect } from "react";
import { avatarSrc } from "../../utils/avatarsrc.js";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../../components/Navbar";
import { getPUser } from "../../api/authapi.js";
import { startConversation } from "../../api/messageApi.js";
import "./OnlineMembers.css";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const ROLE_CONFIG = {
  doctor:     { label: "Doctors",     color: "#0ea5e9" },
  pharmacist: { label: "Pharmacists", color: "#8b5cf6" },
  student:    { label: "Students",    color: "#f59e0b" },
  user:       { label: "Members",     color: "#22c55e" },
};

const ROLE_ORDER = ["doctor", "pharmacist", "student", "user"];

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function OnlineMembers() {
  const [users,     setUsers]     = useState([]);
  const [count,     setCount]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [chatting,  setChatting]  = useState(null); // userId being opened
  const currentUser = getPUser();
  const navigate    = useNavigate();

  const load = (silent = false) => {
    axios.get(`${BASE}/api/users/online`)
      .then(res => {
        setUsers(res.data.users || []);
        setCount(res.data.count || 0);
        if (!silent) setLoading(false);
      })
      .catch(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, []);

  const grouped = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = users.filter(u => u.role === role);
    return acc;
  }, {});

  const handleChat = async (e, userId) => {
    e.preventDefault();
    if (!currentUser) { alert("Please log in"); return; }
    setChatting(userId);
    try {
      const res = await startConversation(userId);
      navigate(`/messages/${res.data.conversationId}`);
    } catch (err) {
      alert(err.response?.data?.message || "Could not open chat");
    } finally {
      setChatting(null);
    }
  };

  return (
    <>
      <Navbar />
      <div className="om-page">

        <div className="om-header">
          <div>
            <h1 className="om-title">
              <span className="om-live-dot" /> Who's Online
            </h1>
            <p className="om-sub">
              {loading ? "Loading…" : `${count} member${count !== 1 ? "s" : ""} online`}
            </p>
          </div>
        </div>

        {loading && <div className="om-loading">Loading online members…</div>}
        {!loading && count === 0 && <div className="om-empty">No members online right now.</div>}

        {!loading && ROLE_ORDER.map(role => {
          const group = grouped[role];
          if (group.length === 0) return null;
          const rc = ROLE_CONFIG[role];
          return (
            <div key={role} className="om-section">
              <div className="om-section-header">
                <span className="om-role-pill" style={{ color: rc.color, background: "transparent" }}>
                  {rc.label}
                </span>
                <span className="om-role-count">{group.length}</span>
              </div>

              <div className="om-grid">
                {group.map(u => {
                  const isSelf = u._id === (currentUser?._id || currentUser?.id);

                  return (
                    <Link to={`/profile/${u.username}`} key={u._id} className="om-card">
                      <div className="om-card-avatar">
                        {u.avatar
                          ? <img src={avatarSrc(u.avatar)} alt={u.name} />
                          : <span>{u.name?.[0]?.toUpperCase() || "?"}</span>}
                        <span className="om-dot" />
                      </div>

                      <div className="om-card-info">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="om-card-name">{u.name}</span>
                          {isSelf && (
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "20px", background: "#0ea5e922", color: "#0ea5e9" }}>You</span>
                          )}
                        </div>
                        <span className="om-card-username">@{u.username}</span>
                        {u.isRoleVerified && <span className="om-verified">✓ Verified</span>}
                        {u.inChat
                          ? <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 600 }}>● In Chat</span>
                          : <span className="om-card-seen">{timeAgo(u.lastSeen)}</span>
                        }
                      </div>

                      {currentUser && !isSelf && (
                        u.inChat ? (
                          <span style={{
                            marginLeft: "auto", padding: "4px 10px", borderRadius: "8px",
                            background: "var(--border-color)", color: "var(--color-3)",
                            fontSize: "11px", flexShrink: 0,
                          }}>
                            Busy
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleChat(e, u._id)}
                            disabled={chatting === u._id}
                            style={{
                              marginLeft: "auto", padding: "6px 12px", borderRadius: "8px",
                              background: "#0ea5e9", color: "white", border: "none",
                              fontSize: "12px", fontWeight: 600, cursor: "pointer",
                              flexShrink: 0, opacity: chatting === u._id ? 0.6 : 1,
                            }}>
                            {chatting === u._id ? "…" : "Chat"}
                          </button>
                        )
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}