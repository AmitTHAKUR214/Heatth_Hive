import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./css/FilterPopup.css";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

const FilterPopup = ({ onClose, defaultPlace = "", defaultCategory = "hospital" }) => {
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const [mode, setMode] = useState("medicine");

  /* ── Place state ── */
  const [category, setCategory] = useState(defaultCategory);
  const [place, setPlace] = useState(defaultPlace);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isValidPlace, setIsValidPlace] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  /* ── Medicine state ── */
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicine, setMedicine] = useState(null);
  const [medicineSuggestions, setMedicineSuggestions] = useState([]);
  const [showMedicineSuggestions, setShowMedicineSuggestions] = useState(false);
  const [isValidMedicine, setIsValidMedicine] = useState(false);
  const [isLoadingMedicine, setIsLoadingMedicine] = useState(false);
  const [type, setType] = useState("");

  /* ── Location autocomplete ── */
  const handlePlaceChange = (e) => {
    const value = e.target.value;
    setPlace(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingLocation(false);
      setIsValidPlace(false);
      return;
    }

    setShowSuggestions(true);
    setIsValidPlace(false);
    setIsLoadingLocation(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: { q: value, format: "json", addressdetails: 1, limit: 8, countrycodes: "in" },
        });
        setSuggestions(res.data);
      } catch (err) {
        console.error("Autocomplete error:", err);
        setSuggestions([]);
      } finally {
        setIsLoadingLocation(false);
      }
    }, 400);
  };

  const handleSuggestionClick = (s) => {
    setPlace(s.display_name);
    setIsValidPlace(true);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleUseMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // ✅ Store coords in place state for medicine submit to use
        setPlace(`${lat},${lon}`);
        setIsValidPlace(true);
      },
      () => alert("Unable to retrieve location")
    );
  };

  const handlePlaceSubmit = (e) => {
    e.preventDefault();
    if (!isValidPlace) return alert("Please select a valid location");
    // ✅ FIX: route is /mappage not /map
    navigate(`/mappage?place=${encodeURIComponent(place)}&category=${category}`);
    onClose();
  };

  /* ── Medicine autocomplete ── */
  const handleMedicineChange = (e) => {
    const value = e.target.value;
    setMedicineQuery(value);
    setMedicine(null);
    setIsValidMedicine(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setMedicineSuggestions([]);
      setShowMedicineSuggestions(false);
      setIsLoadingMedicine(false);
      return;
    }

    setShowMedicineSuggestions(true);
    setIsLoadingMedicine(true);

    // ✅ FIX: Query real medicines from DB instead of hardcoded mock list
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${BASE_URL}/medicinesearch/medicines`, {
          params: { q: value },
        });
        // expects array of strings or objects with a name field
        const names = res.data.map((m) => (typeof m === "string" ? m : m.name || m.medicineName));
        setMedicineSuggestions(names);
      } catch (err) {
        console.error("Medicine search error:", err);
        setMedicineSuggestions([]);
      } finally {
        setIsLoadingMedicine(false);
      }
    }, 300);
  };

  const handleMedicineSelect = (name) => {
    setMedicine(name);
    setMedicineQuery(name);
    setIsValidMedicine(true);
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
  };

  const handleMedicineSubmit = () => {
    if (!isValidMedicine) return alert("Please select a medicine from the list");
    if (!isValidPlace) return alert("Please select a valid location");

    const params = new URLSearchParams({
      mode: "medicine",
      medicine: medicine.trim(),
    });

    // If place holds "lat,lon" from geolocation
    if (place.match(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)) {
      const [lat, lon] = place.split(",");
      params.append("lat", lat.trim());
      params.append("lon", lon.trim());
    } else {
      params.append("place", place.trim());
    }

    if (type) params.append("type", type);

    // ✅ FIX: correct route is /mappage
    navigate(`/mappage?${params.toString()}`);
    onClose();
  };

  const clearMedicine = () => {
    setMedicineQuery("");
    setMedicine(null);
    setMedicineSuggestions([]);
    setShowMedicineSuggestions(false);
    setIsValidMedicine(false);
    setType("");
    setPlace("");
    setIsValidPlace(false);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  /* ── Render ── */
  return (
    <div className="Search_overlay">
      <div className="popup">
        <section>
          <button onClick={onClose} className="closeBtn">✕</button>
        </section>

        <div className="popupToggle">
          <button
            className={`toggleBtn ${mode === "medicine" ? "active" : ""}`}
            onClick={() => setMode("medicine")}
            type="button"
          >
            Find Medicine
          </button>
          <button
            className={`toggleBtn ${mode === "place" ? "active" : ""}`}
            onClick={() => setMode("place")}
            type="button"
          >
            Hospitals / Clinics
          </button>
        </div>

        <div className="popupContent">
          {/* ── MEDICINE MODE ── */}
          {mode === "medicine" && (
            <>
              <label>Medicine Name</label>
              <div className="inputWrapper">
                <input
                  value={medicineQuery}
                  onChange={handleMedicineChange}
                  onFocus={() => medicineQuery.length >= 2 && setShowMedicineSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowMedicineSuggestions(false), 150)}
                  placeholder="Search medicine"
                  className="input"
                />
                {showMedicineSuggestions && (
                  <ul className="suggestionList">
                    <p style={{ marginLeft: "12px" }}>select from the list</p>
                    {isLoadingMedicine && <span className="loadingItem">Loading...</span>}
                    {!isLoadingMedicine && medicineSuggestions.length === 0 && (
                      <span className="loadingItem">No medicines found</span>
                    )}
                    {!isLoadingMedicine &&
                      medicineSuggestions.map((m, i) => (
                        <span key={i} className="suggestionItem" onClick={() => handleMedicineSelect(m)}>
                          {m}
                        </span>
                      ))}
                  </ul>
                )}
              </div>

              <label>Medicine Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input">
                <option value="">Any</option>
                <option value="tablet">Tablet</option>
                <option value="syrup">Syrup</option>
                <option value="injection">Injection</option>
                <option value="powder">Powder</option>
              </select>

              <label>Where?</label>
              <div className="inputWrapper">
                <input
                  type="text"
                  value={place}
                  onChange={handlePlaceChange}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => place.length >= 2 && setShowSuggestions(true)}
                  placeholder="Enter area or town"
                  className="input"
                />
                {showSuggestions && (
                  <ul className="suggestionList">
                    <p style={{ marginLeft: "12px" }}>select from the list</p>
                    {isLoadingLocation && <span className="loadingItem">Loading...</span>}
                    {!isLoadingLocation &&
                      suggestions.map((s, i) => (
                        <span key={i} className="suggestionItem" onClick={() => handleSuggestionClick(s)}>
                          {s.display_name}
                        </span>
                      ))}
                  </ul>
                )}
              </div>

              <div className="buttonRow">
                <i
                  title="Use current location"
                  role="button"
                  className="fa-solid fa-location-dot buttonPrimary clickable"
                  onClick={handleUseMyLocation}
                />
                <button onClick={handleMedicineSubmit} className="buttonPrimary">
                  Search Medicine
                </button>
                <button onClick={clearMedicine} className="buttonSecondary">
                  Clear
                </button>
              </div>
            </>
          )}

          {/* ── PLACE MODE ── */}
          {mode === "place" && (
            <form onSubmit={handlePlaceSubmit} className="form">
              <label>What are you looking for?</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="pharmacy">Medical Store</option>
              </select>

              <label>Where?</label>
              <div className="inputWrapper">
                <input
                  type="text"
                  value={place}
                  onChange={handlePlaceChange}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => place.length >= 2 && setShowSuggestions(true)}
                  placeholder="Enter area or town"
                  className="input"
                />
                {showSuggestions && (
                  <ul className="suggestionList">
                    <p style={{ marginLeft: "12px" }}>select from the list</p>
                    {isLoadingLocation && <span className="loadingItem">Loading...</span>}
                    {!isLoadingLocation &&
                      suggestions.map((s, i) => (
                        <span key={i} className="suggestionItem" onClick={() => handleSuggestionClick(s)}>
                          {s.display_name}
                        </span>
                      ))}
                  </ul>
                )}
              </div>

              <div className="buttonRow">
                <i
                  title="Use current location"
                  role="button"
                  className="fa-solid fa-location-dot buttonPrimary clickable"
                  onClick={handleUseMyLocation}
                />
                <button type="submit" className="buttonPrimary">Search</button>
                <button
                  type="button"
                  onClick={() => { setPlace(""); setCategory("hospital"); setIsValidPlace(false); setSuggestions([]); }}
                  className="buttonSecondary"
                >
                  Clear
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterPopup;