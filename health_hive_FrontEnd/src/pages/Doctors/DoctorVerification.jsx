import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getDoctorProfile, saveDoctorProfile, uploadDoctorDocs } from "../../api/Doctorapi";
import "./DoctorVerification.css";

const SPECIALTIES = [
  "General Physician", "Cardiologist", "Dermatologist", "ENT Specialist",
  "Gastroenterologist", "Gynecologist", "Neurologist", "Oncologist",
  "Ophthalmologist", "Orthopedic Surgeon", "Pediatrician", "Psychiatrist",
  "Pulmonologist", "Radiologist", "Urologist", "Other",
];
const QUALIFICATIONS = ["MBBS", "MD", "MS", "BDS", "MDS", "DNB", "DM", "MCh", "MBBS + MD", "MBBS + MS", "Other"];

const DOC_LABELS = {
  medicalDegree:           "Medical Degree (MBBS/MD etc.)",
  registrationCertificate: "Medical Council Registration Certificate",
  governmentId:            "Government ID Proof",
};

export default function DoctorVerification() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    fullName: "", specialty: "", qualification: "",
    registrationNo: "", hospitalName: "", phone: "", city: "",
  });
  const [files,              setFiles]              = useState({ medicalDegree: null, registrationCertificate: null, governmentId: null });
  const [existingDocs,       setExistingDocs]       = useState({});
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [rejectionReason,    setRejectionReason]    = useState("");
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [message,            setMessage]            = useState({ text: "", type: "" });
  const [step,               setStep]               = useState(1);

  useEffect(() => {
    getDoctorProfile()
      .then((res) => {
        const p = res?.data?.profile;
        if (!p) return;
        setProfile({
          fullName:       p.fullName       || "",
          specialty:      p.specialty      || "",
          qualification:  p.qualification  || "",
          registrationNo: p.registrationNo || "",
          hospitalName:   p.hospitalName   || "",
          phone:          p.phone          || "",
          city:           p.city           || "",
        });
        setExistingDocs(p.documents || {});
        setVerificationStatus(p.verificationStatus);
        setRejectionReason(p.rejectionReason || "");
        if (p.fullName && p.specialty) setStep(2);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: f } = e.target;
    setFiles((prev) => ({ ...prev, [name]: f[0] || null }));
  };

  const handleSaveProfile = async () => {
    if (!profile.fullName || !profile.specialty || !profile.qualification || !profile.registrationNo) {
      setMessage({ text: "Please fill all required fields.", type: "error" });
      return;
    }
    setSaving(true);
    setMessage({ text: "", type: "" });
    try {
      await saveDoctorProfile(profile);
      setMessage({ text: "Profile saved. Now upload your documents.", type: "success" });
      setStep(2);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || "Failed to save profile.", type: "error" });
    } finally { setSaving(false); }
  };

  const handleUploadDocs = async () => {
    if (!Object.values(files).some(Boolean)) {
      setMessage({ text: "Please select at least one document to upload.", type: "error" });
      return;
    }
    setSaving(true);
    setMessage({ text: "", type: "" });
    try {
      const fd = new FormData();
      Object.entries(files).forEach(([key, file]) => { if (file) fd.append(key, file); });
      const res = await uploadDoctorDocs(fd);
      setExistingDocs(res.data.documents || {});
      setVerificationStatus("pending");
      setMessage({ text: "Documents submitted! Pending admin review.", type: "success" });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || "Upload failed.", type: "error" });
    } finally { setSaving(false); }
  };

  if (loading) return <><Navbar /><div className="dv-page"><p style={{ opacity: 0.5 }}>Loading…</p></div></>;

  // ── Approved — read-only view ──
  if (verificationStatus === "verified") {
    return (
      <>
        <Navbar />
        <div className="dv-page">
          <div className="dv-approved-card">
            <div className="dv-approved-icon">✅</div>
            <h2>Verification Approved</h2>
            <p>Your doctor profile has been verified. Your badge is active on the platform.</p>
            <div className="dv-approved-details">
              <div className="dv-detail-row"><span>Name</span><strong>{profile.fullName}</strong></div>
              <div className="dv-detail-row"><span>Specialty</span><strong>{profile.specialty}</strong></div>
              <div className="dv-detail-row"><span>Qualification</span><strong>{profile.qualification}</strong></div>
              <div className="dv-detail-row"><span>Reg. No.</span><strong>{profile.registrationNo}</strong></div>
              {profile.hospitalName && <div className="dv-detail-row"><span>Hospital</span><strong>{profile.hospitalName}</strong></div>}
              {profile.city         && <div className="dv-detail-row"><span>City</span><strong>{profile.city}</strong></div>}
            </div>
            <button className="dv-btn secondary" style={{ marginTop: "20px" }} onClick={() => navigate(-1)}>
              ← Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Normal form (pending / rejected / null) ──
  return (
    <>
      <Navbar />
      <div className="dv-page">

        <div className="dv-header">
          <h2>Doctor Verification</h2>
          <p className="dv-subtitle">Submit your credentials to get your verified doctor badge</p>

          {verificationStatus === "pending" && (
            <div className="dv-status-banner" style={{ background: "#fef9c3", color: "#854d0e" }}>
              <strong>⏳ Pending Review</strong>
              <p style={{ marginTop: 4, fontSize: 13 }}>Your documents are under review. You'll be notified once a decision is made.</p>
            </div>
          )}

          {verificationStatus === "rejected" && (
            <div className="dv-status-banner" style={{ background: "#fee2e2", color: "#991b1b" }}>
              <strong>❌ Verification Rejected</strong>
              {rejectionReason && <p className="dv-rejection-reason">Reason: {rejectionReason}</p>}
              <p style={{ marginTop: 4, fontSize: 13 }}>Please correct the issues and re-submit your documents below.</p>
            </div>
          )}
        </div>

        {/* Step tabs */}
        <div className="dv-steps">
          <div className={`dv-step ${step === 1 ? "active" : ""}`} onClick={() => setStep(1)}>
            <span className="dv-step-num">1</span> Profile Details
          </div>
          <div className="dv-step-divider" />
          <div className={`dv-step ${step === 2 ? "active" : ""}`} onClick={() => { if (profile.fullName) setStep(2); }}>
            <span className="dv-step-num">2</span> Upload Documents
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="dv-section">
            <h3 className="dv-section-title">Personal & Professional Details</h3>

            <div className="dv-form-row two">
              <div className="dv-field">
                <label>Full Name <span className="req">*</span></label>
                <input name="fullName" value={profile.fullName} onChange={handleChange} placeholder="Dr. Priya Sharma" />
              </div>
              <div className="dv-field">
                <label>Registration Number <span className="req">*</span></label>
                <input name="registrationNo" value={profile.registrationNo} onChange={handleChange} placeholder="MCI-12345" />
              </div>
            </div>
            <div className="dv-form-row two">
              <div className="dv-field">
                <label>Specialty <span className="req">*</span></label>
                <select name="specialty" value={profile.specialty} onChange={handleChange}>
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="dv-field">
                <label>Qualification <span className="req">*</span></label>
                <select name="qualification" value={profile.qualification} onChange={handleChange}>
                  <option value="">Select qualification</option>
                  {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div className="dv-form-row three">
              <div className="dv-field">
                <label>Hospital / Clinic (optional)</label>
                <input name="hospitalName" value={profile.hospitalName} onChange={handleChange} placeholder="Apollo Hospital" />
              </div>
              <div className="dv-field">
                <label>Phone (optional)</label>
                <input name="phone" value={profile.phone} onChange={handleChange} placeholder="+91 98765 43210" />
              </div>
              <div className="dv-field">
                <label>City (optional)</label>
                <input name="city" value={profile.city} onChange={handleChange} placeholder="Mumbai" />
              </div>
            </div>

            {message.text && <div className={`dv-msg ${message.type}`}>{message.text}</div>}
            <div className="dv-actions">
              <button className="dv-btn primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save & Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="dv-section">
            <h3 className="dv-section-title">Upload Verification Documents</h3>
            <p className="dv-doc-hint">Accepted formats: JPG, PNG, PDF — max 5MB each</p>

            <div className="dv-doc-list">
              {Object.entries(DOC_LABELS).map(([key, label]) => {
                const existing = existingDocs[key];
                return (
                  <div key={key} className="dv-doc-row">
                    <div className="dv-doc-info">
                      <span className="dv-doc-label">{label}</span>
                      {existing?.url && (
                        <div className="dv-doc-existing">
                          <span className="dv-doc-uploaded">📄 Already uploaded</span>
                          <span className={`dv-doc-status ${existing.status}`}>{existing.status}</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      name={key}
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="dv-file-input"
                    />
                    {files[key] && <span className="dv-file-name">📎 {files[key].name}</span>}
                  </div>
                );
              })}
            </div>

            {message.text && <div className={`dv-msg ${message.type}`}>{message.text}</div>}
            <div className="dv-actions">
              <button className="dv-btn secondary" onClick={() => setStep(1)}>← Back</button>
              <button className="dv-btn primary" onClick={handleUploadDocs} disabled={saving}>
                {saving ? "Uploading…" : "Submit Documents"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}