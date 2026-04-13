import React, { useState } from "react";
import { useNavigate ,Link, Navigate} from "react-router-dom";
import "./CreateSpace.css";
import { getPUser } from "../../../api/authapi";

const CreateSpace = () => {
  const navigate = useNavigate();
  const user = getPUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📌");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Space title is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/spaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          icon,
        }),
      });


      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create space");
      }

      // redirect to space page
      navigate(`/space/${data.slug}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
    // to rturn guest user from doing any action
    if (user?.role === "guest") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ authMessage: "Guest access is limited. Please login or register as a user to continue." }}
      />
    );
  }
  return (
    <div className="create-space-container">
      <h1>Create a Space</h1>
     
      <p className="subtitle">
        Spaces help organize questions, posts, and discussions.
      </p>

      <form className="create-space-form" onSubmit={handleSubmit}>
        {/* Title */}
        <label>
          Space Name
          <input
            type="text"
            placeholder="Inbox"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {/* Description */}
        <label>
          Description
          <textarea
            placeholder="What is this space about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {/* Icon */}
        <label>
          Space Icon (emoji)
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={2}
          />
        </label>

        {/* Error */}
        {error && <div className="error">{error}</div>}

        {/* Submit */}
        <button type="submit" disabled={loading}>
          {loading ? "Creating your space..." : "Create Space"}
        </button>
      </form>
       <Link className="Home_Link_createSpace_Page" to="/">Go Home</Link>
    </div>
  );
};

export default CreateSpace;