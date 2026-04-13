import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPharmacyProfile, fetchInventorySummary } from "../../api/pharmacistApi";
import { getPUser } from "../../api/authapi";
import "./P_shop.css";

const P_shop = () => {
  const navigate  = useNavigate();
  const user      = getPUser();

  const [pharmacy,       setPharmacy]       = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [inventoryStats, setInventoryStats] = useState({ totalMedicines: 0, lowStock: 0 });

  // 🚫 Only pharmacists
  useEffect(() => {
    if (!user || user.role !== "pharmacist") navigate("/login");
  }, [user, navigate]);

  const loadPharmacy = async () => {
    try {
      const res = await getPharmacyProfile();
      setPharmacy(res.data.pharmacy || null);
      if (res.data.pharmacy?.verificationStatus === "verified") {
        const statsRes = await fetchInventorySummary();
        setInventoryStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch pharmacy", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPharmacy();
    const interval = setInterval(loadPharmacy, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p style={{ padding: "2rem" }}>Loading...</p>;

  // ── No pharmacy yet — first time setup ──
  if (!pharmacy) return (
    <div style={{ padding: "2rem" }}>
      <p>You have not created a pharmacy profile yet.</p>
      <Link to="/p-dashboard/shop/verification" className="primary-btn">
        Create Pharmacy Profile
      </Link>
    </div>
  );

  const { verificationStatus } = pharmacy;

  const statusLabel = {
    pending:    "⏳ Pending Verification",
    verified:   "✅ Verified",
    rejected:   "❌ Rejected",
    unverified: "📋 Not Verified",
  }[verificationStatus] || "📋 Not Verified";

  // ✅ Show full verification form only when:
  // - never submitted (unverified)
  // - rejected (need to resubmit)
  // - admin explicitly set a flag requesting re-verification
  const needsVerificationForm =
    verificationStatus === "unverified" ||
    verificationStatus === "rejected"   ||
    pharmacy.reVerificationRequested === true; // admin can flip this flag

  return (
    <div className="shop-wrapper">
      <section className="shop-card">

        {/* Header */}
        <div className="shop-header">
          <h2 className="shop-name">{pharmacy.name}</h2>
          <span className={`status-badge-shop status-${verificationStatus}`}>
            {statusLabel}
          </span>
        </div>

        {/* Info */}
        <div className="shop-info">
          <p><strong>Address:</strong> {pharmacy.address || "Not provided"}</p>
          <p><strong>Email:</strong>   {pharmacy.email   || "Not provided"}</p>
          <p><strong>Phone:</strong>   {pharmacy.phone   || "Not provided"}</p>
        </div>

        {/* Stats — only when verified */}
        {verificationStatus === "verified" && (
          <div className="shop-stats">
            <div>
              <strong>{inventoryStats.totalMedicines}</strong>
              <span>Total Medicines</span>
            </div>
            <div>
              <strong>{inventoryStats.lowStock}</strong>
              <span>Low Stock</span>
            </div>
          </div>
        )}

        {/* ✅ Edit Shop — always available once pharmacy exists */}
        <Link to="/p-dashboard/shop/edit" className="secondary-btn" style={{ marginTop: "12px", display: "inline-block" }}>
          ✏️ Edit Shop Details
        </Link>

        {/* ✅ Verification form — only when needed */}
        {needsVerificationForm && (
          <div className="verification-box" style={{ marginTop: "16px" }}>
            {verificationStatus === "rejected" && pharmacy.rejectionReason && (
              <p style={{ color: "#dc2626", marginBottom: "8px" }}>
                <strong>Rejection reason:</strong> {pharmacy.rejectionReason}
              </p>
            )}
            {verificationStatus === "rejected" && (
              <p>Your verification was rejected. Please update your details and resubmit.</p>
            )}
            {verificationStatus === "unverified" && (
              <p>Upload your documents to apply for verification.</p>
            )}
            {pharmacy.reVerificationRequested && (
              <p>⚠️ Admin has requested you resubmit your verification documents.</p>
            )}
            <Link to="/p-dashboard/shop/verification" className="secondary-btn" style={{ marginTop: "8px", display: "inline-block" }}>
              {verificationStatus === "rejected" ? "🔄 Resubmit Verification" : "📄 Submit Documents"}
            </Link>
          </div>
        )}

        {/* Pending notice */}
        {verificationStatus === "pending" && (
          <div className="verification-box" style={{ marginTop: "16px", background: "#fefce8", border: "1px solid #fde68a" }}>
            <p style={{ color: "#92400e" }}>
              ⏳ Your documents are under review. You'll be notified once verified.
            </p>
          </div>
        )}

        {/* Manage Inventory — verified only */}
        <Link
          to={verificationStatus === "verified" ? "/my-p-inventory" : "#"}
          className={`primary-btn ${verificationStatus !== "verified" ? "btn-disabled" : ""}`}
          onClick={(e) => { if (verificationStatus !== "verified") e.preventDefault(); }}
          style={{ marginTop: "16px", display: "inline-block" }}
        >
          Manage Inventory →
        </Link>

      </section>
    </div>
  );
};

export default P_shop;