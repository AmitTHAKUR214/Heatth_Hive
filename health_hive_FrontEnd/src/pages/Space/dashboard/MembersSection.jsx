import { useEffect, useState } from "react";
import { avatarSrc } from "../../../utils/avatarsrc.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const ROLE_STYLE = {
  owner:  { background: "#fef3c7", color: "#92400e", label: "👑 Owner"  },
  admin:  { background: "#ede9fe", color: "#5b21b6", label: "⚙️ Admin"  },
  member: { background: "#f0fdf4", color: "#166534", label: "✅ Member" },
};

export default function MembersSection({ space }) {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [toast,    setToast]    = useState(null);
  const token = localStorage.getItem("token");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${space.slug}/members`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { if (space?.slug) fetchMembers(); }, [space?.slug]);

  const action = async (userId, path, method = "PATCH") => {
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${space.slug}/members/${userId}/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(data.message);
      fetchMembers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const filtered = members.filter((m) => {
    if (!search) return true;
    const u = m.userId;
    return u?.name?.toLowerCase().includes(search.toLowerCase()) ||
           u?.username?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0 }}>Members ({members.length})</h2>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--border-color, #e5e7eb)", fontSize: "13px", width: "200px", background: "var(--bg-color)", color: "var(--color)", outline: "none" }}
        />
      </div>

      {loading && <p style={{ opacity: 0.5 }}>Loading…</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filtered.map(({ userId: u, role }) => {
          if (!u) return null;
          const rs = ROLE_STYLE[role] || ROLE_STYLE.member;
          return (
            <div key={u._id} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 16px", borderRadius: "10px",
              background: "var(--card-bg)", border: "1px solid var(--border-color, #e5e7eb)",
            }}>
              {u.avatar
                ? <img src={avatarSrc(u.avatar)} alt={u.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name}</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>@{u.username}</div>
              </div>

              <span style={{ ...rs, borderRadius: "6px", padding: "2px 10px", fontSize: "12px", fontWeight: 700 }}>
                {rs.label}
              </span>

              {role !== "owner" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  {role === "member" && (
                    <button onClick={() => action(u._id, "promote")}
                      style={{ padding: "4px 10px", background: "#7c3aed", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      Promote
                    </button>
                  )}
                  {role === "admin" && (
                    <button onClick={() => action(u._id, "demote")}
                      style={{ padding: "4px 10px", background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      Demote
                    </button>
                  )}
                  <button onClick={() => action(u._id, "ban")}
                    style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                    Ban
                  </button>
                  <button onClick={() => action(u._id, "remove", "DELETE")}
                    style={{ padding: "4px 10px", background: "none", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "12px", color: "#6b7280" }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <p style={{ opacity: 0.5, fontSize: "14px" }}>No members found.</p>
        )}
      </div>

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