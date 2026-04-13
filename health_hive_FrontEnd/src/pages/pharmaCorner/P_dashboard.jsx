import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import P_news from "./P_news";
import P_shop from "./P_shop";
import { getPUser } from "../../api/authapi";
import { getPharmacyProfile } from "../../api/pharmacistApi";
import "./P_dashboard.css";

const PDashboard = () => {
  const user = getPUser();

  const [verificationStatus, setVerificationStatus] = useState(null);
  const [rejectionReason,    setRejectionReason]    = useState("");
  const [statusLoading,      setStatusLoading]      = useState(true);

  useEffect(() => {
    getPharmacyProfile()
      .then((res) => {
        const pharmacy = res?.data?.pharmacy;
        if (pharmacy) {
          setVerificationStatus(pharmacy.verificationStatus || "unverified");
          setRejectionReason(pharmacy.rejectionReason || "");
        } else {
          setVerificationStatus("none");
        }
      })
      .catch(() => setVerificationStatus("unknown"))
      .finally(() => setStatusLoading(false));
  }, []);

  if (!user || user.role !== "pharmacist") return <Navigate to="/login" replace />;

  // ✅ Only show a banner when there's something actionable — never block the dashboard
  const warningBanner = () => {
    if (statusLoading || !verificationStatus) return null;

    switch (verificationStatus) {
      case "none":
        return (
          <div className="setup-warning">
            You haven't created a pharmacy profile yet.{" "}
            <Link to="/p-dashboard/shop/verification">Create profile</Link>
          </div>
        );

      case "unverified":
        return (
          <div className="setup-warning">
            Submit your documents to get verified and unlock inventory.{" "}
            <Link to="/p-dashboard/shop/verification">Submit documents</Link>
          </div>
        );

      case "pending":
        return (
          <div className="setup-warning" style={{ borderColor: "#f59e0b", background: "#fffbeb", color: "#92400e" }}>
            ⏳ Your documents are under review. Inventory is locked until verified.
          </div>
        );

      case "rejected":
        return (
          <div className="setup-warning" style={{ borderColor: "#ef4444", background: "#fef2f2", color: "#991b1b" }}>
            ❌ Your verification was rejected.
            {rejectionReason && <span> <strong>Reason:</strong> {rejectionReason}</span>}
            {" — "}
            <Link to="/p-dashboard/shop/edit">Edit shop details</Link>
            {" or "}
            <Link to="/p-dashboard/shop/verification">Resubmit documents</Link>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Navbar />
      <div className="home-dashboard">
        <h2 className="dashboard-title">Dashboard</h2>

        {/* Banner only — dashboard always fully accessible */}
        {warningBanner()}

        {/* ✅ P_shop and P_news always render regardless of verification status */}
        <div className="inside-section">
          <P_shop />
          <P_news />
        </div>

        {/* Inventory locked inside P_inventoryguard — not here */}
      </div>
    </>
  );
};

export default PDashboard;