import { useEffect, useState } from "react";
import { avatarSrc } from "../../../utils/avatarsrc.js";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function RequestsTab({ slug, onUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const token = localStorage.getItem("token");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, [slug]);

  const handleDecision = async (userId, decision) => {
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}/requests/${userId}/${decision}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(decision === "approve" ? "Request approved" : "Request rejected");
      setRequests((prev) => prev.filter((r) => r.userId?._id !== userId));
      onUpdate?.(); // refresh parent space data
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (loading) return <p style={{ padding: "20px", opacity: 0.6 }}>Loading requests…</p>;

  return (
    <div style={{ padding: "16px" }}>
      <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: 700 }}>
        Pending Requests ({requests.length})
      </h3>

      {requests.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: "14px" }}>No pending requests.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {requests.map(({ userId: u }) => {
            if (!u) return null;
            return (
              <div key={u._id} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px", borderRadius: "10px",
                background: "var(--card-bg, #f9fafb)",
                border: "1px solid var(--border-color, #e5e7eb)",
              }}>
                {u.avatar
                  ? <img src={avatarSrc(u.avatar)} alt={u.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                }

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>@{u.username}</div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleDecision(u._id, "approve")}
                    style={{ padding: "6px 14px", background: "#22c55e", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                    ✅ Approve
                  </button>
                  <button onClick={() => handleDecision(u._id, "reject")}
                    style={{ padding: "6px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                    ❌ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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