import { useEffect, useState } from "react";
import pinventorymanagerapi from "../../api/pinventorymanagerapi";
import "./P_inventory_manager.css";
import Navbar from "../../components/Navbar";
import "../../components/css/Navbar.css";
import { getPUser } from "../../api/authapi";

export default function PharmacistDashboard() {
  const user = getPUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState(null);
  const [popup, setPopup] = useState({ message: "", type: "" });
  const [savingRow, setSavingRow] = useState(null);

  // ✅ FIX: Removed the broken shop verification block entirely.
  // P_inventoryguard.jsx already verifies the pharmacy is verified
  // before this component ever renders. Duplicating it here with stale
  // localStorage data (user.shop is never set — shop lives in the
  // Pharmacy model, not User) caused a permanent false lock screen.

  // ---------- Fetch Inventory ----------
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data } = await pinventorymanagerapi.get("/inventory/me");
      setItems(data.items?.map((item) => ({ ...item, isEditing: false })) || []);
      setLastUpdated(data.lastUpdatedAt || null);
    } catch (err) {
      console.error("Failed to fetch inventory", err);
      showPopup("Failed to fetch inventory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // ---------- Popup ----------
  const showPopup = (message, type = "info") => {
    setPopup({ message, type });
    setTimeout(() => setPopup({ message: "", type: "" }), 3000);
  };

  // ---------- Search ----------
  const filteredItems = items.filter((item) => {
    const name = item.medicineName || "";
    const brand = item.brand || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // ---------- Add new row locally ----------
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { medicineName: "", brand: "", quantity: 0, price: "", expiry: "", isEditing: true },
    ]);
  };

  // ---------- Update field locally ----------
  const updateItemField = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  };

  // ---------- Toggle Edit ----------
  const toggleEdit = (index) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isEditing: true };
      return copy;
    });
  };

  // ---------- Cancel Edit ----------
  const cancelEdit = (index) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item.id) {
        copy.splice(index, 1);
      } else {
        copy[index].isEditing = false;
      }
      return copy;
    });
  };

  // ---------- Save Row ----------
  const saveRow = async (index) => {
    const copy = [...items];
    const item = copy[index];
    setSavingRow(index);

    let expiryISO = null;
    if (item.expiry) {
      const d = new Date(item.expiry);
      if (!isNaN(d)) expiryISO = d.toISOString();
    }

    const payloadItem = { ...item, expiry: expiryISO, isEditing: false };
    copy[index] = payloadItem;

    try {
      await pinventorymanagerapi.post("/inventory/me", { items: copy });
      setItems(copy);
      showPopup("Inventory updated successfully", "success");
    } catch (err) {
      console.error(err);
      showPopup("Failed to save inventory", "error");
    } finally {
      setSavingRow(null);
    }
  };

  // ---------- Delete ----------
  const deleteItem = async (index) => {
    if (!window.confirm("Are you sure you want to delete this medicine?")) return;

    const copy = [...items];
    copy.splice(index, 1);

    try {
      await pinventorymanagerapi.post("/inventory/me", { items: copy });
      setItems(copy);
      showPopup("Medicine deleted successfully", "success");
    } catch (err) {
      console.error(err);
      showPopup("Failed to delete medicine", "error");
    }
  };

  // ---------- Save Inventory (bulk) ----------
  const updateInventory = async () => {
    if (items.length === 0) return showPopup("No items to save", "info");

    const payload = items.map((item) => ({
      ...item,
      expiry: item.expiry ? new Date(item.expiry + "-01").toISOString() : null,
    }));

    try {
      await pinventorymanagerapi.post("/inventory/me", { items: payload });
      showPopup("Inventory updated successfully", "success");
      setItems((prev) => prev.map((i) => ({ ...i, isEditing: false })));
    } catch (err) {
      console.error(err);
      showPopup("Failed to update inventory", "error");
    }
  };

  // ---------- CSV Upload ----------
  const handleFileSelect = (e) => setCsvFile(e.target.files[0] || null);

  const uploadCSV = async () => {
    if (!csvFile) return showPopup("Please select a CSV file", "error");

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      await pinventorymanagerapi.post("/inventory/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showPopup("CSV uploaded successfully", "success");
      setCsvFile(null);
      document.getElementById("csv-input").value = null;
      fetchInventory();
    } catch (err) {
      console.error(err);
      showPopup("CSV upload failed", "error");
    }
  };

  if (loading) return <p>Loading inventory...</p>;

  return (
    <>
      <Navbar />
      <div className="main_page">
        {/* ---------- Header ---------- */}
        <div className="dashboard-header">
          <h2>
            Welcome{user?.name ? `, ${user.name}` : ""}
            <span className="role-badge">Pharmacist</span>
          </h2>
          {lastUpdated && (
            <p className="updated-at">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </div>

        {/* ---------- Popup ---------- */}
        {popup.message && (
          <div className={`popup ${popup.type}`}>{popup.message}</div>
        )}

        {/* ---------- CSV Upload ---------- */}
        <div className="csv-upload">
          <label className="file-label">
            Select CSV
            <input
              type="file"
              accept=".csv"
              id="csv-input"
              onChange={handleFileSelect}
              hidden
            />
          </label>
          <span className="file-name">{csvFile?.name || "No file selected"}</span>
          <button onClick={uploadCSV} disabled={!csvFile}>
            Upload CSV
          </button>
        </div>

        {/* ---------- Inventory Table ---------- */}
        <h3>My Inventory</h3>
        <div className="inventory-search">
          <input
            type="text"
            placeholder="Search by medicine or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {items.length === 0 && <p className="muted-text">No medicines added yet.</p>}

        <div className="inventory-table">
          <div className="inventory-header">
            <span>Medicine</span>
            <span>Brand</span>
            <span>Quantity</span>
            <span>Price (₹)</span>
            <span>Expiry</span>
            <span>Actions</span>
          </div>

          {filteredItems.map((item, i) => (
            <div key={item.id || i} className="inventory-row">
              {item.isEditing ? (
                <>
                  <input
                    placeholder="Medicine name"
                    value={item.medicineName}
                    onChange={(e) => updateItemField(i, "medicineName", e.target.value)}
                  />
                  <input
                    placeholder="Brand"
                    value={item.brand}
                    onChange={(e) => updateItemField(i, "brand", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItemField(i, "quantity", Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updateItemField(i, "price", Number(e.target.value))}
                  />
                  <input
                    type="month"
                    value={item.expiry ? new Date(item.expiry).toISOString().slice(0, 7) : ""}
                    onChange={(e) => updateItemField(i, "expiry", e.target.value)}
                  />
                  <div className="row-actions">
                    <button onClick={() => saveRow(i)} disabled={savingRow === i}>
                      {savingRow === i ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => cancelEdit(i)} className="cancel-btn">
                      Cancel
                    </button>
                    <button onClick={() => deleteItem(i)} className="delete-btn">
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span>{item.medicineName}</span>
                  <span>{item.brand}</span>
                  <span>{item.quantity}</span>
                  <span>{item.price}</span>
                  <span>
                    {item.expiry ? new Date(item.expiry).toISOString().slice(0, 7) : ""}
                  </span>
                  <div className="row-actions">
                    <button onClick={() => toggleEdit(i)}>Edit</button>
                    <button onClick={() => deleteItem(i)} className="delete-btn">
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ---------- Inventory Actions ---------- */}
        <div className="inventory-actions">
          <button onClick={addItem}>+ Add Medicine</button>
          <button onClick={updateInventory} disabled={items.length === 0}>
            Save Inventory
          </button>
        </div>
      </div>
    </>
  );
}