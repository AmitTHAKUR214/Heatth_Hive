import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  getPharmacyProfile,
  updatePharmacyProfile,
  uploadVerificationDocs,
} from "../../api/pharmacistApi";
import "./P_shopVerification.css";

export default function P_shopVerification() {
  const [shop, setShop] = useState({
    name: "", email: "", phone: "", licenseNumber: "", gstNumber: "",
  });

  const [resolvedAddress, setResolvedAddress] = useState(null); // { lat, lng }

  const [files, setFiles] = useState({
    pharmacyLicense: null,
    ownerIdProof:    null,
    gstCertificate:  null,
  });

  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState("");
  const [redirect, setRedirect] = useState(false);

  // ── Load existing profile ──
  useEffect(() => {
    getPharmacyProfile()
      .then((res) => {
        if (!res?.data?.pharmacy) return;
        const p = res.data.pharmacy;
        setShop({
          name:          p.name          || "",
          email:         p.email         || "",
          phone:         p.phone         || "",
          licenseNumber: p.licenseNumber || "",
          gstNumber:     p.gstNumber     || "",
        });
        if (p.location?.coordinates?.length === 2) {
          setResolvedAddress({
            lat: p.location.coordinates[1],
            lng: p.location.coordinates[0],
          });
        }
      })
      .catch(console.error);
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return setMessage("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResolvedAddress({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMessage("");
      },
      () => setMessage("Failed to fetch location")
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setShop((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: f } = e.target;
    setFiles((prev) => ({ ...prev, [name]: f[0] || null }));
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!shop.name.trim()) return setMessage("Pharmacy name is required.");
    if (!resolvedAddress)  return setMessage("Please pin your shop location using the button.");

    setLoading(true);
    try {
      await updatePharmacyProfile({
        ...shop,
        lat: resolvedAddress.lat,
        lng: resolvedAddress.lng,
      });

      const formData = new FormData();
      Object.entries(files).forEach(([key, file]) => { if (file) formData.append(key, file); });
      if ([...formData.keys()].length > 0) await uploadVerificationDocs(formData);

      setMessage("✅ Pharmacy profile submitted. Verification pending.");
      setTimeout(() => setRedirect(true), 1200);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  if (redirect) return <Navigate to="/p-dashboard" />;

  return (
    <div className="page">
      <h2>Pharmacy Registration &amp; Verification</h2>

      <form className="doc-upload" onSubmit={handleSubmit}>

        {/* Basic Details */}
        <div className="section">
          <div className="section-title">Basic Details *</div>
          <div className="form-row">
            <input type="text"  name="name"          placeholder="Pharmacy Name"  value={shop.name}          onChange={handleChange} required />
            <input type="text"  name="phone"         placeholder="Phone Number"   value={shop.phone}         onChange={handleChange} />
            <input type="email" name="email"         placeholder="Email"          value={shop.email}         onChange={handleChange} />
            <input type="text"  name="licenseNumber" placeholder="License Number" value={shop.licenseNumber} onChange={handleChange} />
            <input type="text"  name="gstNumber"     placeholder="GST Number"     value={shop.gstNumber}     onChange={handleChange} />
          </div>
        </div>

        {/* Shop Location */}
        <div className="section">
          <div className="section-title">Shop Location *</div>
          <div className="form-row">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button type="button" onClick={handleUseMyLocation}
                style={{ padding: "10px 16px", cursor: "pointer", width: "fit-content",
                  background: "#16a34a", color: "white", border: "none",
                  borderRadius: "8px", fontSize: "14px" }}>
                📍 Use My Location
              </button>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="number" placeholder="Latitude"
                  value={resolvedAddress?.lat || ""}
                  onChange={(e) => setResolvedAddress(prev => ({ lat: parseFloat(e.target.value), lng: prev?.lng || "" }))}
                  step="any"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
                <input
                  type="number" placeholder="Longitude"
                  value={resolvedAddress?.lng || ""}
                  onChange={(e) => setResolvedAddress(prev => ({ lat: prev?.lat || "", lng: parseFloat(e.target.value) }))}
                  step="any"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "8px",
                    border: "1px solid #e5e7eb", fontSize: "13px" }}
                />
              </div>

              {resolvedAddress?.lat && resolvedAddress?.lng ? (
                <p style={{ color: "#16a34a", fontSize: "13px", margin: 0 }}>
                  ✅ Pinned: {Number(resolvedAddress.lat).toFixed(5)}, {Number(resolvedAddress.lng).toFixed(5)}
                </p>
              ) : (
                <p style={{ color: "#f59e0b", fontSize: "13px", margin: 0 }}>
                  ⚠️ Use my location or enter coordinates manually
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="section">
          <div className="section-title">Upload Documents *</div>
          <div className="form-row">
            <label>Pharmacy License *</label>
            <input type="file" name="pharmacyLicense" onChange={handleFileChange} />
            <label>Owner ID Proof *</label>
            <input type="file" name="ownerIdProof" onChange={handleFileChange} />
            <label>GST Certificate</label>
            <input type="file" name="gstCertificate" onChange={handleFileChange} />
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit for Verification"}
        </button>

        {message && (
          <p style={{ color: message.startsWith("✅") ? "#16a34a" : "#dc2626", marginTop: "8px" }}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}