import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Spaces.css";
import Navbar from "../../../components/Navbar";
import { getPUser } from "../../../api/authapi";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const SpaceSkeleton = () => (
  <div className="spaces-card spaces-skeleton">
    <div className="spaces-card-icon skeleton-box"></div>
    <div className="spaces-card-title skeleton-box"></div>
    <div className="spaces-card-meta skeleton-box"></div>
    <div className="spaces-card-button skeleton-box"></div>
  </div>
);

function Spaces() {
  const navigate  = useNavigate();
  const user      = getPUser();
  const token     = localStorage.getItem("token");

  const [spaces,   setSpaces]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [joining,  setJoining]  = useState({}); // { [spaceId]: true }
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSpaces = () => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BASE_URL}/api/spaces`, { headers })
      .then((res) => res.json())
      .then((data) => {
        setSpaces(data.filter((s) => s.status === "active"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchSpaces(); }, []);

  const handleJoin = async (e, space) => {
    e.preventDefault(); // don't navigate
    if (!user) return navigate("/login");

    setJoining((prev) => ({ ...prev, [space._id]: true }));
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${space.slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      showToast(data.message);

      // Update local state so button reflects new status instantly
      setSpaces((prev) =>
        prev.map((s) =>
          s._id === space._id
            ? { ...s, memberStatus: data.status, memberCount: (s.memberCount || 0) + (data.status === "active" ? 1 : 0) }
            : s
        )
      );
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoining((prev) => ({ ...prev, [space._id]: false }));
    }
  };

  // ── Join button per space state ──
  const JoinButton = ({ space }) => {
    const status = space.memberStatus;
    const isLoading = joining[space._id];

    if (status === "active") {
      return (
        <Link to={`/space/${space.slug}`} className="spaces-join-btn joined">
          ✅ Joined
        </Link>
      );
    }
    if (status === "pending") {
      return <span className="spaces-join-btn pending">⏳ Pending</span>;
    }
    if (status === "banned") {
      return <span className="spaces-join-btn banned">🚫 Banned</span>;
    }
    if (!user) {
      return (
        <Link to="/login" className="spaces-join-btn">
          Join
        </Link>
      );
    }
    return (
      <button
        className="spaces-join-btn"
        onClick={(e) => handleJoin(e, space)}
        disabled={isLoading}
      >
        {isLoading ? "…" : space.visibility === "private" ? "🔒 Request" : "Join"}
      </button>
    );
  };

  return (
    <>
      <Navbar />
      <div className="Main_content">
        <div className="spaces-page">
          <h2 className="spaces-title">Explore Spaces</h2>

          <div className="spaces-grid">
            {loading
              ? [1, 2, 3, 4, 5].map((i) => <SpaceSkeleton key={i} />)
              : spaces.map((space) => (
                  <div key={space._id} className="spaces-card">
                    <div className="spaces-card-left">
                      <div className="spaces-card-icon">{space.icon || "📌"}</div>
                    </div>

                    <div className="spaces-card-content">
                      <Link to={`/space/${space.slug}`} className="spaces-card-title">
                        {space.title}
                      </Link>
                      <span className="spaces-card-meta">
                        {(space.memberCount || 0).toLocaleString()} members
                      </span>
                      <span style={{ position: "relative", fontSize: "small", color: "var(--color-3)" }}>
                        created by: {space.createdBy?.name}
                      </span>
                      <p className="spaces-card-description">
                        {space.description || "No description available."}
                      </p>
                    </div>

                    <div className="spaces-card-action">
                      <JoinButton space={space} />
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}

export default Spaces;