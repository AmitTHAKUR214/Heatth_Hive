import { useEffect, useState, useRef } from "react";
import CommentItem from "../../../components/CommentItem";
import Spinner from "../../../components/Spinner";

export default function UserReplies({ username }) {

  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loaderRef = useRef(null);

  const rawUser = localStorage.getItem("user");
  const currentUser = rawUser ? JSON.parse(rawUser) : null;
  const currentUserId = currentUser?._id || currentUser?.id || null;

  const token = localStorage.getItem("token");

  // ---------------- Fetch all user comments ----------------
  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/comments/user/${username}`);
        const data = await res.json();

        const userReplies = data.items.filter(c => c.parentCommentId);
        setReplies(userReplies);
        
      } catch (err) {
        console.error(err);
        setReplies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReplies();
  }, [username]);


  // ---------------- Helper functions ----------------
  const removeById = (list, id) =>
    list
      .filter(c => c._id !== id)
      .map(c => ({ ...c, replies: removeById(c.replies || [], id) }));

  const updateTextById = (list, id, text) =>
    list.map(c =>
      c._id === id ? { ...c, text } : { ...c, replies: updateTextById(c.replies || [], id, text) }
    );

  const addReplyById = (list, parentId, reply) =>
    list.map(c =>
      c._id === parentId ? { ...c, replies: [reply, ...(c.replies || [])] } : { ...c, replies: addReplyById(c.replies || [], parentId, reply) }
    );

  // ---------------- Actions ----------------
  const handleDelete = async (id) => {
    if (!token) return;
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/comments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setReplies(prev => removeById(prev, id));
  };

  const submitEdit = async (id, text) => {
    if (!token || !text.trim()) return;
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/comments/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });
    setReplies(prev => updateTextById(prev, id, text));
  };

  const submitReply = async (parentCommentId, text) => {
    if (!text.trim()) return;

    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/comments/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ parentCommentId, text }),
    });

    if (!res.ok) throw new Error("Reply failed");

    const newReply = await res.json();
    setReplies(prev => addReplyById(prev, parentCommentId, newReply));
  };

  if (loading) return <Spinner />;

  if (!replies.length) return <p style={{ opacity: 0.6 }}>No replies yet.</p>;

  return (
    <div className="comments-list">
    {replies.map(reply => (
      <div key={reply._id} className="reply-thread">

        {reply.parentComment && (
          <div className="parent-comment">
            <CommentItem
              comment={reply.parentComment}
              currentUserId={currentUserId}
              onDelete={() => {}}
              onEdit={() => {}}
              onReply={() => {}}
            />
          </div>
        )}

        <div className="reply-with-line">
          <CommentItem
            comment={reply}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onEdit={submitEdit}
            onReply={submitReply}
          />
        </div>

      </div>
    ))}


      <div ref={loaderRef} style={{ textAlign: "center", padding: "12px" }}>
        {/* Optional: infinite scroll */}
      </div>
    </div>
  );
}
