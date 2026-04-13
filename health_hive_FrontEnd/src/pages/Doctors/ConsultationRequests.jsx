import { useState, useEffect } from "react";
import { getIncomingRequests, respondToRequest } from "../../api/consultationApi";
import "./ConsultationRequests.css";

const STATUS_STYLE = {
  pending:  { bg: "#fef9c3", color: "#854d0e", label: "Pending"  },
  accepted: { bg: "#dcfce7", color: "#166534", label: "Accepted" },
  declined: { bg: "#fee2e2", color: "#991b1b", label: "Declined" },
  closed:   { bg: "#f1f5f9", color: "#64748b", label: "Closed"   },
};

export default function ConsultationRequests() {
  const [requests,    setRequests]    = useState([]);
  const [filter,      setFilter]      = useState("pending");
  const [loading,     setLoading]     = useState(true);
  const [responding,  setResponding]  = useState(null); // id being responded to
  const [respondModal,setRespondModal]= useState(null); // { id, status }
  const [note,        setNote]        = useState("");
  const [toast,       setToast]       = useState(null);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = (status) => {
    setLoading(true);
    getIncomingRequests(status === "all" ? null : status)
      .then(res => setRequests(res.data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleRespond = async () => {
    if (!respondModal) return;
    setResponding(respondModal.id);
    try {
      await respondToRequest(respondModal.id, respondModal.status, note);
      showToast(respondModal.status === "accepted" ? "Request accepted" : "Request declined");
      setRespondModal(null); setNote("");
      load(filter);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed", "error");
    } finally { setResponding(null); }
  };

  const FILTERS = ["pending", "accepted", "declined", "all"];

  return (
    <div className="cr-wrapper">
      {/* Filter pills */}
      <div className="cr-filters">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`cr-filter-btn ${filter === f ? "active" : ""}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="cr-empty">Loading…</p>}

      {!loading && requests.length === 0 && (
        <p className="cr-empty">No {filter === "all" ? "" : filter} requests.</p>
      )}

      <div className="cr-list">
        {requests.map(r => {
          const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
          return (
            <div key={r._id} className="cr-card">
              {/* Header */}
              <div className="cr-card-top">
                <div className="cr-patient">
                  <div className="cr-avatar">
                    {r.patient?.avatar
                      ? <img src={r.patient.avatar} alt={r.patient.name} />
                      : <span>{r.patient?.name?.[0]?.toUpperCase() || "?"}</span>}
                  </div>
                  <div>
                    <div className="cr-patient-name">{r.patient?.name}</div>
                    <div className="cr-patient-meta">@{r.patient?.username} · {r.patient?.role}</div>
                  </div>
                </div>
                <div className="cr-meta-right">
                  <span className="cr-status" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                  <span className="cr-date">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              </div>

              {/* Message */}
              <p className="cr-message">"{r.message}"</p>

              {/* Doctor note if responded */}
              {r.doctorNote && (
                <div className="cr-note">
                  <span className="cr-note-label">Your note:</span> {r.doctorNote}
                </div>
              )}

              {/* Actions — only for pending */}
              {r.status === "pending" && (
                <div className="cr-actions">
                  <button className="cr-btn accept"
                    onClick={() => { setRespondModal({ id: r._id, status: "accepted" }); setNote(""); }}>
                    ✓ Accept
                  </button>
                  <button className="cr-btn decline"
                    onClick={() => { setRespondModal({ id: r._id, status: "declined" }); setNote(""); }}>
                    ✗ Decline
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Respond modal */}
      {respondModal && (
        <>
          <div onClick={() => setRespondModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000 }} />
          <div className="cr-modal">
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--color)" }}>
              {respondModal.status === "accepted" ? "Accept request" : "Decline request"}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--color-muted, #94a3b8)" }}>
              Add an optional note for the patient
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={respondModal.status === "accepted"
                ? "e.g. Please book a slot via phone or share more details…"
                : "e.g. Outside my specialty, please consult a cardiologist…"}
              rows={4}
              style={{
                width: "100%", padding: "10px", borderRadius: "8px", fontSize: "13px",
                border: "1px solid var(--border-color, #e2e8f0)", background: "var(--bg-color)",
                color: "var(--color)", resize: "vertical", boxSizing: "border-box", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setRespondModal(null)}
                style={{ padding: "8px 18px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", color: "var(--color-muted)", fontSize: "13px" }}>
                Cancel
              </button>
              <button onClick={handleRespond} disabled={!!responding}
                style={{
                  padding: "8px 18px", border: "none", borderRadius: "8px", fontWeight: 600,
                  fontSize: "13px", cursor: "pointer",
                  background: respondModal.status === "accepted" ? "#22c55e" : "#ef4444",
                  color: "white", opacity: responding ? 0.7 : 1,
                }}>
                {responding ? "Submitting…" : respondModal.status === "accepted" ? "Confirm Accept" : "Confirm Decline"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 3000,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600,
        }}>{toast.text}</div>
      )}
    </div>
  );
}