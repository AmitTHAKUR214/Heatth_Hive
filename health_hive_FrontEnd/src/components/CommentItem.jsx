import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPUser } from "../api/authapi";
import { avatarSrc as getAvatarSrc } from "../utils/avatarsrc";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const BASE = import.meta.env.VITE_API_BASE_URL;

export default function CommentItem({ comment, currentUserId, onDelete, onEdit, onReply }) {
  const user   = getPUser();
  const author = comment.author || comment.userId;

  const resolvedAvatar = getAvatarSrc(author?.avatar);
  const hasAvatar = !!resolvedAvatar;

  const commentId = comment._id;
  const authorId  = author?._id;
  const isOwner   = currentUserId && authorId && String(authorId) === String(currentUserId);

  /* ── state ── */
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [replying,     setReplying]     = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const [editText,     setEditText]     = useState(comment.text);
  const [replyText,    setReplyText]    = useState("");
  const [isDirty,      setIsDirty]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [imgFailed,    setImgFailed]    = useState(false);

  // like/dislike
  const [likes,      setLikes]      = useState(comment.stats?.likes    || 0);
  const [dislikes,   setDislikes]   = useState(comment.stats?.dislikes || 0);
  const [userAction, setUserAction] = useState(comment.userAction || null); // "like" | "dislike" | null
  const [reacting,   setReacting]   = useState(false);

  const repliesRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    if (repliesRef.current) {
      setMaxHeight(expanded ? repliesRef.current.scrollHeight : 0);
    }
  }, [expanded, comment.replies?.length]);

  const closeAll = () => { setMenuOpen(false); setEditing(false); setReplying(false); setIsDirty(false); };

  const handleCancelEdit = () => { isDirty ? setShowConfirm(true) : closeAll(); };

  const handleReact = async (action) => {
    if (!user || reacting) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setReacting(true);
    try {
      const res  = await fetch(`${BASE}/api/comments/${commentId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setLikes(data.stats.likes    || 0);
      setDislikes(data.stats.dislikes || 0);
      setUserAction(data.userAction);
    } catch { /* silent */ }
    finally { setReacting(false); }
  };

  return (
    <section style={{ display: "flex", justifyContent: "center", transition: "0.5s" }}>
      {/* Avatar */}
      <div className="comment-avatar">
        {hasAvatar && !imgFailed ? (
          <img src={resolvedAvatar} alt={author?.name || "User"} onError={() => setImgFailed(true)} />
        ) : (
          <i className="fa-regular fa-user" />
        )}
      </div>

      {/* Body */}
      <div className="comment-item">
        {/* Header */}
        <div className="comment-header">
          <Link
            to={author?.username ? `/profile/${author.username}` : "#"}
            style={{ color: "var(--color)", textDecoration: "none" }}
            onClick={e => e.stopPropagation()}
          >
            <strong>{author?.name || "User"}</strong>
            <span style={{ marginLeft: "8px", fontSize: "0.85rem", color: "var(--color-3)" }}>
              {comment.createdAt ? dayjs(comment.createdAt).fromNow() : ""}
            </span>
          </Link>

          <div className="comment-menu">
            {user && <i className="fa fa-ellipsis-h" onClick={() => setMenuOpen(v => !v)} />}
            {menuOpen && (
              <div className={isOwner ? "comment-dropdown" : "comment-dropdown-reply"}>
                {isOwner ? (
                  <>
                    <button className="Comment-edit-btn" onClick={() => { setEditing(true); setMenuOpen(false); }}>Edit</button>
                    <button className="Comment-delete-btn" onClick={() => { onDelete(commentId); setMenuOpen(false); }}>Delete</button>
                  </>
                ) : (
                  <button className="comment-reply-btn" onClick={() => { setReplying(true); setMenuOpen(false); }}>Reply</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Text / Edit */}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input className="Comment-edit-input-btn" value={editText}
              onChange={(e) => { setEditText(e.target.value); setIsDirty(true); }} />
            <section className="comment-editing-section">
              <button className="Comment-save-btn" onClick={() => { onEdit(commentId, editText); closeAll(); }}>Save</button>
              <button className="Comment-cancle-btn" onClick={handleCancelEdit}>Cancel</button>
            </section>
          </div>
        ) : (
          <p>{comment.text}</p>
        )}

        {/* Actions row */}
        <div className="comment-actions-row" style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "6px" }}>
          {/* Like */}
          <button
            onClick={() => handleReact("like")}
            disabled={reacting}
            style={{ background: "none", border: "none", cursor: user ? "pointer" : "default", display: "flex", alignItems: "center", gap: "4px", color: userAction === "like" ? "var(--color-g, #22c55e)" : "var(--color-3)", fontSize: "13px", padding: 0 }}
          >
            <i className="fa-solid fa-thumbs-up" />
            <span>{likes}</span>
          </button>

          {/* Dislike */}
          <button
            onClick={() => handleReact("dislike")}
            disabled={reacting}
            style={{ background: "none", border: "none", cursor: user ? "pointer" : "default", display: "flex", alignItems: "center", gap: "4px", color: userAction === "dislike" ? "var(--color-red, #ef4444)" : "var(--color-3)", fontSize: "13px", padding: 0 }}
          >
            <i className="fa-solid fa-thumbs-down" />
            <span>{dislikes}</span>
          </button>

          {/* Replies toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", color: "var(--color-3)", fontSize: "13px", padding: 0 }}
          >
            <i className="fa-solid fa-comment" style={{ transform: "scale(1.1)" }} />
            <span>{comment.replies?.length || 0}</span>
          </button>
        </div>

        {/* Replies */}
        <div ref={repliesRef} className="comment-replies"
          style={{ maxHeight: `${maxHeight}px`, overflow: "hidden", transition: "max-height 0.4s ease, opacity 0.4s ease", opacity: expanded ? 1 : 0 }}>
          {comment.replies?.map(reply => (
            <div key={`reply-${reply._id}`} className="comment-reply">
              <CommentItem comment={reply} currentUserId={currentUserId}
                onDelete={onDelete} onEdit={onEdit} onReply={onReply} />
            </div>
          ))}
        </div>

        {/* Reply box */}
        {replying && (
          <div className="comment-reply-box">
            <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." />
            <button onClick={() => { onReply(commentId, replyText); setReplyText(""); setExpanded(true); closeAll(); }}>Reply</button>
            <button onClick={closeAll}>Cancel</button>
          </div>
        )}

        {/* Discard confirm */}
        {showConfirm && (
          <div className="discard-overlay">
            <div className="discard-modal">
              <div className="discard-header">
                <span className="discard-icon">⚠️</span>
                <h3>Discard your changes?</h3>
              </div>
              <p className="discard-text">You have unsaved content. If you discard, your draft will be permanently lost.</p>
              <div className="discard-actions">
                <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Continue editing</button>
                <button className="btn-danger" onClick={() => { setEditText(comment.text); closeAll(); setShowConfirm(false); }}>Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}