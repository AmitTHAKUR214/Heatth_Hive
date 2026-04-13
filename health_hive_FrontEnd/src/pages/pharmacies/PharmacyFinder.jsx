import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getNearbyPharmacies, subscribeToPharmacy, unsubscribeFromPharmacy } from "../../api/pharmacyDiscoveryApi";
import { getPUser } from "../../api/authapi";
import "./PharmacyFinder.css";

const RADIUS_OPTIONS = [
  { label: "1 km",   value: 1000 },
  { label: "2.5 km", value: 2500 },
  { label: "5 km",   value: 5000 },
];

// Nominatim autocomplete
async function fetchPlaceSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=in`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  return res.json();
}

export default function PharmacyFinder() {
  const user     = getPUser();
  const navigate = useNavigate();

  const [pharmacies,    setPharmacies]    = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);
  const [error,         setError]         = useState("");
  const [radius,        setRadius]        = useState(2500);
  const [subscribing,   setSubscribing]   = useState(null); // pharmacyId in flight

  // location state
  const [locationMode,  setLocationMode]  = useState("text"); // "text" | "gps"
  const [textInput,     setTextInput]     = useState("");
  const [suggestions,   setSuggestions]   = useState([]);
  const [showSugg,      setShowSugg]      = useState(false);
  const [loadingSugg,   setLoadingSugg]   = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState(null); // { lat, lng, label }
  const [gpsLoading,    setGpsLoading]    = useState(false);

  const debounceRef = useRef(null);

  // ── Text input autocomplete ──
  const handleTextChange = (e) => {
    const val = e.target.value;
    setTextInput(val);
    setResolvedCoords(null);

    clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); setShowSugg(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const results = await fetchPlaceSuggestions(val);
        setSuggestions(results);
        setShowSugg(true);
      } catch { /* ignore */ }
      finally { setLoadingSugg(false); }
    }, 350);
  };

  const handleSelectSuggestion = (s) => {
    setTextInput(s.display_name);
    setResolvedCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon), label: s.display_name });
    setSuggestions([]);
    setShowSugg(false);
  };

  // ── GPS ──
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // reverse geocode for label
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          const label = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setResolvedCoords({ lat, lng, label });
          setLocationMode("gps");
          setTextInput("");
        } catch {
          setResolvedCoords({ lat, lng, label: "Your location" });
          setLocationMode("gps");
        }
        setGpsLoading(false);
      },
      (err) => {
        setError("Could not get your location. Please allow location access or type an area.");
        setGpsLoading(false);
      }
    );
  };

  const resetLocation = () => {
    setResolvedCoords(null);
    setLocationMode("text");
    setTextInput("");
  };

  // ── Search ──
  const handleSearch = async () => {
    if (!resolvedCoords) {
      setError("Please select a location or use your GPS.");
      return;
    }
    setError("");
    setLoading(true);
    setSearched(true);
    try {
      const res = await getNearbyPharmacies(resolvedCoords.lat, resolvedCoords.lng, radius);
      setPharmacies(res.data.pharmacies || []);
    } catch (err) {
      setError("Failed to fetch pharmacies. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Subscribe toggle ──
  const handleSubscribe = async (e, pharmacy) => {
    e.stopPropagation();
    if (!user) { navigate("/login"); return; }
    setSubscribing(pharmacy._id);
    try {
      if (pharmacy.isSubscribed) {
        await unsubscribeFromPharmacy(pharmacy._id);
        setPharmacies(prev => prev.map(p => p._id === pharmacy._id ? { ...p, isSubscribed: false, subscriberCount: p.subscriberCount - 1 } : p));
      } else {
        await subscribeToPharmacy(pharmacy._id);
        setPharmacies(prev => prev.map(p => p._id === pharmacy._id ? { ...p, isSubscribed: true, subscriberCount: p.subscriberCount + 1 } : p));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Action failed");
    } finally {
      setSubscribing(null);
    }
  };

  return (
    <>
      <Navbar />
      <div className="pf-page">

        {/* ── Header ── */}
        <div className="pf-header">
          <div>
            <h1 className="pf-title">🏪 Find Pharmacies</h1>
            <p className="pf-sub">Discover verified pharmacies near you, subscribe to view live inventory and reserve medicines.</p>
          </div>
        </div>

        {/* ── Search Panel ── */}
        <div className="pf-search-panel">

          {/* Location row */}
          <div className="pf-location-row">
            {resolvedCoords ? (
              <div className="pf-resolved">
                <span className="pf-resolved-icon">📍</span>
                <span className="pf-resolved-label">{resolvedCoords.label.length > 60 ? resolvedCoords.label.slice(0, 60) + "…" : resolvedCoords.label}</span>
                <button className="pf-clear-btn" onClick={resetLocation}>✕</button>
              </div>
            ) : (
              <div className="pf-input-wrap" style={{ position: "relative" }}>
                <span className="pf-input-icon">🔍</span>
                <input
                  className="pf-input"
                  value={textInput}
                  onChange={handleTextChange}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  placeholder="Type area, locality or city…"
                />
                {loadingSugg && <span className="pf-input-spinner">⏳</span>}
                {showSugg && suggestions.length > 0 && (
                  <ul className="pf-suggestions">
                    {suggestions.map((s, i) => (
                      <li key={i} className="pf-sugg-item" onMouseDown={() => handleSelectSuggestion(s)}>
                        <span className="pf-sugg-pin">📌</span>
                        <span>{s.display_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              className={`pf-gps-btn ${gpsLoading ? "pf-gps-loading" : ""}`}
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
              title="Use my location"
            >
              {gpsLoading ? "⏳" : "📍"} {gpsLoading ? "Locating…" : "Use My Location"}
            </button>
          </div>

          {/* Radius + Search */}
          <div className="pf-controls-row">
            <div className="pf-radius-group">
              <span className="pf-radius-label">Radius:</span>
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`pf-radius-btn ${radius === opt.value ? "active" : ""}`}
                  onClick={() => setRadius(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              className="pf-search-btn"
              onClick={handleSearch}
              disabled={loading || !resolvedCoords}
            >
              {loading ? "Searching…" : "Search →"}
            </button>
          </div>

          {error && <p className="pf-error">⚠️ {error}</p>}
        </div>

        {/* ── Results ── */}
        {loading && (
          <div className="pf-loading-grid">
            {[1,2,3,4,5,6].map(i => <div key={i} className="pf-skeleton" />)}
          </div>
        )}

        {!loading && searched && pharmacies.length === 0 && (
          <div className="pf-empty">
            <span style={{ fontSize: "48px" }}>🏪</span>
            <p>No verified pharmacies found within {radius / 1000} km.</p>
            <p style={{ fontSize: "13px", color: "var(--color-3)" }}>Try increasing the radius or searching a different area.</p>
          </div>
        )}

        {!loading && pharmacies.length > 0 && (
          <>
            <div className="pf-results-header">
              <span className="pf-results-count">{pharmacies.length} pharmacies found</span>
              <span className="pf-results-area">near {resolvedCoords?.label?.split(",")[0]}</span>
            </div>
            <div className="pf-grid">
              {pharmacies.map((pharmacy) => (
                <PharmacyCard
                  key={pharmacy._id}
                  pharmacy={pharmacy}
                  user={user}
                  subscribing={subscribing === pharmacy._id}
                  onSubscribe={handleSubscribe}
                  onClick={() => navigate(`/pharmacies/${pharmacy._id}`)}
                />
              ))}
            </div>
          </>
        )}

        {!searched && !loading && (
          <div className="pf-landing">
            <div className="pf-landing-icon">🗺️</div>
            <p className="pf-landing-text">Search an area or use your GPS to discover nearby pharmacies</p>
          </div>
        )}

      </div>
    </>
  );
}

function PharmacyCard({ pharmacy, user, subscribing, onSubscribe, onClick }) {
  const isSelf = user && pharmacy.owner?._id === (user._id || user.id);

  return (
    <div className="pf-card" onClick={onClick}>
      <div className="pf-card-top">
        <div className="pf-card-icon">💊</div>
        <div className="pf-card-info">
          <h3 className="pf-card-name">{pharmacy.name}</h3>
          <p className="pf-card-address">{pharmacy.address || "Address not provided"}</p>
        </div>
        <span className="pf-card-verified">✅ Verified</span>
      </div>

      <div className="pf-card-stats">
        <div className="pf-stat">
          <strong>{pharmacy.distanceKm} km</strong>
          <span>Away</span>
        </div>
        <div className="pf-stat">
          <strong>{pharmacy.totalMedicines}</strong>
          <span>Medicines</span>
        </div>
        <div className="pf-stat">
          <strong>{pharmacy.subscriberCount}</strong>
          <span>Subscribers</span>
        </div>
        {pharmacy.lowStockCount > 0 && (
          <div className="pf-stat pf-stat-warn">
            <strong>{pharmacy.lowStockCount}</strong>
            <span>Low Stock</span>
          </div>
        )}
      </div>

      {pharmacy.phone && (
        <p className="pf-card-phone">📞 {pharmacy.phone}</p>
      )}

      <div className="pf-card-footer">
        <button className="pf-view-btn" onClick={onClick}>View Inventory →</button>
        {!isSelf && user && (
          <button
            className={`pf-sub-btn ${pharmacy.isSubscribed ? "subscribed" : ""}`}
            onClick={(e) => onSubscribe(e, pharmacy)}
            disabled={subscribing}
          >
            {subscribing ? "…" : pharmacy.isSubscribed ? "✓ Subscribed" : "+ Subscribe"}
          </button>
        )}
      </div>
    </div>
  );
}