import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getListings, unlockContact, confirmUnlock } from "../lib/api";
import ListingCard from "../components/ListingCard";
import RazorpayModal from "../components/RazorpayModal";

export default function HomePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [featuredListings, setFeaturedListings] = useState([]);
  const [recentListings, setRecentListings] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [loadingListings, setLoadingListings] = useState(true);

  // Pass purchase states
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }

    if (user && token) {
      setLoadingListings(true);
      
      // Load both boosted and recent listings
      Promise.all([
        getListings({ is_boosted: true, limit: 3 }),
        getListings({ limit: 6 })
      ])
        .then(([boosted, all]) => {
          setFeaturedListings(boosted);
          // filter out duplicates if any
          const boostedIds = new Set(boosted.map(b => b.id));
          setRecentListings(all.filter(item => !boostedIds.has(item.id)));
        })
        .catch((err) => setFetchError(err.message))
        .finally(() => setLoadingListings(false));
    }
  }, [user, loading, token]);

  const handleBuyPass = async () => {
    setPurchasing(true);
    try {
      // Create order for monthly plan
      // We can use a dummy/general listing id or handle it as listing_id = "" in unlock contact
      // Let's pass "plan" to unlockContact with dummy listing_id = "" to generate plan order
      const res = await unlockContact("", "plan", token);
      if (res.status === "payment_required") {
        setPaymentConfig({
          amount: res.amount,
          order_id: res.order_id,
          key_id: res.key_id,
        });
        setPaymentOpen(true);
      }
    } catch (err) {
      alert(err.message || "Failed to initiate pass purchase");
    } finally {
      setPurchasing(false);
    }
  };

  const handleConfirmPassPayment = async (paymentId, signature) => {
    setPurchasing(true);
    try {
      const payload = {
        razorpay_order_id: paymentConfig.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        listing_id: "",
        unlock_type: "plan",
      };
      await confirmUnlock(payload, token);
      setPaymentOpen(false);
      alert("RoomSathi Monthly Pass Activated! Enjoy unlimited contact unlocks.");
      window.location.reload();
    } catch (err) {
      alert(err.message || "Failed to verify payment");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  const isPassActive = user.plan_type === "monthly" && user.plan_expires_at && new Date(user.plan_expires_at) > new Date();

  return (
    <div className="home-dashboard">
        
        {/* Hero Welcome banner */}
        <header className="hero-banner">
          <div className="hero-content">
            <h1>Welcome, {user.full_name || "Friend"}!</h1>
            <p>Your hyperlocal community to find rooms and roommates in Pune, Maharashtra.</p>
            
            <div className="hero-actions">
              <button className="primary hero-btn" onClick={() => router.push("/search")}>
                🔍 Search Rooms & Roommates
              </button>
              <button className="outline secondary-hero-btn" onClick={() => router.push("/create-listing")}>
                ➕ Post a Room / Requirement
              </button>
            </div>
          </div>
          <div className="hero-graphic">🏠🤝</div>
        </header>

        {/* Plan Upgrade Banner */}
        {!isPassActive ? (
          <div className="card upgrade-pass-banner animate-fade">
            <div className="banner-icon">👑</div>
            <div className="banner-details">
              <h3>Get RoomSathi Monthly Pass</h3>
              <p>Unlock unlimited owner contact details for 30 days. Save money on brokers & agents.</p>
            </div>
            <button 
              className="primary buy-pass-btn" 
              onClick={handleBuyPass}
              disabled={purchasing}
            >
              {purchasing ? "Processing..." : "Get Pass for ₹299"}
            </button>
          </div>
        ) : (
          <div className="card pass-active-banner">
            <div className="banner-icon">🎉</div>
            <div className="banner-details">
              <h3>Monthly Pass Active</h3>
              <p>You have unlimited contact unlocks. Expires on: {new Date(user.plan_expires_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* TOP BOOSTED LISTINGS */}
        {featuredListings.length > 0 && (
          <section className="dashboard-section">
            <div className="section-header">
              <h2>⚡ Featured Properties</h2>
              <span className="section-subtitle">Top boosted postings in Pune</span>
            </div>
            <div className="listings-grid">
              {featuredListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} token={token} />
              ))}
            </div>
          </section>
        )}

        {/* RECENT LISTINGS */}
        <section className="dashboard-section" style={{ marginTop: "32px" }}>
          <div className="section-header">
            <h2>🏠 Fresh Listings</h2>
            <span className="section-subtitle">Newly posted listings across Pune</span>
          </div>

          {fetchError && <p className="error-text">{fetchError}</p>}

          {loadingListings ? (
            <div className="skeleton-grid">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton-card card">
                  <div className="skeleton-image"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line title"></div>
                    <div className="skeleton-line text"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentListings.length > 0 ? (
            <div className="listings-grid">
              {recentListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} token={token} />
              ))}
            </div>
          ) : (
            <div className="card empty-state" style={{ padding: "40px", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#6b7280" }}>No fresh listings posted today. Check back later!</p>
            </div>
          )}
        </section>

      {/* Razorpay Integration */}
      {paymentConfig && (
        <RazorpayModal
          isOpen={paymentOpen}
          amount={paymentConfig.amount}
          orderId={paymentConfig.order_id}
          keyId={paymentConfig.key_id}
          onClose={() => setPaymentOpen(false)}
          onSuccess={(paymentId, signature) => {
            handleConfirmPassPayment(paymentId, signature);
          }}
          onFailure={(err) => {
            alert(err || "Payment failed");
          }}
        />
      )}

      <style jsx>{`
        .home-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .hero-banner {
          background: linear-gradient(135deg, #065f46 0%, #047857 100%);
          border-radius: 20px;
          padding: 40px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        @media(max-width: 600px) {
          .hero-banner {
            flex-direction: column-reverse;
            text-align: center;
            padding: 30px 20px;
          }
          .hero-graphic {
            font-size: 4rem !important;
            margin-bottom: 20px;
          }
        }
        .hero-content h1 {
          font-size: 2.5rem;
          margin: 0 0 10px;
          font-weight: 800;
        }
        .hero-content p {
          font-size: 1.1rem;
          color: #d1fae5;
          margin: 0 0 24px;
          max-width: 500px;
        }
        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .hero-btn {
          background: white;
          color: #065f46;
          border-color: white;
          padding: 12px 20px;
        }
        .hero-btn:hover {
          background: #f0fdf4;
          color: #047857;
        }
        .secondary-hero-btn {
          border-color: rgba(255, 255, 255, 0.4);
          color: white;
          padding: 12px 20px;
        }
        .secondary-hero-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .hero-graphic {
          font-size: 6rem;
          user-select: none;
        }
        .upgrade-pass-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          background: linear-gradient(to right, #ecfdf5, #f0fdf4);
          border-color: #a7f3d0;
        }
        .pass-active-banner {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #eff6ff;
          border-color: #bfdbfe;
        }
        @media(max-width: 600px) {
          .upgrade-pass-banner, .pass-active-banner {
            flex-direction: column;
            text-align: center;
          }
        }
        .banner-icon {
          font-size: 2.2rem;
        }
        .banner-details {
          flex-grow: 1;
        }
        .banner-details h3 {
          margin: 0 0 4px;
          color: #111827;
        }
        .banner-details p {
          margin: 0;
          color: #4b5563;
          font-size: 0.9rem;
        }
        .buy-pass-btn {
          padding: 10px 18px;
          font-size: 0.9rem;
        }
        .dashboard-section {
          margin-top: 10px;
        }
        .section-header {
          margin-bottom: 16px;
        }
        .section-header h2 {
          margin: 0;
          color: #111827;
        }
        .section-subtitle {
          color: #6b7280;
          font-size: 0.85rem;
        }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 24px;
        }
        .error-text {
          color: #dc2626;
        }
        /* Skeleton loaders */
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 24px;
        }
        .skeleton-card {
          padding: 0 !important;
          overflow: hidden;
        }
        .skeleton-image {
          aspect-ratio: 16/10;
          background: #e5e7eb;
          animation: pulse 1.5s infinite;
        }
        .skeleton-content {
          padding: 16px;
        }
        .skeleton-line {
          background: #e5e7eb;
          height: 14px;
          border-radius: 4px;
          margin-bottom: 8px;
          animation: pulse 1.5s infinite;
        }
        .skeleton-line.title {
          width: 70%;
          height: 18px;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.9; }
          100% { opacity: 0.6; }
        }
        .animate-fade {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
