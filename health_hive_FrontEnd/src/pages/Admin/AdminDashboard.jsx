import React, { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import pinventorymanagerapi from "../../api/pinventorymanagerapi.js";
import "./AdminDashboard.css";
// import Navbar from "../../components/Navbar.jsx";  

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("admin"));

  const [tab,            setTab]            = useState("pharmacies");
  const [pharmacists,    setPharmacists]    = useState([]);
  const [doctors,        setDoctors]        = useState([]);
  const [users,          setUsers]          = useState([]);
  const [stats,          setStats]          = useState(null);
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [userSearch,     setUserSearch]     = useState("");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [toast,          setToast]          = useState(null);
  const [docViewer,      setDocViewer]      = useState(null); // { url, label }
  const [banModal,       setBanModal]       = useState(null); // { id, name }
  const [banReason,      setBanReason]      = useState("");
  const [rejectModal,    setRejectModal]    = useState(null);
  const [rejectReason,   setRejectReason]   = useState("");
  const [reVerifyModal,  setReVerifyModal]  = useState(null);
  const [reVerifyReason, setReVerifyReason] = useState("");
  const [blurEnabled,    setBlurEnabled]    = useState(() => {
    const saved = localStorage.getItem("adminBlurMode");
    return saved ? JSON.parse(saved) : true;
  });

  if (!user) return <Navigate to="/admin/login" replace />;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const authHeader = () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/admin/login"); return {}; }
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const handle401 = (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
      navigate("/admin/login");
    }
  };

  useEffect(() => {
    localStorage.setItem("adminBlurMode", JSON.stringify(blurEnabled));
  }, [blurEnabled]);

  /* ── Fetchers ── */
  const fetchPharmacists = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus !== "all" ? { status: filterStatus } : {};
      const res = await pinventorymanagerapi.get("/admin/pharmacists", { ...authHeader(), params });
      setPharmacists((res.data.pharmacists || []).map((p) => ({
        ...p, owner: p.owner || {}, documents: p.documents || {},
      })));
      setError("");
    } catch (err) {
      handle401(err);
      setError(err.response?.data?.message || "Failed to load pharmacists");
    } finally { setLoading(false); }
  }, [filterStatus]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = userSearch ? { search: userSearch } : {};
      const res = await pinventorymanagerapi.get("/admin/users", { ...authHeader(), params });
      setUsers(res.data.users || []);
    } catch (err) { handle401(err); }
    finally { setLoading(false); }
  }, [userSearch]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await pinventorymanagerapi.get("/admin/stats", authHeader());
      setStats(res.data);
    } catch { /* silent */ }
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStatus !== "all" ? { status: filterStatus } : {};
      const res = await pinventorymanagerapi.get("/admin/doctors", { ...authHeader(), params });
      setDoctors((res.data.doctors || []).map((d) => ({ ...d, owner: d.owner || {}, documents: d.documents || {} })));
      setError("");
    } catch (err) {
      handle401(err);
      setError(err.response?.data?.message || "Failed to load doctors");
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === "pharmacies") fetchPharmacists(); }, [tab, fetchPharmacists]);
  useEffect(() => { if (tab === "doctors")    fetchDoctors();     }, [tab, fetchDoctors]);
  useEffect(() => { if (tab === "users")      fetchUsers();       }, [tab, fetchUsers]);

  /* ── Doctor actions ── */
  const handleDoctorApprove = async (id) => {
    try {
      await pinventorymanagerapi.patch(`/admin/doctors/${id}/approve`, {}, authHeader());
      showToast("✅ Doctor approved");
      fetchDoctors(); fetchStats();
    } catch (err) { showToast(err.response?.data?.message || "Failed to approve", "error"); }
  };

  const submitDoctorReject = async () => {
    if (!rejectReason.trim()) return showToast("Please enter a reason", "error");
    try {
      await pinventorymanagerapi.patch(`/admin/doctors/${rejectModal.id}/reject`, { reason: rejectReason }, authHeader());
      showToast("Doctor rejected");
      setRejectModal(null); setRejectReason("");
      fetchDoctors(); fetchStats();
    } catch { showToast("Failed to reject", "error"); }
  };

  const submitDoctorReVerify = async () => {
    try {
      await pinventorymanagerapi.patch(`/admin/doctors/${reVerifyModal.id}/request-reverification`, { reason: reVerifyReason }, authHeader());
      showToast("Re-verification requested");
      setReVerifyModal(null); setReVerifyReason("");
      fetchDoctors();
    } catch { showToast("Failed", "error"); }
  };

  /* ── Pharmacy actions ── */
  const handleApprove = async (id) => {
    try {
      await pinventorymanagerapi.patch(`/admin/pharmacists/${id}/approve`, {}, authHeader());
      showToast("✅ Pharmacy approved");
      fetchPharmacists(); fetchStats();
    } catch (err) { showToast(err.response?.data?.message || "Failed to approve", "error"); }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) return showToast("Please enter a reason", "error");
    try {
      if (rejectModal.isDoctor) {
        await submitDoctorReject();
      } else {
        await pinventorymanagerapi.patch(`/admin/pharmacists/${rejectModal.id}/reject`, { reason: rejectReason }, authHeader());
        showToast("Pharmacy rejected");
        setRejectModal(null); setRejectReason("");
        fetchPharmacists(); fetchStats();
      }
    } catch { showToast("Failed to reject", "error"); }
  };

  const submitReVerify = async () => {
    try {
      if (reVerifyModal.isDoctor) {
        await submitDoctorReVerify();
      } else {
        await pinventorymanagerapi.patch(`/admin/pharmacists/${reVerifyModal.id}/request-reverification`, { reason: reVerifyReason }, authHeader());
        showToast("Re-verification requested");
        setReVerifyModal(null); setReVerifyReason("");
        fetchPharmacists();
      }
    } catch { showToast("Failed", "error"); }
  };

  /* ── User actions ── */
  const handleBan = async (id, isBanned) => {
    if (!isBanned) {
      // open modal to collect reason
      const user = users.find(u => u._id === id);
      setBanModal({ id, name: user?.name || "this user" });
      setBanReason("");
      return;
    }
    // unban directly
    try {
      await pinventorymanagerapi.patch(`/admin/users/${id}/unban`, {}, authHeader());
      showToast("User unbanned");
      fetchUsers();
    } catch { showToast("Failed", "error"); }
  };

  const submitBan = async () => {
    if (!banReason.trim()) return showToast("Please select or enter a reason", "error");
    try {
      await pinventorymanagerapi.patch(`/admin/users/${banModal.id}/ban`, { reason: banReason }, authHeader());
      showToast("User banned");
      setBanModal(null); setBanReason("");
      fetchUsers(); fetchStats();
    } catch { showToast("Failed to ban", "error"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this user?")) return;
    try {
      await pinventorymanagerapi.delete(`/admin/users/${id}`, authHeader());
      showToast("User deleted");
      fetchUsers();
    } catch { showToast("Failed to delete", "error"); }
  };

  const statusClass = (s) =>
    s === "verified" ? "status-verified" : s === "pending" ? "status-pending" :
    s === "rejected" ? "status-rejected" : "status-unverified";

  const badgeSty = (bg, color) => ({
    fontSize: "10px", fontWeight: 700, padding: "2px 7px",
    borderRadius: "20px", background: bg, color,
    display: "inline-block", whiteSpace: "nowrap",
  });

  /* ══════════════════════════════════════════ */
  return (
    <>
      <button className="blur-toggle-btn" onClick={() => setBlurEnabled((v) => !v)}>
        {blurEnabled ? "Disable focus blur" : "Enable focus blur"}
      </button>

      <div className="a-dash-board">

        {/* Header with live stats */}
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          {stats && (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "8px", fontSize: "13px" }}>
              <span>
                🏥 <strong>{stats.pharmacies.total}</strong> pharmacies —&nbsp;
                <span style={{ color: "#f59e0b" }}>{stats.pharmacies.pending} pending</span>,&nbsp;
                <span style={{ color: "#22c55e" }}>{stats.pharmacies.verified} verified</span>,&nbsp;
                <span style={{ color: "#ef4444" }}>{stats.pharmacies.rejected} rejected</span>
              </span>
              <span>
                👨‍⚕️ <strong>{stats.doctors?.total ?? 0}</strong> doctors registered —&nbsp;
                <span style={{ color: "#f59e0b" }}>{stats.doctors?.pending ?? 0} pending</span>,&nbsp;
                <span style={{ color: "#22c55e" }}>{stats.doctors?.verified ?? 0} verified</span>
                {stats.doctors?.profilesSubmitted != null && stats.doctors.profilesSubmitted !== stats.doctors.total
                  ? <span style={{ color: "var(--color-muted, #94a3b8)" }}> ({stats.doctors.profilesSubmitted} submitted docs)</span>
                  : null}
              </span>
              <span>
                👤 <strong>{stats.users.total}</strong> users —&nbsp;
                <span style={{ color: "#ef4444" }}>{stats.users.banned} banned</span>
              </span>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "4px", margin: "16px 0 0", borderBottom: "1px solid var(--border-color, #1e293b)" }}>
          {[["pharmacies", "🏥 Pharmacies"], ["doctors", "👨‍⚕️ Doctors"], ["users", "👤 Users"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "9px 20px", border: "none", background: "none", cursor: "pointer",
              fontSize: "14px", fontWeight: 600, marginBottom: "-1px",
              color: tab === key ? "var(--color-primary, #3b82f6)" : "var(--color-muted, #94a3b8)",
              borderBottom: `2px solid ${tab === key ? "var(--color-primary, #3b82f6)" : "transparent"}`,
            }}>{label}</button>
          ))}
        </div>

        {/* ══ PHARMACIES ══ */}
        {tab === "pharmacies" && (
          <section className="a-dash-main-content">
            {/* Filter pills */}
            <div style={{ display: "flex", gap: "8px", margin: "16px 0", flexWrap: "wrap" }}>
              {["all", "pending", "verified", "rejected", "unverified"].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "5px 14px", borderRadius: "20px", cursor: "pointer",
                  fontSize: "12px", fontWeight: 600, textTransform: "capitalize",
                  border: "1px solid var(--border-color, #1e293b)",
                  background: filterStatus === s ? "var(--color-primary, #3b82f6)" : "transparent",
                  color: filterStatus === s ? "white" : "var(--color-muted, #94a3b8)",
                }}>
                  {s}{stats && s !== "all" && stats.pharmacies[s] != null ? ` (${stats.pharmacies[s]})` : ""}
                </button>
              ))}
            </div>

            {loading && <p>Loading pharmacists...</p>}
            {error   && <p style={{ color: "var(--color-red)" }}>{error}</p>}

            {!loading && !error && (
              <div className={`admin-cards ${blurEnabled ? "blur-mode" : ""}`}>
                {pharmacists.length === 0 && <p style={{ opacity: 0.5 }}>No pharmacies found for this filter.</p>}

                {pharmacists.map((p) => (
                  <div key={p.owner?._id || p._id} className="admin-card" style={{ opacity: p.hasProfile ? 1 : 0.75 }}>

                    {/* Badges row */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {p.hasProfile ? (
                        <span className={`status-badge ${statusClass(p.verificationStatus)}`}>
                          {p.verificationStatus || "unverified"}
                        </span>
                      ) : (
                        <span className="status-badge" style={{ background: "var(--border-color, #e2e8f0)", color: "var(--color-muted, #94a3b8)" }}>
                          No documents submitted
                        </span>
                      )}
                      {p.reVerificationRequested && (
                        <span className="status-badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                          ⚠️ Re-verify Requested
                        </span>
                      )}
                    </div>

                    <h2 style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "15px", margin: "0 0 6px" }}>
                      {p.owner?.username
                        ? <Link to={`/profile/${p.owner.username}`} style={{ color: "var(--color)", textDecoration: "none", fontWeight: 600 }} onClick={() => navigate(`/profile/${p.owner.username}`)}>{p.owner?.name}</Link>
                        : p.owner?.name}
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#ede9fe", color: "#8b5cf6" }}>Pharmacist</span>
                      {p.verificationStatus === "verified" && (
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#dcfce7", color: "#166534" }}>✓ Verified</span>
                      )}
                    </h2>
                    <p><strong>Email:</strong> {p.owner?.email}</p>
                    {p.name      && <p><strong>Shop Name:</strong> {p.name}</p>}
                    {p.email     && <p><strong>Shop Email:</strong> {p.email}</p>}
                    {p.address   && <p><strong>Shop Address:</strong> {p.address}</p>}
                    {p.phone     && <p><strong>Phone:</strong> {p.phone}</p>}

                    {p.rejectionReason && (
                      <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", margin: "8px 0" }}>
                        <strong>Last rejection reason:</strong> {p.rejectionReason}
                      </div>
                    )}

                  {/* Document links */}
                  {p.hasProfile && Object.entries(p.documents).some(([, doc]) => doc?.url) && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" }}>
                      {Object.entries(p.documents).map(([key, doc]) => doc?.url && (
                        <button key={key}
                          onClick={() => setDocViewer({ url: `${import.meta.env.VITE_API_BASE_URL}${doc.url.startsWith("/") ? "" : "/"}${doc.url}`, label: key.replace(/([A-Z])/g, " $1").trim() })}
                          style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--card-bg, #1e293b)", color: "var(--color-primary, #3b82f6)", border: "1px solid var(--border-color)", cursor: "pointer" }}>
                          📄 {key.replace(/([A-Z])/g, " $1").trim()}
                        </button>
                      ))}
                    </div>
                  )}

                    {/* Action buttons */}
                    <div className="action-buttons">
                      {p.hasProfile && p.verificationStatus !== "verified" && (
                        <button className="action-btn action-approve" onClick={() => handleApprove(p._profileId)}>
                          ✅ Approve
                        </button>
                      )}
                      {p.hasProfile && p.verificationStatus !== "rejected" && (
                        <button className="action-btn action-reject"
                          onClick={() => { setRejectModal({ id: p._profileId, name: p.name || p.owner?.name }); setRejectReason(""); }}>
                          ❌ Reject
                        </button>
                      )}
                      {p.hasProfile && p.verificationStatus === "verified" && (
                        <button className="action-btn"
                          style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", padding: "6px 14px", fontWeight: 600 }}
                          onClick={() => { setReVerifyModal({ id: p._profileId, name: p.name || p.owner?.name }); setReVerifyReason(""); }}>
                          🔄 Request Re-verify
                        </button>
                      )}
                      {p.hasProfile && (
                        <button className="action-btn action-view" onClick={() => navigate(`/admin/pharmacist/${p._profileId}`)}>
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══ DOCTORS ══ */}
        {tab === "doctors" && (
          <section className="a-dash-main-content">
            <div style={{ display: "flex", gap: "8px", margin: "16px 0", flexWrap: "wrap" }}>
              {["all", "pending", "verified", "rejected"].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "5px 14px", borderRadius: "20px", cursor: "pointer",
                  fontSize: "12px", fontWeight: 600, textTransform: "capitalize",
                  border: "1px solid var(--border-color, #1e293b)",
                  background: filterStatus === s ? "var(--color-primary, #3b82f6)" : "transparent",
                  color: filterStatus === s ? "white" : "var(--color-muted, #94a3b8)",
                }}>
                  {s}{stats?.doctors && s !== "all" && stats.doctors[s] != null ? ` (${stats.doctors[s]})` : ""}
                </button>
              ))}
            </div>

            {loading && <p>Loading doctors...</p>}
            {error   && <p style={{ color: "var(--color-red)" }}>{error}</p>}

            {!loading && !error && (
              <div className={`admin-cards ${blurEnabled ? "blur-mode" : ""}`}>
                {doctors.length === 0 && <p style={{ opacity: 0.5 }}>No doctors found for this filter.</p>}

                {doctors.map((d) => (
                  <div key={d.owner?._id || d._id} className="admin-card" style={{ opacity: d.hasProfile ? 1 : 0.75 }}>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {d.hasProfile ? (
                        <span className={`status-badge ${statusClass(d.verificationStatus)}`}>
                          {d.verificationStatus || "pending"}
                        </span>
                      ) : (
                        <span className="status-badge" style={{ background: "var(--border-color, #e2e8f0)", color: "var(--color-muted, #94a3b8)" }}>
                          No documents submitted
                        </span>
                      )}
                      {d.reVerificationRequested && (
                        <span className="status-badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                          ⚠️ Re-verify Requested
                        </span>
                      )}
                    </div>

                    <h2 style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "15px", margin: "0 0 6px" }}>
                      {d.owner?.username
                        ? <Link to={`/profile/${d.owner.username}`} style={{ color: "var(--color)", textDecoration: "none", fontWeight: 600 }}>{d.fullName || d.owner?.name}</Link>
                        : (d.fullName || d.owner?.name)}
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#e0f2fe", color: "#0ea5e9" }}>Doctor</span>
                      {d.verificationStatus === "verified" && (
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#dcfce7", color: "#166534" }}>✓ Verified</span>
                      )}
                    </h2>
                    <p style={{ fontSize: "12px", color: "var(--color-muted, #94a3b8)", margin: "0 0 6px" }}>{d.owner?.email}</p>
                    {d.specialty      && <p><strong>Specialty:</strong> {d.specialty}</p>}
                    {d.qualification  && <p><strong>Qualification:</strong> {d.qualification}</p>}
                    {d.registrationNo && <p><strong>Reg. No:</strong> {d.registrationNo}</p>}
                    {d.hospitalName   && <p><strong>Hospital:</strong> {d.hospitalName}</p>}
                    {d.city           && <p><strong>City:</strong> {d.city}</p>}

                    {d.rejectionReason && (
                      <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", margin: "8px 0" }}>
                        <strong>Last rejection reason:</strong> {d.rejectionReason}
                      </div>
                    )}

                    {/* Document links */}
                    {d.hasProfile && Object.entries(d.documents).some(([, doc]) => doc?.url) && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" }}>
                        {Object.entries(d.documents).map(([key, doc]) => doc?.url && (
                          <button key={key}
                            onClick={() => setDocViewer({ url: `${import.meta.env.VITE_API_BASE_URL}${doc.url.startsWith("/") ? "" : "/"}${doc.url}`, label: key.replace(/([A-Z])/g, " $1").trim() })}
                            style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", background: "var(--card-bg, #1e293b)", color: "var(--color-primary, #3b82f6)", border: "1px solid var(--border-color)", cursor: "pointer" }}>
                            📄 {key.replace(/([A-Z])/g, " $1").trim()}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="action-buttons">
                      {d.hasProfile && d.verificationStatus !== "verified" && (
                        <button className="action-btn action-approve" onClick={() => handleDoctorApprove(d._profileId)}>
                          ✅ Approve
                        </button>
                      )}
                      {d.hasProfile && d.verificationStatus !== "rejected" && (
                        <button className="action-btn action-reject"
                          onClick={() => { setRejectModal({ id: d._profileId, name: d.fullName, isDoctor: true }); setRejectReason(""); }}>
                          ❌ Reject
                        </button>
                      )}
                      {d.hasProfile && d.verificationStatus === "verified" && (
                        <button className="action-btn"
                          style={{ background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", padding: "6px 14px", fontWeight: 600 }}
                          onClick={() => { setReVerifyModal({ id: d._profileId, name: d.fullName, isDoctor: true }); setReVerifyReason(""); }}>
                          🔄 Request Re-verify
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══ USERS ══ */}
        {tab === "users" && (
          <section className="a-dash-main-content">
            <div style={{ margin: "16px 0" }}>
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                style={{
                  padding: "8px 14px", width: "280px", borderRadius: "8px",
                  border: "1px solid var(--border-color, #1e293b)",
                  background: "var(--card-bg, #1e293b)", color: "var(--color)",
                  fontSize: "13px", outline: "none",
                }}
              />
            </div>

            {loading && <p>Loading users...</p>}

            {!loading && (() => {
              const roleOrder  = ["doctor", "pharmacist", "student", "user", "guest"];
              const roleColors = {
                doctor:     { color: "#0ea5e9", bg: "#e0f2fe", label: "Doctor" },
                pharmacist: { color: "#8b5cf6", bg: "#ede9fe", label: "Pharmacist" },
                student:    { color: "#f59e0b", bg: "#fef3c7", label: "Student" },
                user:       { color: "#22c55e", bg: "#dcfce7", label: "Member" },
                guest:      { color: "#94a3b8", bg: "#f1f5f9", label: "Guest" },
              };

              const grouped = roleOrder.reduce((acc, r) => {
                acc[r] = users.filter(u => u.role === r);
                return acc;
              }, {});

              return roleOrder.map(role => {
                const group = grouped[role];
                if (group.length === 0) return null;
                const rc = roleColors[role] || roleColors.user;
                return (
                  <div key={role} style={{ marginBottom: "28px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: rc.bg, color: rc.color }}>
                        {rc.label}s
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--color-muted, #94a3b8)" }}>{group.length}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
                      {group.map(u => {
                        const needsVerify = role === "doctor" || role === "pharmacist";
                        const vs          = u.verificationStatus;

                        const verifyBadge = () => {
                          if (!needsVerify) return null;
                          if (vs === "verified") return <span style={badgeSty("#dcfce7","#166534")}>✓ Verified</span>;
                          if (vs === "pending")  return <span style={badgeSty("#fef9c3","#854d0e")}>⏳ Pending</span>;
                          if (vs === "rejected") return <span style={badgeSty("#fee2e2","#991b1b")}>✗ Rejected</span>;
                          return <span style={badgeSty("var(--border-color,#e2e8f0)","var(--color-muted,#94a3b8)")}>No docs</span>;
                        };

                        const initials = u.name?.trim().split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() || "?";
                        const avatarColors = ["#3b82f6","#8b5cf6","#0ea5e9","#22c55e","#f59e0b","#ec4899"];
                        const avatarBg = avatarColors[u.name?.charCodeAt(0) % avatarColors.length] || "#3b82f6";

                        return (
                          <div key={u._id} style={{
                            padding: "16px",
                            borderRadius: "12px",
                            border: u.isBanned ? "1px solid #fca5a5" : "1px solid var(--border-color, #e2e8f0)",
                            background: u.isBanned ? "rgba(239,68,68,0.04)" : "var(--card-bg, white)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}>
                            {/* Top row: avatar + info */}
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                              {/* Avatar */}
                              {u.avatar ? (
                                <img
                                  src={u.avatar.startsWith("http")
                                    ? u.avatar
                                    : `${import.meta.env.VITE_API_BASE_URL}${u.avatar}`
                                  }
                                  alt={u.name}
                                  style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                    flexShrink: 0,
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              ) : (
                                <>
                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--color-primary, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "15px", flexShrink: 0 }}>
                                  {user.name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                                </div>
                                
                                </>
                              )}

                              {/* Name + badges + meta */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", marginBottom: "3px" }}>
                                  <Link to={`/profile/${u.username}`} style={{ fontWeight: 600, fontSize: "14px", color: "var(--color)", textDecoration: "none" }}
                                    onMouseEnter={e => e.target.style.textDecoration = "underline"}
                                    onMouseLeave={e => e.target.style.textDecoration = "none"}>
                                    {u.name}
                                  </Link>
                                  <span style={badgeSty(rc.bg, rc.color)}>{rc.label}</span>
                                  {verifyBadge()}
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--color-muted, #94a3b8)", marginBottom: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {u.email}
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--color-muted, #94a3b8)" }}>
                                  @{u.username} · joined {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </div>
                              </div>
                            </div>

                            {/* Ban reason banner */}
                            {u.isBanned && (
                              <div style={{ background: "#fee2e2", borderRadius: "8px", padding: "8px 12px" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#991b1b", marginBottom: "2px" }}>🚫 Banned</div>
                                {u.banReason && <div style={{ fontSize: "12px", color: "#b91c1c" }}>{u.banReason}</div>}
                                {u.bannedAt  && <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "2px", opacity: 0.7 }}>{new Date(u.bannedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>}
                              </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
                              <button onClick={() => handleBan(u._id, u.isBanned)}
                                style={{ flex: 1, background: u.isBanned ? "#22c55e" : "#f59e0b", color: "white", border: "none", padding: "6px 10px", fontSize: "12px", borderRadius: "7px", cursor: "pointer", fontWeight: 600 }}>
                                {u.isBanned ? "Unban" : "Ban"}
                              </button>
                              <button onClick={() => handleDelete(u._id)}
                                style={{ flex: 1, background: "none", border: "1px solid #fca5a5", color: "#ef4444", padding: "6px 10px", fontSize: "12px", borderRadius: "7px", cursor: "pointer", fontWeight: 600 }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}

            {!loading && users.length === 0 && (
              <p style={{ opacity: 0.5 }}>No users found</p>
            )}
          </section>
        )}
      </div>

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <>
          <div onClick={() => setRejectModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "28px", zIndex: 1001, width: "min(420px,90vw)" }}>
            <h3 style={{ margin: "0 0 6px" }}>Reject Pharmacy</h3>
            <p style={{ fontSize: "13px", color: "var(--color-muted, #94a3b8)", marginBottom: "16px" }}>{rejectModal.name}</p>
            <label style={{ fontSize: "12px", display: "block", marginBottom: "6px" }}>
              Reason <span style={{ color: "#ef4444" }}>*</span>
              <span style={{ color: "var(--color-muted)", fontWeight: 400 }}> — the pharmacist will see this</span>
            </label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. License document is blurry, please resubmit…"
              rows={4}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", fontSize: "13px", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setRejectModal(null)}
                style={{ padding: "8px 18px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", color: "var(--color-muted)" }}>
                Cancel
              </button>
              <button onClick={submitReject} className="action-btn action-reject" style={{ padding: "8px 18px" }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Re-verify Modal ── */}
      {reVerifyModal && (
        <>
          <div onClick={() => setReVerifyModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "28px", zIndex: 1001, width: "min(420px,90vw)" }}>
            <h3 style={{ margin: "0 0 6px" }}>Request Re-verification</h3>
            <p style={{ fontSize: "13px", color: "var(--color-muted, #94a3b8)", marginBottom: "16px" }}>{reVerifyModal.name}</p>
            <label style={{ fontSize: "12px", display: "block", marginBottom: "6px" }}>Reason (optional)</label>
            <textarea value={reVerifyReason} onChange={(e) => setReVerifyReason(e.target.value)}
              placeholder="e.g. License renewal required…"
              rows={3}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", fontSize: "13px", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setReVerifyModal(null)}
                style={{ padding: "8px 18px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", color: "var(--color-muted)" }}>
                Cancel
              </button>
              <button onClick={submitReVerify} className="action-btn"
                style={{ padding: "8px 18px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                Send Request
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Ban Modal ── */}
      {banModal && (() => {
        const BAN_PRESETS = [
          "Inappropriate or offensive content",
          "Harassment or abusive behaviour",
          "Spreading misinformation",
          "Impersonating a medical professional",
          "Spam or self-promotion",
          "Violation of community guidelines",
        ];
        return (
          <>
            <div onClick={() => setBanModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000 }} />
            <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "28px", zIndex: 1001, width: "min(440px,92vw)" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>Ban User</h3>
              <p style={{ fontSize: "13px", color: "var(--color-muted, #94a3b8)", marginBottom: "18px" }}>{banModal.name}</p>

              <p style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: "var(--color)" }}>Select a reason</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                {BAN_PRESETS.map(p => (
                  <button key={p} onClick={() => setBanReason(p)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
                      border: `1px solid ${banReason === p ? "#f59e0b" : "var(--border-color)"}`,
                      background: banReason === p ? "#fef3c7" : "none",
                      color: banReason === p ? "#92400e" : "var(--color)",
                      fontWeight: banReason === p ? 600 : 400,
                      transition: "all 0.1s",
                    }}>
                    {banReason === p ? "✓ " : ""}{p}
                  </button>
                ))}
              </div>

              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px", color: "var(--color)" }}>
                Or write a custom reason
              </label>
              <textarea
                value={BAN_PRESETS.includes(banReason) ? "" : banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Describe the specific issue…"
                rows={3}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", fontSize: "13px", resize: "vertical", boxSizing: "border-box", outline: "none" }}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button onClick={() => setBanModal(null)}
                  style={{ padding: "8px 18px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", color: "var(--color-muted)" }}>
                  Cancel
                </button>
                <button onClick={submitBan}
                  style={{ padding: "8px 18px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                  Confirm Ban
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Doc Viewer Modal ── */}
      {docViewer && (
        <>
          <div onClick={() => setDocViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1001, width: "min(860px, 94vw)", maxHeight: "90vh", background: "var(--card-bg)", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: "14px", textTransform: "capitalize" }}>📄 {docViewer.label}</span>
              <button onClick={() => setDocViewer(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "var(--color-muted)", lineHeight: 1 }}>×</button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", minHeight: "400px" }}>
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(docViewer.url) ? (
                <img src={docViewer.url} alt={docViewer.label} style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />
              ) : (
                <iframe src={docViewer.url} title={docViewer.label} style={{ width: "100%", height: "75vh", border: "none" }} />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 2000,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}