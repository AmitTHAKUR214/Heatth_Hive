import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import client from "../api/client.js";
import { getSocket } from "../utils/socket.js";
const api = client;
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

// const api = axios.create({ baseURL: `${BASE_URL}/api` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const TYPE_ICON = {
  low_stock:                "🔔",
  out_of_stock:             "⚠️",
  verification_approved:    "✅",
  verification_rejected:    "❌",
  reverification_requested: "🔄",
  admin_announcement:       "📢",
  medicine_found:           "💊",
  consultation_request:     "📩",
  consultation_response:    "🩺",
  dm_request:               "💬",
  dm_accepted:              "✅",
  dm_declined:              "❌",
};

const TYPE_COLOR = {
  low_stock:                "#f59e0b",
  out_of_stock:             "#ef4444",
  verification_approved:    "#22c55e",
  verification_rejected:    "#ef4444",
  reverification_requested: "#f59e0b",
  admin_announcement:       "#3b82f6",
  medicine_found:           "#7c3aed",
  consultation_request:     "#0ea5e9",
  consultation_response:    "#0ea5e9",
  dm_request:               "#22c55e",
  dm_accepted:              "#22c55e",
  dm_declined:              "#ef4444",
};

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [open,          setOpen]          = useState(false);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef(null);
  const pollRef  = useRef(null);
  const navigate = useNavigate();

  const handleNotificationClick = (n) => {
    if (!n.isRead) markRead(n._id);
    setOpen(false);
    if (n.type === "consultation_response" && n.meta?.requestId) {
      navigate(`/consultation/${n.meta.requestId}`);
    } else if (n.type === "consultation_request") {
      navigate("/doctor/dashboard");
    } else if (n.type === "dm_accepted" && n.meta?.roomId) {
      navigate(`/dm/${n.meta.roomId}`);
    }
  };

  const handleDMRespond = async (e, requestId, status) => {
    e.stopPropagation();
    try {
      const res = await api.patch(`/dm/request/${requestId}/respond`, { status });
      if (status === "accepted" && res.data.roomId) {
        setOpen(false);
        navigate(`/dm/${res.data.roomId}`);
      }
      fetchNotifications();
    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch { /* silent — user might not be logged in */ }
  }, []);

  // fetch on mount + listen for socket push — no polling needed
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.role === "guest") return;
    } catch { return; }

    fetchNotifications();

    // keep fallback poll every 2 minutes
    pollRef.current = setInterval(fetchNotifications, 120_000);

    // socket push — instant notification delivery
    const socket = getSocket();
    if (socket) {
      socket.on("notification:new", () => fetchNotifications());
    }

    return () => {
      clearInterval(pollRef.current);
      if (socket) socket.off("notification:new");
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await api.patch("/notifications/read-all").catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    setUnreadCount((c) => {
      const wasUnread = notifications.find((n) => n._id === id && !n.isRead);
      return wasUnread ? Math.max(0, c - 1) : c;
    });
  };

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      const token = localStorage.getItem("token");
      if (token) fetchNotifications();
    }
  };

  return (
    <div ref={panelRef} style={{ position: "relative", display: "inline-block" }}>

      {/* ── Bell button ── */}
      <button onClick={handleOpen} style={{
        background: "none", border: "none", cursor: "pointer",
        position: "relative", padding: "6px", fontSize: "20px",
        display: "flex", alignItems: "center",
      }} aria-label="Notifications">
        <i style={{scale:'1.2', marginTop:'4px'}} className="fas fa-bell nav-icon" title="Notifications" />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "0", right: "0",
            background: "#ef4444", color: "white",
            borderRadius: "50%", width: "18px", height: "18px",
            fontSize: "11px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: "340px", maxHeight: "480px",
          background: "var(--card-bg, white)",
          border: "1px solid var(--border-color, #e5e7eb)",
          borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          zIndex: 9999, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px", display: "flex", justifyContent: "space-between",
            alignItems: "center", borderBottom: "1px solid var(--border-color, #e5e7eb)",
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: "15px" }}>
              Notifications {unreadCount > 0 && (
                <span style={{ background: "#ef4444", color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "11px", marginLeft: "6px" }}>
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={loading} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "12px", color: "#3b82f6", fontWeight: 600,
              }}>
                {loading ? "…" : "Mark all read"}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                No notifications yet
              </div>
            )}
            {notifications.map((n) => (
              <div key={n._id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-color, #f3f4f6)",
                  background: n.isRead ? "transparent" : "var(--notification-unread-bg, #eff6ff)",
                  cursor: "pointer",
                  display: "flex", gap: "10px", alignItems: "flex-start",
                  transition: "background 0.15s",
                }}>

                {/* Type icon */}
                <span style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px",
                  background: `${TYPE_COLOR[n.type]}22`,
                }}>
                  {TYPE_ICON[n.type] || "🔔"}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: "13px", color: "var(--color, #111827)" }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                    {timeAgo(n.createdAt)}
                  </div>

                  {/* DM request — inline accept/decline */}
                  {n.type === "dm_request" && n.meta?.requestId && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDMRespond(e, n.meta.requestId, "accepted")}
                        style={{ padding: "4px 12px", borderRadius: "6px", border: "none", background: "#22c55e", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Accept
                      </button>
                      <button
                        onClick={(e) => handleDMRespond(e, n.meta.requestId, "declined")}
                        style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #ef4444", background: "none", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                {/* Unread dot + delete */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {!n.isRead && (
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", display: "block" }} />
                  )}
                  <button onClick={(e) => deleteNotification(n._id, e)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "14px", color: "#d1d5db", padding: "0",
                    lineHeight: 1,
                  }} title="Dismiss">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}