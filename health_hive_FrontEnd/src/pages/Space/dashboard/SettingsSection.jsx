import { useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

export default function SettingsSection({ space, setSpace }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title:       space.title       || "",
    description: space.description || "",
    icon:        space.icon        || "📌",
    banner:      space.banner      || "",
    visibility:  space.visibility  || "public",
  });
  const [theme, setTheme] = useState({
    primary:    space.theme?.primary    || "#4f46e5",
    accent:     space.theme?.accent     || "#22c55e",
    background: space.theme?.background || "#f8fafc",
  });
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const [danger,  setDanger]  = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return showToast("Title is required", "error");
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/spaces/slug/${space.slug}`, {
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
      showToast("✅ Settings saved");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const ColorRow = ({ label, field }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <span style={{ width: "90px", fontSize: "13px", fontWeight: 500 }}>{label}</span>
      <input type="color" value={theme[field]}
        onChange={(e) => setTheme({ ...theme, [field]: e.target.value })}
        style={{ width: "36px", height: "36px", border: "none", padding: 0, cursor: "pointer", borderRadius: "6px" }} />
      <input type="text" value={theme[field]}
        onChange={(e) => setTheme({ ...theme, [field]: e.target.value })}
        style={{ width: "90px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-color, #e5e7eb)", fontFamily: "monospace", fontSize: "12px", background: "var(--bg-color)", color: "var(--color)" }} />
      <span style={{ width: 24, height: 24, borderRadius: "50%", background: theme[field], display: "inline-block", border: "1px solid #e5e7eb", flexShrink: 0 }} />
    </div>
  );

  const Field = ({ label, children }) => (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--color-muted, #6b7280)" }}>
        {label}
      </label>
      {children}
    </div>
  );

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid var(--border-color, #e5e7eb)",
    background: "var(--bg-color)", color: "var(--color)",
    fontSize: "14px", boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ maxWidth: "560px" }}>
      <h2 style={{ marginBottom: "24px" }}>Space Settings</h2>

      {/* ── Basic Info ── */}
      <div style={{ background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Basic Info</h3>

        <Field label="Space Name">
          <input style={inputStyle} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>

        <Field label="Description">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        <div style={{ display: "flex", gap: "16px" }}>
          <Field label="Icon (emoji)">
            <input style={{ ...inputStyle, width: "70px", fontSize: "22px", textAlign: "center" }}
              value={form.icon} maxLength={2}
              onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>

          <Field label="Visibility">
            <select style={{ ...inputStyle, width: "160px" }} value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private</option>
            </select>
          </Field>
        </div>

        <Field label="Banner URL">
          <input style={inputStyle} placeholder="https://..." value={form.banner}
            onChange={(e) => setForm({ ...form, banner: e.target.value })} />
          {form.banner && (
            <img src={form.banner} alt="Banner preview" onError={(e) => e.target.style.display = "none"}
              style={{ marginTop: "8px", width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px" }} />
          )}
        </Field>
      </div>

      {/* ── Theme ── */}
      <div style={{ background: "var(--card-bg, #f9fafb)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" }}>Theme Colors</h3>
        <ColorRow label="Primary"    field="primary"    />
        <ColorRow label="Accent"     field="accent"     />
        <ColorRow label="Background" field="background" />
        {/* Mini preview strip */}
        <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>Preview:</span>
          <div style={{ flex: 1, height: "28px", borderRadius: "6px", background: theme.background, border: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 8px", gap: "6px" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: theme.primary, display: "inline-block" }} />
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: theme.accent,  display: "inline-block" }} />
            <span style={{ fontSize: "11px", color: theme.primary, fontWeight: 700 }}>{form.title || "Space Name"}</span>
          </div>
        </div>
      </div>

      {/* ── Save ── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "32px" }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "10px 24px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "14px", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={() => navigate(`/space/${space.slug}/settings`)}
          style={{ padding: "10px 16px", background: "none", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: "8px", cursor: "pointer", fontSize: "14px", color: "#6b7280" }}>
          Full Editor →
        </button>
      </div>

      {/* ── Danger Zone ── */}
      <div style={{ border: "1px solid #fca5a5", borderRadius: "12px", padding: "20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚠️ Danger Zone</h3>
        {!danger ? (
          <button onClick={() => setDanger(true)}
            style={{ padding: "8px 16px", background: "none", border: "1px solid #ef4444", color: "#ef4444", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
            Delete this Space
          </button>
        ) : (
          <div>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "10px" }}>
              This will permanently delete the space and all its content. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setDanger(false)}
                style={{ padding: "7px 14px", background: "none", border: "1px solid #e5e7eb", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                Cancel
              </button>
              <button
                style={{ padding: "7px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                onClick={() => showToast("Delete endpoint not yet wired up", "error")}>
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>

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
}