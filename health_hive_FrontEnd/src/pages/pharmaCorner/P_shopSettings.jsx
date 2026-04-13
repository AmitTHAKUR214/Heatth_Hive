import Navbar from "../../components/Navbar";
import "./P_shopSettings.css";
import { useState } from "react";
import pinventorymanagerapi from "../../api/pinventorymanagerapi";


const P_shopSettings = () => {
  const [shopName, setShopName] = useState("My Medical Store");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async () => {
    if (!shopName.trim()) {
      setMessage("Shop name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await pinventorymanagerapi.put("/shop/update-name", {
        shopName,
      });

      setMessage("Shop name updated successfully");
    } catch (err) {
      setMessage("Failed to update shop name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="shop-settings-page">
        <h2>Shop Settings</h2>

        <div className="shop-settings-card">
          <label>Shop Name</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Enter shop name"
          />

          <label>Shop Address</label>
          <input
            type="text"
            placeholder="Address (coming soon)"
            disabled
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="Email (coming soon)"
            disabled
          />

          <button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>

          {message && <p className="status-msg">{message}</p>}
        </div>
      </div>
    </>
  );
};

export default P_shopSettings;
