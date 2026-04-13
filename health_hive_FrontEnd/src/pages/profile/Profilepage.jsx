import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getUserProfileByUsername } from "../../api/userProfileApi";
import AskPost from "../../QA/AskPost";

import "../../QA/QuestionsList.css"
import "./profilestyles/profile.css";
import "./profilestyles/profileUi.css";
import Navbar from "../../components/Navbar";
import ProfileHeader from "./ProfilePages/ProfileHeader";
import ProfileTabs from "./profileTabs/ProfileTabs";

function ProfileSkeleton() {
  return (
    <>
    <div className="profile-skeleton">
      {/* Avatar */}
      <div 
      className="skeleton-circle avatar-skeleton"
      style={{width:"80px",height:"80px",borderRadius:"50%"}}
      ></div>
      
      {/* Name */}
      <div className="skeleton-line name-skeleton"></div>
      
      {/* Bio */}
      <div className="skeleton-line bio-skeleton"></div>
      <div className="skeleton-line bio-skeleton short"></div>

      {/* Tabs */}
      <div className="skeleton-tabs">
        <div className="skeleton-line tab-skeleton"></div>
        <div className="skeleton-line tab-skeleton"></div>
        <div className="skeleton-line tab-skeleton"></div>
      </div>
    </div>   
    </>
  );
}
function Skeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-desc" />
      <section style={{display:"flex",gap:"4px"}}>
        <div className="skeleton-line skeleton-desc short" />
        <div className="skeleton-line skeleton-desc short" />
        <div className="skeleton-line skeleton-desc short" />
        <div className="skeleton-line skeleton-desc short" />
      </section>
      
      <div className="skeleton-actions">
        <span className="skeleton-circle"></span>
        <span className="skeleton-circle"></span>
        <span className="skeleton-circle"></span>
        <span className="skeleton-circle"></span>
      </div>
    </div>
  );
}
// 
export default function ProfilePage() {
  const { username } = useParams();

  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab,    setActiveTab]    = useState("posts");
  const [showAskPost,  setShowAskPost]  = useState(false);
  const [askTab,       setAskTab]       = useState("post");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!username) return;
    hasFetched.current = false;

    const fetchUser = async () => {
      try {
        if (!hasFetched.current) setLoading(true);
        const data = await getUserProfileByUsername(username.toLowerCase());

        const currentUser = (() => {
          try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
        })();

        const minimalUser = {
          id:         data.profile._id || data.profile.id,
          username:   data.profile.username,
          name:       data.profile.name,
          avatar:     data.profile.avatar,
          bio:        data.profile.bio,
          role:       data.profile.role,
          isVerified: data.profile.isVerified,
          lastSeen:   data.profile.lastSeen,
          isOnline:   data.profile.isOnline,
          isOwn:      currentUser?.username === data.profile.username,
          viewerId:   currentUser?.id || currentUser?._id,
          viewerRole: currentUser?.role,
        };

        setUser(minimalUser);
        hasFetched.current = true;
        setError(null);
      } catch (err) {
        console.error("Profile fetch failed:", err);
        setError("Profile not found");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [username]);

  const handleProfileUpdate = (updated) => {
    setUser(prev => ({ ...prev, name: updated.name, bio: updated.bio }));
  };

  if (loading) {
    return (
      <div className="profile_mainpage_container">
        <Navbar />
        <div className="profile-page">
          <ProfileSkeleton />
          <div>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
        </div>
        
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="profile_mainpage_container">
        <Navbar />
        <div className="profile-page">{error || "User not found"}</div>
      </div>
    );
  }

  return (
    <div className="profile_mainpage_container">
      <Navbar />
      <div className="profile-page">
        <ProfileHeader user={user} onProfileUpdate={handleProfileUpdate} />
        <ProfileTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          username={user.username}
        />
      </div>

      {/* Floating + button — own profile only */}
      {user.isOwn && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>

          {showAskPost === "menu" && (
            <>
              <button onClick={() => { setAskTab("ask"); setShowAskPost(true); }}
                style={{ padding: "8px 16px", borderRadius: "20px", background: "var(--card-bg)", border: "1px solid var(--border-color)", color: "var(--color)", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", animation: "slideInRight 0.15s ease" }}>
                ❓ Ask Question
              </button>
              <button onClick={() => { setAskTab("post"); setShowAskPost(true); }}
                style={{ padding: "8px 16px", borderRadius: "20px", background: "var(--card-bg)", border: "1px solid var(--border-color)", color: "var(--color)", fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", animation: "slideInRight 0.15s ease" }}>
                ✏️ Write Post
              </button>
            </>
          )}

          <button
            onClick={() => setShowAskPost(prev => prev === "menu" ? false : "menu")}
            style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: "var(--bg-color, #0ea5e9)", color: "white",
              border: "none", fontSize: "26px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              transform: showAskPost === "menu" ? "rotate(135deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}>
            +
          </button>
        </div>
      )}

      {/* AskPost modal */}
      {showAskPost === true && (
        <AskPost
          isOpen={true}
          activeTab={askTab}
          onClose={() => setShowAskPost(false)}
        />
      )}
    </div>
  );
}