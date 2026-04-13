import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import pinventorymanagerapi from "../../api/pinventorymanagerapi";
import "./PharmacistDetails.css";

// ✅ Always prefix relative URLs with the backend base
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://localhost:5000";

const resolveUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};

const STATUS_STYLES = {
  verified:   { background: "#dcfce7", color: "#166534" },
  pending:    { background: "#fef3c7", color: "#92400e" },
  rejected:   { background: "#fee2e2", color: "#991b1b" },
  unverified: { background: "#f1f5f9", color: "#475569" },
};

const DOC_LABELS = {
  pharmacyLicense: "Pharmacy License",
  ownerIdProof:    "Owner ID Proof",
  gstCertificate:  "GST Certificate",
};

const PharmacistDetails = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [pharmacist,      setPharmacist]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");
  const [activeDocument,  setActiveDocument]  = useState(null); // { key, url, label }
  const [toast,           setToast]           = useState(null); // { msg, type }

  // Reject modal state
  const [rejectModal,   setRejectModal]   = useState(false);
  const [rejectReason,  setRejectReason]  = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  /* ── Fetch ── */
  useEffect(() => {
    
    const fetchPharmacist = async () => {
      try {
        const res = await pinventorymanagerapi.get(`/admin/pharmacist/${id}`);
        const pharmacy = res.data.pharmacy;
        if (!pharmacy) { setError("Pharmacy not found"); return; }
        setPharmacist({ ...pharmacy, owner: pharmacy.owner || {} });
      } catch (err) {
        if (err.response?.status === 401) navigate("/admin/login");
        else setError("Failed to load pharmacist details");
      } finally { setLoading(false); }
    };
    fetchPharmacist();
    
  }, [id, navigate]);

  /* ── Toast ── */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Approve pharmacy ── */
  const handleApprove = async () => {
    try {
      await pinventorymanagerapi.patch(`/admin/pharmacists/${id}/approve`);
      setPharmacist((prev) => ({ ...prev, verificationStatus: "verified", rejectionReason: "" }));
      showToast("✅ Pharmacy approved");
    } catch { showToast("Failed to approve", "error"); }
  };

  /* ── Reject pharmacy with reason ── */
  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return showToast("Please enter a rejection reason", "error");
    setRejectLoading(true);
    try {
      await pinventorymanagerapi.patch(`/admin/pharmacists/${id}/reject`, { reason: rejectReason });
      setPharmacist((prev) => ({ ...prev, verificationStatus: "rejected", rejectionReason: rejectReason }));
      setRejectModal(false);
      setRejectReason("");
      showToast("Pharmacy rejected");
    } catch { showToast("Failed to reject", "error"); }
    finally { setRejectLoading(false); }
  };

  /* ── ✅ FIXED: updateDocumentStatus was defined but never declared before ── */
  const updateDocumentStatus = async (pharmacyId, documentType, status) => {
    try {
      await pinventorymanagerapi.patch(`/admin/pharmacist/${pharmacyId}/document`, {
        documentType, status,
      });
      setPharmacist((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [documentType]: { ...prev.documents[documentType], status },
        },
      }));
      showToast(`${DOC_LABELS[documentType] || documentType} ${status}`);
    } catch { showToast("Failed to update document", "error"); }
  };

  /* ── Request re-verification ── */
  const handleReVerify = async () => {
    try {
      await pinventorymanagerapi.patch(`/admin/pharmacists/${id}/request-reverification`, { reason: "" });
      setPharmacist((prev) => ({ ...prev, reVerificationRequested: true }));
      showToast("Re-verification requested");
    } catch { showToast("Failed", "error"); }
  };

  /* ── Guards ── */
  if (loading) return <p style={{ padding: "2rem" }}>Loading…</p>;
  if (error)   return <p style={{ color: "red", padding: "2rem" }}>{error}</p>;
  if (!pharmacist) return null;

  const status      = pharmacist.verificationStatus || "unverified";
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.unverified;
  const documents   = Object.entries(pharmacist.documents || {})
    .map(([key, doc]) => ({ key, label: DOC_LABELS[key] || key, url: resolveUrl(doc?.url), docStatus: doc?.status || "pending" }))
    .filter((d) => d.url);
    

  /* ══════════════════════════════════════════════════════ */
  return (
    <section className="Main_Page_container">
      <div className="pharmacist-page">

        {/* Header */}
        <header className="pharmacist-header">
          <button className="back-btn" onClick={() => navigate("/admin")}>← Back</button>
          <h1>Pharmacist Details</h1>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={`status-badge status-${status}`}
              style={{ ...statusStyle, borderRadius: "8px", padding: "4px 14px", fontWeight: 700, fontSize: "13px" }}>
              {status}
            </span>
            {pharmacist.reVerificationRequested && (
              <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: "8px", padding: "4px 14px", fontWeight: 700, fontSize: "13px" }}>
                ⚠️ Re-verify Requested
              </span>
            )}
          </div>
        </header>

        <div className="pharmacist-grid">

          {/* ── Owner Info ── */}
          <div className="info-card">
            <h2>Owner Info</h2>
            <div className="info-row"><strong>Name:</strong>  {pharmacist.owner?.name  || "N/A"}</div>
            <div className="info-row"><strong>Email:</strong> {pharmacist.owner?.email || "N/A"}</div>
            <div className="info-row"><strong>Joined:</strong>
              {pharmacist.owner?.createdAt
                ? new Date(pharmacist.owner.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "N/A"}
            </div>
          </div>

          {/* ── Shop Info ── */}
          <div className="info-card">
            <h2>Shop Info</h2>
            <div className="info-row"><strong>Shop Name:</strong>    {pharmacist.name    || "N/A"}</div>
            <div className="info-row"><strong>Shop Email:</strong>   {pharmacist.email   || "N/A"}</div>
            <div className="info-row"><strong>Phone:</strong>        {pharmacist.phone   || "N/A"}</div>
            <div className="info-row"><strong>Address:</strong>      {pharmacist.address || "N/A"}</div>
            <div className="info-row"><strong>License No:</strong>   {pharmacist.licenseNumber || "N/A"}</div>
            <div className="info-row"><strong>GST No:</strong>       {pharmacist.gstNumber     || "N/A"}</div>
            {pharmacist.location?.coordinates?.length === 2 && (
              <div className="info-row">
                <strong>Coordinates:</strong>{" "}
                <a
                  href={`https://maps.google.com/?q=${pharmacist.location.coordinates[1]},${pharmacist.location.coordinates[0]}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: "#3b82f6" }}>
                  📍 View on map
                </a>
              </div>
            )}
          </div>

          {/* ── Rejection reason (if any) ── */}
          {pharmacist.rejectionReason && (
            <div className="info-card" style={{ borderLeft: "4px solid #ef4444" }}>
              <h2 style={{ color: "#ef4444" }}>Rejection Reason</h2>
              <p style={{ fontSize: "14px", color: "#991b1b", margin: 0 }}>{pharmacist.rejectionReason}</p>
            </div>
          )}

          {/* ── Documents ── */}
          <div className="info-card">
            <h2>Documents</h2>
            {documents.length === 0 ? (
              <div className="no-documents">🔔 No documents uploaded yet</div>
            ) : (
              <ul className="documents-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {documents.map((doc) => (
                  <li key={doc.key} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>{doc.label}</span>

                    {/* Document status badge */}
                    <span style={{
                      fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px",
                      background: doc.docStatus === "approved" ? "#dcfce7" : doc.docStatus === "rejected" ? "#fee2e2" : "#fef3c7",
                      color:      doc.docStatus === "approved" ? "#166534" : doc.docStatus === "rejected" ? "#991b1b" : "#92400e",
                    }}>{doc.docStatus}</span>

                    {/* View button */}
                    <button className="link-btn" onClick={() => setActiveDocument(doc)}>
                      👁 View
                    </button>

                    {/* Approve / Reject individual doc */}
                    {doc.docStatus !== "approved" && (
                      <button className="btn approve" onClick={() => updateDocumentStatus(pharmacist._id, doc.key, "approved")}>
                        ✅ Approve
                      </button>
                    )}
                    {doc.docStatus !== "rejected" && (
                      <button className="btn reject" onClick={() => updateDocumentStatus(pharmacist._id, doc.key, "rejected")}>
                        ❌ Reject
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="info-card">
            <h2>Actions</h2>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {status !== "verified" && (
                <button className="btn approve" onClick={handleApprove}>
                  ✅ Approve Pharmacy
                </button>
              )}
              {status !== "rejected" && (
                <button className="btn reject" onClick={() => { setRejectModal(true); setRejectReason(""); }}>
                  ❌ Reject Pharmacy
                </button>
              )}
              {status === "verified" && (
                <button className="btn" style={{ background: "#f59e0b", color: "white", border: "none" }}
                  onClick={handleReVerify}>
                  🔄 Request Re-verification
                </button>
              )}
              {status === "rejected" && (
                <button className="btn" style={{ background: "#3b82f6", color: "white", border: "none" }}
                  onClick={handleApprove}>
                  ↩️ Re-approve
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Document viewer modal ── */}
      {activeDocument && (
        <div className="modal-overlay" onClick={() => setActiveDocument(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setActiveDocument(null)}>×</button>
            <h3 style={{ margin: "0 0 12px", fontSize: "15px" }}>{activeDocument.label}</h3>
            {activeDocument.url.toLowerCase().match(/\.(pdf)$/) ? (
              <iframe src={activeDocument.url} title="Document" className="modal-doc-viewer" />
            ) : (
              <img src={activeDocument.url} alt={activeDocument.label} className="modal-doc-viewer"
                onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
              />
            )}
            {/* Fallback if image fails */}
            <p style={{ display: "none", color: "#ef4444", textAlign: "center" }}>
              ⚠️ Could not load image.{" "}
              <a href={activeDocument.url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>Open directly</a>
            </p>
          </div>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectModal && (
        <>
          <div onClick={() => setRejectModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "var(--card-bg, white)", border: "1px solid #e5e7eb",
            borderRadius: "14px", padding: "28px", zIndex: 1001, width: "min(420px, 90vw)",
          }}>
            <h3 style={{ margin: "0 0 6px" }}>Reject Pharmacy</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>{pharmacist.name}</p>
            <label style={{ fontSize: "12px", display: "block", marginBottom: "6px" }}>
              Reason <span style={{ color: "#ef4444" }}>*</span>
              <span style={{ color: "#9ca3af", fontWeight: 400 }}> — the pharmacist will see this</span>
            </label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. License document is blurry, please resubmit a clearer photo…"
              rows={4}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", resize: "vertical", boxSizing: "border-box", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setRejectModal(false)}
                style={{ padding: "8px 18px", background: "none", border: "1px solid #e5e7eb", borderRadius: "8px", cursor: "pointer", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={handleRejectSubmit} disabled={rejectLoading}
                className="btn reject" style={{ padding: "8px 18px" }}>
                {rejectLoading ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 2000,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "white", borderRadius: "10px", padding: "12px 20px",
          fontSize: "14px", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          {toast.msg}
        </div>
      )}
    </section>
  );
};

export default PharmacistDetails;