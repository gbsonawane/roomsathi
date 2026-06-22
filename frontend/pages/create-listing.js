import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import RazorpayModal from "../components/RazorpayModal";
import { createListing, uploadPhotos, createPlanOrder } from "../lib/api";

const PUNE_AREAS = [
  "Kothrud", "Kalyani Nagar", "Viman Nagar", "Baner", "Hinjawadi", 
  "Aundh", "Wakad", "Hadapsar", "Kharadi", "Pimple Saudagar", 
  "Karve Nagar", "Katraj", "Shivajinagar", "Deccan Gymkhana", 
  "Koregaon Park", "Bibwewadi", "Balewadi", "Bavdhan", 
  "Sinhagad Road", "Dhankawadi"
];

export default function CreateListing() {
  const router = useRouter();
  const { token, user, loading } = useAuth();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading]);

  // Form state
  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState("room_available");
  const [propertyType, setPropertyType] = useState("1bhk");
  const [city, setCity] = useState("Pune");
  const [area, setArea] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState([]);
  
  const [furnishing, setFurnishing] = useState("unfurnished");
  const [genderPreference, setGenderPreference] = useState("any");
  const [parking, setParking] = useState("none");
  const [floor, setFloor] = useState("");

  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");
  
  // Set default tomorrow's date
  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };
  const [availableFrom, setAvailableFrom] = useState(getTomorrowString());

  const [description, setDescription] = useState("");
  
  // Photo states
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Plan & Payment states
  const [selectedPlan, setSelectedPlan] = useState("basic");
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdListingId, setCreatedListingId] = useState(null);

  // Filter area suggestions
  useEffect(() => {
    if (area.length > 1) {
      const filtered = PUNE_AREAS.filter(a => 
        a.toLowerCase().includes(area.toLowerCase())
      );
      setAreaSuggestions(filtered);
    } else {
      setAreaSuggestions([]);
    }
  }, [area]);

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // Next / Prev step validation handlers
  const nextStep = () => {
    if (step === 1) {
      if (!city.trim()) return alert("City is required");
      if (!area.trim()) return alert("Area/Locality is required");
    }
    if (step === 3) {
      if (!rent || parseInt(rent) <= 0) return alert("Please enter a valid Rent amount");
      if (!deposit || parseInt(deposit) < 0) return alert("Please enter a valid Deposit amount");
      if (!availableFrom) return alert("Please select an availability date");
    }
    if (step === 4) {
      if (description.length < 30) {
        return alert("Description must be at least 30 characters long to help seekers.");
      }
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  // Handles photo uploads
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (photos.length + files.length > 5 && selectedPlan === "basic") {
      setUploadError("Basic plan allows max 5 photos. Upgrade plan to upload more.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const res = await uploadPhotos(files, token);
      setPhotos(prev => [...prev, ...res.urls]);
    } catch (err) {
      setUploadError(err.message || "Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (indexToRemove) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Listing
  const handleFinalSubmit = async (paymentDetails = null) => {
    setSubmitting(true);
    setError("");

    const payload = {
      listing_type: listingType,
      property_type: propertyType,
      gender_preference: genderPreference,
      furnishing: furnishing,
      floor: floor || null,
      parking: parking,
      city: city,
      area: area,
      full_address: `${area}, ${city}`,
      rent: parseInt(rent),
      deposit: parseInt(deposit),
      available_from: availableFrom,
      description: description,
      photos: photos,
      listing_plan: selectedPlan,
      razorpay_order_id: paymentDetails?.order_id || null,
      razorpay_payment_id: paymentDetails?.payment_id || null,
      razorpay_signature: paymentDetails?.signature || null,
    };

    try {
      const res = await createListing(payload, token);
      setCreatedListingId(res.id);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong while creating the listing");
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger listing creation / payment logic
  const handlePlanSelection = async (plan) => {
    setSelectedPlan(plan);
    if (plan === "basic") {
      await handleFinalSubmit();
    } else {
      setSubmitting(true);
      setError("");
      try {
        const orderData = await createPlanOrder(plan, token);
        setPaymentConfig(orderData);
        setPaymentOpen(true);
      } catch (err) {
        setError(err.message || "Failed to initiate payment");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: "560px", margin: "40px auto", textAlign: "center" }} className="card">
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎉</div>
        <h1 style={{ color: "#065f46" }}>Listing Published!</h1>
        <p style={{ color: "#4b5563", margin: "16px 0 24px", lineHeight: "1.6" }}>
          Your property listing has been successfully published on RoomSathi. It is now live and visible to room seekers in Pune.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button 
            className="primary" 
            onClick={() => router.push(`/listing/${createdListingId}`)}
          >
            View My Listing
          </button>
          <button 
            className="outline" 
            onClick={() => router.push("/home")}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ maxWidth: "680px", margin: "20px auto" }}>
        
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
          <div className="steps-indicator">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div 
                key={s} 
                className={`step-dot ${step === s ? "active" : ""} ${step > s ? "completed" : ""}`}
                onClick={() => {
                  if (s < step) setStep(s);
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div className="step-label">
            {step === 1 && "Step 1: Basic Information"}
            {step === 2 && "Step 2: Property Details"}
            {step === 3 && "Step 3: Rent & Availability"}
            {step === 4 && "Step 4: Description"}
            {step === 5 && "Step 5: Photos"}
            {step === 6 && "Step 6: Choose Listing Plan"}
          </div>
        </div>

        {error && (
          <div className="error-alert">
            {error}
          </div>
        )}

        <div className="card form-card">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="form-step-content animate-fade">
              <h2>Basic Information</h2>
              <p className="subtitle">Let's start with what type of listing you want to create.</p>
              
              <div className="input-group">
                <label>Listing Type</label>
                <div className="type-toggle-grid">
                  <div 
                    className={`toggle-option ${listingType === "room_available" ? "selected" : ""}`}
                    onClick={() => setListingType("room_available")}
                  >
                    <div className="icon">🏠</div>
                    <div>
                      <strong>Room Available</strong>
                      <small>You have a flat/room to rent out</small>
                    </div>
                  </div>
                  <div 
                    className={`toggle-option ${listingType === "roommate_needed" ? "selected" : ""}`}
                    onClick={() => setListingType("roommate_needed")}
                  >
                    <div className="icon">🤝</div>
                    <div>
                      <strong>Roommate Needed</strong>
                      <small>You want to find a roommate for a flat</small>
                    </div>
                  </div>
                </div>
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="propertyType">Property Type</label>
                <select 
                  id="propertyType"
                  value={propertyType} 
                  onChange={(e) => setPropertyType(e.target.value)}
                >
                  <option value="1bhk">1 BHK</option>
                  <option value="2bhk">2 BHK</option>
                  <option value="3bhk">3 BHK</option>
                  <option value="1rk">1 RK</option>
                  <option value="shared_room">Shared Room</option>
                  <option value="pg">PG</option>
                  <option value="hostel">Hostel</option>
                </select>
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="city">City</label>
                <input 
                  id="city"
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  placeholder="Pune"
                />
              </div>

              <div className="input-group" style={{ marginTop: "20px", position: "relative" }}>
                <label htmlFor="area">Area / Locality in Pune</label>
                <input 
                  id="area"
                  type="text" 
                  value={area} 
                  onChange={(e) => setArea(e.target.value)} 
                  placeholder="e.g. Kothrud, Viman Nagar"
                  autoComplete="off"
                />
                {areaSuggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {areaSuggestions.map(s => (
                      <li key={s} onClick={() => {
                        setArea(s);
                        setAreaSuggestions([]);
                      }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="form-step-content animate-fade">
              <h2>Property Details</h2>
              <p className="subtitle">Add options describing the furnishing, access, and rules.</p>

              <div className="input-group">
                <label htmlFor="furnishing">Furnishing Status</label>
                <select 
                  id="furnishing"
                  value={furnishing} 
                  onChange={(e) => setFurnishing(e.target.value)}
                >
                  <option value="unfurnished">Unfurnished</option>
                  <option value="semi_furnished">Semi-Furnished</option>
                  <option value="fully_furnished">Fully Furnished</option>
                </select>
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="genderPreference">Gender Preference</label>
                <select 
                  id="genderPreference"
                  value={genderPreference} 
                  onChange={(e) => setGenderPreference(e.target.value)}
                >
                  <option value="any">No Preference (Any)</option>
                  <option value="male">Male Seeker Only</option>
                  <option value="female">Female Seeker Only</option>
                </select>
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="parking">Parking Availability</label>
                <select 
                  id="parking"
                  value={parking} 
                  onChange={(e) => setParking(e.target.value)}
                >
                  <option value="none">No Parking</option>
                  <option value="two_wheeler">Two Wheeler Only</option>
                  <option value="four_wheeler">Four Wheeler Only</option>
                  <option value="both">Both Two & Four Wheeler</option>
                </select>
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="floor">Floor Details (Optional)</label>
                <input 
                  id="floor"
                  type="text" 
                  value={floor} 
                  onChange={(e) => setFloor(e.target.value)} 
                  placeholder="e.g. 3rd Floor, Ground"
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="form-step-content animate-fade">
              <h2>Rent & Availability</h2>
              <p className="subtitle">Set your pricing models and dates clearly.</p>

              <div className="input-group">
                <label htmlFor="rent">Monthly Rent (₹)</label>
                <input 
                  id="rent"
                  type="number" 
                  value={rent} 
                  onChange={(e) => setRent(e.target.value)} 
                  placeholder="e.g. 12000"
                  min="1"
                />
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="deposit">Security Deposit (₹)</label>
                <input 
                  id="deposit"
                  type="number" 
                  value={deposit} 
                  onChange={(e) => setDeposit(e.target.value)} 
                  placeholder="e.g. 24000"
                  min="0"
                />
              </div>

              <div className="input-group" style={{ marginTop: "20px" }}>
                <label htmlFor="availableFrom">Available From Date</label>
                <input 
                  id="availableFrom"
                  type="date" 
                  value={availableFrom} 
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="form-step-content animate-fade">
              <h2>Listing Description</h2>
              <p className="subtitle">Write a brief description detailing flat features, house rules, flatmates info, etc.</p>

              <div className="input-group">
                <label htmlFor="description">Description (Min 30 chars)</label>
                <textarea 
                  id="description"
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Describe your room, rules, facilities (Wi-Fi, washing machine, maid) and what type of roommate you want..."
                  style={{ width: "100%", height: "160px", padding: "12px", borderRadius: "12px", border: "1px solid #d1d5db" }}
                />
                <span className="character-counter">
                  {description.length} / 30 minimum characters
                </span>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="form-step-content animate-fade">
              <h2>Upload Photos</h2>
              <p className="subtitle">Upload high quality images of your room. (Basic plan allows max 5 photos)</p>

              <div className="upload-dropzone">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  id="file-upload-input"
                  style={{ display: "none" }}
                  disabled={uploading}
                />
                <label htmlFor="file-upload-input" className="upload-label">
                  <div className="upload-icon">📸</div>
                  <span>{uploading ? "Uploading..." : "Click to select or drop photos here"}</span>
                </label>
              </div>

              {uploadError && (
                <div style={{ color: "#b91c1c", marginTop: "8px", fontSize: "0.9rem" }}>
                  {uploadError}
                </div>
              )}

              {/* Photos Previews */}
              <div className="photos-grid">
                {photos.map((url, idx) => (
                  <div key={idx} className="photo-preview-item">
                    <img src={url} alt={`preview-${idx}`} />
                    <button type="button" className="remove-photo-btn" onClick={() => removePhoto(idx)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="form-step-content animate-fade">
              <h2>Select Listing Plan</h2>
              <p className="subtitle">Boost your listing or keep it basic.</p>

              <div className="plans-grid">
                
                {/* Basic Plan */}
                <div className="plan-card">
                  <h3>Basic Plan</h3>
                  <div className="price">₹0</div>
                  <ul className="plan-features">
                    <li>✓ Standard Listing Visibility</li>
                    <li>✓ Max 5 Photos</li>
                    <li>✓ Active for 30 Days</li>
                  </ul>
                  <button 
                    disabled={submitting} 
                    className="outline" 
                    onClick={() => handlePlanSelection("basic")}
                  >
                    {submitting && selectedPlan === "basic" ? "Publishing..." : "Choose Free"}
                  </button>
                </div>

                {/* Standard Plan */}
                <div className="plan-card featured">
                  <div className="badge">RECOMMENDED</div>
                  <h3>Standard Plan</h3>
                  <div className="price">₹199</div>
                  <ul className="plan-features">
                    <li>✓ Search Priority Boost</li>
                    <li>✓ Verified Owner Badge</li>
                    <li>✓ Up to 15 Photos</li>
                    <li>✓ 7 Days Automated Boost</li>
                  </ul>
                  <button 
                    disabled={submitting} 
                    className="primary" 
                    onClick={() => handlePlanSelection("standard")}
                  >
                    {submitting && selectedPlan === "standard" ? "Loading..." : "Pay ₹199"}
                  </button>
                </div>

                {/* Premium Plan */}
                <div className="plan-card">
                  <h3>Premium Plan</h3>
                  <div className="price">₹399</div>
                  <ul className="plan-features">
                    <li>✓ Top Search Priority Placement</li>
                    <li>✓ Verified Owner Badge</li>
                    <li>✓ Unlimited Photos</li>
                    <li>✓ 15 Days Automated Boost</li>
                    <li>✓ Shared to Telegram & WhatsApp</li>
                  </ul>
                  <button 
                    disabled={submitting} 
                    className="primary" 
                    onClick={() => handlePlanSelection("premium")}
                  >
                    {submitting && selectedPlan === "premium" ? "Loading..." : "Pay ₹399"}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Form Actions (for steps 1-5) */}
          {step < 6 && (
            <div className="form-actions">
              <button 
                type="button" 
                disabled={step === 1} 
                onClick={prevStep} 
                className="outline"
              >
                Back
              </button>
              <button 
                type="button" 
                onClick={nextStep} 
                className="primary"
              >
                Next Step
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Razorpay Integration */}
      {paymentConfig && (
        <RazorpayModal
          isOpen={paymentOpen}
          amount={paymentConfig.amount}
          orderId={paymentConfig.order_id}
          keyId={paymentConfig.key_id}
          onClose={() => setPaymentOpen(false)}
          onSuccess={(paymentId, signature) => {
            handleFinalSubmit({
              order_id: paymentConfig.order_id,
              payment_id: paymentId,
              signature: signature,
            });
          }}
          onFailure={(err) => {
            setError(err || "Payment failed");
          }}
        />
      )}

      {/* Custom Scoped CSS Styles for the Form and Layout */}
      <style jsx>{`
        .progress-container {
          margin-bottom: 30px;
        }
        .progress-bar-bg {
          height: 6px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .progress-bar-fill {
          height: 100%;
          background: #065f46;
          transition: width 0.3s ease;
        }
        .steps-indicator {
          display: flex;
          justify-content: space-between;
          margin-top: -33px;
        }
        .step-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #e5e7eb;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border: 2px solid white;
          transition: all 0.3s ease;
        }
        .step-dot.active {
          background: #065f46;
          color: white;
          transform: scale(1.15);
        }
        .step-dot.completed {
          background: #ecfdf5;
          color: #065f46;
          border-color: #065f46;
        }
        .step-label {
          text-align: center;
          margin-top: 14px;
          font-weight: 600;
          color: #374151;
        }
        .subtitle {
          color: #6b7280;
          margin: 4px 0 24px;
          font-size: 0.95rem;
        }
        .type-toggle-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .toggle-option {
          border: 1px solid #d1d5db;
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.2s ease;
          background: #f9fafb;
        }
        .toggle-option:hover {
          border-color: #065f46;
          background: #f0fdf4;
        }
        .toggle-option.selected {
          border-color: #065f46;
          background: #ecfdf5;
          box-shadow: 0 0 0 1px #065f46;
        }
        .toggle-option .icon {
          font-size: 1.5rem;
        }
        .toggle-option strong {
          display: block;
          color: #111827;
        }
        .toggle-option small {
          color: #6b7280;
          font-size: 0.8rem;
        }
        .suggestions-list {
          position: absolute;
          z-index: 10;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          width: 100%;
          max-height: 180px;
          overflow-y: auto;
          margin: 4px 0 0;
          padding: 0;
          list-style: none;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .suggestions-list li {
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .suggestions-list li:hover {
          background: #f3f4f6;
        }
        .character-counter {
          display: block;
          text-align: right;
          font-size: 0.8rem;
          color: #6b7280;
          margin-top: 6px;
        }
        .upload-dropzone {
          border: 2px dashed #d1d5db;
          border-radius: 14px;
          padding: 30px;
          text-align: center;
          cursor: pointer;
          background: #f9fafb;
          transition: background 0.15s ease;
        }
        .upload-dropzone:hover {
          background: #f3f4f6;
          border-color: #065f46;
        }
        .upload-label {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #4b5563;
        }
        .upload-icon {
          font-size: 2.2rem;
        }
        .photos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }
        .photo-preview-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }
        .photo-preview-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .remove-photo-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-top: 20px;
        }
        @media(max-width: 600px) {
          .plans-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
        .plan-card {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          background: white;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .plan-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
        }
        .plan-card.featured {
          border-color: #065f46;
          background: #f0fdf4;
          box-shadow: 0 4px 15px rgba(6, 95, 70, 0.1);
        }
        .plan-card.featured .badge {
          position: absolute;
          top: -12px;
          background: #065f46;
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .plan-card h3 {
          margin: 0;
          font-size: 1.15rem;
          color: #111827;
        }
        .plan-card .price {
          font-size: 1.8rem;
          font-weight: 800;
          color: #111827;
          margin: 14px 0;
        }
        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
          text-align: left;
          font-size: 0.85rem;
          color: #4b5563;
          flex-grow: 1;
        }
        .plan-features li {
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .form-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #f3f4f6;
        }
        .error-alert {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
        }
        .animate-fade {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
