import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

// Deterministic colour from space title — so cards without a banner still look distinct
const titleToColor = (title = "") => {
  const palette = [
    "#16a34a", "#0d9488", "#2563eb", "#7c3aed",
    "#db2777", "#ea580c", "#ca8a04", "#0891b2",
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export default function UserSpaces({ username }) {
  const [tab,     setTab]     = useState("joined");
  const [spaces,  setSpaces]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`${BASE_URL}/api/users/${username}/spaces?type=${tab}`)
      .then((res) => res.json())
      .then((data) => { setSpaces(data.spaces || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [username, tab]);

  return (
    <div style={{ padding: "4px 0" }}>

      {/* ── Tab switcher — green active state ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {["joined", "created"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 20px", borderRadius: "20px", cursor: "pointer",
            border: tab === t ? "none" : "1px solid var(--border-color, #e5e7eb)",
            background: tab === t ? "var(--color-g, #22c55e)" : "transparent",
            color: tab === t ? "white" : "var(--color)",
            fontWeight: 700, fontSize: "13px", transition: "all 0.15s",
          }}>
            {t === "joined" ? "Joined" : "Created"}
          </button>
        ))}
      </div>

      {/* ── States ── */}
      {loading && <SpacesSkeleton />}
      {!loading && spaces.length === 0 && (
        <EmptyState label={tab === "joined" ? "No spaces joined yet" : "No spaces created yet"} />
      )}

      {/* ── Grid ── */}
      {!loading && spaces.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "16px",
        }}>
          {spaces.map((space) => {
            const accentColor = titleToColor(space.title);
            return (
              <Link key={space._id} to={`/space/${space.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  borderRadius: "12px", overflow: "hidden",
                  border: "1px solid var(--border-color, #e5e7eb)",
                  background: "var(--card-bg, #1e293b)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  cursor: "pointer",
                  height:"200px",
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = `0 8px 24px ${accentColor}33`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Banner — image if available, else gradient from accent color */}
                  <div style={{
                    height: "64px",
                    background: space.banner
                      ? `url(${space.banner}) center/cover`
                      : `linear-gradient(135deg, ${accentColor}cc, ${accentColor}55)`,
                    position: "relative",
                  }}>
                    {/* Floating icon */}
                    <div style={{
                      position: "absolute", bottom: "-18px", left: "14px",
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: "var(--card-bg, #1e293b)",
                      border: `2px solid ${accentColor}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "18px",
                    }}>
                      {space.icon || "📌"}
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: "26px 14px 14px" }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {space.title}
                    </h3>

                    {space.description && (
                      <p style={{
                        fontSize: "12px", color: "var(--color-3, #94a3b8)",
                        margin: "0 0 10px", lineHeight: 1.5,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",height:"100%",maxHeight:"40px"
                      }}>
                        {space.description}
                      </p>
                    )}

                    {/* Footer row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px",
                        borderRadius: "6px",
                        background: space.visibility === "private" ? "#1e293b" : `${accentColor}22`,
                        color: space.visibility === "private" ? "#94a3b8" : accentColor,
                        border: `1px solid ${space.visibility === "private" ? "#334155" : `${accentColor}44`}`,
                      }}>
                        {space.visibility === "private" ? "🔒 Private" : "🌐 Public"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--color-3, #94a3b8)", marginLeft: "auto" }}>
                        👥 {space.memberCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0", opacity: 0.5 }}>
      <p style={{ fontSize: "32px", margin: "0 0 8px" }}>🌌</p>
      <p style={{ fontSize: "14px" }}>{label}</p>
    </div>
  );
}

function SpacesSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          borderRadius: "12px", overflow: "hidden",
          border: "1px solid var(--border-color, #e5e7eb)",
          background: "var(--card-bg, #1e293b)",
        }}>
          <div style={{ height: "64px", background: "var(--border-color, #334155)" }} />
          <div style={{ padding: "26px 14px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ height: "14px", borderRadius: "6px", background: "var(--border-color, #334155)", width: "70%" }} />
            <div style={{ height: "12px", borderRadius: "6px", background: "var(--border-color, #334155)", width: "90%" }} />
            <div style={{ height: "12px", borderRadius: "6px", background: "var(--border-color, #334155)", width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}