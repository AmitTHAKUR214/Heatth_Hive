import React, { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPUser } from "../../../api/authapi";
import "../Spages/Spacedashboard.css";

const OverviewSection = lazy(() => import("../dashboard/OverviewSection"));
const AdminsSection   = lazy(() => import("../dashboard/AdminsSection"));
const MembersSection  = lazy(() => import("../dashboard/MembersSection"));
const SettingsSection = lazy(() => import("../dashboard/SettingsSection"));

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function SpaceDashboard() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const user       = getPUser();

  const [space,   setSpace]   = useState(null);
  const [section, setSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const fetchSpace = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) throw new Error("Space not found");
        const data = await res.json();
        setSpace(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSpace();
  }, [slug]);

  if (loading) return <p style={{ padding: "2rem" }}>Loading dashboard…</p>;
  if (error)   return <p style={{ padding: "2rem", color: "red" }}>{error}</p>;
  if (!user)   return <p style={{ padding: "2rem" }}>Please log in to access the dashboard.</p>;
  if (!space)  return null;

  // ✅ Allow both owner AND admins (memberRole comes from the slug endpoint)
  const userId    = user._id || user.id;
  const creatorId = space.createdBy?._id || space.createdBy?.id || space.createdBy;
  const isOwner   = userId && creatorId && String(userId) === String(creatorId);
  const isAdmin   = isOwner || space.memberRole === "admin";

  if (!isAdmin) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>You don't have access to this dashboard.</p>
        <button onClick={() => navigate(`/space/${slug}`)}>Back to Space</button>
      </div>
    );
  }

  const navItems = [
    { key: "overview", label: "📊 Overview" },
    { key: "admins",   label: "⚙️ Admins"   },
    { key: "members",  label: "👥 Members"  },
    { key: "settings", label: "🛠 Settings" },
  ];

  return (
    <div className="space-dashboard">
      <div className="dashboard-header">
        <h1>{space.title} — Dashboard</h1>
        <button onClick={() => navigate(`/space/${space.slug}`)}>← Back to Space</button>
      </div>

      <div className="dashboard-nav">
        {navItems.map(({ key, label }) => (
          <button key={key} className={section === key ? "active" : ""}
            onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        <Suspense fallback={<p>Loading…</p>}>
          {section === "overview" && <OverviewSection space={space} />}
          {section === "admins"   && <AdminsSection   space={space} setSpace={setSpace} />}
          {section === "members"  && <MembersSection  space={space} />}
          {section === "settings" && <SettingsSection space={space} setSpace={setSpace} />}
        </Suspense>
      </div>
    </div>
  );
}