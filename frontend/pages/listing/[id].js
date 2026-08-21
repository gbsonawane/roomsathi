import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import RazorpayModal from "../../components/RazorpayModal";
import {
  getListing,
  saveListing,
  unsaveListing,
  unlockContact,
  confirmUnlock,
  boostListing,
  confirmBoost,
  chatWithAssistant
} from "../../lib/api";

export default function ListingDetailPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const { id } = router.query;

  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [loadingListing, setLoadingListing] = useState(true);

  // Gallery states
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Unlock modal states
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedUnlockType, setSelectedUnlockType] = useState("single"); // single | plan

  // Boost modal states
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [selectedBoostDays, setSelectedBoostDays] = useState(7); // 7 | 15

  // Razorpay states
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPurpose, setPaymentPurpose] = useState(""); // unlock | boost
  const [processingPayment, setProcessingPayment] = useState(false);

  // AI Chat Widget States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your RoomSathi Assistant. Ask me anything about this listing, the area, rent negotiation, or what to check before you move in. 🏠"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const fetchListingDetails = async () => {
    if (!id) return;
    setLoadingListing(true);
    try {
      const data = await getListing(id, token);
      setListing(data);
    } catch (err) {
      setError(err.message || "Failed to fetch listing details");
    } finally {
      setLoadingListing(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }
    if (id) {
      fetchListingDetails();
    }
  }, [id, user, loading]);

  const handleSaveToggle = async () => {
    if (!listing || !token) return;
    try {
      if (listing.is_saved) {
        await unsaveListing(listing.id, token);
        setListing(prev => ({ ...prev, is_saved: false, save_count: Math.max(0, (prev.save_count || 1) - 1) }));
      } else {
        await saveListing(listing.id, token);
        setListing(prev => ({ ...prev, is_saved: true, save_count: (prev.save_count || 0) + 1 }));
      }
    } catch (err) {
      alert(err.message || "Failed to update saved status");
    }
  };

  // Initiate Unlock
  const handleInitiateUnlock = async (unlockType) => {
    setSelectedUnlockType(unlockType);
    setProcessingPayment(true);
    try {
      const res = await unlockContact(listing.id, unlockType, token);
      if (res.status === "already_unlocked" || res.status === "unlocked_with_plan") {
        alert("Unlocked successfully!");
        setUnlockModalOpen(false);
        fetchListingDetails();
      } else if (res.status === "payment_required") {
        setPaymentConfig({
          amount: res.amount,
          order_id: res.order_id,
          key_id: res.key_id,
        });
        setPaymentPurpose("unlock");
        setPaymentOpen(true);
      }
    } catch (err) {
      alert(err.message || "Failed to unlock contact");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Confirm Unlock after Payment
  const handleConfirmUnlock = async (paymentId, signature) => {
    setProcessingPayment(true);
    try {
      const payload = {
        razorpay_order_id: paymentConfig.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        listing_id: listing.id,
        unlock_type: selectedUnlockType,
      };
      await confirmUnlock(payload, token);
      setUnlockModalOpen(false);
      fetchListingDetails();
    } catch (err) {
      alert(err.message || "Failed to verify payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Initiate Boost
  const handleInitiateBoost = async (days) => {
    setSelectedBoostDays(days);
    setProcessingPayment(true);
    try {
      const res = await boostListing(listing.id, days, token);
      if (res.status === "payment_required") {
        setPaymentConfig({
          amount: res.amount,
          order_id: res.order_id,
          key_id: res.key_id,
        });
        setPaymentPurpose("boost");
        setPaymentOpen(true);
      }
    } catch (err) {
      alert(err.message || "Failed to initiate boost");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Confirm Boost after Payment
  const handleConfirmBoost = async (paymentId, signature) => {
    setProcessingPayment(true);
    try {
      const payload = {
        razorpay_order_id: paymentConfig.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        listing_id: listing.id,
        boost_days: selectedBoostDays,
      };
      await confirmBoost(payload, token);
      setBoostModalOpen(false);
      fetchListingDetails();
      alert("Listing boosted successfully!");
    } catch (err) {
      alert(err.message || "Failed to verify boost payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

  async function handleChatSend(overrideText) {
    const text = typeof overrideText === "string" ? overrideText.trim() : chatInput.trim();
    if (!text || chatLoading) return;

    const userMessage = { role: "user", content: text };
    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    // Build listing context from current listing state
    const listingContext = {
      title: listing?.title,
      property_type: listing?.property_type,
      area: listing?.area,
      city: listing?.city,
      rent: listing?.rent,
      deposit: listing?.deposit,
      furnishing: listing?.furnishing,
      gender_preference: listing?.gender_preference,
      parking: listing?.parking,
      floor: listing?.floor,
      available_from: listing?.available_from,
      description: listing?.description,
    };

    try {
      // Send only role+content pairs (no extra fields)
      const historyToSend = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));
      const res = await chatWithAssistant(listing.id, historyToSend, listingContext, token);
      setChatMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    } catch {
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again in a moment." }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  const SUGGESTED_QUESTIONS = [
    "Is this area safe?",
    "How far is it from Hinjewadi IT park?",
    "Is the deposit negotiable?",
    "What should I check during the site visit?",
    "What documents will the owner ask for?",
  ];

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (loadingListing) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading property details...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <h2 style={{ color: "#dc2626" }}>Error</h2>
        <p>{error}</p>
        <button className="primary" style={{ marginTop: "16px" }} onClick={() => router.push("/search")}>
          Back to Search
        </button>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="card" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <h2>Listing Not Found</h2>
        <p>The property you are looking for might have been removed or expired.</p>
        <button className="primary" style={{ marginTop: "16px" }} onClick={() => router.push("/search")}>
          Back to Search
        </button>
      </div>
    );
  }

  const isOwner = user.id === listing.owner_id;
  const showPhotos = listing.photos && listing.photos.length > 0;

  return (
    <>
      <div className="detail-container">

        {/* Navigation & Action Bar */}
        <div className="detail-header-actions">
          <button className="outline back-btn" onClick={() => router.push("/search")}>
            ← Back to Listings
          </button>

          <button
            className={`save-btn-action ${listing.is_saved ? "active" : ""}`}
            onClick={handleSaveToggle}
          >
            {listing.is_saved ? "❤️ Saved" : "🤍 Save Listing"}
          </button>
        </div>

        {/* main layout grid */}
        <div className="detail-grid">

          {/* LEFT COLUMN: Gallery, Description, Details */}
          <div className="left-pane">

            {/* Premium Image Gallery */}
            <div className="gallery-section card">
              {showPhotos ? (
                <div className="carousel-main">
                  <img
                    src={listing.photos[activePhotoIndex]}
                    alt={`Property ${activePhotoIndex + 1}`}
                    onClick={() => setLightboxOpen(true)}
                    className="carousel-image-view"
                  />
                  {listing.photos.length > 1 && (
                    <>
                      <button
                        className="carousel-nav-btn prev"
                        onClick={() => setActivePhotoIndex(prev => prev === 0 ? listing.photos.length - 1 : prev - 1)}
                      >
                        ‹
                      </button>
                      <button
                        className="carousel-nav-btn next"
                        onClick={() => setActivePhotoIndex(prev => prev === listing.photos.length - 1 ? 0 : prev + 1)}
                      >
                        ›
                      </button>
                    </>
                  )}
                  <div className="carousel-counter">
                    {activePhotoIndex + 1} / {listing.photos.length}
                  </div>
                </div>
              ) : (
                <div className="no-photos-placeholder">
                  <div className="placeholder-icon">🏠</div>
                  <p>No photos uploaded for this listing</p>
                </div>
              )}

              {showPhotos && listing.photos.length > 1 && (
                <div className="thumbnails-strip">
                  {listing.photos.map((url, idx) => (
                    <div
                      key={idx}
                      className={`thumb-wrapper ${activePhotoIndex === idx ? "active" : ""}`}
                      onClick={() => setActivePhotoIndex(idx)}
                    >
                      <img src={url} alt={`Property thumbnail ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Badges & Overview */}
            <div className="listing-info card" style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                <span className="badge badge-type">
                  {listing.listing_type === "room_available" ? "Room Available" : "Roommate Needed"}
                </span>
                <span className="badge badge-prop">{listing.property_type.toUpperCase()}</span>
                <span className="badge badge-furnishing">{listing.furnishing.replace("_", " ")}</span>
                <span className="badge badge-gender">Preference: {listing.gender_preference}</span>
                {listing.is_boosted && <span className="badge badge-boosted">⚡ Boosted</span>}
              </div>

              <h1 className="listing-title">{listing.title}</h1>
              <p className="listing-location">📍 {listing.area}, {listing.city}</p>

              <div className="rent-box-container">
                <div className="rent-item">
                  <div className="lbl">Monthly Rent</div>
                  <div className="val">₹{listing.rent.toLocaleString("en-IN")}</div>
                </div>
                <div className="rent-item border-left">
                  <div className="lbl">Security Deposit</div>
                  <div className="val">₹{listing.deposit.toLocaleString("en-IN")}</div>
                </div>
                <div className="rent-item border-left">
                  <div className="lbl">Available From</div>
                  <div className="val">{new Date(listing.available_from).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              <div className="description-section" style={{ marginTop: "24px" }}>
                <h3>Description</h3>
                <p className="description-text">{listing.description}</p>
              </div>

              <div className="key-details-grid" style={{ marginTop: "24px" }}>
                <div className="detail-pair">
                  <strong>Parking:</strong>
                  <span>{listing.parking.replace("_", " ")}</span>
                </div>
                {listing.floor && (
                  <div className="detail-pair">
                    <strong>Floor:</strong>
                    <span>{listing.floor}</span>
                  </div>
                )}
                <div className="detail-pair">
                  <strong>Verified Owner:</strong>
                  <span>{listing.is_verified ? "Yes ✅" : "Self-Reported"}</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Contact Panel / Action Widget */}
          <div className="right-pane">

            <div className="contact-widget card">

              {/* OWNER VIEW */}
              {isOwner ? (
                <div className="owner-controls">
                  <h3 style={{ color: "#065f46", margin: "0 0 16px" }}>You are the Owner</h3>

                  <div className="contact-details-box">
                    <p><strong>Name:</strong> {user.full_name}</p>
                    <p><strong>Phone:</strong> {user.phone}</p>
                  </div>

                  <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {!listing.is_boosted ? (
                      <button className="primary" onClick={() => setBoostModalOpen(true)}>
                        ⚡ Boost Listing (Get 10x views)
                      </button>
                    ) : (
                      <div className="boosted-status-box">
                        🚀 Listing Boost active until:
                        <strong>{new Date(listing.boost_expires_at).toLocaleDateString()}</strong>
                      </div>
                    )}

                    <button className="outline" onClick={() => alert("Edit Listing is under development")}>
                      ✏️ Edit Listing Details
                    </button>
                  </div>

                  <div className="stats-box" style={{ marginTop: "20px" }}>
                    <h4>Listing Performance</h4>
                    <div className="stats-grid">
                      <div>
                        <strong>{listing.view_count || 0}</strong>
                        <span>Views</span>
                      </div>
                      <div>
                        <strong>{listing.save_count || 0}</strong>
                        <span>Bookmarks</span>
                      </div>
                      <div>
                        <strong>{listing.unlock_count || 0}</strong>
                        <span>Unlocks</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SEEKER VIEW */
                <div className="seeker-controls">

                  {listing.is_unlocked ? (
                    /* UNLOCKED VIEW */
                    <div className="unlocked-contact-box animate-fade">
                      <div className="unlock-badge">✅ CONTACT UNLOCKED</div>
                      <h3>Owner Contact Details</h3>

                      <div className="contact-details-box" style={{ margin: "16px 0" }}>
                        <p style={{ fontSize: "1.1rem", margin: "0 0 8px" }}>
                          <strong>👤 Name:</strong> {listing.owner_name}
                        </p>
                        <p style={{ fontSize: "1.2rem", color: "#065f46", margin: "0" }}>
                          <strong>📞 Phone:</strong> {listing.owner_phone}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                        <a
                          href={`tel:${listing.owner_phone}`}
                          className="action-link-btn call"
                          style={{ flex: 1, textAlign: "center" }}
                        >
                          📞 Call Now
                        </a>
                        <a
                          href={`https://wa.me/91${listing.owner_phone}?text=Hi,%20I'm%20interested%20in%20your%20RoomSathi%20listing:%20${encodeURIComponent(listing.title)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="action-link-btn whatsapp"
                          style={{ flex: 1, textAlign: "center" }}
                        >
                          💬 WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* LOCKED VIEW */
                    <div className="locked-contact-box">
                      <div className="lock-icon">🔒</div>
                      <h3>Owner Details Locked</h3>
                      <p style={{ color: "#6b7280", fontSize: "0.9rem", lineHeight: "1.5", margin: "10px 0 20px" }}>
                        Unlock this contact to directly talk, call, or chat with the landlord/flatmate. We keep listings trusted and spam-free.
                      </p>

                      <button
                        className="primary unlock-trigger-btn"
                        onClick={() => setUnlockModalOpen(true)}
                        style={{ width: "100%", padding: "14px" }}
                      >
                        🔓 Unlock Contact for ₹29
                      </button>

                      <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", marginTop: "12px" }}>
                        Or get the RoomSathi Monthly Pass for unlimited unlocks
                      </p>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* LIGHTBOX FOR IMAGES */}
      {lightboxOpen && showPhotos && (
        <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={listing.photos[activePhotoIndex]} alt="Expanded View" />
            <button className="lightbox-close" onClick={() => setLightboxOpen(false)}>✕</button>
          </div>
        </div>
      )}

      {/* UNLOCK SELECTION MODAL */}
      {unlockModalOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal card animate-fade">
            <button className="close-modal-btn" onClick={() => setUnlockModalOpen(false)}>✕</button>

            <h3 style={{ margin: "0 0 10px", fontSize: "1.25rem", color: "#111827" }}>Unlock Contact Options</h3>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 20px" }}>
              Select a payment option to unlock this contact details.
            </p>

            <div className="modal-options-list">

              {/* Option 1: Single */}
              <div
                className={`modal-pay-option ${selectedUnlockType === "single" ? "selected" : ""}`}
                onClick={() => setSelectedUnlockType("single")}
              >
                <input
                  type="radio"
                  checked={selectedUnlockType === "single"}
                  readOnly
                />
                <div style={{ flexGrow: 1 }}>
                  <strong>Single Listing Unlock</strong>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "#6b7280" }}>
                    Get owner contact details for this listing only
                  </span>
                </div>
                <div className="price-tag">₹29</div>
              </div>

              {/* Option 2: Plan */}
              <div
                className={`modal-pay-option ${selectedUnlockType === "plan" ? "selected" : ""}`}
                onClick={() => setSelectedUnlockType("plan")}
              >
                <input
                  type="radio"
                  checked={selectedUnlockType === "plan"}
                  readOnly
                />
                <div style={{ flexGrow: 1 }}>
                  <strong>RoomSathi Monthly Pass</strong>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "#6b7280" }}>
                    Unlimited contact unlocks across all listings for 30 days
                  </span>
                </div>
                <div className="price-tag">₹299</div>
              </div>

            </div>

            <div style={{ marginTop: "24px", display: "flex", gap: "10px" }}>
              <button
                className="outline"
                style={{ flex: 1 }}
                onClick={() => setUnlockModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary"
                style={{ flex: 2 }}
                disabled={processingPayment}
                onClick={() => handleInitiateUnlock(selectedUnlockType)}
              >
                {processingPayment ? "Processing..." : `Pay ₹${selectedUnlockType === "single" ? "29" : "299"}`}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BOOST SELECTION MODAL */}
      {boostModalOpen && (
        <div className="custom-modal-overlay">
          <div className="custom-modal card animate-fade">
            <button className="close-modal-btn" onClick={() => setBoostModalOpen(false)}>✕</button>

            <h3 style={{ margin: "0 0 10px", fontSize: "1.25rem", color: "#111827" }}>Boost Your Listing</h3>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 20px" }}>
              Stand out and get up to 10x more visibility by placing your listing at the top of searches.
            </p>

            <div className="modal-options-list">

              {/* Option 1: 7 Days */}
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
                    Highlight and search priority for 7 days
                  </span>
                </div>
                <div className="price-tag">₹49</div>
              </div>

              {/* Option 2: 15 Days */}
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
                    Highlight and search priority for 15 days
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
                disabled={processingPayment}
                onClick={() => handleInitiateBoost(selectedBoostDays)}
              >
                {processingPayment ? "Processing..." : `Pay ₹${selectedBoostDays === 7 ? "49" : "89"}`}
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
            if (paymentPurpose === "unlock") {
              handleConfirmUnlock(paymentId, signature);
            } else if (paymentPurpose === "boost") {
              handleConfirmBoost(paymentId, signature);
            }
          }}
          onFailure={(err) => {
            alert(err || "Payment failed");
          }}
        />
      )}

      {/* Scoped CSS Styles for Details Layout */}
      <style jsx>{`
        .detail-container {
          margin-top: 10px;
        }
        .detail-header-actions {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .back-btn {
          border-color: transparent;
          color: #4b5563;
        }
        .back-btn:hover {
          color: #111827;
        }
        .save-btn-action {
          border: 1px solid #d1d5db;
          background: white;
          padding: 8px 16px;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        .save-btn-action:hover {
          background: #fff5f5;
          border-color: #fca5a5;
        }
        .save-btn-action.active {
          color: #dc2626;
          background: #fef2f2;
          border-color: #fee2e2;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        @media(max-width: 800px) {
          .detail-grid {
            grid-template-columns: 1fr;
          }
        }
        .carousel-main {
          position: relative;
          aspect-ratio: 16/10;
          background: #f3f4f6;
          border-radius: 14px;
          overflow: hidden;
        }
        .carousel-image-view {
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: zoom-in;
        }
        .carousel-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.85);
          border: none;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: background 0.15s ease;
        }
        .carousel-nav-btn:hover {
          background: white;
        }
        .carousel-nav-btn.prev {
          left: 12px;
        }
        .carousel-nav-btn.next {
          right: 12px;
        }
        .carousel-counter {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .no-photos-placeholder {
          aspect-ratio: 16/10;
          background: #e5e7eb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          color: #6b7280;
        }
        .placeholder-icon {
          font-size: 3.5rem;
          margin-bottom: 8px;
        }
        .thumbnails-strip {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .thumb-wrapper {
          width: 70px;
          height: 50px;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          opacity: 0.6;
          border: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .thumb-wrapper:hover, .thumb-wrapper.active {
          opacity: 1;
          border-color: #065f46;
        }
        .thumb-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .badge {
          font-size: 0.8rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 999px;
          display: inline-block;
        }
        .badge-type {
          background: #ecfdf5;
          color: #065f46;
        }
        .badge-prop {
          background: #f1f5f9;
          color: #475569;
        }
        .badge-furnishing {
          background: #fffbeb;
          color: #b45309;
        }
        .badge-gender {
          background: #fdf2f8;
          color: #be185d;
        }
        .badge-boosted {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 700;
        }
        .listing-title {
          font-size: 1.8rem;
          font-weight: 800;
          color: #111827;
          margin: 12px 0 4px;
          line-height: 1.25;
        }
        .listing-location {
          color: #6b7280;
          margin: 0 0 20px;
          font-size: 1rem;
        }
        .rent-box-container {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
        }
        .rent-item {
          text-align: center;
        }
        .rent-item.border-left {
          border-left: 1px solid #e5e7eb;
        }
        .rent-item .lbl {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          margin-bottom: 4px;
        }
        .rent-item .val {
          font-size: 1.25rem;
          font-weight: 800;
          color: #065f46;
        }
        .description-text {
          line-height: 1.6;
          color: #374151;
          white-space: pre-wrap;
        }
        .key-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #f8fafc;
          padding: 16px;
          border-radius: 12px;
        }
        .detail-pair {
          display: flex;
          justify-content: space-between;
          font-size: 0.9rem;
          color: #4b5563;
        }
        .contact-widget {
          position: sticky;
          top: 24px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          text-align: center;
          margin-top: 12px;
        }
        .stats-grid div {
          background: #f3f4f6;
          padding: 10px;
          border-radius: 8px;
        }
        .stats-grid strong {
          display: block;
          font-size: 1.2rem;
          color: #111827;
        }
        .stats-grid span {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .unlocked-contact-box {
          text-align: center;
        }
        .unlock-badge {
          background: #d1fae5;
          color: #065f46;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          display: inline-block;
          margin-bottom: 12px;
        }
        .contact-details-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 16px;
          text-align: left;
        }
        .contact-details-box p {
          margin: 8px 0;
        }
        .action-link-btn {
          display: inline-block;
          padding: 12px 18px;
          border-radius: 999px;
          font-weight: 600;
          color: white;
          text-decoration: none;
        }
        .action-link-btn.call {
          background: #065f46;
        }
        .action-link-btn.whatsapp {
          background: #25d366;
        }
        .locked-contact-box {
          text-align: center;
          padding: 10px 0;
        }
        .lock-icon {
          font-size: 3.5rem;
          margin-bottom: 16px;
        }
        .boosted-status-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          border-radius: 10px;
          padding: 12px;
          font-size: 0.9rem;
          text-align: center;
        }
        .boosted-status-box strong {
          display: block;
          margin-top: 4px;
        }
        .lightbox-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.9);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox-content {
          position: relative;
          max-width: 90%;
          max-height: 85%;
        }
        .lightbox-content img {
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 8px;
        }
        .lightbox-close {
          position: absolute;
          top: -40px;
          right: 0;
          background: none;
          border: none;
          color: white;
          font-size: 2rem;
          cursor: pointer;
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
        .animate-fade {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── AI Chat Widget ── */}
      {listing && (
        <>
          {/* Floating toggle button — fixed bottom-right */}
          <button
            onClick={() => setChatOpen(o => !o)}
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#065f46",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "1.5rem",
              boxShadow: "0 4px 20px rgba(6,95,70,0.4)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.2s ease",
            }}
            aria-label={chatOpen ? "Close assistant" : "Open RoomSathi Assistant"}
          >
            {chatOpen ? "✕" : "🤖"}
          </button>

          {/* Chat panel — fixed bottom-right above button */}
          {chatOpen && (
            <div style={{
              position: "fixed",
              bottom: "92px",
              right: "24px",
              width: "340px",
              maxWidth: "calc(100vw - 48px)",
              height: "480px",
              background: "white",
              borderRadius: "20px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              zIndex: 999,
              overflow: "hidden",
              border: "1px solid #e5e7eb",
            }}>

              {/* Header */}
              <div style={{
                background: "#065f46",
                color: "white",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: "1.2rem" }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    RoomSathi Assistant
                  </div>
                  <div style={{ fontSize: "0.72rem", opacity: 0.8 }}>
                    Ask anything about this listing
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    <div style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: msg.role === "user"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: msg.role === "user" ? "#065f46" : "#f3f4f6",
                      color: msg.role === "user" ? "white" : "#111827",
                      fontSize: "0.85rem",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Suggested questions — only when fresh */}
                {chatMessages.length === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af", marginLeft: "2px" }}>
                      Try asking:
                    </span>
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button key={i} onClick={() => {
                        setChatInput(q)
                        setTimeout(() => handleChatSend(q), 0)
                      }}
                        style={{
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "999px",
                          padding: "6px 12px",
                          fontSize: "0.78rem",
                          color: "#065f46",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.15s",
                        }}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Typing indicator */}
                {chatLoading && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{
                      background: "#f3f4f6",
                      borderRadius: "18px 18px 18px 4px",
                      padding: "10px 16px",
                      fontSize: "1.2rem",
                      letterSpacing: "2px",
                    }}>
                      ···
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: "10px 12px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "8px",
                flexShrink: 0,
                background: "white",
              }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChatSend()}
                  placeholder="Ask anything..."
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: "999px",
                    padding: "8px 14px",
                    fontSize: "0.85rem",
                    outline: "none",
                    background: chatLoading ? "#f9fafb" : "white",
                  }}
                />
                <button
                  onClick={() => handleChatSend()}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    background: "#065f46",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                    opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ➤
                </button>
              </div>

            </div>
          )}
        </>
      )}
    </>
  );
}
