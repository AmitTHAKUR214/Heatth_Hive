import { useState, lazy, Suspense, useEffect } from "react";
import { NavLink, useNavigate} from "react-router-dom";
import NotificationBell from "./NotificationBell";
import NavbarProfile from "./NavbarProfile";
import "./css/Navbar.css";

const FilterPopup = lazy(() => import("./FilterPopup"));

export default function Navbar() {
  const navigate = useNavigate();

  const [showPopup, setShowPopup] = useState(false);

  // Read once — no effect needed
  const [user] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark"
  );

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const handleFilterSubmit = ({ category, location }) => {
    navigate(
      `/mappage?place=${encodeURIComponent(
        location
      )}&category=${encodeURIComponent(category)}`
    );
  };

  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    const handler = (e) => setUnreadMsgs(e.detail);
    window.addEventListener("unread-count", handler);
    // fetch on mount
    const token = localStorage.getItem("token");
    if (token) {
      import("../api/messageApi").then(({ getInbox }) => {
        getInbox().then(res => {
          const total = (res.data.conversations || [])
            .reduce((sum, c) => sum + (c.unread || 0), 0);
          setUnreadMsgs(total);
        }).catch(() => {});
      });
    }
    return () => window.removeEventListener("unread-count", handler);
  }, []);

  return (
    <>
      <div className="navbar">
        <div className="navbar-section">
          <NavLink to="/" end replace className={({ isActive }) =>
             isActive ? "Nav-btn active" : "Nav-btn"}
          >
            <i className="fas fa-home nav-icon" title="Home" />
          </NavLink>

          <NavLink to="/spaces" className={({ isActive }) =>
              isActive ? "Nav-btn active" : "Nav-btn"}
          >
            <i className="fas fa-users nav-icon" title="Spaces" />
          </NavLink>

          <button
            className="Nav-btn"
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => window.dispatchEvent(new Event("toggle-messenger"))}
            title="Messages"
          >
            <i className="fas fa-comment-dots nav-icon" />
            {unreadMsgs > 0 && (
              <span style={{
                position: "absolute", top: "-4px", right: "-4px",
                background: "#ef4444", color: "white",
                fontSize: "10px", fontWeight: 700,
                minWidth: "16px", height: "16px",
                borderRadius: "8px", display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "0 3px",
              }}>
                {unreadMsgs > 99 ? "99+" : unreadMsgs}
              </span>
            )}
          </button>

          <NotificationBell />

          <div
            className="search-box-nav"
            onClick={() => setShowPopup(true)}
          >
            <i className="fas fa-search" />
            <input
              type="text"
              placeholder="Find medicine, hospitals and more"
              readOnly
            />
          </div>

          <div className="container">
            <div className="theme-switch">
              <div className="switch" onClick={toggleTheme} />
            </div>
          </div>

          <NavbarProfile user={user} />
        </div>
      </div>

      {showPopup && (
        <Suspense fallback={<div></div>}>
          <FilterPopup
            onClose={() => setShowPopup(false)}
            onSubmit={handleFilterSubmit}
          />
        </Suspense>
      )}
    </>
  );
}