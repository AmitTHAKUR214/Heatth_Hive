import "./css/AuthRequiredModal.css";
import { Link } from "react-router-dom";

export default function AuthRequiredModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="authreq-overlay">
      <div className="authreq-modal">
        <h2>Login required</h2>
        <p>
          You need to be logged in to ask questions or create posts.
        </p>

        <div className="authreq-actions">
          <Link to="/login" className="login-btn">
            Login
          </Link>

          <button className="cancel-btn-auth" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
