const SpaceHeader = ({ space, isAdmin }) => {
  return (
    <div className="space-header">
      <div className="space-header-left">
        <div className="space-icon">{space.icon || "📌"}</div>
        <div>
          <h1 className="space-title">{space.title}</h1>
          <p className="space-description">
            {space.description || "No description yet."}
          </p>

          <div className="space-meta">
            <span className={`badge ${space.visibility}`}>
              {space.visibility}
            </span>

            <span className={`badge ${space.verificationStatus}`}>
              {space.verificationStatus}
            </span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="space-admin-actions">
          <button className="btn-outline">Edit Space</button>
        </div>
      )}
    </div>
  );
};
