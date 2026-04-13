import { useEffect, useState } from "react";
import axios from "axios";
import CommentItem from "./CommentItem";
import "./css/CommentList.css"

export default function CommentsList({ contentType, contentId, refreshKey }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeMenu, setActiveMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // 🔁 Reply state
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  // const [expandedComments, setExpandedComments] = useState({});


  const rawUser = localStorage.getItem("user");
  const currentUser = rawUser ? JSON.parse(rawUser) : null;
  const currentUserId = currentUser?._id || currentUser?.id || null;

  const token = localStorage.getItem("token");

  /* ---------------- Fetch comments ---------------- */
  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/comments/${contentType}/${contentId}`);
      const tree = buildCommentTree(res.data);
      setComments(tree);
    } catch (err) {
      console.error("Failed to load comments", err);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    setLoading(true);
    fetchComments();
  }, [contentType, contentId, refreshKey]);

  /* ---------------- Delete (OWNER ONLY) ---------------- */
  const handleDelete = async (commentId) => {
    if (!token) return;
    if (!window.confirm("Delete this comment?")) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      setComments(prev => prev.filter(c => (c._id || c.id) !== commentId));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  /* ---------------- Edit (OWNER ONLY) ---------------- */
  const handleEdit = (comment) => {
    setEditingId(comment._id || comment.id);
    setEditText(comment.text);
    setActiveMenu(null);
  };

  const submitEdit = async (commentId) => {
    if (!token || !editText.trim()) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: editText }),
      });

      const updated = await res.json();

      setComments(prev =>
        prev.map(c => {
          const id = c._id || c.id;
          if (id !== parentCommentId) return c;

          return {
            ...c,
            replies: [data.reply, ...(c.replies || [])],
            stats: { ...c.stats, replies: (c.stats?.replies || 0) + 1 },
          };
        })
      );

      // 👇 THIS IS THE KEY LINE
      setExpandedComments(prev => ({
        ...prev,
        [parentCommentId]: true,
      }));

      setReplyText("");
      setReplyingToId(null);


      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Edit failed", err);
    }
  };

  /* ---------------- Submit reply ---------------- */
  const submitReply = async (parentCommentId) => {
    if (!token || !replyText.trim()) return;
    const normalizedContentType = contentType.toLowerCase().replace(/s$/, "");

    try {
      const res = await fetch("/api/comments/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentType: normalizedContentType, // normalized here
          contentId,
          parentCommentId,
          text: replyText,
        }),
      });


      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setComments(prev =>
        prev.map(c => {
          const id = c._id || c.id;
          if (id !== parentCommentId) return c;

          return {
            ...c,
            replies: [data.reply, ...(c.replies || [])],
            stats: { ...c.stats, replies: (c.stats?.replies || 0) + 1 },
          };
        })
      );

      setReplyText("");
      setReplyingToId(null);
    } catch (err) {
      console.error("Reply failed", err);
    }
  };

  /* ---------------- Handle reply from child component ---------------- */
  const handleReply = async (parentCommentId, text) => {
    if (!token) return;

    try {
      const res = await fetch("/api/comments/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contentType, contentId, parentCommentId, text }),
      });

      if (!res.ok) return;

      fetchComments(); // refresh tree
    } catch (err) {
      console.error("Reply failed", err);
    }
  };

  const buildCommentTree = (comments) => {
  const map = {};
  const roots = [];

  comments.forEach(c => {
    c.replies = [];
    map[c._id] = c;
  });

  comments.forEach(c => {
    if (c.parentCommentId) {
      const parent = map[c.parentCommentId];
      if (parent) parent.replies.push(c);
    } else {
      roots.push(c);
    }
  });

  return roots;
};

  /* ---------------- UI STATES ---------------- */
  if (loading) return <div>Loading comments…</div>;
  if (!comments.length) return <div>No comments yet</div>;

  /* ---------------- Render ---------------- */
  return (
    <div className="comments-list">
      {comments.map(comment => {
        const commentId = comment._id || comment.id;
        const author = comment.author || comment.userId;
        const authorId = author?._id || author?.id;

        const isOwner =
          currentUserId &&
          authorId &&
          String(authorId) === String(currentUserId);

        return (
          <div key={commentId} className="comment-item">
            {/* Avatar */}
            <div className="comment-avatar">
              {author?.avatar ? (
                <img src={author.avatar} alt="avatar" />
              ) : (
                <div className="fallback-avatar">
                  <i className="fa-solid fa-user"></i>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="comment-body">
              <div className="comment-header">
                <a href={`/profile/${authorId}`} className="comment-author">
                  {author?.name || "User"}
                </a>

                {isOwner && (
                  <div className="comment-menu">
                    <i
                      className="fa-solid fa-ellipsis"
                      onClick={() =>
                        setActiveMenu(activeMenu === commentId ? null : commentId)
                      }
                    />
                    {activeMenu === commentId && (
                      <div className="comment-dropdown">
                        <button onClick={() => handleEdit(comment)}>Edit</button>
                        <button onClick={() => handleDelete(commentId)}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {editingId === commentId ? (
                <div className="comment-edit">
                  <input
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                  />
                  <button onClick={() => submitEdit(commentId)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <p className="comment-text">{comment.text}</p>
              )}

              {/* Actions */}
              <div className="comment-actions">
                <button onClick={() => setReplyingToId(commentId)}>Reply</button>
              </div>

              {/* Reply box */}
              {replyingToId === commentId && (
                <div className="comment-reply-box">
                  <input
                    placeholder="Write a reply…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                  />
                  <button onClick={() => submitReply(commentId)}>Reply</button>
                  <button
                    onClick={() => {
                      setReplyingToId(null);
                      setReplyText("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Replies */}
              {/* Show / Hide Replies button */}
              {comment.replies?.length > 0 && (
                <>
                {/* Replies */}
                <button
                  className="cmt-reply-toggle-btn"
                  onClick={() =>
                    setExpandedComments(prev => ({
                      ...prev,
                      [commentId]: prev[commentId] === undefined ? true : !prev[commentId],
                    }))
                  }
                >
                  {expandedComments[commentId]
                    ? "Hide Replies"
                    : `View Replies (${comment.replies?.length || 0})`}
                </button>


                {expandedComments[commentId] && (
                  <div className="cmt-replies-container">
                    {comment.replies && comment.replies.length > 0 ? (
                      comment.replies.map(reply => (
                        <div key={reply._id} className="cmt-reply-item">
                          <div className="cmt-reply-avatar">
                            {reply.author?.avatar ? (
                              <img src={reply.author.avatar} alt={reply.author.name} />
                            ) : (
                              <div className="cmt-reply-avatar-fallback">
                                <i className="fa-solid fa-user"></i>
                              </div>
                            )}
                          </div>

                          <div className="cmt-reply-body">
                            <strong className="cmt-reply-author">
                              {reply.author?.name || "User"}
                            </strong>
                            <p className="cmt-reply-text">{reply.text}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="cmt-no-replies">No replies yet</div>
                    )}
                  </div>
                )}

                </>
              )}


            </div>
          </div>
        );
      })}
    </div>
  );
}
