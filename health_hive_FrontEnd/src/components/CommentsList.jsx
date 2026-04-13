import { useEffect, useState } from "react";
import CommentItem from "./CommentItem";
import "./css/CommentList.css"

export default function CommentsLists({ contentType, contentId, refreshKey, onCountLoad }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const BASE = import.meta.env.VITE_API_BASE_URL || "";

  const rawUser = localStorage.getItem("user");
  const currentUser = rawUser ? JSON.parse(rawUser) : null;
  const currentUserId = currentUser?._id || currentUser?.id || null;

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  /* ================= Unsaved state ================= */
  const [hasUnsavedInput, setHasUnsavedInput] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingClose, setPendingClose] = useState(null);

  /* ---------------- Fetch comments ---------------- */
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`${BASE}/api/comments/${contentType}/${contentId}`, {
          headers: authHeaders,
        });
        if (!res.ok) throw new Error("Failed to fetch comments");
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        if (onCountLoad) {
          const total = list.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
          onCountLoad(total);
        }
      } catch (err) {
        console.error(err);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchComments();
  }, [contentType, contentId, refreshKey]);

  /* ---------------- Tab close guard ---------------- */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedInput) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedInput]);

  /* ---------------- Recursive helpers ---------------- */
  const removeById = (list, id) =>
    list
      .filter(c => c._id !== id)
      .map(c => ({
        ...c,
        replies: removeById(c.replies || [], id),
      }));

  const addReplyById = (list, parentId, reply) =>
    list.map(c =>
      c._id === parentId
        ? { ...c, replies: [reply, ...(c.replies || [])] }
        : { ...c, replies: addReplyById(c.replies || [], parentId, reply) }
    );

  const updateTextById = (list, id, text) =>
    list.map(c =>
      c._id === id
        ? { ...c, text }
        : { ...c, replies: updateTextById(c.replies || [], id, text) }
    );

  /* ---------------- Actions ---------------- */
  const handleDelete = async (id) => {
    if (!token) return;
    await fetch(`${BASE}/api/comments/${id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    setComments(prev => removeById(prev, id));
  };

  const submitEdit = async (id, text) => {
    if (!token || !text.trim()) return;
    await fetch(`${BASE}/api/comments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ text }),
    });
    setComments(prev => updateTextById(prev, id, text));
    setHasUnsavedInput(false);
  };

  const submitReply = async (parentCommentId, text) => {
    if (!text.trim()) return;
    setHasUnsavedInput(false);
    const res = await fetch(`${BASE}/api/comments/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ contentType, contentId, parentCommentId, text }),
    });
    if (!res.ok) throw new Error("Reply failed");
    setLoading(true);
    const refreshed = await fetch(`${BASE}/api/comments/${contentType}/${contentId}`, {
      headers: authHeaders,
    });
    const data = await refreshed.json();
    setComments(data);
    setLoading(false);
  };

  /* ---------------- Close intent handler ---------------- */
  const requestClose = (callback) => {
    if (!hasUnsavedInput) {
      callback();
    } else {
      setPendingClose(() => callback);
      setShowUnsavedModal(true);
    }
  };

  const discardChanges = () => {
    setHasUnsavedInput(false);
    setShowUnsavedModal(false);
    if (pendingClose) pendingClose();
    setPendingClose(null);
  };

  if (loading) return <div>Loading comments…</div>;
  if (!comments.length) return <div>No comments yet</div>;

  return (
    <>
      <div className="comments-list">
        {comments.map(comment => (
          <CommentItem
            key={`comment-${comment._id}`}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onEdit={submitEdit}
            onReply={submitReply}
            setHasUnsavedInput={setHasUnsavedInput}
            requestClose={requestClose}
          />
        ))}
      </div>

      {/* ================= Unsaved Overlay ================= */}
      {showUnsavedModal && (
        <div className="overlay">
          <div className="confirm-box">
            <h4>Discard changes?</h4>
            <p>You have unsaved text. What would you like to do?</p>

            <div className="confirm-actions">
              <button onClick={() => setShowUnsavedModal(false)}>
                Continue editing
              </button>
              <button className="btn-danger" onClick={discardChanges}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}