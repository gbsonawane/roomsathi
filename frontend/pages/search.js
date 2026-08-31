import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getListings, parseSearchQuery } from "../lib/api";
import ListingCard from "../components/ListingCard";
import { SkeletonListingGrid } from "../components/Skeleton";

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

  // NL Search states
  const [nlQuery, setNlQuery] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [nlError, setNlError] = useState("");

  // Map view states
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const mapScriptLoaded = useRef(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 12;

  // Listings & UI status
  const [listings, setListings] = useState([]);
  const [searching, setSearching] = useState(true);
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

  const fetchResults = async (pageOverride, modeOverride = viewMode) => {
    const isMap = modeOverride === "map";
    const activePage = isMap ? 1 : (typeof pageOverride === "number" ? pageOverride : currentPage);
    const activeSize = isMap ? 100 : PAGE_SIZE;

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
        page: activePage,
        page_size: activeSize,
      };

      if (selectedPropertyTypes.length > 0) {
        payload.property_type = selectedPropertyTypes;
      }

      const results = await getListings(payload);
      setListings(results.items);

      if (!isMap) {
        setTotalPages(results.total_pages);
        setTotalCount(results.total);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch search results");
    } finally {
      setSearching(false);
    }
  };

  // Run search on load and whenever filters change
  useEffect(() => {
    if (user) {
      setCurrentPage(1);
      fetchResults(1, "list");
    }
  }, [user, listingType, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchResults(1, "list");
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
      setCurrentPage(1);
      fetchResults(1, "list");
    }, 50);
  };

  async function handleNlSearch(queryToUse) {
    const activeQuery = typeof queryToUse === "string" ? queryToUse : nlQuery;
    if (!activeQuery.trim() || activeQuery.trim().length < 3) return;
    setNlParsing(true);
    setNlError("");
    try {
      const parsed = await parseSearchQuery(activeQuery, token);
      if (!parsed || Object.keys(parsed).length === 0) {
        setNlError("Couldn't understand that. Try: '2BHK in Hinjewadi under 15k'");
        return;
      }

      // Apply each recognized key to the corresponding filter state:
      if (parsed.city) setCity(parsed.city);
      if (parsed.area) setArea(parsed.area);
      if (parsed.listing_type) setListingType(parsed.listing_type);
      if (parsed.property_type) setSelectedPropertyTypes([parsed.property_type]);

      if (parsed.gender_preference) {
        if (parsed.gender_preference === "boys") {
          setGenderPreference("male");
        } else if (parsed.gender_preference === "girls") {
          setGenderPreference("female");
        } else {
          setGenderPreference(parsed.gender_preference);
        }
      }

      if (parsed.min_rent) setMinRent(String(parsed.min_rent));
      if (parsed.max_rent) setMaxRent(String(parsed.max_rent));

      // Trigger search with the newly set filters after state settles
      setTimeout(() => {
        setCurrentPage(1);
        fetchResults(1, "list");
      }, 50);
    } catch (err) {
      setNlError("Search failed. Try again.");
    } finally {
      setNlParsing(false);
    }
  }

  if (loading || !user) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  const goToPage = (page) => {
    setCurrentPage(page);
    fetchResults(page, "list");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (currentPage <= 2) end = 5;
    if (currentPage >= totalPages - 1) start = totalPages - 4;
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const loadGoogleMapsScript = (callback) => {
    if (typeof window === "undefined") return;
    if (window.google?.maps) {
      callback();
      return;
    }
    const existingScript = document.getElementById("googleMapsScript");
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      script.id = "googleMapsScript";
      document.body.appendChild(script);
      script.onload = () => {
        if (callback) callback();
      };
    } else if (callback) {
      existingScript.addEventListener("load", () => callback());
    }
  };

  function updateMarkers(listingsData) {
    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    listingsData.forEach(listing => {
      if (!listing.latitude || !listing.longitude) return;

      const marker = new window.google.maps.Marker({
        position: { lat: listing.latitude, lng: listing.longitude },
        map: mapInstanceRef.current,
        title: listing.title || listing.area,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: listing.is_boosted ? "#f59e0b" : "#065f46",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        }
      });

      // Info window on marker click
      const infoContent = `
        <div style="max-width:220px;font-family:sans-serif;padding:4px">
          <strong style="font-size:14px">
            ₹${listing.rent.toLocaleString('en-IN')}/mo
          </strong>
          <p style="margin:4px 0;font-size:12px;color:#4b5563">
            ${(listing.property_type || '').toUpperCase()} · ${listing.area}
          </p>
          <p style="margin:4px 0;font-size:12px">
            ${listing.furnishing} · ${listing.gender_preference}
          </p>
          <a href="/listing/${listing.id}"
             style="color:#065f46;font-size:12px;font-weight:600">
            View listing →
          </a>
        </div>
      `;
      const infoWindow = new window.google.maps.InfoWindow({
        content: infoContent
      });
      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  }

  useEffect(() => {
    if (viewMode !== "map") {
      mapInstanceRef.current = null;
      return;
    }
    if (mapScriptLoaded.current && mapInstanceRef.current) {
      updateMarkers(listings);
      return;
    }
    loadGoogleMapsScript(() => {
      mapScriptLoaded.current = true;
      if (!mapRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 18.5204, lng: 73.8567 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;
      updateMarkers(listings);
    });
  }, [viewMode, listings]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null));
    };
  }, []);

  const handleModeSwitch = (mode) => {
    if (viewMode === mode) return;
    setViewMode(mode);
    fetchResults(mode === "map" ? 1 : currentPage, mode);
  };


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

        {/* Natural Language Search bar section */}
        <div className="card nl-search-card" style={{ marginBottom: "20px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ✨ Search naturally
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={nlQuery}
              onChange={(e) => {
                setNlQuery(e.target.value);
                if (nlError) setNlError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleNlSearch();
                }
              }}
              placeholder="e.g. 2BHK near Hinjewadi under ₹15k for girls"
              style={{ flexGrow: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db" }}
            />
            <button
              type="button"
              onClick={() => handleNlSearch()}
              className="primary"
              disabled={nlParsing}
              style={{ minWidth: "110px", padding: "10px 20px", borderRadius: "8px", fontWeight: "600" }}
            >
              {nlParsing ? "Parsing..." : "✨ Search"}
            </button>
          </div>
          {nlError && (
            <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "6px" }}>
              {nlError}
            </div>
          )}
          <div className="chips-row">
            <span style={{ fontSize: "12px", color: "#6b7280" }}>Try:</span>
            {[
              "furnished 1BHK in Baner",
              "PG for girls in Wakad under 8k",
              "roommate needed in Kothrud"
            ].map(txt => (
              <span
                key={txt}
                className="chip-pill"
                onClick={() => {
                  setNlQuery(txt);
                  handleNlSearch(txt);
                }}
              >
                {txt}
              </span>
            ))}
          </div>
        </div>

        {/* Divider with horizontal rule effect */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px" }}>
          <div style={{ flexGrow: 1, height: "1px", background: "#e5e7eb" }}></div>
          <span style={{ padding: "0 16px", color: "#9ca3af", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" }}>
            — or use filters below —
          </span>
          <div style={{ flexGrow: 1, height: "1px", background: "#e5e7eb" }}></div>
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
                {searching ? "Searching listings..." : `${totalCount} listings found`}
              </span>

              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleModeSwitch("list")}
                    style={{
                      background: viewMode === "list" ? "#065f46" : "transparent",
                      color: viewMode === "list" ? "white" : "#065f46",
                      border: "1px solid #065f46",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    ≡ List
                  </button>
                  <button
                    onClick={() => handleModeSwitch("map")}
                    style={{
                      background: viewMode === "map" ? "#065f46" : "transparent",
                      color: viewMode === "map" ? "white" : "#065f46",
                      border: "1px solid #065f46",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    🗺 Map
                  </button>
                </div>

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
            </div>

            {error && (
              <div className="error-box">
                <p>{error}</p>
              </div>
            )}

            {/* Listings Grid */}
            {searching ? (
              <SkeletonListingGrid count={12} />
            ) : listings.length > 0 ? (
              <>
                {viewMode === "list" ? (
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
                  <div>
                    <div
                      ref={mapRef}
                      style={{
                        width: "100%",
                        height: "520px",
                        borderRadius: "16px",
                        border: "1px solid #e5e7eb",
                        background: "#f3f4f6",
                      }}
                    />
                    {listings.filter(l => !l.latitude || !l.longitude).length > 0 && (
                      <p style={{ textAlign: "center", fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
                        Note: {listings.filter(l => !l.latitude || !l.longitude).length} listings are not shown on map (no location data)
                      </p>
                    )}
                  </div>
                )}
              </>
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

            {/* Pagination Controls */}
            {totalPages > 1 && !searching && listings.length > 0 && viewMode === "list" && (
              <div className="pagination-container">
                <span className="pagination-showing">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} listings
                </span>
                <div className="pagination-row">
                  <button
                    className="page-pill"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                  >
                    ← Prev
                  </button>

                  {getPageNumbers().map(p => (
                    <button
                      key={p}
                      className={`page-pill ${p === currentPage ? "active" : ""}`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    className="page-pill"
                    disabled={currentPage === totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                  >
                    Next →
                  </button>
                </div>
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
        .pagination-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .pagination-showing {
          font-size: 13px;
          color: #6b7280;
        }
        .pagination-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .page-pill {
          min-width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          cursor: pointer;
          background: white;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          transition: all 0.2s;
        }
        .page-pill:hover:not(:disabled) {
          border-color: #d1d5db;
          background: #f9fafb;
        }
        .page-pill.active {
          background: #065f46;
          color: white;
          border-color: #065f46;
        }
        .page-pill:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .empty-results p {
          color: #6b7280;
          font-size: 0.9rem;
          margin: 8px 0 16px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        .nl-search-card {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025);
        }
        .chips-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
          align-items: center;
        }
        .chip-pill {
          background: #f3f4f6;
          border-radius: 999px;
          font-size: 12px;
          padding: 4px 12px;
          cursor: pointer;
          color: #4b5563;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .chip-pill:hover {
          background: #e5e7eb;
          color: #111827;
        }
      `}</style>
    </>
  );
}
