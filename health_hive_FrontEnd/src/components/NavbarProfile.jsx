import { useState, useEffect, useRef } from "react";
import { avatarSrc } from "../utils/avatarsrc";
import { Link, useNavigate } from "react-router-dom";
import { getPUser } from "../api/authapi";
import { logout } from "../utils/logout";
import "./css/NavbarProfile.css";

const ROLE_BADGE = {
  doctor:     { label: "Doctor",     color: "#0ea5e9", bg: "#e0f2fe" },
  pharmacist: { label: "Pharmacist", color: "#8b5cf6", bg: "#ede9fe" },
  student:    { label: "Student",    color: "#f59e0b", bg: "#fef3c7" },
  user:       { label: "Member",     color: "#22c55e", bg: "#dcfce7" },
  guest:      { label: "Guest",      color: "#94a3b8", bg: "#f1f5f9" },
};

function RoleBadge({ role }) {
  const badge = ROLE_BADGE[role];
  if (!badge) return null;
  return (
    <span className="np-role-badge" style={{ color: badge.color, background: badge.bg }}>
      {badge.label}
    </span>
  );
}

function Avatar({ user, size = 36 }) {
  const [failed, setFailed] = useState(false);
  const initials = user?.name?.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  if (user?.avatar && !failed) {
    return (
      <img
        src={avatarSrc(user.avatar)}
        alt={user.name}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div className="np-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

export default function NavbarProfile() {
  const user = getPUser();
  const isGuest = !user || user.role === "guest";
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const roleLinks = () => {
    if (!user) return null;
    if (user.role === "pharmacist") {
      return (
        <Link to="/p-dashboard" className="np-link" onClick={() => setOpen(false)}>
          <i className="fas fa-store np-link-icon" /> Pharmacy Dashboard
        </Link>
      );
    }
    if (user.role === "doctor") {
      return (
        <>
          <Link to="/doctor/dashboard" className="np-link" onClick={() => setOpen(false)}>
            <i className="fas fa-stethoscope np-link-icon" /> Doctor Dashboard
          </Link>
          <Link to="/doctor/verify" className="np-link" onClick={() => setOpen(false)}>
            <i className="fas fa-user-md np-link-icon" />
            {" "}{user.isRoleVerified ? "Verification" : "Submit Verification"}
            {!user.isRoleVerified && <span className="np-pending-dot" />}
          </Link>
        </>
      );
    }
    return null;
  };

  return (
    <div className="np-wrapper" ref={dropdownRef}>
      <button className="np-trigger" onClick={() => setOpen(v => !v)} aria-label="Profile menu">
        <Avatar user={user} size={34} />
      </button>

      {open && (
        <div className="np-dropdown">
          {isGuest ? (
            <div className="np-guest">
              <p className="np-guest-msg">Browsing as guest</p>
              <Link to="/login"    className="np-btn-primary"   onClick={() => setOpen(false)}>Log in</Link>
              <Link to="/register" className="np-btn-secondary" onClick={() => setOpen(false)}>Create account</Link>
            </div>
          ) : (
            <>
              <div className="np-user-header">
                <Avatar user={user} size={42} />
                <div className="np-user-info">
                  <span className="np-user-name">{user.name}</span>
                  <span className="np-user-username">@{user.username}</span>
                  <RoleBadge role={user.role} />
                </div>
              </div>

              <div className="np-divider" />

              <Link to={`/profile/${user.username}`} className="np-link" onClick={() => setOpen(false)}>
                <i className="fas fa-user np-link-icon" /> My Profile
              </Link>

              {user.role !== "doctor" && user.role !== "pharmacist" && user.role !== "guest" && (
                <Link to="/my-consultations" className="np-link" onClick={() => setOpen(false)}>
                  <i className="fas fa-notes-medical np-link-icon" /> My Consultations
                </Link>
              )}

              {roleLinks()}

              <div className="np-divider" />

              <button className="np-logout" onClick={() => { setOpen(false); logout(); }}>
                <i className="fas fa-sign-out-alt np-link-icon" /> Log out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}