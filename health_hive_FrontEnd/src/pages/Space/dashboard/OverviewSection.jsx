import { useEffect, useState } from "react";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const StatCard = ({ label, value, icon }) => (
  <div style={{
    background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)",
    borderRadius: "12px", padding: "20px 24px", flex: 1, minWidth: "120px",
  }}>
    <div style={{ fontSize: "28px", fontWeight: 800 }}>{value ?? "—"}</div>
    <div style={{ fontSize: "13px", color: "var(--color-muted, #6b7280)", marginTop: "4px" }}>
      {icon} {label}
    </div>
  </div>
);

export default function OverviewSection({ space }) {
  const [memberCount, setMemberCount] = useState(space.memberCount ?? "…");
  const [postCount,   setPostCount]   = useState(null);

  useEffect(() => {
    // Fetch live member count
    fetch(`${BASE_URL}/api/spaces/slug/${space.slug}/members`)
      .then((r) => r.json())
      .then((d) => setMemberCount(d.members?.length ?? 0))
      .catch(() => {});
  }, [space.slug]);

  const adminCount = Array.isArray(space.admins) ? space.admins.length : 0;

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>Overview</h2>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
        <StatCard label="Members"             value={memberCount} icon="👥" />
        <StatCard label="Admins"              value={adminCount}  icon="⚙️" />
        <StatCard label="Visibility"          value={space.visibility === "private" ? "🔒 Private" : "🌐 Public"} icon="" />
        <StatCard label="Verification"        value={space.verificationStatus} icon="✅" />
        <StatCard label="Status"              value={space.status}             icon="📡" />
      </div>

      <div style={{ background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "12px", padding: "20px" }}>
        <h3 style={{ marginBottom: "12px", fontSize: "15px" }}>Space Details</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px" }}>
          <div><strong>Title:</strong> {space.title}</div>
          <div><strong>Slug:</strong> <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>/space/{space.slug}</code></div>
          <div><strong>Description:</strong> {space.description || "—"}</div>
          <div><strong>Created:</strong> {new Date(space.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
          {space.createdBy && (
            <div><strong>Created by:</strong> {space.createdBy.name} (@{space.createdBy.username})</div>
          )}
        </div>
      </div>
    </div>
  );
}