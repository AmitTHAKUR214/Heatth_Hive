import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "./SpacePage.css";
import { getPUser } from "../../../api/authapi";

const AboutTab    = lazy(() => import("../tabs/AboutTab"));
const PostsTab    = lazy(() => import("../tabs/PostsTab"));
const MembersTab  = lazy(() => import("../tabs/MembersTab"));
const RequestsTab = lazy(() => import("../tabs/RequestsTab"));

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function SpacePage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const user       = getPUser();

  const [space,        setSpace]        = useState(null);
  const [activeTab,    setActiveTab]    = useState("about");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [joinLoading,  setJoinLoading]  = useState(false);
  const [toast,        setToast]        = useState(null);

  const token = localStorage.getItem("token");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSpace = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Space not found");
      const data = await res.json();
      setSpace(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSpace(); }, [slug]);

  const handleJoin = async () => {
    if (!user) return navigate("/login");
    setJoinLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(data.message);
      fetchSpace(); // refresh membership state
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this space?")) return;
    setJoinLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("Left space");
      fetchSpace();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) return <div className="space-page">Loading space...</div>;
  if (error)   return <div className="space-page">{error}</div>;
  if (!space)  return null;

  // ── Derived membership state ──
  const memberStatus = space.memberStatus; // active | pending | left | banned | null
  const memberRole   = space.memberRole;   // owner | admin | member | null
  const isOwner      = memberRole === "owner";
  const isAdmin      = memberRole === "owner" || memberRole === "admin";
  const isMember     = memberStatus === "active";
  const isPending    = memberStatus === "pending";
  const isBanned     = memberStatus === "banned";

  // ── Join button label ──
  const joinButton = () => {
    if (!user)      return <button className="join-btn" onClick={() => navigate("/login")}>Join</button>;
    if (isBanned)   return <span className="badge status-rejected">Banned</span>;
    if (isOwner)    return null; // owner has no join/leave
    if (isPending)  return <button className="join-btn pending" disabled>⏳ Request Pending</button>;
    if (isMember)   return <button className="join-btn leave" onClick={handleLeave} disabled={joinLoading}>Leave</button>;
    return (
      <button className="join-btn" onClick={handleJoin} disabled={joinLoading}>
        {joinLoading ? "…" : space.visibility === "private" ? "Request to Join" : "Join"}
      </button>
    );
  };

  // ── Share URL (works without login) ──
  const shareUrl = `${window.location.origin}/space/${slug}`;
  const handleShare = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => showToast("Link copied!"));
  };

  return (
    <div className="space-page">

      {/* Banner */}
      <div className="space-banner">
        {space.banner
          ? <img src={space.banner} alt="Space banner" />
          : <div className="space-banner-placeholder" />}
      </div>

      {/* Header */}
      <div className="space-header">
        <div className="space-icon">{space.icon || "📌"}</div>

        <div className="space-info">
          <h1>{space.title}</h1>
          <p>{space.description || "No description provided."}</p>

          {space?.createdBy && typeof space.createdBy === "object" && (
            <div className="space-creator">
              <span className="creator-label">Created by</span>
              <Link to={`/profile/${space.createdBy.username}`} className="creator-name">
                {space.createdBy.name || space.createdBy.username}
              </Link>
              {space.createdBy.username && (
                <span className="creator-username">@{space.createdBy.username}</span>
              )}
            </div>
          )}

          <div className="space-meta">
            <span className="badge">{space.visibility === "private" ? "🔒 Private" : "🌐 Public"}</span>
            <span className="badge secondary">{space.verificationStatus}</span>
            <span className="badge secondary">👥 {space.memberCount ?? 0} members</span>
            {isOwner  && <span className="badge">👑 Owner</span>}
            {!isOwner && isAdmin  && <span className="badge">⚙️ Admin</span>}
            {!isAdmin && isMember && <span className="badge secondary">✅ Member</span>}
          </div>
        </div>

        {/* Right side actions */}
        <div className="space-actions">
          {joinButton()}

          {/* Share button — works for non-logged-in users too */}
          <button className="share-btn" onClick={handleShare} title="Copy shareable link">
            🔗 Share
          </button>

          {isAdmin && (
            <>
              <button onClick={() => navigate(`/space/${space.slug}/settings`)}>⚙️ Settings</button>
              <button onClick={() => navigate(`/space/${space.slug}/dashboard`)}>📊 Dashboard</button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-tabs">
        {["about", "posts", "members"].map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {isAdmin && (
          <button className={activeTab === "requests" ? "active" : ""}
            onClick={() => setActiveTab("requests")}>
            Requests {space.pendingCount > 0 && <span className="badge-count">{space.pendingCount}</span>}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="space-content">
        <Suspense fallback={<p>Loading…</p>}>
          {activeTab === "about"    && <AboutTab space={space} />}
          {activeTab === "posts"    && <PostsTab spaceId={space._id} isMember={isMember || isAdmin} />}
          {activeTab === "members"  && <MembersTab slug={slug} isAdmin={isAdmin} spaceId={space._id} />}
          {activeTab === "requests" && isAdmin && <RequestsTab slug={slug} onUpdate={fetchSpace} />}
        </Suspense>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>{toast.msg}</div>
      )}
    </div>
  );
}