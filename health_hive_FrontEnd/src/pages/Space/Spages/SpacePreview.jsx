import "./SpacePreview.css";

const mockPosts = [
  {
    id: 1,
    title: "Welcome to this Space 🎉",
    author: "Admin",
    content: "This is a pinned introduction post for new members.",
  },
  {
    id: 2,
    title: "Community Guidelines",
    author: "Moderator",
    content: "Please be respectful and follow the rules.",
  },
  {
    id: 3,
    title: "Weekly Discussion",
    author: "Member",
    content: "What are you working on this week?",
  },
];

const mockMembers = [
  { id: 1, name: "You (Admin)", avatar: "🧑‍💼" },
  { id: 2, name: "Alex", avatar: "🧑" },
  { id: 3, name: "Sam", avatar: "🧑‍🎓" },
  { id: 4, name: "Taylor", avatar: "👩‍⚕️" },
];

const SpacePreview = ({ data, theme }) => {
  return (
    <section className="space-preview-wrapper">
    <div className="Section-preview">
      <h2 className="preview-title">Live Preview</h2>

      <div className="space-preview-scroll">
        <div className="space-preview">
          {/* Banner */}
          <div
            className="space-preview-banner"
            style={{ background: theme.primary }}
          />

          {/* Header */}
          <div className="space-preview-header">
            <div className="space-preview-icon">{data.icon || "📌"}</div>

            <div className="space-preview-info">
              <h1>{data.title || "Untitled Space"}</h1>
              <p>{data.description || "No description yet."}</p>

              <div className="space-preview-meta">
                <span
                  className="badge"
                  style={{ background: theme.accent }}
                >
                  {data.visibility === "private" ? "Private" : "Public"}
                </span>
                <span className="badge secondary">Preview</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="space-preview-tabs">
            <button
              className="active"
              style={{
                borderColor: theme.primary,
                color: theme.primary,
              }}
            >
              Posts
            </button>
            <button>Members</button>
            <button>About</button>
          </div>

          {/* Posts */}
          <div className="space-preview-section">
            <h3>Recent Posts</h3>

            {mockPosts.map((post) => (
              <div key={post.id} className="space-preview-post">
                <h4>{post.title}</h4>
                <span className="post-author">{post.author}</span>
                <p>{post.content}</p>
              </div>
            ))}
          </div>

          {/* Members */}
          <div className="space-preview-section">
            <h3>Members</h3>

            <div className="space-preview-members">
              {mockMembers.map((member) => (
                <div key={member.id} className="space-preview-member">
                  <span className="avatar">{member.avatar}</span>
                  <span>{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
};

export default SpacePreview;
