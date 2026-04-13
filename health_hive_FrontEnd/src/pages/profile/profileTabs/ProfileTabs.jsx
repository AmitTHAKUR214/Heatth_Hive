import { lazy, Suspense } from "react";

const UserPosts = lazy(() => import("./UserPosts"));
const UserQuestions = lazy(() => import("./UserQuestions"));
const UserLiked = lazy(() => import("./UserLikes"));
const UserReplies = lazy(() => import("./UserReplies"));
const UserComments = lazy(() => import("./UserComments"));
const UserSpaces = lazy(() => import("./UserSpaces"));
const ProfileStatsTab = lazy(() => import("../ProfilePages/ProfileStatsTab"))

export default function ProfileTabs({
  activeTab,
  setActiveTab,
  username,
  isOwner,
}) {

  if (!username) {
    console.warn("ProfileTabs: username missing");
    return null;
  }

  const tabs = [
    "posts",
    "questions",
    "liked",
    "replies",
    "comments",
    "spaces",
    "stats",
  ];

  return (
    <div className="profile-tabs">
      {/* TAB BAR */}
      <div className="profile-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`profile-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="profile-tab-content">
        <Suspense fallback={<div className="tab-loader">Loading…</div>}>
          {activeTab === "posts" && <UserPosts username={username} />}
          {activeTab === "questions" && <UserQuestions username={username} />}
          {activeTab === "liked" && <UserLiked username={username} />}
          {activeTab === "replies" && <UserReplies username={username} />}
          {activeTab === "comments" && <UserComments username={username} />}
          {activeTab === "spaces" && <UserSpaces username={username} type="joined" isOwner={isOwner} />}
          {activeTab === "stats" && <ProfileStatsTab username={username} />}
        </Suspense>
      </div>
    </div>
  );
}