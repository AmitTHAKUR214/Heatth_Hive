import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle input changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Make POST request to backend
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/auth/login`,
        form,
        { headers: { "Content-Type": "application/json" } } // ensure JSON
      );

      // ✅ DEBUG: log full response to see structure
      console.log("Login Response:", res.data);

      // Check if admin exists in response
      if (!res.data.admin) {
        throw new Error("Admin details not returned from server");
      }

      // ✅ Store admin and token safely
      localStorage.setItem("admin", JSON.stringify(res.data.admin));
      localStorage.setItem("token", res.data.token);

      // ✅ Remove previous user login (if any)
      localStorage.removeItem("user");

      // ✅ Redirect to admin dashboard
      navigate("/admin");
    } catch (err) {
      console.error("Login Error:", err);

      // Display error message from backend if available
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "var(--bg-color)",
        color: "var(--color)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--card-bg)",
          padding: "2rem",
          borderRadius: "0.5rem",
          width: "300px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
          Admin Login
        </h2>

        {error && (
          <p style={{ color: "var(--color-red)", textAlign: "center" }}>
            {error}
          </p>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              marginTop: "0.25rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--border-color)",
              background: "var(--bg-color)",
              color: "var(--color)",
            }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              marginTop: "0.25rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--border-color)",
              background: "var(--bg-color)",
              color: "var(--color)",
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.5rem",
            background: "var(--color-gd)",
            border: "none",
            borderRadius: "0.25rem",
            color: "var(--bg-color)",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}