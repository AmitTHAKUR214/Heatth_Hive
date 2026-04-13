import { useEffect, useState } from "react";
import { avatarSrc } from "../utils/avatarsrc.js";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import FeedCard from "../components/FeedCard";
import Navbar from "../components/Navbar";
import { OnlineDot } from "../utils/onlineStatus.jsx";
import "../QA/QuestionsList.css";
import "./searchResults.css";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const ROLE_BADGE = {
  doctor:     { label: "Doctor",     color: "#0ea5e9", bg: "#e0f2fe" },
  pharmacist: { label: "Pharmacist", color: "#8b5cf6", bg: "#ede9fe" },
  student:    { label: "Student",    color: "#f59e0b", bg: "#fef3c7" },
};

function UserCard({ u }) {
  const badge    = ROLE_BADGE[u.role];
  const verified = u.isRoleVerified;
  const dp       = u.doctorProfile;
  const ph       = u.pharmacy;

  return (
    <Link to={`/profile/${u.username}`} className="sr-user-card">
      <div className="sr-user-avatar">
        {u.avatar
          ? <img src={avatarSrc(u.avatar)} alt={u.name} />
          : <span>{u.name?.[0]?.toUpperCase() || "?"}</span>}
        <OnlineDot lastSeen={u.lastSeen} size={11} style={{ position: "absolute", bottom: 1, right: 1, border: "2px solid var(--card-bg, white)" }} />
      </div>

      <div className="sr-user-info">
        <div className="sr-user-top">
          <span className="sr-user-name">{u.name}</span>
          {badge && (
            <span className="sr-badge" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
          )}
          {verified && (
            <span className="sr-badge" style={{ color: "#166534", background: "#dcfce7" }}>✓ Verified</span>
          )}
        </div>
        <span className="sr-user-username">@{u.username}</span>
        {dp?.specialty && (
          <span className="sr-user-meta">🩺 {dp.specialty}</span>
        )}
        {ph?.name && (
          <span className="sr-user-meta">🏪 {ph.name}</span>
        )}
        {u.role === "doctor" && dp?.availableForConsultation && (
          <span className="sr-available">● Available for consultation</span>
        )}
      </div>
    </Link>
  );
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q");

  const [users,   setUsers]   = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState("all"); // all | people | content

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError("");
    axios.get(`${BASE}/api/search?q=${encodeURIComponent(query)}`)
      .then(res => {
        // handle both old array response and new { users, content } shape
        if (Array.isArray(res.data)) {
          setUsers([]);
          setContent(res.data);
        } else {
          setUsers(res.data.users   || []);
          setContent(res.data.content || []);
        }
      })
      .catch(() => setError("Search failed"))
      .finally(() => setLoading(false));
  }, [query]);

  const showUsers   = tab === "all" || tab === "people";
  const showContent = tab === "all" || tab === "content";

  return (
    <>
      <Navbar />
      <div className="qa-container">
        <h2 className="qa-title">Results for "{query}"</h2>

        {/* Tab pills */}
        <div className="sr-tabs">
          {[["all", "All"], ["people", `People${users.length ? ` (${users.length})` : ""}`], ["content", `Posts & Questions${content.length ? ` (${content.length})` : ""}`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`sr-tab ${tab === key ? "active" : ""}`}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p style={{ padding: "2rem", opacity: 0.5 }}>Searching…</p>}
        {error   && <p style={{ padding: "1rem", color: "#ef4444" }}>{error}</p>}

        {!loading && !error && (
          <>
            {/* People section */}
            {showUsers && users.length > 0 && (
              <div className="sr-section">
                <h3 className="sr-section-title">People</h3>
                <div className="sr-user-grid">
                  {users.map(u => <UserCard key={u._id} u={u} />)}
                </div>
              </div>
            )}

            {/* Content section */}
            {showContent && content.length > 0 && (
              <div className="sr-section">
                {tab === "all" && <h3 className="sr-section-title">Posts & Questions</h3>}
                {content.map(item => (
                  <FeedCard key={item._id} item={item} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && users.length === 0 && content.length === 0 && (
              <p style={{ padding: "2rem 0", opacity: 0.5 }}>No results found for "{query}"</p>
            )}
          </>
        )}
      </div>
    </>
  );
}