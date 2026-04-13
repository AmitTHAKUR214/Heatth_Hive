import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getPharmacyProfile } from "../../api/pharmacistApi";

/**
 * P_verificationGuard
 *
 * Allows access to P_shopVerification ONLY when:
 *  1. No pharmacy profile exists yet (first-time setup)
 *  2. verificationStatus === "rejected"
 *  3. verificationStatus === "unverified"
 *  4. admin set reVerificationRequested === true
 *
 * Everyone else (pending / verified) gets redirected to /p-dashboard/shop
 */
const P_verificationGuard = ({ children }) => {
  const [status, setStatus] = useState("loading"); // "loading" | "allow" | "block"

  useEffect(() => {
    getPharmacyProfile()
      .then((res) => {
        const pharmacy = res?.data?.pharmacy;

        // No pharmacy yet — allow first-time setup
        if (!pharmacy) { setStatus("allow"); return; }

        const { verificationStatus, reVerificationRequested } = pharmacy;

        const allowed =
          verificationStatus === "unverified"  ||
          verificationStatus === "rejected"    ||
          reVerificationRequested === true;

        setStatus(allowed ? "allow" : "block");
      })
      .catch(() => {
        // If fetch fails, safer to block than allow
        setStatus("block");
      });
  }, []);

  if (status === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
        Checking access…
      </div>
    );
  }

  if (status === "block") {
    return <Navigate to="/p-dashboard/shop" replace />;
  }

  return children;
};

export default P_verificationGuard;