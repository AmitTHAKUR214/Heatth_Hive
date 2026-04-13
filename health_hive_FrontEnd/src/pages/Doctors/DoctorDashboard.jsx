import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getPUser } from "../../api/authapi";
import { getDoctorProfile } from "../../api/Doctorapi";
import ConsultationRequests from "./ConsultationRequests";
import axios from "axios";
import "./DoctorDashboard.css";

const BASE = import.meta.env.VITE_API_BASE_URL;
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function DoctorDashboard() {
  const user     = getPUser();
  const navigate = useNavigate();

  const [profile,   setProfile]   = useState(null);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    Promise.all([
      getDoctorProfile(),
      axios.get(`${BASE}/api/users/${user?.username}/stats`, { headers: authHeader() }).catch(() => null),
    ])
      .then(([profileRes, statsRes]) => {
        setProfile(profileRes?.data?.profile || null);
        setStats(statsRes?.data || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!user || user.role !== "doctor") return <Navigate to="/login" replace />;

  const toggleAvailability = async () => {
    if (!profile) return;
    setToggling(true);
    try {
      const res = await axios.patch(`${BASE}/api/doctor/profile/availability`, {}, { headers: authHeader() });
      setProfile(prev => ({ ...prev, availableForConsultation: res.data.available }));
    } catch { /* silent */ }
    finally { setToggling(false); }
  };

  const statusInfo = () => {
    if (!profile) return { label: "No profile submitted", color: "#94a3b8", bg: "#f1f5f9", action: "/doctor/verify", actionLabel: "Set up profile" };
    const s = profile.verificationStatus;
    if (s === "verified") return { label: "✓ Verified",        color: "#166534", bg: "#dcfce7", action: null };
    if (s === "pending")  return { label: "⏳ Under Review",    color: "#854d0e", bg: "#fef9c3", action: null };
    if (s === "rejected") return { label: "✗ Rejected",         color: "#991b1b", bg: "#fee2e2", action: "/doctor/verify", actionLabel: "Resubmit documents" };
    return                       { label: "Docs not submitted", color: "#94a3b8", bg: "#f1f5f9", action: "/doctor/verify", actionLabel: "Submit documents" };
  };

  const si = statusInfo();

  return (
    <>
      <Navbar />
      <div className="dd-page">

        {/* Header */}
        <div className="dd-header">
          <div>
            <h1 className="dd-title">Doctor Dashboard</h1>
            <p className="dd-sub">Welcome back, {user.name}</p>
          </div>
          <Link to={`/profile/${user.username}`} className="dd-profile-link">
            View public profile →
          </Link>
        </div>

        {loading ? (
          <div className="dd-loading">Loading…</div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="dd-tabs">
              {[["overview", "Overview"], ["requests", "Consultation Requests"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`dd-tab ${activeTab === key ? "active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {activeTab === "overview" && (
              <div className="dd-grid">

                {/* Verification card */}
                <div className="dd-card dd-card-full">
                  <div className="dd-card-top">
                    <h3>Verification Status</h3>
                    <span className="dd-badge" style={{ color: si.color, background: si.bg }}>
                      {si.label}
                    </span>
                  </div>
                  {profile?.rejectionReason && (
                    <div className="dd-alert-red">
                      <strong>Rejection reason:</strong> {profile.rejectionReason}
                    </div>
                  )}
                  {profile?.verificationStatus === "pending" && (
                    <p className="dd-muted">
                      Your documents are under review. You'll receive a notification once a decision is made.
                    </p>
                  )}
                  {si.action && (
                    <Link to={si.action} className="dd-btn-primary" style={{ marginTop: 12, display: "inline-block" }}>
                      {si.actionLabel}
                    </Link>
                  )}
                  {profile?.verificationStatus === "verified" && (
                    <p className="dd-muted" style={{ marginTop: 8 }}>
                      Your doctor badge is active on the platform.{" "}
                      <Link to="/doctor/verify" className="dd-link">View submitted documents →</Link>
                    </p>
                  )}
                </div>

                {/* Profile details card */}
                <div className="dd-card">
                  <div className="dd-card-top">
                    <h3>Professional Profile</h3>
                    <Link to="/doctor/verify" className="dd-link">Edit →</Link>
                  </div>
                  {profile ? (
                    <div className="dd-detail-list">
                      <div className="dd-detail-row"><span>Full name</span><strong>{profile.fullName}</strong></div>
                      <div className="dd-detail-row"><span>Specialty</span><strong>{profile.specialty}</strong></div>
                      <div className="dd-detail-row"><span>Qualification</span><strong>{profile.qualification}</strong></div>
                      <div className="dd-detail-row"><span>Reg. No.</span><strong>{profile.registrationNo}</strong></div>
                      {profile.hospitalName && <div className="dd-detail-row"><span>Hospital</span><strong>{profile.hospitalName}</strong></div>}
                      {profile.city         && <div className="dd-detail-row"><span>City</span><strong>{profile.city}</strong></div>}
                      {profile.phone        && <div className="dd-detail-row"><span>Phone</span><strong>{profile.phone}</strong></div>}
                    </div>
                  ) : (
                    <div className="dd-empty">
                      <p>No profile submitted yet.</p>
                      <Link to="/doctor/verify" className="dd-btn-primary">Set up profile</Link>
                    </div>
                  )}
                </div>

                {/* Availability toggle card */}
                <div className="dd-card">
                  <div className="dd-card-top">
                    <h3>Consultation Availability</h3>
                  </div>
                  <p className="dd-muted" style={{ marginBottom: 16 }}>
                    Let users know whether you're currently available for consultations on the platform.
                  </p>
                  <div className="dd-toggle-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color)" }}>
                        {profile?.availableForConsultation ? "🟢 Available" : "🔴 Unavailable"}
                      </div>
                      <div className="dd-muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {profile?.availableForConsultation
                          ? "Users can see you're open to questions"
                          : "You appear offline to users"}
                      </div>
                    </div>
                    <button
                      className={`dd-toggle-btn ${profile?.availableForConsultation ? "active" : ""}`}
                      onClick={toggleAvailability}
                      disabled={toggling || !profile}
                    >
                      {toggling ? "…" : profile?.availableForConsultation ? "Go offline" : "Go online"}
                    </button>
                  </div>
                  {!profile && (
                    <p className="dd-muted" style={{ fontSize: 12, marginTop: 8 }}>
                      Submit your profile first to enable this.
                    </p>
                  )}
                </div>

                {/* Activity stats card */}
                {stats && (
                  <div className="dd-card dd-card-full">
                    <div className="dd-card-top"><h3>Activity</h3></div>
                    <div className="dd-stats-grid">
                      <div className="dd-stat">
                        <span className="dd-stat-num">{stats.postsCount ?? 0}</span>
                        <span className="dd-stat-label">Posts</span>
                      </div>
                      <div className="dd-stat">
                        <span className="dd-stat-num">{stats.questionsCount ?? 0}</span>
                        <span className="dd-stat-label">Questions</span>
                      </div>
                      <div className="dd-stat">
                        <span className="dd-stat-num">{stats.commentsCount ?? 0}</span>
                        <span className="dd-stat-label">Answers</span>
                      </div>
                      <div className="dd-stat">
                        <span className="dd-stat-num">{stats.likesReceived ?? 0}</span>
                        <span className="dd-stat-label">Likes received</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Requests tab */}
            {activeTab === "requests" && (
              <ConsultationRequests />
            )}
          </>
        )}

      </div>
    </>
  );
}