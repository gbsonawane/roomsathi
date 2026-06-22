import Link from "next/link";
import { useState } from "react";
import { saveListing, unsaveListing } from "../lib/api";

export default function ListingCard({ listing, token, onSavedToggle }) {
  const [isSaved, setIsSaved] = useState(listing.is_saved);

  const handleHeartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      alert("Please sign in to save properties.");
      return;
    }
    try {
      if (isSaved) {
        await unsaveListing(listing.id, token);
        setIsSaved(false);
        if (onSavedToggle) onSavedToggle(listing.id, false);
      } else {
        await saveListing(listing.id, token);
        setIsSaved(true);
        if (onSavedToggle) onSavedToggle(listing.id, true);
      }
    } catch (err) {
      alert(err.message || "Failed to save listing");
    }
  };

  const hasPhoto = listing.photos && listing.photos.length > 0;
  const firstPhoto = hasPhoto ? listing.photos[0] : null;

  return (
    <Link href={`/listing/${listing.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className={`property-card card ${listing.is_boosted ? "boosted" : ""}`}>
        
        {/* Card Image Banner */}
        <div className="card-image-wrapper">
          {hasPhoto ? (
            <img src={firstPhoto} alt={listing.title} className="card-image" />
          ) : (
            <div className="card-image-placeholder">
              <span>🏠</span>
            </div>
          )}

          {/* Top Badges */}
          <div className="card-top-badges">
            {listing.is_boosted && (
              <span className="card-badge featured-badge">⚡ FEATURED</span>
            )}
            <span className={`card-badge type-badge ${listing.listing_type}`}>
              {listing.listing_type === "room_available" ? "Room" : "Roommate Seeker"}
            </span>
          </div>

          {/* Heart Button */}
          {token && (
            <button className={`card-heart-btn ${isSaved ? "active" : ""}`} onClick={handleHeartClick}>
              {isSaved ? "❤️" : "🤍"}
            </button>
          )}
        </div>

        {/* Content details */}
        <div className="card-content">
          <div className="card-price-row">
            <span className="card-rent">₹{listing.rent.toLocaleString("en-IN")}<small>/mo</small></span>
            <span className="card-deposit">Deposit: ₹{listing.deposit.toLocaleString("en-IN")}</span>
          </div>

          <h3 className="card-title">{listing.title || `${listing.property_type.toUpperCase()} in ${listing.area}`}</h3>
          <p className="card-locality">📍 {listing.area}, {listing.city}</p>

          <div className="card-pills">
            <span>{listing.property_type.toUpperCase()}</span>
            <span>{listing.furnishing.replace("_", " ")}</span>
            <span>Pref: {listing.gender_preference}</span>
          </div>
        </div>

        <style jsx>{`
          .property-card {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            padding: 0 !important;
            height: 100%;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            background: white;
            position: relative;
            border: 1px solid #e5e7eb;
          }
          .property-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
          }
          .property-card.boosted {
            border-color: #065f46;
            background: #f0fdf4;
            box-shadow: 0 4px 15px rgba(6, 95, 70, 0.06);
          }
          .card-image-wrapper {
            position: relative;
            aspect-ratio: 16/10;
            background: #f3f4f6;
            width: 100%;
            overflow: hidden;
          }
          .card-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
          }
          .property-card:hover .card-image {
            transform: scale(1.03);
          }
          .card-image-placeholder {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .card-image-placeholder span {
            font-size: 2.5rem;
          }
          .card-top-badges {
            position: absolute;
            top: 10px;
            left: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 2;
          }
          .card-badge {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 999px;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .featured-badge {
            background: #065f46;
          }
          .type-badge.room_available {
            background: #1d4ed8;
          }
          .type-badge.roommate_needed {
            background: #db2777;
          }
          .card-heart-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255,255,255,0.85);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.15s ease, background 0.15s ease;
            font-size: 0.95rem;
            z-index: 2;
          }
          .card-heart-btn:hover {
            transform: scale(1.1);
            background: white;
          }
          .card-heart-btn.active {
            background: #fef2f2;
          }
          .card-content {
            padding: 16px;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
          }
          .card-price-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 8px;
          }
          .card-rent {
            font-size: 1.25rem;
            font-weight: 800;
            color: #065f46;
          }
          .card-rent small {
            font-size: 0.8rem;
            color: #6b7280;
            font-weight: 500;
          }
          .card-deposit {
            font-size: 0.75rem;
            color: #6b7280;
          }
          .card-title {
            margin: 0 0 4px;
            font-size: 1rem;
            font-weight: 700;
            color: #1f2937;
            line-height: 1.3;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .card-locality {
            color: #6b7280;
            font-size: 0.8rem;
            margin: 0 0 14px;
          }
          .card-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-top: auto;
          }
          .card-pills span {
            background: #f3f4f6;
            color: #4b5563;
            font-size: 0.7rem;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 999px;
          }
        `}</style>
      </div>
    </Link>
  );
}
