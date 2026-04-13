import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getPUser } from "../../api/authapi";
import pinventorymanagerapi from "../../api/pinventorymanagerapi";

/**
 * PharmacistInventoryGuard
 *
 * ✅ FIX: Old guard only checked localStorage user.role — stale data.
 * Now we verify against the server:
 *   1. Check role === "pharmacist" from localStorage (fast, cheap)
 *   2. Fetch /pharmacist/shop from server to confirm verificationStatus === "verified"
 *
 * This prevents unverified pharmacists from accessing inventory even if they
 * manually edit localStorage.
 */
function PharmacistInventoryGuard({ children }) {
  const user = getPUser();

  const [status, setStatus] = useState("loading"); // "loading" | "allowed" | "not-pharmacist" | "not-verified"

  useEffect(() => {
    // Step 1: fast role check
    if (!user || user.role !== "pharmacist") {
      setStatus("not-pharmacist");
      return;
    }

    // Step 2: server-side verification check
    pinventorymanagerapi
      .get("/pharmacist/shop")
      .then(({ data }) => {
        const verificationStatus = data?.pharmacy?.verificationStatus;
        if (verificationStatus === "verified") {
          setStatus("allowed");
        } else {
          setStatus("not-verified");
        }
      })
      .catch((err) => {
        // If 403/404 → not set up or not verified
        const code = err?.response?.data?.code;
        if (code === "PHARMACY_NOT_CREATED" || code === "PHARMACY_NOT_VERIFIED") {
          setStatus("not-verified");
        } else {
          // Network error — fail closed (don't grant access)
          console.error("Guard check failed:", err);
          setStatus("not-verified");
        }
      });
  }, []);

  if (status === "loading") {
    return <p style={{ padding: "2rem" }}>Checking access...</p>;
  }

  if (status === "not-pharmacist") {
    return <Navigate to="/login" />;
  }

  if (status === "not-verified") {
    return (
      <div style={{ padding: "2rem" }}>
        <h3>Inventory Locked</h3>
        <p>Your pharmacy is not verified yet. Please wait for admin approval.</p>
        <a href="/p-dashboard/" style={{ marginTop: "12px", display: "inline-block" }}>
          Back to Dashboard →
        </a>
      </div>
    );
  }

  return children;
}

export default PharmacistInventoryGuard;