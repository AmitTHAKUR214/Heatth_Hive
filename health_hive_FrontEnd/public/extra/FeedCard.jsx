import "../QA/QuestionsList.css";
import { useState, useEffect, useRef } from "react";
import "./css/FeedCard.css";
import "./css/CommentList.css"
import CommentsList from "./CommentsList.jsx";
import { Link } from "react-router-dom";

export default function FeedCard({ item }) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [posting, setPosting] = useState(false);
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);
  const token = localStorage.getItem("token");
  const [emojis, setEmojis] = useState([]);
  const clickBuffer = useRef([]);

  const [loading, setLoading] = useState({
    like: false,
    dislike: false,
    comment: false,
    share: false,
    flag: false
  });

  // ✅ Stats state
  const [stats, setStats] = useState({
    likes: 0,
    dislikes: 0,
    comments: 0,
    shares: 0,
    flags: 0,
  });

  const basePath = "http://localhost:5000/api/content"; // centralized interaction route

  // -------------------- Fetch stats --------------------
const updateStats = async () => {
  if (!token) return; // ❌ prevent call if not logged in
  try {
    const res = await fetch(`${basePath}/stats/${item.type}/${item._id}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || "Failed to fetch stats");
    }

    const data = await res.json();
    setStats({
      likes: data.likes || 0,
      dislikes: data.dislikes || 0,
      comments: data.comments || 0,
      shares: data.shares || 0,
      flags: data.flags || 0,
    });
  } catch (err) {
    console.error("Failed to update stats:", err);
  }
};



  useEffect(() => {
    updateStats();
  }, [item._id, item.type]);

  // -------------------- Handle interactions --------------------
  const handleAction = async (action) => {
    try {
      setLoading(prev => ({ ...prev, [action]: true }));

      const res = await fetch(`${basePath}/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentId: item._id,
          contentType: item.type,
          action
        }),
      });

      const data = await res.json();

      await updateStats(); // update numbers from backend

      setTimeout(() => {
        setLoading(prev => ({ ...prev, [action]: false }));
      }, 500);

      return data;
    } catch (err) {
      console.error("Action failed", err);
      setLoading(prev => ({ ...prev, [action]: false }));
    }
  };

  // -------------------- Emoji animation --------------------
  const handleLikeClick = async () => {
    try {
      const res = await handleAction("like");
      const now = Date.now();
      clickBuffer.current = clickBuffer.current.filter(t => now - t < 1000);
      clickBuffer.current.push(now);
      const count = clickBuffer.current.length;

      const emojiCount = Math.min(count > 4 ? 5 : 1, 5);

      for (let i = 0; i < emojiCount; i++) {
        const id = Date.now() + Math.random();
        const offset = Math.floor(Math.random() * 30) - 15;

        setEmojis(prev => [...prev, { id, emoji: "👍", offset }]);

        setTimeout(() => {
          setEmojis(prev => prev.filter(e => e.id !== id));
        }, 1000);
      }
    } catch (err) {
      console.error("Like click failed", err);
    }
  };

  // -------------------- Comments --------------------
  const handleCommentsCloseAttempt = () => {
    if (!isDirty) {
      setIsCommentsOpen(false);
      return;
    }
    setShowDiscardConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return alert("You must be logged in to post a comment");
    if (!commentText.trim()) return;

    try {
      setPosting(true);

      const res = await fetch("http://localhost:5000/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType: item.type,
          contentId: item._id,
          text: commentText,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to post comment");

      setCommentText("");
      setIsDirty(false);
      setCommentsRefreshKey(prev => prev + 1);

      await updateStats(); // update comments count
    } catch (err) {
      console.error("Failed to post comment:", err);
      alert(err.message);
    } finally {
      setPosting(false);
    }
  };

  // -------------------- JSX --------------------
  return (
    <div className="qa-card">
      <div className="qa-meta">
        <div className="qa-poster">
          {item.postedBy?.avatar ? (
            <img src={item.postedBy.avatar} alt={`${item.postedBy.name}'s profile`} className="qa-avatar" />
          ) : (
            <div className="qa-avatar fallback">
              <i className="fa-solid fa-user"></i>
            </div>
          )}
          <div>
            <span className="qa-name">{item.postedBy?.name || "Anonymous"}</span><br />
            <h3>{item.title}</h3>
            {item.description && <p className="qa-description">{item.description}</p>}
            {item.content && <p className="qa-description">{item.content}</p>}
          </div>
        </div>
      </div>

      <div className="qa-actions">
        <div className="action-item">
          <button onClick={handleLikeClick} disabled={loading.like} className={loading.like ? "active" : ""}>
            <i className="fa-solid fa-thumbs-up"></i>
          </button>
          <span style={{ color: "var(--color-3)" }}>
            {loading.like ? <i className="fa-solid fa-spinner fa-spin"></i> : stats.likes || 0}
          </span>
        </div>

        <div className="action-item">
          <button onClick={() => setIsCommentsOpen(true)} className="comment-btn">
            <i className="fa-solid fa-comment"></i>
          </button>
          <span style={{ color: "var(--color-3)" }}>
            {loading.comment ? <i className="fa-solid fa-spinner fa-spin"></i> : stats.comments || 0}
          </span>
        </div>

        <div className="action-item">
          <button onClick={async () => await handleAction("dislike")} disabled={loading.dislike} className={loading.dislike ? "active" : ""}>
            <i className="fa-solid fa-thumbs-down"></i>
          </button>
          <span style={{ color: "var(--color-3)" }}>
            {loading.dislike ? <i className="fa-solid fa-spinner fa-spin"></i> : stats.dislikes || 0}
          </span>
        </div>

        <div className="action-item">
          <button onClick={async () => await handleAction("share")} disabled={loading.share} className={loading.share ? "active" : ""}>
            <i className="fa-solid fa-share-nodes"></i>
          </button>
          <span style={{ color: "var(--color-3)" }}>
            {loading.share ? <i className="fa-solid fa-spinner fa-spin"></i> : stats.shares || 0}
          </span>
        </div>

        <div className="action-item">
          <button onClick={async () => await handleAction("flag")} disabled={loading.flag} className={loading.flag ? "active" : ""}>
            <i className="fa-solid fa-flag"></i>
          </button>
          <span style={{ color: "var(--color-3)" }}>
            {loading.flag ? <i className="fa-solid fa-spinner fa-spin"></i> : stats.flags || 0}
          </span>
        </div>
      </div>

      <div className="emoji-container">
        {emojis.map(e => (
          <span key={e.id} className="floating-emoji" style={{ left: `${50 + e.offset}%` }}>
            {e.emoji}
          </span>
        ))}
      </div>

      {isCommentsOpen && (
        <div className="comments-popup-overlay">
          <div className="comments-popup">
            <div className="comments-popup-header">
              <h3>Comments</h3>
              <button className="comments-close-btn" onClick={handleCommentsCloseAttempt}>✕</button>
            </div>

            <div className="comments-popup-body">
              <div className="comments-scroll-area">
                <CommentsList
                  key={commentsRefreshKey}
                  contentType={item.type}
                  contentId={item._id}
                  refreshKey={commentsRefreshKey}
                />
              </div>

              <div className="comments-input-bar">
                {token ? (
                  <form onSubmit={handleSubmit}>
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => {
                        setCommentText(e.target.value);
                        setIsDirty(true);
                      }}
                      disabled={posting}
                    />
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

      {showDiscardConfirm && (
        <div className="comments-discard-overlay">
          <div className="comments-discard-modal" role="dialog" aria-modal="true">
            <div className="comments-discard-header">
              <span className="comments-discard-icon">⚠️</span>
              <h3>Discard your comment?</h3>
            </div>

            <p className="comments-discard-text">
              You have an unfinished comment. If you discard it, your text will be lost.
            </p>

            <div className="comments-discard-actions">
              <button className="comments-btn-secondary" onClick={() => setShowDiscardConfirm(false)}>Continue writing</button>
              <button className="comments-btn-danger" onClick={() => {
                setCommentText("");
                setIsDirty(false);
                setShowDiscardConfirm(false);
                setIsCommentsOpen(false);
              }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
