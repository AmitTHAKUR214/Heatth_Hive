import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getPublicDoctorProfile } from "../../../api/Doctorapi.js";
import { sendConsultationRequest } from "../../../api/consultationApi";
import { startConversation } from "../../../api/messageApi";
import { OnlineDot } from "../../../utils/onlineStatus.jsx";
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

const ROLE_BADGE = {
  doctor:     { label: "Doctor",     color: "#0ea5e9", bg: "#e0f2fe" },
  pharmacist: { label: "Pharmacist", color: "#8b5cf6", bg: "#ede9fe" },
  student:    { label: "Student",    color: "#f59e0b", bg: "#fef3c7" },
  user:       { label: "Member",     color: "#22c55e", bg: "#dcfce7" },
};

export default function ProfileHeader({ user, onProfileUpdate }) {
  const navigate       = useNavigate();
  const [doctorProfile, setDoctorProfile] = useState(null);

  // consultation modal
  const [showConsult, setShowConsult] = useState(false);
  const [message,     setMessage]     = useState("");
  const [sending,     setSending]     = useState(false);
  const [feedback,    setFeedback]    = useState(null);

  // edit profile modal
  const [showEdit,  setShowEdit]  = useState(false);
  const [editName,  setEditName]  = useState("");
  const [editBio,   setEditBio]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [editError, setEditError] = useState("");
  const [avatarErr, setAvatarErr] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [avatarFile,   setAvatarFile]   = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const isDoctor     = user?.role === "doctor";
  const isVerified   = user?.isVerified;
  const isOwn        = user?.isOwn;
  const canRequest   = isDoctor && isVerified && !isOwn && user?.viewerRole !== "guest";

  useEffect(() => {
    if (!isDoctor || !isVerified || !user?.username) return;
    getPublicDoctorProfile(user.username)
      .then(res => setDoctorProfile(res?.data?.profile || null))
      .catch(() => {});
  }, [user?.username, isDoctor, isVerified]);

  const openEdit = () => {
    setEditName(user.name || "");
    setEditBio(user.bio   || "");
    setEditUsername(user.username || "");
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditError("");
    setShowEdit(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { setEditError("Name cannot be empty"); return; }
    if (editUsername && editUsername !== user.username && !/^[a-z0-9._]{3,30}$/.test(editUsername)) {
      setEditError("Username: 3-30 chars, lowercase letters, numbers, . _ only");
      return;
    }
    setSaving(true); setEditError("");
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("name", editName.trim());
      fd.append("bio",  editBio.trim());
      if (editUsername.trim() && editUsername !== user.username)
        fd.append("username", editUsername.trim());
      if (avatarFile) fd.append("avatar", avatarFile);

      const res = await axios.patch(`${BASE}/api/users/me/profile`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.name     = res.data.user.name;
        parsed.username = res.data.user.username;
        parsed.avatar   = res.data.user.avatar;
        localStorage.setItem("user", JSON.stringify(parsed));
      }
      setShowEdit(false);
      if (onProfileUpdate) onProfileUpdate(res.data.user);
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const handleSendConsult = async () => {
    if (!message.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      await sendConsultationRequest(user.id, message.trim());
      setFeedback({ text: "Request sent! The doctor will be notified.", type: "success" });
      setMessage("");
      setTimeout(() => { setShowConsult(false); setFeedback(null); }, 2500);
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || "Failed to send request.", type: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const badge = ROLE_BADGE[user.role];

  return (
    <>
      {/* ── Banner ── */}
      <div className="profile-banner" />

      <div className="profile-header">
        <div className="profile-header-info">
          <div className="profile-name-row">
            {user.avatar && !avatarErr ? (
              <img
                src={user.avatar.startsWith("http") ? user.avatar : `${BASE}${user.avatar}`}
                alt={user.name}
                style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-color)" }}
                onError={() => setAvatarErr(true)}
              />
            ) : (
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--color-primary, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "15px", flexShrink: 0 }}>
                {user.name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
            )}
            <h2 className="profile-name" style={{ margin: 0 }}>{user.name}</h2>
            <OnlineDot userId={user._id} lastSeen={user.lastSeen} isOnline={user.isOnline} />
            {badge && (
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 9px", borderRadius: "20px", background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}
            {isVerified && (
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 9px", borderRadius: "20px", background: "#dcfce7", color: "#166534" }}>
                ✓ Verified
              </span>
            )}
          </div>

          <p className="profile-username">@{user.username}</p>
          {user.bio && <p className="profile-bio">{user.bio}</p>}

          {/* Doctor info strip */}
          {isDoctor && isVerified && doctorProfile && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", margin: "8px 0", fontSize: "13px", color: "var(--color-muted, #94a3b8)" }}>
              {doctorProfile.specialty     && <span>🩺 {doctorProfile.specialty}</span>}
              {doctorProfile.qualification && <span>🎓 {doctorProfile.qualification}</span>}
              {doctorProfile.hospitalName  && <span>🏥 {doctorProfile.hospitalName}</span>}
              {doctorProfile.city          && <span>📍 {doctorProfile.city}</span>}
              <span style={{ fontWeight: 600, color: doctorProfile.availableForConsultation ? "#16a34a" : "#94a3b8" }}>
                {doctorProfile.availableForConsultation ? "🟢 Available" : "🔴 Unavailable"}
              </span>
            </div>
          )}

          <div className="profile-meta">
            {joinedDate && <span>Joined {joinedDate}</span>}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
            {/* Edit — own profile only */}
            {isOwn && (
              <button onClick={openEdit} style={{
                padding: "8px 18px", borderRadius: "8px", fontWeight: 600, fontSize: "13px",
                border: "1px solid var(--border-color, #e2e8f0)", background: "none",
                color: "var(--color)", cursor: "pointer",
              }}>
                ✏️ Edit Profile
              </button>
            )}

            {/* Message button — other users only */}
            {!isOwn && (
              <button
                onClick={async () => {
                  try {
                    const targetId = user._id || user.id;
                    const res = await startConversation(targetId);
                    navigate(`/messages/${res.data.conversationId}`);
                  } catch (err) {
                    alert(err.response?.data?.message || "Could not open chat");
                  }
                }}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "none",
                  fontWeight: 600, fontSize: "13px", cursor: "pointer",
                  background: "#0ea5e9", color: "white",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                💬 Message
              </button>
            )}

            {/* Consult request — always visible for verified doctors, disabled if unavailable */}
            {canRequest && (
              <button
                onClick={() => doctorProfile?.availableForConsultation && setShowConsult(true)}
                style={{
                  padding: "8px 18px", borderRadius: "8px", border: "none", fontWeight: 600,
                  fontSize: "13px", cursor: doctorProfile?.availableForConsultation ? "pointer" : "not-allowed",
                  background: doctorProfile?.availableForConsultation ? "#0ea5e9" : "var(--border-color)",
                  color: doctorProfile?.availableForConsultation ? "white" : "var(--color-3)",
                  display: "flex", alignItems: "center", gap: "6px",
                }}
                title={!doctorProfile?.availableForConsultation ? "Doctor is not accepting consultations" : ""}
              >
                📩 Request Consultation
                {!doctorProfile?.availableForConsultation && (
                  <span style={{ fontSize: "11px", opacity: 0.7 }}>(unavailable)</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEdit && (
        <>
          <div onClick={() => setShowEdit(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000 }} />
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
            background:"var(--card-bg, white)", border:"1px solid var(--border-color)",
            borderRadius:"16px", padding:"28px", zIndex:2001, width:"min(460px, 92vw)",
            maxHeight:"90vh", overflowY:"auto" }}>
            <h3 style={{ margin:"0 0 20px", fontSize:"17px", color:"var(--color)" }}>Edit Profile</h3>

            {/* Avatar picker */}
            <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"20px" }}>
              <div style={{ position:"relative" }}>
                {avatarPreview || user.avatar ? (
                  <img src={avatarPreview || (user.avatar?.startsWith("http") ? user.avatar : `${BASE}${user.avatar}`)}
                    style={{ width:"72px", height:"72px", borderRadius:"50%", objectFit:"cover", border:"2px solid var(--border-color)" }} />
                ) : (
                  <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:"var(--color-primary,#3b82f6)",
                    display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:700, fontSize:"22px" }}>
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <label htmlFor="avatarInput" style={{ position:"absolute", bottom:0, right:0,
                  background:"var(--color-primary,#3b82f6)", color:"white", borderRadius:"50%",
                  width:"22px", height:"22px", display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", fontSize:"12px", border:"2px solid var(--card-bg)" }}>✏️</label>
                <input id="avatarInput" type="file" accept="image/*" hidden onChange={(e) => {
                  const f = e.target.files[0]; if (!f) return;
                  setAvatarFile(f);
                  setAvatarPreview(URL.createObjectURL(f));
                }} />
              </div>
              <div>
                <div style={{ fontSize:"13px", fontWeight:600, color:"var(--color)" }}>Profile Photo</div>
                <div style={{ fontSize:"12px", color:"var(--color-muted)", marginTop:"2px" }}>JPG, PNG up to 3MB</div>
              </div>
            </div>

            {/* Name */}
            <label style={{ fontSize:"13px", fontWeight:600, display:"block", marginBottom:"6px", color:"var(--color)" }}>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60}
              style={{ width:"100%", padding:"10px 12px", borderRadius:"8px", fontSize:"14px",
                border:"1px solid var(--border-color)", background:"var(--bg-color)",
                color:"var(--color)", boxSizing:"border-box", marginBottom:"16px" }} />

            {/* Username */}
            <label style={{ fontSize:"13px", fontWeight:600, display:"block", marginBottom:"6px", color:"var(--color)" }}>
              Username
            </label>
            <div style={{ position:"relative", marginBottom:"16px" }}>
              <span style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)",
                color:"var(--color-muted)", fontSize:"14px" }}>@</span>
              <input value={editUsername} onChange={e => setEditUsername(e.target.value.toLowerCase())} maxLength={30}
                style={{ width:"100%", padding:"10px 12px 10px 28px", borderRadius:"8px", fontSize:"14px",
                  border:"1px solid var(--border-color)", background:"var(--bg-color)",
                  color:"var(--color)", boxSizing:"border-box" }} />
            </div>

            {/* Bio */}
            <label style={{ fontSize:"13px", fontWeight:600, display:"block", marginBottom:"6px", color:"var(--color)" }}>Bio</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
              placeholder="Tell people a bit about yourself…" rows={4} maxLength={300}
              style={{ width:"100%", padding:"10px 12px", borderRadius:"8px", fontSize:"14px",
                border:"1px solid var(--border-color)", background:"var(--bg-color)",
                color:"var(--color)", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }} />
            <div style={{ textAlign:"right", fontSize:"11px", color:"var(--color-muted)", marginBottom:"4px" }}>
              {editBio.length}/300
            </div>

            {editError && (
              <div style={{ padding:"10px 12px", borderRadius:"8px", background:"#fee2e2",
                color:"#991b1b", fontSize:"13px", marginBottom:"12px" }}>{editError}</div>
            )}

            <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"8px" }}>
              <button onClick={() => setShowEdit(false)} style={{ padding:"9px 20px", background:"none",
                border:"1px solid var(--border-color)", borderRadius:"8px", cursor:"pointer",
                color:"var(--color-muted)", fontSize:"13px" }}>Cancel</button>
              <button onClick={handleSaveProfile} disabled={saving} style={{ padding:"9px 20px",
                background:"var(--color-primary,#3b82f6)", color:"white", border:"none",
                borderRadius:"8px", fontWeight:600, fontSize:"13px",
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Consultation Request Modal ── */}
      {showConsult && (
        <>
          <div onClick={() => setShowConsult(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "var(--card-bg, white)", border: "1px solid var(--border-color)",
            borderRadius: "16px", padding: "28px", zIndex: 2001, width: "min(460px, 92vw)",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "17px", color: "var(--color)" }}>Request Consultation</h3>
            <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--color-muted)" }}>
              Sending to Dr. {user.name}{doctorProfile?.specialty ? ` · ${doctorProfile.specialty}` : ""}
            </p>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px", color: "var(--color)" }}>
              Describe your concern
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Briefly describe your symptoms or the topic you'd like to discuss…"
              rows={5} maxLength={1000}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", fontSize: "14px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.5 }}
            />
            <div style={{ textAlign: "right", fontSize: "11px", color: "var(--color-muted)", marginTop: "4px" }}>{message.length}/1000</div>
            {feedback && (
              <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", background: feedback.type === "success" ? "#dcfce7" : "#fee2e2", color: feedback.type === "success" ? "#166534" : "#991b1b" }}>
                {feedback.text}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowConsult(false)} style={{ padding: "9px 20px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", color: "var(--color-muted)", fontSize: "13px" }}>
                Cancel
              </button>
              <button onClick={handleSendConsult} disabled={sending || !message.trim()} style={{ padding: "9px 20px", background: "#0ea5e9", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending…" : "Send Request"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}