import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getListings } from "../lib/api";
import ListingCard from "../components/ListingCard";

export default function SearchPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  // Filter states
  const [listingType, setListingType] = useState("both"); // both | room_available | roommate_needed
  const [city, setCity] = useState("Pune");
  const [area, setArea] = useState("");
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState([]); // Array of selected property types
  const [genderPreference, setGenderPreference] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | rent_asc | rent_desc

  // Listings & UI status
  const [listings, setListings] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading]);

  const handlePropertyTypeToggle = (type) => {
    setSelectedPropertyTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const fetchResults = async () => {
    setError("");
    setSearching(true);
    try {
      const payload = {
        city: city || undefined,
        area: area || undefined,
        gender_preference: genderPreference || undefined,
        min_rent: minRent ? parseInt(minRent) : undefined,
        max_rent: maxRent ? parseInt(maxRent) : undefined,
        sort_by: sortBy,
        listing_type: listingType,
      };

      if (selectedPropertyTypes.length > 0) {
        payload.property_type = selectedPropertyTypes;
      }

      const results = await getListings(payload);
      setListings(results);
    } catch (err) {
      setError(err.message || "Failed to fetch search results");
    } finally {
      setSearching(false);
    }
  };

  // Run search on load and whenever filters change
  useEffect(() => {
    if (user) {
      fetchResults();
    }
  }, [user, listingType, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchResults();
  };

  const handleReset = () => {
    setListingType("both");
    setCity("Pune");
    setArea("");
    setSelectedPropertyTypes([]);
    setGenderPreference("");
    setMinRent("");
    setMaxRent("");
    setSortBy("newest");
    setListings([]);
    setError("");
    // Trigger immediate reload with defaults
    setTimeout(() => {
      fetchResults();
    }, 50);
  };

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  const propertyTypes = [
    { value: "1rk", label: "1 RK" },
    { value: "1bhk", label: "1 BHK" },
    { value: "2bhk", label: "2 BHK" },
    { value: "3bhk", label: "3 BHK" },
    { value: "shared_room", label: "Shared Room" },
    { value: "pg", label: "PG" },
    { value: "hostel", label: "Hostel" }
  ];

  return (
    <>
    <div className="search-layout">
        
        {/* Page Title */}
        <div style={{ marginBottom: "20px" }}>
          <h1 className="page-title">Find Rooms & Roommates</h1>
          <p style={{ color: "#6b7280", margin: "4px 0 0" }}>
            Explore verified listings around Pune with direct contact unlocks.
          </p>
        </div>

        {/* Listing Type tabs selector */}
        <div className="listing-type-tabs">
          <button 
            className={`tab-btn ${listingType === "both" ? "active" : ""}`} 
            onClick={() => setListingType("both")}
          >
            All Listings
          </button>
          <button 
            className={`tab-btn ${listingType === "room_available" ? "active" : ""}`} 
            onClick={() => setListingType("room_available")}
          >
            🏠 Rooms Available
          </button>
          <button 
            className={`tab-btn ${listingType === "roommate_needed" ? "active" : ""}`} 
            onClick={() => setListingType("roommate_needed")}
          >
            🤝 Roommates Needed
          </button>
        </div>

        <div className="search-grid-container">
          
          {/* LEFT: Search Filters Card */}
          <aside className="filters-aside card">
            <form onSubmit={handleSearchSubmit}>
              <h3 style={{ margin: "0 0 16px", color: "#111827", fontSize: "1.1rem" }}>Filters</h3>
              
              <div className="filter-group">
                <label htmlFor="city">City</label>
                <input 
                  id="city"
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  placeholder="e.g. Pune"
                />
              </div>

              <div className="filter-group">
                <label htmlFor="area">Area / Locality</label>
                <input 
                  id="area"
                  type="text" 
                  value={area} 
                  onChange={(e) => setArea(e.target.value)} 
                  placeholder="e.g. Kothrud, Baner"
                />
              </div>

              <div className="filter-group">
                <label>Property Types</label>
                <div className="checkbox-list">
                  {propertyTypes.map(t => (
                    <label key={t.value} className="checkbox-item">
                      <input 
                        type="checkbox" 
                        checked={selectedPropertyTypes.includes(t.value)}
                        onChange={() => handlePropertyTypeToggle(t.value)}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <label htmlFor="genderPreference">Gender Preference</label>
                <select 
                  id="genderPreference"
                  value={genderPreference} 
                  onChange={(e) => setGenderPreference(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="any">No Preference</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Rent Range (₹)</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input 
                    type="number" 
                    value={minRent} 
                    onChange={(e) => setMinRent(e.target.value)} 
                    placeholder="Min" 
                    style={{ padding: "8px 12px" }}
                  />
                  <input 
                    type="number" 
                    value={maxRent} 
                    onChange={(e) => setMaxRent(e.target.value)} 
                    placeholder="Max" 
                    style={{ padding: "8px 12px" }}
                  />
                </div>
              </div>

              <div className="filter-actions">
                <button type="submit" className="primary" style={{ width: "100%" }} disabled={searching}>
                  {searching ? "Searching..." : "Apply Filters"}
                </button>
                <button type="button" className="outline" style={{ width: "100%" }} onClick={handleReset}>
                  Reset All
                </button>
              </div>
            </form>
          </aside>

          {/* RIGHT: Results List */}
          <main className="results-main">
            
            {/* Sorting & Stats Bar */}
            <div className="results-header-row">
              <span className="results-count">
                {searching ? "Searching listings..." : `${listings.length} listings found`}
              </span>
              
              <div className="sort-selector">
                <label htmlFor="sort-dropdown" style={{ margin: 0, fontWeight: 500, fontSize: "0.85rem", color: "#6b7280" }}>Sort by:</label>
                <select 
                  id="sort-dropdown"
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ width: "auto", padding: "6px 12px", fontSize: "0.85rem", borderRadius: "8px" }}
                >
                  <option value="newest">Newest First</option>
                  <option value="rent_asc">Rent: Low to High</option>
                  <option value="rent_desc">Rent: High to Low</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="error-box">
                <p>{error}</p>
              </div>
            )}

            {/* Listings Grid */}
            {searching ? (
              <div className="skeleton-grid">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-card card">
                    <div className="skeleton-image"></div>
                    <div className="skeleton-content">
                      <div className="skeleton-line title"></div>
                      <div className="skeleton-line text"></div>
                      <div className="skeleton-line pills"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : listings.length > 0 ? (
              <div className="listings-grid">
                {listings.map(listing => (
                  <ListingCard 
                    key={listing.id} 
                    listing={listing} 
                    token={token} 
                  />
                ))}
              </div>
            ) : (
              <div className="empty-results card">
                <div className="empty-icon">🔍</div>
                <h3>No Listings Found</h3>
                <p>We couldn't find any listings matching your specific criteria. Try widening your search filters or changing the locality.</p>
                <button className="primary" onClick={handleReset} style={{ marginTop: "12px" }}>
                  Clear All Filters
                </button>
              </div>
            )}

          </main>

        </div>

      </div>

      <style jsx>{`
        .search-layout {
          margin-top: 10px;
        }
        .listing-type-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
        }
        .tab-btn {
          background: transparent;
          border: none;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.95rem;
          color: #4b5563;
          cursor: pointer;
          border-radius: 999px;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          background: #f3f4f6;
          color: #111827;
        }
        .tab-btn.active {
          background: #065f46;
          color: white;
        }
        .search-grid-container {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          align-items: start;
        }
        @media(max-width: 768px) {
          .search-grid-container {
            grid-template-columns: 1fr;
          }
        }
        .filters-aside {
          position: sticky;
          top: 24px;
        }
        .filter-group {
          margin-bottom: 18px;
        }
        .filter-group label {
          font-size: 0.85rem;
          margin-bottom: 6px;
        }
        .checkbox-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 150px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px;
          background: #f9fafb;
        }
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .checkbox-item input {
          width: auto;
          cursor: pointer;
        }
        .filter-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
        }
        .results-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .results-count {
          font-weight: 600;
          color: #374151;
          font-size: 0.95rem;
        }
        .sort-selector {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }
        .error-box {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fee2e2;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .empty-results {
          text-align: center;
          padding: 48px 24px;
        }
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }
        .empty-results h3 {
          margin: 0;
          color: #111827;
        }
        .empty-results p {
          color: #6b7280;
          font-size: 0.9rem;
          margin: 8px 0 16px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        /* Skeleton loaders styling */
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
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
          border-radius: 4px;
          margin-bottom: 8px;
          animation: pulse 1.5s infinite;
        }
        .skeleton-line.title {
          height: 18px;
          width: 70%;
        }
        .skeleton-line.text {
          height: 12px;
          width: 50%;
        }
        .skeleton-line.pills {
          height: 14px;
          width: 90%;
          margin-top: 12px;
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.9; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
