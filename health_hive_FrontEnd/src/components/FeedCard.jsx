import React from "react";
import { avatarSrc } from "../utils/avatarsrc.js";
import { feedCache } from "../cache/feedCache.js";
import "../QA/QuestionsList.css";
import { useState, useEffect, useRef } from "react";
import "./css/FeedCard.css";
import "../QA/AskPost.css"
import CommentsList from "./CommentsList.jsx";
import { Link, useNavigate } from "react-router-dom";
import ImageLightbox from "./ImageLightBox.jsx";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import CommentItem from "./CommentItem.jsx";

dayjs.extend(relativeTime);

function FeedCard({ item, onImageLoad, extraComments = [], onTopicClick }) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  /* ---------------- State ---------------- */
  const [stats, setStats] = useState(item.stats || {});
  const [interaction, setInteraction] = useState(
    item.userInteraction || { liked: false, disliked: false, flagged: false, shared: false }
  );
  const [loading, setLoading] = useState({ like: false, dislike: false, share: false, flag: false });

  useEffect(() => {
    setStats(item.stats || {});
    setInteraction(item.userInteraction || { liked: false, disliked: false, flagged: false, shared: false });
  }, [item._id]); // use _id not item — prevents reset on parent re-render

  const [isCommentsOpen,     setIsCommentsOpen]    = useState(false);
  const [commentText,        setCommentText]        = useState("");
  const [isDirty,            setIsDirty]            = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [posting,            setPosting]            = useState(false);
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
  const [liveCommentCount,   setLiveCommentCount]   = useState(item.stats?.comments ?? null);

  // owner check
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } })();
  const isOwner = currentUser && item.postedBy?._id &&
    (currentUser._id || currentUser.id) === item.postedBy._id.toString();
  const withinEditWindow = isOwner && (Date.now() - new Date(item.createdAt).getTime()) < 5 * 60 * 1000;

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editTitle,   setEditTitle]   = useState(item.title || "");
  const [editDesc,    setEditDesc]    = useState(item.description || "");
  const [editSaving,  setEditSaving]  = useState(false);
  const [deleted,     setDeleted]     = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // fetch real comment count on mount — stats.comments in the DB is often stale
  useEffect(() => {
    if (!item._id || !item.type) return;
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/comments/${item.type}/${item._id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!Array.isArray(data)) return;
        const total = data.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
        setLiveCommentCount(total);
      })
      .catch(() => {});
  }, [item._id, item.type]);
  const [emojis,             setEmojis]             = useState([]);
  const clickBuffer = useRef([]);

  const [lightboxOpen,  setLightboxOpen]  = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [avatarFailed,  setAvatarFailed]  = useState(false);

  const hasAvatar =
    typeof item.postedBy?.avatar === "string" && item.postedBy.avatar.trim() !== "";

  // ======================= horizontal scroll on images =============================
  const containerRef = useRef(null);
  const dragged = useRef(false);
  const onMouseDown  = () => { dragged.current = false; };
  const onMouseMove  = () => { dragged.current = true; };
  const onMouseUp    = () => { dragged.current = false; };
  const onMouseLeave = () => { dragged.current = false; };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      e.preventDefault();
      container.scrollBy({ left: e.deltaY, behavior: "smooth" });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // -------------------- Handle interactions --------------------
  const handleAction = async (action) => {
    if (!token) return;
    try {
      setLoading((prev) => ({ ...prev, [action]: true }));
      const res = await fetch(`${BASE_URL}/api/content/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentId: item._id, contentType: item.type, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStats(data.stats);
      setInteraction((prev) => {
        const updated = { ...prev };
        if (action === "like")    { updated.liked    = !prev.liked;    if (updated.liked)    updated.disliked = false; }
        if (action === "dislike") { updated.disliked = !prev.disliked; if (updated.disliked) updated.liked    = false; }
        if (action === "flag")    { updated.flagged  = !prev.flagged; }
        if (action === "share")   { updated.shared   = true; }
        return updated;
      });
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  // -------------------- Emoji animation --------------------
  const handleLikeClick = async () => {
    try {
      await handleAction("like");
      const now = Date.now();
      clickBuffer.current = clickBuffer.current.filter(t => now - t < 1000);
      clickBuffer.current.push(now);
      const count = clickBuffer.current.length;
      const emojiCount = Math.min(count > 4 ? 5 : 1, 5);
      for (let i = 0; i < emojiCount; i++) {
        const id = Date.now() + Math.random();
        const offset = Math.floor(Math.random() * 30) - 15;
        setEmojis(prev => [...prev, { id, emoji: "👍", offset }]);
        setTimeout(() => setEmojis(prev => prev.filter(e => e.id !== id)), 1000);
      }
    } catch (err) {
      console.error("Like click failed", err);
    }
  };

  // -------------------- Comments --------------------
  const handleCommentsCloseAttempt = () => {
    if (!isDirty) { setIsCommentsOpen(false); return; }
    setShowDiscardConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return alert("You must be logged in to post a comment");
    if (!commentText.trim()) return;
    try {
      setPosting(true);
      const res = await fetch(`${BASE_URL}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType: item.type, contentId: item._id, text: commentText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to post comment");
      setCommentText("");
      setIsDirty(false);
      setCommentsRefreshKey(prev => prev + 1);
      setLiveCommentCount(prev => (prev ?? 0) + 1);
    } catch (err) {
      console.error("Failed to post comment:", err);
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  const navigateToPost = () => {
    sessionStorage.setItem(`scroll-${window.location.pathname}`, window.scrollY);
    navigate(`/post/${item._id}`, { state: { postData: item } });
  };

  const handleEdit = async () => {  
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const endpoint = item.type?.startsWith("question") ? "questions" : "posts";
      const res = await fetch(`${BASE_URL}/api/${endpoint}/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, description: editDesc }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.message); return; }
      setEditing(false);
      // update local display
      item.title = editTitle;
      item.description = editDesc;
    } catch { alert("Failed to save"); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post?")) return;
    const endpoint = item.type?.startsWith("question") ? "questions" : "posts";
    console.log("🗑️ type:", item.type);
    console.log("🗑️ endpoint:", endpoint); 
    console.log("🗑️ id:", item._id);
    console.log("🗑️ full URL:", `${BASE_URL}/api/${endpoint}/${item._id}`);

    const res = await fetch(`${BASE_URL}/api/${endpoint}/${item._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setDeleted(true);
    else { const d = await res.json(); alert(d.message); }
  };

  // ============================== JSX ==============================
  if (deleted) return null;

  return (
    <div
      className={`qa-card ${extraComments.length > 0 ? "expanded" : ""}`}
      style={{ maxHeight: extraComments.length > 0 ? "none" : "auto", overflow: "auto", position: "relative" }}
    >
      {/* ── Clickable card body ── */}
      <div className="qa-meta clickable" onClick={navigateToPost}>
        <div className="qa-poster">

          {/* Avatar */}
          {hasAvatar && !avatarFailed ? (
            <img key={`avatar-${item._id}`} src={avatarSrc(item.postedBy.avatar)}
              className="qa-avatar" loading="lazy" onError={() => setAvatarFailed(true)} />
          ) : (
            <div className="qa-avatar fallback">
              <i className="fa-solid fa-user"
                style={{ color: "var(--color-3)", width: "44px", display: "flex", alignItems: "center", justifyContent: "center" }} />
            </div>
          )}

          {/* Right side content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Row 1 — author · time · type badge · owner menu */}
            <div className="fc-meta-row">
              {item.postedBy ? (
                <Link to={`/profile/${item.postedBy.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="fc-author">
                  {item.postedBy.name}
                </Link>
              ) : (
                <span className="fc-author">Anonymous</span>
              )}

              {/* Role badge */}
              {item.postedBy?.role === "doctor" && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "20px", background: "#e0f2fe", color: "#0369a1" }}>
                  Doctor{item.postedBy?.isRoleVerified ? " ✓" : ""}
                </span>
              )}
              {item.postedBy?.role === "pharmacist" && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "20px", background: "#ede9fe", color: "#6d28d9" }}>
                  Pharmacist{item.postedBy?.isRoleVerified ? " ✓" : ""}
                </span>
              )}
              {item.postedBy?.role === "student" && (
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "20px", background: "#fef3c7", color: "#92400e" }}>
                  Student
                </span>
              )}

              <span className="fc-time">
                {item.createdAt ? dayjs(item.createdAt).fromNow() : ""}
              </span>

              <span className={`fc-type-badge ${item.type?.startsWith("question") ? "fc-type-qa" : "fc-type-post"}`}>
                {item.type?.startsWith("question") ? "Q&A" : "POST"}
              </span>

              {/* Owner menu — top right corner of card */}
              {isOwner && (
                <div style={{ position: "absolute", top: "10px", right: "12px" }} ref={menuRef}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => setMenuOpen(v => !v)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-3)", fontSize: "18px", padding: "0 4px", lineHeight: 1 }}>
                    ⋯
                  </button>
                  {menuOpen && (
                    <div style={{
                      position: "absolute", right: 0, top: "24px", background: "var(--card-bg)",
                      border: "1px solid var(--border-color)", borderRadius: "10px",
                      padding: "6px", zIndex: 50, minWidth: "140px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    }}>
                      <button
                        onClick={() => { setEditing(true); setMenuOpen(false); }}
                        disabled={!withinEditWindow}
                        title={!withinEditWindow ? "Edit window expired (5 min)" : ""}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "8px 12px", background: "none", border: "none",
                          borderRadius: "6px", cursor: withinEditWindow ? "pointer" : "not-allowed",
                          color: withinEditWindow ? "var(--color)" : "var(--color-3)",
                          fontSize: "13px",
                        }}>
                        ✏️ Edit {!withinEditWindow && <span style={{ fontSize: "11px" }}>(expired)</span>}
                      </button>
                      <button
                        onClick={() => { handleDelete(); setMenuOpen(false); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "8px 12px", background: "none", border: "none",
                          borderRadius: "6px", cursor: "pointer",
                          color: "#ef4444", fontSize: "13px",
                        }}>
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 2 — title */}
            {editing ? (
              <div onClick={e => e.stopPropagation()} style={{ marginTop: "8px" }}>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", fontSize: "15px", fontWeight: 600, marginBottom: "8px", boxSizing: "border-box" }} />
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--color)", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button onClick={handleEdit} disabled={editSaving}
                    style={{ padding: "6px 14px", borderRadius: "8px", background: "var(--hover-color, #0ea5e9)", color: "white", border: "none", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(false)}
                    style={{ padding: "6px 14px", borderRadius: "8px", background: "none", border: "1px solid var(--border-color)", color: "var(--color-3)", fontSize: "13px", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="fc-title">{item.title || "Untitled"}</p>

            {/* Row 3 — description */}
            <p className="fc-desc qa-description">
              {item.content || item.description || ""}
            </p>
            </>
            )}

            {/* Row 4 — space tag + topic chips */}
            {((item.spaceId?.slug) || (item.topics?.length > 0)) && (
              <div className="fc-tags" onClick={(e) => e.stopPropagation()}>

                {item.spaceId?.slug && (
                  <Link to={`/space/${item.spaceId.slug}`} style={{ textDecoration: "none" }}>
                    <span className="fc-space-tag">
                      📌 {item.spaceId.title}
                    </span>
                  </Link>
                )}

                {item.topics?.map((topic, i) => (
                  <span key={i} className="fc-topic-chip"
                    onClick={() => onTopicClick && onTopicClick(topic)}
                    style={{ cursor: onTopicClick ? "pointer" : "default" }}>
                    #{topic}
                  </span>
                ))}
              </div>
            )}

            {/* Row 5 — images */}
            {item.images?.length > 0 && (
              <div ref={containerRef} className="qa-images-container"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
                {item.images.map((img, index) => (
                  <img key={`${item._id}-img-${index}`}
                    src={`${BASE_URL}${img.path}`} alt={`Post image ${index + 1}`}
                    loading="lazy" className="qa-image" draggable={false}
                    onClick={(e) => {
                      if (dragged.current) return;
                      e.stopPropagation();
                      setLightboxIndex(index);
                      setLightboxOpen(true);
                    }} />
                ))}
              </div>
            )}

            {lightboxOpen && (
              <ImageLightbox
                images={item.images.map(img => ({ path: `${BASE_URL}${img.path}` }))}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)} />
            )}
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="qa-actions">
        <div className="action-item">
          <button onClick={() => handleAction("like")} className={interaction.liked ? "active" : ""}>
            <i className="fa-solid fa-thumbs-up"
              style={{ color: interaction.liked ? "var(--color-g)" : "var(--color-3)" }} />
          </button>
          <span>{stats.likes || 0}</span>
        </div>

        <div className="action-item">
          <button onClick={() => setIsCommentsOpen(true)} className="comment-btn">
            <i className="fa-solid fa-comment"
              style={{ color: interaction.comment ? "var(--color-g)" : "var(--color-3)" }} />
          </button>
          <span>{liveCommentCount ?? stats.comments ?? 0}</span>
        </div>

        <div className="action-item">
          <button onClick={() => handleAction("dislike")} className={interaction.disliked ? "active" : ""}>
            <i className="fa-solid fa-thumbs-down"
              style={{ color: interaction.disliked ? "var(--color-g)" : "var(--color-3)" }} />
          </button>
          <span>{stats.dislikes || 0}</span>
        </div>

        <div className="action-item">
          <button onClick={() => handleAction("share")} className={interaction.shared ? "active" : ""}>
            <i className="fa-solid fa-share-nodes"
              style={{ color: interaction.shared ? "var(--color-g)" : "var(--color-3)" }} />
          </button>
          <span>{stats.shares || 0}</span>
        </div>

        <div className="action-item">
          <button onClick={() => handleAction("flag")} className={interaction.flagged ? "active" : ""}>
            <i className="fa-solid fa-flag"
              style={{ color: interaction.flagged ? "var(--color-g)" : "var(--color-3)" }} />
          </button>
          <span>{stats.flags || 0}</span>
        </div>
      </div>

      {/* ── Profile page extra comments ── */}
      {extraComments.length > 0 && (
        <div className="user-comments-container" style={{ marginTop: "16px" }}>
          {extraComments.map((comment) => (
            <CommentItem key={comment._id} comment={comment}
              currentUserId={null} onDelete={() => {}} onEdit={() => {}} onReply={() => {}} />
          ))}
        </div>
      )}

      {/* ── Comments popup ── */}
      {isCommentsOpen && (
        <div className="comments-popup-overlay">
          <div className="comments-popup">
            <div className="comments-popup-header">
              <h3>Comments on :</h3>
              <p className="clickable" onClick={navigateToPost}>{item.title}</p>
              <button className="comments-close-btn" onClick={handleCommentsCloseAttempt}>✕</button>
            </div>
            <div className="comments-popup-body">
              <div className="comments-scroll-area">
                <CommentsList
                  contentType={item.type}
                  contentId={item._id}
                  refreshKey={commentsRefreshKey}
                  onCountLoad={setLiveCommentCount}
                />
              </div>
              <div className="comments-input-bar">
                {token ? (
                  <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => { setCommentText(e.target.value); setIsDirty(true); }}
                      disabled={posting} />
                    <button type="submit" disabled={posting}>
                      {posting ? "Posting..." : "Post"}
                    </button>
                  </form>
                ) : (
                  <Link to="/login" className="comment-login-hint">Log in to comment</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Discard confirm ── */}
      {showDiscardConfirm && (
        <div className="comments-popup-overlay">
          <div className="comments-discard-modal" role="dialog" aria-modal="true">
            <div className="comments-discard-header">
              <span className="comments-discard-icon">⚠️</span>
              <h3>Discard your comment?</h3>
            </div>
            <p className="comments-discard-text">
              You have an unfinished comment. If you discard it, your text will be lost.
            </p>
            <div className="comments-discard-actions">
              <button className="comments-btn-secondary" onClick={() => setShowDiscardConfirm(false)}>
                Continue writing
              </button>
              <button className="comments-btn-danger" onClick={() => {
                setCommentText(""); setIsDirty(false);
                setShowDiscardConfirm(false); setIsCommentsOpen(false);
              }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FeedCard);

{/* try clicking like button after uncommenting this code below */}
      {/* <div className="emoji-container">
        {emojis.map(e => (
          <span key={e.id} className="floating-emoji" style={{ left: `${50 + e.offset}%` }}>
            {e.emoji}
          </span>
        ))}
      </div> */}