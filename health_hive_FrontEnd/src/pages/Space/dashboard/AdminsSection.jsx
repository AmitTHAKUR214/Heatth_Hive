import React, { useState, useEffect } from "react";
import { avatarSrc } from "../../../utils/avatarsrc";
import { Link } from "react-router-dom";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function AdminsSection({ space, setSpace }) {
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser,  setSelectedUser]  = useState(null);
  const [admins,        setAdmins]        = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast,         setToast]         = useState(null);
  const token = localStorage.getItem("token");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Fetch current admins from SpaceMember
  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${space.slug}/members`);
      const data = await res.json();
      setAdmins((data.members || []).filter((m) => m.role === "admin" || m.role === "owner"));
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAdmins(); }, [space.slug]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/auth/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ✅ Use the correct promote route (not the broken /add-admin)
  const addAdmin = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api/spaces/slug/${space.slug}/members/${selectedUser._id}/promote`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(`${selectedUser.name} promoted to admin`);
      setSelectedUser(null);
      setSearchQuery("");
      setSearchResults([]);
      fetchAdmins();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false); }
  };

  const demoteAdmin = async (userId, name) => {
    if (!window.confirm(`Demote ${name} to member?`)) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/spaces/slug/${space.slug}/members/${userId}/demote`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(`${name} demoted to member`);
      fetchAdmins();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="admins-section">
      <h2 style={{ marginBottom: "16px" }}>Admins</h2>

      {/* Current admins list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
        {admins.length === 0 && <p style={{ opacity: 0.5 }}>No admins yet.</p>}
        {admins.map(({ userId: u, role }) => {
          if (!u) return null;
          return (
            <div key={u._id} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 14px", borderRadius: "10px",
              background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)",
            }}>
              {u.avatar
                ? <img src={avatarSrc(u.avatar)} alt={u.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>@{u.username}</div>
              </div>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                background: role === "owner" ? "#fef3c7" : "#ede9fe",
                color:      role === "owner" ? "#92400e" : "#5b21b6",
              }}>{role === "owner" ? "👑 Owner" : "⚙️ Admin"}</span>
              {role === "admin" && (
                <button onClick={() => demoteAdmin(u._id, u.name)}
                  style={{ padding: "4px 10px", background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                  Demote
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add admin — search members */}
      <h3 style={{ marginBottom: "10px", fontSize: "15px" }}>Promote a Member to Admin</h3>
      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}>
        Only existing members can be promoted. They must join the space first.
      </p>

      <input type="text" placeholder="Search members by name…"
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color, #e5e7eb)", fontSize: "13px", marginBottom: "8px", boxSizing: "border-box", background: "var(--bg-color)", color: "var(--color)", outline: "none" }}
      />

      {loading && <p style={{ fontSize: "12px", color: "#6b7280" }}>Searching…</p>}

      {searchResults.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "8px", overflow: "hidden" }}>
          {searchResults.map((u) => (
            <li key={u._id} onClick={() => { setSelectedUser(u); setSearchQuery(u.name); setSearchResults([]); }}
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-color, #f3f4f6)", background: selectedUser?._id === u._id ? "#eff6ff" : "transparent" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={(e) => e.currentTarget.style.background = selectedUser?._id === u._id ? "#eff6ff" : "transparent"}>
              {u.avatar
                ? <img src={avatarSrc(u.avatar)} alt={u.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
              }
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>{u.name}</div>
                <div style={{ fontSize: "11px", color: "#6b7280" }}>@{u.username}</div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedUser && (
        <button onClick={addAdmin} disabled={actionLoading}
          style={{ padding: "8px 18px", background: "#7c3aed", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
          {actionLoading ? "Promoting…" : `Promote ${selectedUser.name} to Admin`}
        </button>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}