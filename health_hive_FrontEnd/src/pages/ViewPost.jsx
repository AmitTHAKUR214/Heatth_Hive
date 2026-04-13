import { useParams, useLocation, useNavigate } from "react-router-dom";
import { avatarSrc } from "../utils/avatarsrc.js";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import CommentsLists from "../components/CommentsList";
import ImageLightbox from "../components/ImageLightBox";
import dayjs from "dayjs";
import "./css/ViewPost.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ViewPost() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialItem = location.state?.postData || null;

  const [item, setItem] = useState(initialItem);
  const [loading, setLoading] = useState(!initialItem);
  const [error, setError] = useState(null);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);

  const token = useMemo(() => localStorage.getItem("token"), []);
  const textareaRef = useRef(null);

  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef(null);
  const dragged = useRef(false);

  const imageContainerRef = useCallback((node) => {
    if (!node) return;
    const handleWheel = (e) => {
      e.stopPropagation();
      e.preventDefault();
      node.scrollBy({ left: e.deltaY + e.deltaX, behavior: "smooth" });
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
  }, []);

  /* ================= SMART FETCH ================= */
  useEffect(() => {
    let cancelled = false;

    const fetchFullPost = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api/feed/${id}`);
        if (!res.ok) throw new Error("Post not found");
        const data = await res.json();
        if (!cancelled) setItem(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Only fetch if:
    // 1. No item
    // 2. OR item doesn't match current ID
    if (!item || item._id !== id) {
      fetchFullPost();
    } else {
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [id]);

  /* ================= Memoized Date ================= */
  const formattedDate = useMemo(() => {
    return item?.createdAt
      ? dayjs(item.createdAt).format("YYYY-MM-DD")
      : "";
  }, [item?.createdAt]);

  /* ================= Auto expand textarea ================= */
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      `${textareaRef.current.scrollHeight}px`;
  }, [commentText]);

  /* ================= Comment Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !token) return;

    setPosting(true);

    try {
      const res = await fetch(`${BASE_URL}/api/comments`, {
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

      if (!res.ok) throw new Error("Failed to post comment");

      setCommentText("");
      setCommentsRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <p>Loading post…</p>;
  if (error) return <p>{error}</p>;
  if (!item) return <p>Post not found</p>;

  const hasAvatar =
    typeof item.postedBy?.avatar === "string" &&
    item.postedBy.avatar.trim() !== "";

  return (
    <>
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-color, #0a0a0a)",
        borderBottom: "1px solid var(--border-color)",
        padding: "12px 16px",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "14px", fontWeight: 600,
            color: "var(--color-primary, #0ea5e9)",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
          ← Back
        </button>
      </div>
      <main className="viewpost-page">

        {/* HEADER */}
        <header className="viewpost-header">
          <div className="qa-poster">
            {hasAvatar && !avatarFailed ? (
              <img
                src={avatarSrc(item.postedBy.avatar)}
                className="qa-avatar"
                loading="lazy"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="qa-avatar fallback">
                <i className="fa-solid fa-user" />
              </div>
            )}

            <div className="viewpost-author">
              <strong
                className="clickable"
                onClick={() => navigate(`/profile/${item.postedBy.username}`)}
              >
                {item.postedBy?.name || "Anonymous"}
              </strong>

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

              <span>@{item.postedBy?.username || "notfound"}</span>
              <span className="post-date">{formattedDate}</span>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <article className="viewpost-body">
          <h1 className="viewpost-title">
            {item.title || "Untitled Post"}
          </h1>

          <p className="viewpost-text">
            {item.content || item.description || "No description"}
          </p>

          {/* IMAGES */}
          {item.images?.length > 0 && (
            <div
              ref={imageContainerRef}
              className="qa-images-container"
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                padding: "8px 0",
              }}
            >
              {item.images.map((img, index) => (
                <img
                  key={index}
                  src={`${BASE_URL}${img.path}`}
                  alt=""
                  loading="lazy"
                  className="qa-image"
                  draggable={false}
                  onClick={() => {
                    setLightboxIndex(index);
                    setLightboxOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {lightboxOpen && (
            <ImageLightbox
              images={item.images.map(img => ({
                path: `${BASE_URL}${img.path}`
              }))}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxOpen(false)}
            />
          )}
        </article>

        {/* COMMENT INPUT */}
        {token && (
          <section className="viewpost-comment-input">
            <form onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={posting}
                rows={1}
              />
              <button type="submit" disabled={posting}>
                {posting ? "Posting..." : "Post"}
              </button>
            </form>
          </section>
        )}

        {/* COMMENTS */}
        <section className="viewpost-comments">
          <CommentsLists
            contentType={item.type}
            contentId={item._id}
            refreshKey={commentsRefreshKey}
          />
        </section>
      </main>
    </>
  );
}