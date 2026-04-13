import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import {
  getPharmacyInventory,
  subscribeToPharmacy,
  bookMedicine,
  cancelBooking,
} from "../../api/pharmacyDiscoveryApi";
import { getPUser } from "../../api/authapi";
import "./PharmacyInventoryPage.css";

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function expiryMonth(expiry) {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

export default function PharmacyInventoryPage() {
  const { id }   = useParams();
  const user     = getPUser();
  const navigate = useNavigate();

  const [pharmacy,    setPharmacy]    = useState(null);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [needsSub,    setNeedsSub]    = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Booking modal
  const [bookingItem,  setBookingItem]  = useState(null);
  const [bookQty,      setBookQty]      = useState(1);
  const [bookNote,     setBookNote]     = useState("");
  const [bookLoading,  setBookLoading]  = useState(false);
  const [bookError,    setBookError]    = useState("");

  // Filters
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("all");

  const load = async () => {
    try {
      const res = await getPharmacyInventory(id);
      setItems(res.data.items || []);
      setPharmacy(res.data.pharmacy);
      setNeedsSub(false);
    } catch (err) {
      if (err.response?.data?.requiresSubscription) {
        setNeedsSub(true);
      } else {
        setError(err.response?.data?.message || "Failed to load inventory");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, [id]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await subscribeToPharmacy(id);
      setLoading(true);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  };

  const openBooking = (item) => {
    setBookingItem(item);
    setBookQty(1);
    setBookNote("");
    setBookError("");
  };

  const handleBook = async () => {
    setBookLoading(true);
    setBookError("");
    try {
      await bookMedicine(id, bookingItem._id, bookQty, bookNote);
      setBookingItem(null);
      await load();
    } catch (err) {
      setBookError(err.response?.data?.message || "Booking failed");
    } finally {
      setBookLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await cancelBooking(bookingId);
      await load();
    } catch {}
  };

  // available stock = quantity - all active holds elsewhere
  // (we don't have that count client-side, so just show quantity with booking badge)
  const categories = ["all", ...new Set(items.map(m => m.category).filter(Boolean))];
  const filtered = items.filter(m => {
    const matchCat = category === "all" || m.category === category;
    const matchQ   = (m.medicineName || "").toLowerCase().includes(search.toLowerCase()) ||
                     (m.brand || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  if (loading) return (
    <>
      <Navbar />
      <div className="pip-page"><div className="pip-loading">Loading inventory…</div></div>
    </>
  );

  if (needsSub) return (
    <>
      <Navbar />
      <div className="pip-page">
        <div className="pip-gate">
          <div className="pip-gate-icon">🔒</div>
          <h2>Subscribers Only</h2>
          <p>Subscribe to this pharmacy to view their live inventory and book medicines for pickup.</p>
          <div className="pip-gate-perks">
            <span>💊 Live stock visibility</span>
            <span>📦 Reserve medicines</span>
            <span>🔔 Stock alerts</span>
          </div>
          {error && <p className="pip-error">{error}</p>}
          <button className="pip-sub-cta" onClick={handleSubscribe} disabled={subscribing}>
            {subscribing ? "Subscribing…" : "Subscribe Now — It's Free"}
          </button>
          <Link to="/pharmacies" className="pip-back-link">← Back to pharmacies</Link>
        </div>
      </div>
    </>
  );

  if (error) return (
    <>
      <Navbar />
      <div className="pip-page"><p className="pip-error">{error}</p></div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="pip-page">

        {/* Header */}
        <Link to="/pharmacies" className="pip-back">← Back to Pharmacies</Link>
        <div className="pip-pharmacy-info">
          <div className="pip-pharmacy-icon">🏪</div>
          <div>
            <h1 className="pip-pharmacy-name">{pharmacy?.name}</h1>
            <p className="pip-pharmacy-addr">{pharmacy?.address}</p>
            {pharmacy?.phone && <p className="pip-pharmacy-addr">📞 {pharmacy.phone}</p>}
          </div>
          <span className="pip-verified-badge">✅ Verified</span>
        </div>

        {/* Stats bar */}
        <div className="pip-stats-bar">
          <div className="pip-stat-chip"><strong>{items.length}</strong> total</div>
          <div className="pip-stat-chip"><strong>{items.filter(m => m.quantity > 5).length}</strong> in stock</div>
          <div className="pip-stat-chip pip-warn"><strong>{items.filter(m => m.quantity > 0 && m.quantity <= 5).length}</strong> low stock</div>
          <div className="pip-stat-chip pip-danger"><strong>{items.filter(m => m.quantity === 0).length}</strong> out of stock</div>
        </div>

        {/* Filters */}
        <div className="pip-filters">
          <input
            className="pip-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search medicines or brands…"
          />
          <div className="pip-category-tabs">
            {categories.map(cat => (
              <button key={cat} className={`pip-cat-btn ${category === cat ? "active" : ""}`} onClick={() => setCategory(cat)}>
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0
          ? <div className="pip-empty">No medicines match your search.</div>
          : (
            <div className="pip-grid">
              {filtered.map((item, idx) => {
                const qty        = item.quantity || 0;
                const inStock    = qty > 0;
                const lowStock   = qty > 0 && qty <= 5;
                const hasBooking = !!item.userBooking;
                const expMonth   = expiryMonth(item.expiry);
                const isExpired  = expMonth && new Date(item.expiry) < new Date();

                return (
                  <div key={item._id || idx} className={`pip-med-card ${!inStock ? "out-of-stock" : ""}`}>
                    <div className="pip-med-top">
                      <span className="pip-med-icon">💊</span>
                      <div className="pip-med-info">
                        <h3 className="pip-med-name">{item.medicineName}</h3>
                        {item.brand && <p className="pip-med-brand">{item.brand}</p>}
                      </div>
                      <span className={`pip-stock-badge ${lowStock ? "low" : !inStock ? "out" : "ok"}`}>
                        {!inStock ? "Out of Stock" : lowStock ? `Low: ${qty}` : `${qty} left`}
                      </span>
                    </div>

                    <div className="pip-med-meta">
                      {item.category && <span className="pip-meta-tag">{item.category}</span>}
                      {item.price > 0  && <span className="pip-meta-tag pip-price">₹{item.price}</span>}
                      {expMonth && (
                        <span className={`pip-meta-tag ${isExpired ? "pip-expired" : ""}`}>
                          Exp: {expMonth}
                        </span>
                      )}
                    </div>

                    <div className="pip-med-footer">
                      {hasBooking ? (
                        <div className="pip-booking-chip">
                          <span>📦 Booked {item.userBooking.quantity}× — {timeLeft(item.userBooking.expiresAt)}</span>
                          <button className="pip-cancel-booking" onClick={() => handleCancelBooking(item.userBooking._id)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="pip-book-btn" disabled={!inStock} onClick={() => openBooking(item)}>
                          {inStock ? "📦 Reserve for Pickup" : "Unavailable"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Booking Modal */}
      {bookingItem && (
        <>
          <div className="pip-overlay" onClick={() => setBookingItem(null)} />
          <div className="pip-modal">
            <div className="pip-modal-header">
              <h3>Reserve Medicine</h3>
              <button className="pip-modal-close" onClick={() => setBookingItem(null)}>✕</button>
            </div>

            <div className="pip-modal-med">
              <span style={{ fontSize: "24px" }}>💊</span>
              <div>
                <p className="pip-modal-med-name">{bookingItem.medicineName}</p>
                {bookingItem.brand && <p style={{ fontSize: "12px", color: "var(--color-3)" }}>{bookingItem.brand}</p>}
              </div>
              {bookingItem.price > 0 && (
                <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--color-g)" }}>
                  ₹{bookingItem.price}
                </span>
              )}
            </div>

            <div className="pip-modal-info">
              🕐 This hold lasts <strong>24 hours</strong>. Visit the pharmacy to pick up.
            </div>

            <label className="pip-modal-label">Quantity</label>
            <div className="pip-qty-row">
              <button onClick={() => setBookQty(q => Math.max(1, q - 1))}>−</button>
              <span>{bookQty}</span>
              <button onClick={() => setBookQty(q => Math.min(bookingItem.quantity, q + 1))}>+</button>
              <span className="pip-qty-max">of {bookingItem.quantity} available</span>
            </div>

            <label className="pip-modal-label">
              Pickup note <span style={{ fontWeight: 400, color: "var(--color-3)" }}>(optional)</span>
            </label>
            <textarea
              className="pip-modal-note"
              value={bookNote}
              onChange={e => setBookNote(e.target.value)}
              placeholder="e.g. I'll come in the evening…"
              rows={2}
            />

            {bookingItem.price > 0 && (
              <div className="pip-modal-total">
                <span>Estimated total</span>
                <strong>₹{(bookingItem.price * bookQty).toFixed(2)}</strong>
              </div>
            )}

            {bookError && <p className="pip-error">⚠️ {bookError}</p>}

            <button className="pip-modal-confirm" onClick={handleBook} disabled={bookLoading}>
              {bookLoading ? "Confirming…" : "Confirm Booking"}
            </button>
          </div>
        </>
      )}
    </>
  );
}