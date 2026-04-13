import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./css/Sidebar.css";
import AuthRequiredModal from "../components/AuthRequiredModal.jsx";

const SpaceSkeleton = () => (
  <div className="space-skeleton">
    <div className="space-skeleton-icon"></div>
    <div className="space-skeleton-text"></div>
  </div>
);

function Sidebar({ isOpen, onClose }) {
  const user = JSON.parse(localStorage.getItem("user"));
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/spaces`)
      .then((res) => res.json())
      .then((data) => {
        setSpaces(data.filter((s) => s.status === "active"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // if (!isOpen) return null;

  const handleCreateSpace = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    navigate("/create-space");
  };

  return (
    <>
      {showAuthModal && (
        <AuthRequiredModal
          isOpen={true}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-toggle-section"> 
         <h2 className={`Hh-Title ${collapsed ? "collapsed" : "expanded"}`}>
          HealthHive
        </h2>

          <button className="sidebar-toggle"
          title={collapsed ? "Expand sidebar" : "Close sidebar"}
            onClick={() => setCollapsed(prev => !prev)} >
            {collapsed ? "➡" : "⬅"}
          </button>
        </div>

        <button className="create-space-btn" onClick={handleCreateSpace} title="Create Space">
          <span className="icon">➕</span>
          {!collapsed && <span>Create Space</span>}
        </button>

        <Link to="/online" className="create-space-btn" title="Who's Online" style={{ textDecoration: "none" }}>
          <span className="icon">🟢</span>
          {!collapsed && <span>Who's Online</span>}
        </Link>

        <div className="spaces-section">
        {!collapsed && <h4 className="spaces-title">Spaces</h4>}

          <div className="spaces-list">
            {loading
              ? [1, 2, 3, 4, 5].map((i) => <SpaceSkeleton key={i} />)
              : spaces.slice(0, 10).map((space) => (  //this ;imits it to showing 10 spaces only
                  <Link
                    key={space._id}
                    to={`/space/${space.slug}`}
                    className="space-link"
                  >
                    <div className="sidebar-space-item" title={space.title}>
                      <div className="sidebar-space-icon">
                        {space.icon || "📌"}
                      </div>
                      {!collapsed && (
                        <span className="sidebar-space-name">{space.title}</span>
                      )}
                    </div>
                  </Link>
                ))}
          </div>
            <div className="Ex-more">
              <Link to="/spaces" className="Ex-more-link" title="Explore spaces">
                {collapsed ? "➡" : "Explore More ➡"}
              </Link>
            </div>

        </div>

        <Link to="/pharmacies" className="create-space-btn" title="Find Pharmacies" style={{ textDecoration: "none" }}>
          <span className="icon">🏪</span>
          {!collapsed && <span>Find Pharmacies</span>}
        </Link>
        <div className={`sidebar-footer ${collapsed ? "collapsed" : ""}`}>
          <a href="#">. About</a>  <a href="#">. Careers</a> {" "}
          <a href="#">. Terms</a>  <a href="#">. Privacy</a>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;