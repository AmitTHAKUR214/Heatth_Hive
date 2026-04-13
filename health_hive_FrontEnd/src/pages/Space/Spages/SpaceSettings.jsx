import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./SpaceSettings.css";
import SpacePreview from "./SpacePreview";
import { getPUser } from "../../../api/authapi";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const SpaceSettings = () => {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const user       = getPUser();

  const [space,   setSpace]   = useState(null);
  const [form,    setForm]    = useState({ title: "", description: "", icon: "📌", banner: "", visibility: "public" });
  const [theme,   setTheme]   = useState({ primary: "#4f46e5", accent: "#22c55e", background: "#f8fafc" });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchSpace = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) throw new Error("Space not found");
        const data = await res.json();
        setSpace(data);
        setForm({
          title:       data.title        || "",
          description: data.description  || "",
          icon:        data.icon         || "📌",
          banner:      data.banner       || "",
          visibility:  data.visibility   || "public",
        });
        if (data.theme) setTheme(data.theme);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSpace();
  }, [slug]);

  if (loading) return <div>Loading settings...</div>;
  if (error)   return <div>{error}</div>;
  if (!space)  return null;

  // ✅ Fixed auth check — space.createdBy is a populated object
  const userId    = user?._id || user?.id;
  const creatorId = space.createdBy?._id || space.createdBy?.id || space.createdBy;
  const isAdmin   = userId && creatorId && String(userId) === String(creatorId);

  // Also allow SpaceMember admins
  const isSpaceAdmin = isAdmin || space.memberRole === "admin";

  if (!isSpaceAdmin) return <div style={{ padding: "2rem" }}>Not authorized to edit this space.</div>;

  const handleSave = async () => {
    if (!form.title.trim()) return showToast("Title is required", "error");
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ ...form, theme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSpace(data);
      showToast("✅ Space updated successfully");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const ColorRow = ({ label, field }) => (
    <div className="color-row">
      <label>{label}</label>
      <input type="color" value={theme[field]}
        onChange={(e) => setTheme({ ...theme, [field]: e.target.value })} />
      <input type="text" value={theme[field]}
        onChange={(e) => setTheme({ ...theme, [field]: e.target.value })}
        style={{ width: "90px", fontFamily: "monospace" }} />
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: theme[field], display: "inline-block", border: "1px solid #e5e7eb" }} />
    </div>
  );

  return (
    <div className="space-editor-layout">
      <section>
        {/* LEFT — Editor */}
        <div className="space-settings">
          <h1>Space Editor</h1>

          <label>Space Name
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>

          <label>Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </label>

          <label>Icon (emoji)
            <input value={form.icon} maxLength={2} onChange={(e) => setForm({ ...form, icon: e.target.value })}
              style={{ width: "60px", fontSize: "22px", textAlign: "center" }} />
          </label>

          <label>Banner URL
            <input value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })}
              placeholder="https://..." />
          </label>

          <label>Visibility
            <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private</option>
            </select>
          </label>

          {/* Theme */}
          <div className="theme-editor">
            <h3>Theme Colors</h3>
            <ColorRow label="Primary"    field="primary"    />
            <ColorRow label="Accent"     field="accent"     />
            <ColorRow label="Background" field="background" />
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <button onClick={handleSave} disabled={saving} className="save-btn">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={() => navigate(`/space/${slug}`)} style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}>
              Back to Space
            </button>
          </div>
        </div>

        {/* RIGHT — Live Preview */}
        <SpacePreview data={form} theme={theme} />
      </section>

      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600,
        }}>{toast.msg}</div>
      )}
    </div>
  );
};

export default SpaceSettings;