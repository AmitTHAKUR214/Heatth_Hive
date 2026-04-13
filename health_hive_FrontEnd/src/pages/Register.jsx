import { useState } from "react";
import { registerUser } from "../api/authapi";
import "./css/Register.css";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "",
  });

  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* =========================
     Helpers
  ========================= */
  const generateGuestPassword = () => crypto.randomUUID() + "_guest";
  const generateGuestEmail = () =>
    `guest_${crypto.randomUUID()}@guest.healthhive.local`;

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  /* =========================
     Browse as Guest (No API)
  ========================= */
  const handleBrowseGuest = () => {
    const guestUser = {
      id: crypto.randomUUID(),
      name: "Anonymous",
      role: "browse_guest",
      avatar: "/default-avatar.png",
      username: `guest_${crypto.randomUUID()}`,
    };

    localStorage.setItem("user", JSON.stringify(guestUser));
    navigate("/");
  };

  /* =========================
     Register User
  ======================== */
  // if (form.role === "browse_guest") {
  //   throw new Error("Browse guest should not submit registration form");
  // }  
  // currently not in use as it throwed error in registration

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        name: form.name || "Anonymous",
        role: form.role,
      };

      // =====================
      // Guest Registration
      // =====================
      if (form.role === "guest") {
        payload.email = generateGuestEmail();
        payload.password = generateGuestPassword();

        const res = await registerUser(payload);
        const user = res.data?.user;

        if (!user) throw new Error("Guest registration failed.");

        localStorage.setItem(
          "user",
          JSON.stringify({
            id: user.id,
            name: user.name,
            username: user.username,
            role: "guest",
            avatar: "/default-avatar.png",
          })
        );

        navigate("/");
        return;
      }

      // =====================
      // Normal Users
      // =====================
      if (!form.email || !form.password) {
        throw new Error("Email and password are required.");
      }

      if (!form.username) {
        throw new Error("Username is required.");
      }

      payload.email = form.email;
      payload.password = form.password;
      payload.username = form.username;
console.log("REGISTER PAYLOAD:", payload);
      await registerUser(payload);

      // Backend does NOT return user here (by design)
      setEmailSent(true);

      if (["doctor", "pharmacist"].includes(form.role)) {
        setMessage(
          "Registration successful. Email verification required. Professional verification pending."
        );
      } else {
        setMessage("Registration successful. Please verify your email.");
      }

      setForm({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <h2>Create your account</h2>
        <Link className="register-card-link" to="/">Go Home</Link>
        <Link className="register-card-link" to="/login">Login</Link>
        <p className="subtitle">Join HealthHive</p>

        {emailSent ? (
          <div className="email-sent-message">
            <h2>Verification Email Sent!</h2>
            <p>Check your inbox or spam folder, then login.</p>
          </div>
        ) : (
          <>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="">Select how you want to continue</option>
              <option value="browse_guest">Browse as Guest</option>
              <option value="guest">Register as Guest</option>
              <option value="student">Student</option>
              <option value="user">Normal User</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacist">Pharmacist</option>
            </select>

            {form.role === "browse_guest" && (
             <button
                type="button"
                onClick={handleBrowseGuest}
                disabled={loading}
              >
                Continue as Guest
              </button>
            )}

            {form.role && form.role !== "browse_guest" && (
              <form onSubmit={handleSubmit}>
                <input
                  name="name"
                  placeholder="Name (Default: Anonymous)"
                  value={form.name}
                  onChange={handleChange}
                  disabled={loading}
                />

                {form.role !== "guest" && (
                  <input
                    name="username"
                    placeholder="Username (unique, no spaces)"
                    value={form.username}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                )}

                {form.role !== "guest" && (
                  <>
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      disabled={loading}
                    />
                  </>
                )}

                <button type="submit" disabled={loading}>
                  Register
                </button>
              </form>
            )}
          </>
        )}

        {loading && <p>Setting things up for you…</p>}
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}