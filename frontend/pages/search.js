import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getListings } from "../lib/api";
import ListingCard from "../components/ListingCard";

const initialFilters = {
  city: "",
  area: "",
  property_type: "",
  gender_preference: "",
  min_rent: "",
  max_rent: "",
};

export default function SearchPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [listings, setListings] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }
  }, [user, loading, router]);

  const handleSearch = async (event) => {
    event.preventDefault();
    setError("");
    setSearching(true);
    try {
      const results = await getListings({
        city: filters.city,
        area: filters.area,
        property_type: filters.property_type,
        gender_preference: filters.gender_preference,
        min_rent: filters.min_rent || undefined,
        max_rent: filters.max_rent || undefined,
      });
      setListings(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="page-title">Search listings</h1>
        <p>Filter by location, rent and preferences.</p>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <form className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} onSubmit={handleSearch}>
          <div>
            <label>City</label>
            <input value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} />
          </div>
          <div>
            <label>Area</label>
            <input value={filters.area} onChange={(e) => setFilters((prev) => ({ ...prev, area: e.target.value }))} />
          </div>
          <div>
            <label>Property type</label>
            <select value={filters.property_type} onChange={(e) => setFilters((prev) => ({ ...prev, property_type: e.target.value }))}>
              <option value="">Any</option>
              <option value="shared_room">Shared room</option>
              <option value="1rk">1RK</option>
              <option value="1bhk">1BHK</option>
              <option value="2bhk">2BHK</option>
              <option value="3bhk">3BHK</option>
              <option value="pg">PG</option>
              <option value="hostel">Hostel</option>
            </select>
          </div>
          <div>
            <label>Gender preference</label>
            <select value={filters.gender_preference} onChange={(e) => setFilters((prev) => ({ ...prev, gender_preference: e.target.value }))}>
              <option value="">Any</option>
              <option value="any">Any</option>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="family">Family</option>
            </select>
          </div>
          <div>
            <label>Min rent</label>
            <input type="number" min="0" value={filters.min_rent} onChange={(e) => setFilters((prev) => ({ ...prev, min_rent: e.target.value }))} />
          </div>
          <div>
            <label>Max rent</label>
            <input type="number" min="0" value={filters.max_rent} onChange={(e) => setFilters((prev) => ({ ...prev, max_rent: e.target.value }))} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12 }}>
            <button className="primary" type="submit" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
            <button
              className="outline"
              type="button"
              onClick={() => {
                setFilters(initialFilters);
                setListings([]);
                setError("");
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}

      <div style={{ marginTop: 24 }}>
        <div className="section-title">Results</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {listings.length ? listings.map((listing) => <ListingCard key={listing.id} listing={listing} />) : (
            <p>No listings matched your search.</p>
          )}
        </div>
      </div>
    </>
  );
}
