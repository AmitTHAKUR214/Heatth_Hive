import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getPUser } from "../../api/authapi";
import { getMyRequests, closeRequest } from "../../api/consultationApi";
import "../doctor/ConsultationRequests.css";
import "./MyConsultations.css";

const STATUS_STYLE = {
  pending:  { bg: "#fef9c3", color: "#854d0e", label: "Pending"  },
  accepted: { bg: "#dcfce7", color: "#166534", label: "Accepted" },
  declined: { bg: "#fee2e2", color: "#991b1b", label: "Declined" },
  closed:   { bg: "#f1f5f9", color: "#64748b", label: "Closed"   },
};

export default function MyConsultations() {
  const user = getPUser();
  const [requests, setRequests] = useState([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  if (!user || user.role === "guest") return <Navigate to="/login" replace />;

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    getMyRequests()
      .then(res => setRequests(res.data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClose = async (id) => {
    try {
      await closeRequest(id);
      setRequests(prev => prev.map(r => r._id === id ? { ...r, status: "closed" } : r));
      showToast("Request closed");
    } catch {
      showToast("Failed to close request", "error");
    }
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <>
      <Navbar />
      <div className="mc-page">
        <div className="mc-header">
          <h1 className="mc-title">My Consultations</h1>
          <p className="mc-sub">Consultation requests you've sent to doctors</p>
        </div>

        <div className="cr-filters">
          {["all", "pending", "accepted", "declined", "closed"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`cr-filter-btn ${filter === f ? "active" : ""}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && requests.filter(r => r.status === f).length > 0 &&
                <span className="mc-count"> {requests.filter(r => r.status === f).length}</span>
              }
            </button>
          ))}
        </div>

        {loading && <p className="cr-empty">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="mc-empty">
            <p>{filter === "all" ? "You haven't sent any consultation requests yet." : `No ${filter} requests.`}</p>
            {filter === "all" && (
              <p style={{ fontSize: 13, marginTop: 8 }}>
                Visit a <Link to="/" style={{ color: "var(--color-primary, #3b82f6)" }}>verified doctor's profile</Link> to send a request.
              </p>
            )}
          </div>
        )}

        <div className="cr-list">
          {filtered.map(r => {
            const ss = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
            return (
              <div key={r._id} className="cr-card">
                <div className="cr-card-top">
                  {/* Doctor info */}
                  <div className="cr-patient">
                    <div className="cr-avatar" style={{ background: "#0ea5e9" }}>
                      {r.doctor?.avatar
                        ? <img src={r.doctor.avatar} alt={r.doctor.name} />
                        : <span>{r.doctor?.name?.[0]?.toUpperCase() || "D"}</span>}
                    </div>
                    <div>
                      <Link to={`/profile/${r.doctor?.username}`}
                        className="cr-patient-name mc-doctor-link">
                        Dr. {r.doctor?.name}
                      </Link>
                      {r.doctorSpecialty && (
                        <div className="cr-patient-meta">🩺 {r.doctorSpecialty}</div>
                      )}
                    </div>
                  </div>
                  <div className="cr-meta-right">
                    <span className="cr-status" style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                    <span className="cr-date">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Your message */}
                <div className="mc-section-label">Your message</div>
                <p className="cr-message">"{r.message}"</p>

                {/* Doctor's response */}
                {r.doctorNote && (
                  <div className="cr-note">
                    <span className="cr-note-label">Doctor's note:</span> {r.doctorNote}
                  </div>
                )}

                {/* Status-specific messages */}
                {r.status === "pending" && (
                  <p style={{ fontSize: 12, color: "var(--color-muted, #94a3b8)", margin: "0 0 10px" }}>
                    Waiting for the doctor to respond…
                  </p>
                )}
                {r.status === "accepted" && !r.doctorNote && (
                  <div style={{ background: "#dcfce7", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#166534", marginBottom: 10 }}>
                    ✅ The doctor has accepted your request.
                  </div>
                )}

                {/* Actions */}
                {(r.status === "pending" || r.status === "accepted") && (
                  <div className="cr-actions">
                    <button className="cr-btn close" onClick={() => handleClose(r._id)}>
                      Close request
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "fixed", bottom: "24px", right: "24px", zIndex: 3000,
            background: toast.type === "error" ? "#ef4444" : "#22c55e",
            color: "white", borderRadius: "10px", padding: "12px 20px",
            fontSize: "14px", fontWeight: 600,
          }}>{toast.text}</div>
        )}
      </div>
    </>
  );
}