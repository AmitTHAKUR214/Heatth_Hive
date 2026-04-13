import { useState, useEffect, useRef } from "react";
import "./AskPost.css";
import { createQuestion, createPost } from "../api/QAapi.js";
import AuthRequiredModal from  "../components/AuthRequiredModal.jsx"
import { Navigate } from "react-router-dom";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

function AskPost({ isOpen, activeTab = "ask", onClose, spaceId = null, spaceName = null }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [tab, setTab] = useState(activeTab);

  const DRAFT_KEY = spaceId ? `askpost_draft_space_${spaceId}` : "askpost_draft_v1";

  const imageInputId = tab === "ask" ? "askImageInput" : "postImageInput";
  const [preview, setPreview] = useState(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ Topic suggestions
  const [topicInput,       setTopicInput]       = useState("");
  const [topicSuggestions, setTopicSuggestions] = useState([]);
  const suggestionsRef = useRef(null);

  const MAX_IMAGES = 7;
  const [form, setForm] = useState({
    title: "",
    content: "",
    images: [],
    topics: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setIsDirty(true);
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCloseAttempt = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    setShowConfirm(true);
  };

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

// return image that belong ===========================
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    if (!form.images || form.images.length === 0) {
      setPreviews([]);
      return;
    }

    const urls = form.images.map(file => URL.createObjectURL(file));
    setPreviews(urls);

    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [form.images]);

// ===================================================

const stripRef = useRef(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    const mouseDown = (e) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const mouseLeave = () => isDown = false;
    const mouseUp = () => isDown = false;

    const mouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener("mousedown", mouseDown);
    el.addEventListener("mouseleave", mouseLeave);
    el.addEventListener("mouseup", mouseUp);
    el.addEventListener("mousemove", mouseMove);

    return () => {
      el.removeEventListener("mousedown", mouseDown);
      el.removeEventListener("mouseleave", mouseLeave);
      el.removeEventListener("mouseup", mouseUp);
      el.removeEventListener("mousemove", mouseMove);
    };
  }, []);
// =========================================================

  // ✅ Fetch topic suggestions (debounced 300ms)
  useEffect(() => {
    if (!topicInput.trim()) {
      setTopicSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res  = await fetch(`${BASE_URL}/api/feed/topics/suggestions?q=${topicInput.replace(/^#/, "")}`);
        const data = await res.json();
        setTopicSuggestions(data.filter(t => !form.topics.includes(t)));
      } catch {
        setTopicSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [topicInput, form.topics]);

  // ✅ Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setTopicSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addTopic = (value) => {
    const clean = value.trim().replace(/^#/, "");
    if (clean && !form.topics.includes(clean)) {
      setForm(prev => ({ ...prev, topics: [...prev.topics, clean] }));
      setIsDirty(true);
    }
    setTopicInput("");
    setTopicSuggestions([]);
  };

// =========================================================
  // saves data from refresh 🔥
  useEffect(() => {
  const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      setForm(prev => ({
        ...prev,
        title: parsed.title || "",
        content: parsed.content || "",
        topics: parsed.topics || [],
        images: []
      }));

      setIsDirty(true);
    } catch (e) {
      console.warn("Failed to restore draft");
    }
  }, []);

  // this one also helps in it 🔥
  useEffect(() => {
  if (!isDirty) return;

  const timeout = setTimeout(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: form.title,
        content: form.content,
        topics: form.topics
      })
    );
  }, 400);

  return () => clearTimeout(timeout);
}, [form.title, form.content, form.topics, isDirty]);

// ============================================================

  if (!isOpen) return null;

  if (!user) {
    return (
      <AuthRequiredModal
        isOpen={true}
        onClose={onClose}
      />
    );
  }
  // to return guest user from doing any action
  if (user?.role === "guest") {
   return (
    <Navigate
      to="/login"
      replace
      state={{ authMessage: "Guest access is limited. Please login or register as a user to continue." }}
    />
  );
  }


const handleSubmit = async () => {
  try {
    if (!user) return;

    if (!form.title.trim() || !form.content.trim()) {
      alert("Title and content are required");
      return;
    }

    if (form.images.length > MAX_IMAGES) {
      alert(`You can upload up to ${MAX_IMAGES} images only`);
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("content", form.content);

    form.images.forEach(file => fd.append("images", file));

    if (form.topics.length > 0) {
      fd.append("topics", JSON.stringify(form.topics));
    }

    if (spaceId) {
      fd.append("spaceId", spaceId);
    }
    // before await createQuestion(fd)
    for (let [key, value] of fd.entries()) {
      console.log(key, value);
    }
    if (tab === "ask") {
      await createQuestion(fd);
    } else {
      await createPost(fd);
    }

    resetForm();
    localStorage.removeItem(DRAFT_KEY);
    setIsDirty(false);
    onClose();
    
  } catch (error) {
    console.error("Submission failed", error.response?.data || error);
    alert(error.response?.data?.message || "Failed to submit");
  }
};

  const resetForm = () => {
    setForm({
      title: "",
      content: "",
      images: [],
      topics: []
    });
    setTopicInput("");
    setTopicSuggestions([]);
    setIsDirty(false);
  };


  return (
    <>
      <div className="askpost-overlay">
        <div className="askpost-modal">

          {/* Header */}
          <div className="askpost-header">
            <div className="askpost-tabs">
              <button
                className={tab === "ask" ? "active" : ""}
                onClick={() => setTab("ask")}
              >
                Ask
              </button>
              <button
                className={tab === "post" ? "active" : ""}
                onClick={() => setTab("post")}
              >
                Post
              </button>
            </div>

            {spaceName && (
              <span style={{ fontSize: "11px", color: "#6b7280" }}>
                📌 Posting in <strong style={{ color: "var(--color-g, #22c55e)" }}>{spaceName}</strong>
              </span>
            )}

            <button className="close-btn" onClick={handleCloseAttempt}>
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="askpost-body">

            {/* ASK TAB */}
            {tab === "ask" && (
              <>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Start your question with What, Why, How, etc."
                  value={form.title}
                  onChange={handleChange}
                />

                <textarea
                  name="content"
                  required
                  placeholder="Add more details (optional)"
                  value={form.content}
                  onChange={handleChange}
                />
              </>
            )}

            {/* POST TAB */}
            {tab === "post" && (
              <>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Write something"
                  value={form.title}
                  onChange={handleChange}
                />

                <textarea
                  name="content"
                  required
                  placeholder="Say something..."
                  value={form.content}
                  onChange={handleChange}
                />
              </>
            )}

            {/* ================= SHARED IMAGE UPLOAD ================= */}
           {form.images.length < MAX_IMAGES && (
            <div className="image-upload">
              <label htmlFor={imageInputId} className="image-upload-btn">
                <i className="fa-regular fa-image"></i>Add Image
                <span>
                  {form.images.length}/{MAX_IMAGES} 
                </span>
              </label>

             <input
                id={imageInputId}
                type="file"
                accept="image/*"
                name="images"       // ✅ matches multer backend
                multiple
                hidden
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files);
                  setForm(prev => {
                    const remainingSlots = MAX_IMAGES - prev.images.length;
                    const filesToAdd = selectedFiles.slice(0, remainingSlots);
                    return { ...prev, images: [...prev.images, ...filesToAdd] };
                  });
                  setIsDirty(true);
                  e.target.value = "";
                }}
              />

              </div>
              )}


            {/* ================= IMAGE PREVIEW STRIP ================= */}
           {previews.length > 0 && (
            
            <div className="image-preview-strip">
              {previews.map((url, index) => (
                <div key={index} className="image-preview-item">
                  <img src={url} alt={`preview-${index}`} />
                  <button 
                  className="image-preview-button"
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== index)
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}


            {/* ================= TOPICS with suggestions ================= */}
            <div className="topic-input" style={{ position: "relative" }} ref={suggestionsRef}>
              <input
                type="text"
                placeholder="Add topic and press Enter (e.g. #diabetes)"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && topicInput.trim()) {
                    e.preventDefault();
                    addTopic(topicInput);
                  }
                }}
              />

              {/* ✅ Suggestions dropdown */}
              {topicSuggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                  background: "var(--bg-2, #1e293b)",
                  border: "1px solid var(--border-color, #334155)",
                  borderRadius: "8px", overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                  marginTop: "4px",
                }}>
                  {topicSuggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      onMouseDown={(e) => { e.preventDefault(); addTopic(suggestion); }}
                      style={{
                        padding: "8px 12px", cursor: "pointer",
                        fontSize: "13px", color: "var(--color)",
                        borderBottom: i < topicSuggestions.length - 1
                          ? "1px solid var(--border-color, #334155)"
                          : "none",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-g, #22c55e)18"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ color: "var(--color-g, #22c55e)", marginRight: "4px" }}>#</span>
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="topic-chips">
              {form.topics.map((t, i) => (
                <span key={i} className="topic-chip">
                  #{t}
                  <button
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        topics: prev.topics.filter(x => x !== t)
                      }))
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="askpost-footer">
            <button className="cancel-btn" onClick={handleCloseAttempt}>
              Cancel
            </button>

            <button
              type="button"
              className="askpost-submit-btn"
              onClick={handleSubmit}
            >
              {tab === "ask" ? "Add Question" : "Post"}
            </button>
          </div>

          {/* Discard confirm */}
          {showConfirm && (
            <div className="discard-overlay">
              <div className="discard-modal">
                <h3>Discard your changes?</h3>
                <p>Your draft will be lost.</p>

              <section style={{display:'flex', gap:"4px",justifyContent:"space-between"}}>
                  <button className="ask-post-btn-secondary" onClick={() => setShowConfirm(false)}>
                  Continue editing
                </button>
                <button
                className="ask-post-btn-danger"
                  onClick={() => {
                    resetForm();
                    localStorage.removeItem(DRAFT_KEY);
                    setShowConfirm(false);
                    onClose();
                  }}
                >
                  Discard
                </button>
              </section>
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthRequiredModal
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
      />
    </>
  );
}

export default AskPost;