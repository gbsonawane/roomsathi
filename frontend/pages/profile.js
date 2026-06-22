import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import ListingCard from "../components/ListingCard";
import RazorpayModal from "../components/RazorpayModal";
import { 
  getOwnerListings, 
  getSavedListings, 
  getPayments,
  boostListing,
  confirmBoost
} from "../lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState("listings"); // listings | saved | payments

  // Data states
  const [ownerListings, setOwnerListings] = useState([]);
  const [savedListings, setSavedListings] = useState([]);
  const [payments, setPayments] = useState([]);

  // UI state
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  // Boost payment state
  const [boostListingId, setBoostListingId] = useState(null);
  const [selectedBoostDays, setSelectedBoostDays] = useState(7);
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [processingBoost, setProcessingBoost] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading]);

  const loadTabData = async () => {
    if (!token) return;
    setLoadingData(true);
    setError("");
    try {
      if (activeTab === "listings") {
        const data = await getOwnerListings(token);
        setOwnerListings(data);
      } else if (activeTab === "saved") {
        const data = await getSavedListings(token);
        setSavedListings(data);
      } else if (activeTab === "payments") {
        const data = await getPayments(token);
        setPayments(data);
      }
    } catch (err) {
      setError(err.message || "Failed to load tab information");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && token) {
      loadTabData();
    }
  }, [user, activeTab]);

  // Handle boost trigger
  const handleOpenBoostModal = (listingId) => {
    setBoostListingId(listingId);
    setBoostModalOpen(true);
  };

  const handleInitiateBoost = async (days) => {
    setSelectedBoostDays(days);
    setProcessingBoost(true);
    try {
      const res = await boostListing(boostListingId, days, token);
      if (res.status === "payment_required") {
        setPaymentConfig({
          amount: res.amount,
          order_id: res.order_id,
          key_id: res.key_id,
        });
        setPaymentOpen(true);
      }
    } catch (err) {
      alert(err.message || "Failed to initiate boost payment");
    } finally {
      setProcessingBoost(false);
    }
  };

  const handleConfirmBoost = async (paymentId, signature) => {
    setProcessingBoost(true);
    try {
      const payload = {
        razorpay_order_id: paymentConfig.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        listing_id: boostListingId,
        boost_days: selectedBoostDays,
      };
      await confirmBoost(payload, token);
      setBoostModalOpen(false);
      loadTabData(); // reload listings
      alert("Listing boosted successfully!");
    } catch (err) {
      alert(err.message || "Failed to verify payment");
    } finally {
      setProcessingBoost(false);
    }
  };

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading profile...</h2>
      </div>
    );
  }

  const hasPlan = user.plan_type === "monthly" && user.plan_expires_at;
  const isPlanActive = hasPlan && new Date(user.plan_expires_at) > new Date();

  return (
    <>
    <div className="profile-container">
        
        {/* Profile Info Summary Card */}
        <div className="card profile-summary-card">
          <div className="profile-avatar">
            {user.full_name ? user.full_name[0].toUpperCase() : "👤"}
          </div>
          <div className="profile-info-details">
            <h2>{user.full_name}</h2>
            <p className="contact-info">📞 {user.phone}</p>
            <div className="profile-meta-pills">
              <span className={`role-pill ${user.role}`}>
                Role: {user.role === "owner" ? "Owner / Lister" : "Room Seeker"}
              </span>
              <span className={`plan-pill ${isPlanActive ? "premium" : "free"}`}>
                {isPlanActive ? "👑 Monthly Pass Active" : "Free Seeker Account"}
              </span>
            </div>
            {isPlanActive && (
              <p className="expiry-text">
                Pass expires on: <strong>{new Date(user.plan_expires_at).toLocaleDateString("en-IN")}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="profile-tabs-nav">
          <button 
            className={`tab-link ${activeTab === "listings" ? "active" : ""}`}
            onClick={() => setActiveTab("listings")}
          >
            📋 My Listings
          </button>
          <button 
            className={`tab-link ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            ❤️ Saved Bookmarks
          </button>
          <button 
            className={`tab-link ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            💳 Transaction History
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="profile-tab-content">
          {error && (
            <div className="error-box">
              <p>{error}</p>
            </div>
          )}

          {loadingData ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p>Loading items...</p>
            </div>
          ) : (
            <div>
              
              {/* TAB 1: MY LISTINGS */}
              {activeTab === "listings" && (
                <div>
                  {ownerListings.length > 0 ? (
                    <div className="listings-grid">
                      {ownerListings.map(listing => (
                        <div key={listing.id} className="owner-listing-item">
                          <ListingCard listing={listing} token={token} />
                          <div className="owner-action-strip">
                            {listing.is_boosted ? (
                              <span className="boost-active-tag">🚀 Boost Active</span>
                            ) : (
                              <button 
                                className="primary boost-btn"
                                onClick={() => handleOpenBoostModal(listing.id)}
                              >
                                ⚡ Boost Listing
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-tab card">
                      <p>You haven't posted any room listings yet.</p>
                      <button className="primary" onClick={() => router.push("/create-listing")} style={{ marginTop: "12px" }}>
                        ➕ Create My First Listing
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SAVED LISTINGS */}
              {activeTab === "saved" && (
                <div>
                  {savedListings.length > 0 ? (
                    <div className="listings-grid">
                      {savedListings.map(listing => (
                        <ListingCard 
                          key={listing.id} 
                          listing={listing} 
                          token={token} 
                          onSavedToggle={() => loadTabData()} // refresh saved list on unsave
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-tab card">
                      <p>No saved bookmarks found. Browse rooms and save them to view them here.</p>
                      <button className="primary" onClick={() => router.push("/search")} style={{ marginTop: "12px" }}>
                        Browse Listings
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PAYMENT HISTORY */}
              {activeTab === "payments" && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {payments.length > 0 ? (
                    <div className="payments-table-container">
                      <table className="payments-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Purpose</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(p => (
                            <tr key={p.id}>
                              <td>{new Date(p.created_at).toLocaleDateString("en-IN", { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{p.payment_type.replace("_", " ").toUpperCase()}</td>
                              <td style={{ fontWeight: 700, color: "#065f46" }}>₹{p.amount}</td>
                              <td>
                                <span className={`status-tag ${p.status}`}>
                                  {p.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-tab" style={{ padding: "30px", textAlign: "center" }}>
                      <p style={{ margin: 0, color: "#6b7280" }}>No transaction records found.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* BOOST MODAL */}
      {boostModalOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal card">
            <button className="close-modal-btn" onClick={() => setBoostModalOpen(false)}>✕</button>
            
            <h3 style={{ margin: "0 0 10px", fontSize: "1.25rem", color: "#111827" }}>Boost Your Listing</h3>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 20px" }}>
              Get featured at the top of search query results and receive up to 10x more renter leads.
            </p>

            <div className="modal-options-list">
              
              <div 
                className={`modal-pay-option ${selectedBoostDays === 7 ? "selected" : ""}`}
                onClick={() => setSelectedBoostDays(7)}
              >
                <input 
                  type="radio" 
                  checked={selectedBoostDays === 7} 
                  readOnly 
                />
                <div style={{ flexGrow: 1 }}>
                  <strong>7 Days Boost</strong>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "#6b7280" }}>
                    Standard priority highlight placement
                  </span>
                </div>
                <div className="price-tag">₹49</div>
              </div>

              <div 
                className={`modal-pay-option ${selectedBoostDays === 15 ? "selected" : ""}`}
                onClick={() => setSelectedBoostDays(15)}
              >
                <input 
                  type="radio" 
                  checked={selectedBoostDays === 15} 
                  readOnly
                />
                <div style={{ flexGrow: 1 }}>
                  <strong>15 Days Boost</strong>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "#6b7280" }}>
                    Maximum search priority placement
                  </span>
                </div>
                <div className="price-tag">₹89</div>
              </div>

            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "10px" }}>
              <button 
                className="outline" 
                style={{ flex: 1 }}
                onClick={() => setBoostModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="primary" 
                style={{ flex: 2 }}
                disabled={processingBoost}
                onClick={() => handleInitiateBoost(selectedBoostDays)}
              >
                {processingBoost ? "Processing..." : `Pay ₹${selectedBoostDays === 7 ? "49" : "89"}`}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Razorpay Integration */}
      {paymentConfig && (
        <RazorpayModal
          isOpen={paymentOpen}
          amount={paymentConfig.amount}
          orderId={paymentConfig.order_id}
          keyId={paymentConfig.key_id}
          onClose={() => setPaymentOpen(false)}
          onSuccess={(paymentId, signature) => {
            handleConfirmBoost(paymentId, signature);
          }}
          onFailure={(err) => {
            alert(err || "Payment failed");
          }}
        />
      )}

      <style jsx>{`
        .profile-container {
          margin-top: 10px;
        }
        .profile-summary-card {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }
        @media(max-width: 500px) {
          .profile-summary-card {
            flex-direction: column;
            text-align: center;
          }
        }
        .profile-avatar {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #065f46;
          color: white;
          font-size: 2.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .profile-info-details h2 {
          margin: 0;
          color: #111827;
        }
        .contact-info {
          margin: 4px 0 10px;
          color: #4b5563;
          font-size: 0.95rem;
        }
        .profile-meta-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .role-pill, .plan-pill {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .role-pill {
          background: #f1f5f9;
          color: #475569;
        }
        .plan-pill.free {
          background: #f3f4f6;
          color: #4b5563;
        }
        .plan-pill.premium {
          background: #ecfdf5;
          color: #065f46;
        }
        .expiry-text {
          font-size: 0.8rem;
          color: #6b7280;
          margin: 8px 0 0;
        }
        .profile-tabs-nav {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 20px;
        }
        .tab-link {
          background: transparent;
          border: none;
          padding: 10px 16px;
          font-weight: 600;
          font-size: 0.95rem;
          color: #6b7280;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .tab-link:hover {
          color: #111827;
        }
        .tab-link.active {
          color: #065f46;
          border-color: #065f46;
        }
        .error-box {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fee2e2;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }
        .owner-listing-item {
          display: flex;
          flex-direction: column;
        }
        .owner-action-strip {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 18px 18px;
          margin-top: -18px;
          padding: 12px;
          display: flex;
          justify-content: center;
        }
        .boost-active-tag {
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e40af;
          background: #eff6ff;
          padding: 6px 12px;
          border-radius: 999px;
          width: 100%;
          text-align: center;
        }
        .boost-btn {
          width: 100%;
          font-size: 0.8rem;
          padding: 8px 14px;
        }
        .empty-tab {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
        .payments-table-container {
          width: 100%;
          overflow-x: auto;
        }
        .payments-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }
        .payments-table th, .payments-table td {
          padding: 14px 18px;
          border-bottom: 1px solid #e5e7eb;
        }
        .payments-table th {
          background: #f9fafb;
          color: #374151;
          font-weight: 600;
        }
        .status-tag {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .status-tag.success {
          background: #d1fae5;
          color: #065f46;
        }
        .status-tag.pending {
          background: #fef3c7;
          color: #d97706;
        }
        .status-tag.failed {
          background: #fee2e2;
          color: #b91c1c;
        }
        .custom-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-modal {
          max-width: 440px;
          width: 90%;
          position: relative;
        }
        .close-modal-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 1.2rem;
          color: #6b7280;
          cursor: pointer;
        }
        .modal-options-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .modal-pay-option {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .modal-pay-option:hover {
          border-color: #065f46;
          background: #f0fdf4;
        }
        .modal-pay-option.selected {
          border-color: #065f46;
          background: #ecfdf5;
        }
        .modal-pay-option strong {
          display: block;
          font-size: 0.9rem;
          color: #111827;
        }
        .price-tag {
          font-weight: 800;
          font-size: 1.1rem;
          color: #065f46;
        }
      `}</style>
    </>
  );
}
