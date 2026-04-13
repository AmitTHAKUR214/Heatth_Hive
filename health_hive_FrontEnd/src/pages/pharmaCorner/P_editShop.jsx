import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getPUser } from "../../api/authapi";
const api = client;
import client from "../../api/client";
import "./P_editShop.css";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

// Simple axios instance with auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const P_editShop = () => {
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const [shop, setShop] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ✅ Address state — text + resolved coords
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState(null); // { display, lat, lng }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Load existing shop
  useEffect(() => {
    const loadShop = async () => {
      try {
        const res = await api.get("/pharmacist/shop");
        const shopData = res.data.pharmacy;
        setShop(shopData);
        setName(shopData?.name || "");
        setEmail(shopData?.email || "");
        setPhone(shopData?.phone || "");
        // Pre-fill address if already saved
        if (shopData?.address) {
          setAddressQuery(shopData.address);
          // If coords already saved, pre-populate resolvedAddress
          if (shopData?.location?.coordinates?.length === 2) {
            setResolvedAddress({
              display: shopData.address,
              lat: shopData.location.coordinates[1],
              lng: shopData.location.coordinates[0],
            });
          }
        }
      } catch (err) {
        console.error("Failed to load shop", err);
      }
    };
    loadShop();
  }, []);

  // ── Address autocomplete ──────────────────────────────────────────────────
  const handleAddressChange = (e) => {
    const value = e.target.value;
    setAddressQuery(value);
    setResolvedAddress(null); // clear resolved until user picks again

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    setIsLoadingAddress(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: {
            q: value,
            format: "json",
            addressdetails: 1,
            limit: 6,
            countrycodes: "in",
          },
        });
        setAddressSuggestions(res.data);
      } catch (err) {
        console.error("Address autocomplete error:", err);
        setAddressSuggestions([]);
      } finally {
        setIsLoadingAddress(false);
      }
    }, 400);
  };

  const handleAddressSelect = (suggestion) => {
    // ✅ Geocoding happens here — Nominatim returns lat/lon with each suggestion
    const resolved = {
      display: suggestion.display_name,
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    };
    setResolvedAddress(resolved);
    setAddressQuery(suggestion.display_name);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Reverse geocode to get a human-readable address
        try {
          const res = await axios.get("https://nominatim.openstreetmap.org/reverse", {
            params: { lat, lon: lng, format: "json" },
          });
          const display = res.data?.display_name || `${lat}, ${lng}`;
          setAddressQuery(display);
          setResolvedAddress({ display, lat, lng });
        } catch {
          setAddressQuery(`${lat}, ${lng}`);
          setResolvedAddress({ display: `${lat}, ${lng}`, lat, lng });
        }
      },
      () => alert("Unable to retrieve location")
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required");
      return;
    }

    // ✅ Block save if address was typed but not picked from suggestions
    if (addressQuery.trim() && !resolvedAddress) {
      setError("Please select your address from the suggestions list so we can pin your location on the map.");
      return;
    }

    if (!resolvedAddress) {
      setError("Please enter and select your shop address");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: resolvedAddress.display,
        lat: resolvedAddress.lat,   // ✅ coords sent to backend
        lng: resolvedAddress.lng,
      };

      const res = await api.patch("/pharmacist/shop", payload);

      // Update localStorage
      const currentUser = getPUser();
      localStorage.setItem("user", JSON.stringify({ ...currentUser, shop: res.data.pharmacy }));
      window.dispatchEvent(new Event("user-updated"));

      setToast("✅ Shop updated successfully!");
      setShowConfirm(false);
      setTimeout(() => navigate("/p-dashboard"), 1200);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update shop");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-shop-page">
      <h2>Edit Shop Details</h2>

      <div className="edit-card">
        <form>
          {/* Shop Name */}
          <div className="form-group">
            <label>Shop Name: <strong>{shop?.name || "—"}</strong></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter shop name"
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label>Email: <strong>{shop?.email || "—"}</strong></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter shop email"
            />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label>Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          {/* ✅ Address with autocomplete + geocoding */}
          <div className="form-group">
            <label>
              Address: <strong>{shop?.address || "—"}</strong>
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={addressQuery}
                  onChange={handleAddressChange}
                  onFocus={() => addressQuery.length >= 3 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search your shop address..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  title="Use my current location"
                  onClick={handleUseMyLocation}
                  style={{ padding: "0 12px", cursor: "pointer" }}
                >
                  📍
                </button>
              </div>

              {/* ✅ Green confirmation when address is resolved */}
              {resolvedAddress && (
                <p style={{ color: "#16a34a", fontSize: "12px", marginTop: "4px" }}>
                  ✅ Location pinned: {resolvedAddress.lat.toFixed(4)}, {resolvedAddress.lng.toFixed(4)}
                </p>
              )}

              {showSuggestions && (
                <ul style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "white", border: "1px solid #e5e7eb",
                  borderRadius: "8px", zIndex: 100, maxHeight: "200px",
                  overflowY: "auto", listStyle: "none", padding: "4px 0", margin: 0,
                }}>
                  {isLoadingAddress && (
                    <li style={{ padding: "8px 12px", color: "#6b7280" }}>Loading...</li>
                  )}
                  {!isLoadingAddress && addressSuggestions.length === 0 && (
                    <li style={{ padding: "8px 12px", color: "#6b7280" }}>No results found</li>
                  )}
                  {!isLoadingAddress && addressSuggestions.map((s, i) => (
                    <li
                      key={i}
                      onClick={() => handleAddressSelect(s)}
                      style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: "13px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#f9fafb"}
                      onMouseLeave={(e) => e.target.style.background = "white"}
                    >
                      {s.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "80px", alignItems: "center", marginTop: "8px", justifyContent: "space-between" }}>
            <button
              type="button"
              className="save-btn"
              disabled={loading}
              onClick={() => setShowConfirm(true)}
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <Link className="Link" to="/p-dashboard">Exit</Link>
          </div>
        </form>

        {error && <p style={{ color: "red", marginTop: "8px" }}>{error}</p>}
        {toast && <div className="toast-popup">{toast}</div>}
      </div>

      {/* Confirm popup */}
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p>Are you sure you want to update your shop details?</p>
            {resolvedAddress && (
              <p style={{ fontSize: "13px", color: "#6b7280" }}>
                📍 {resolvedAddress.display}
              </p>
            )}
            <div className="confirm-actions">
              <button className="save-btn" disabled={loading} onClick={handleSubmit}>
                Yes, Update
              </button>
              <button className="secondary-btn" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P_editShop;