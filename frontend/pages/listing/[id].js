import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { getListing } from "../../lib/api";

export default function ListingDetailPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { id } = router.query;
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [loadingListing, setLoadingListing] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }

    if (!id) {
      return;
    }

    setLoadingListing(true);
    setError("");
    getListing(id)
      .then(setListing)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingListing(false));
  }, [id, user, loading, router]);

  if (!id) {
    return <p>Loading listing...</p>;
  }

  if (loadingListing) {
    return <p>Loading listing details…</p>;
  }

  if (error) {
    return <p style={{ color: "#b91c1c" }}>{error}</p>;
  }

  if (!listing) {
    return <p>Listing not found.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">{listing.title || `${listing.property_type} in ${listing.area}`}</h1>
          <p style={{ color: "#475569" }}>{listing.city}, {listing.area}</p>
        </div>
        <button className="outline" onClick={() => router.push("/search")}>Back to search</button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div className="status-pill">Rent ₹{listing.rent}</div>
              <p style={{ margin: "10px 0 0", color: "#475569" }}>Deposit ₹{listing.deposit}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0 }}>Gender: {listing.gender_preference}</p>
              <p style={{ margin: 0 }}>Furnishing: {listing.furnishing}</p>
            </div>
          </div>

          <div>
            <strong>Address</strong>
            <p style={{ margin: "8px 0 0" }}>{listing.full_address || `${listing.area}, ${listing.city}`}</p>
          </div>

          <div>
            <strong>Description</strong>
            <p style={{ margin: "8px 0 0" }}>{listing.description || "No description provided."}</p>
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="section-title">Owner</div>
              <p style={{ margin: 0 }}>{listing.owner_name || "Owner"}</p>
              <p style={{ margin: 0 }}>{listing.owner_phone || "Hidden until unlock"}</p>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="section-title">Stats</div>
              <p>Views: {listing.view_count}</p>
              <p>Saved: {listing.save_count}</p>
              <p>Unlocked: {listing.unlock_count}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
