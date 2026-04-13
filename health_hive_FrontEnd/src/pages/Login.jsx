import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { getPUser, loginUser } from "../api/authapi";
import "./css/Login.css";

export default function Login() {
  const navigate = useNavigate();
  // const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ================== AUTH MESSAGE (FROM REDIRECT) ==================
  // const authMessage = location.state?.authMessage;

  // ================== EMAIL VERIFICATION MESSAGE ==================
  const params = new URLSearchParams(window.location.search);
  const verified = params.get("verified");

  useEffect(() => {
    if (verified === "true") {
      alert("Email verified successfully. Please login.");
    }
    if (verified === "expired") {
      alert("Verification link expired.");
    }
  }, [verified]);

  // ================== CURRENT USER ==================
  // const user = getPUser(); we dont need it yrt
 
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginUser(form);

      // Store auth data
      localStorage.setItem("user", JSON.stringify(res.data.user));
      localStorage.setItem("token", res.data.token);

      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ================== AUTH REDIRECT MESSAGE ================== */}
      {/* {authMessage && (
        <p
          className="error"
          style={{
            zIndex: "1",
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "var(--color-red)",
            borderRadius: "8px",
            maxWidth: "280px",
            color: "var(--color)",
            padding: "12px",
          }}
        >
          {authMessage}
        </p>
      )} */}

      {/* ================== LOGIN FORM ================== */}
      <div className="login-page">
        <div className="login-card">
          <h2>Login to HealthHive</h2>
         

          <form onSubmit={handleSubmit}> <Link className="Home_link_login_Page" to="/">Home</Link>
            <input
              name="email"
              type="email"
              placeholder="Email address"
              onChange={handleChange}
              required
              disabled={loading}
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              onChange={handleChange}
              required
              disabled={loading}
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          <p className="login-footer">
            Don’t have an account? <Link to="/register">Register Yourself</Link>
          </p>
        </div>
      </div>
    </>
  );
}
