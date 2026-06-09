import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getListings } from "../lib/api";
import ListingCard from "../components/ListingCard";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [listings, setListings] = useState([]);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
      return;
    }

    if (!loading) {
      getListings({ page_size: 6 })
        .then(setListings)
        .catch((err) => setFetchError(err.message));
    }
  }, [user, loading, router]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Hello, {user?.full_name || "Guest"}</h1>
          <p>Browse the latest rooms and flats listed by owners.</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="outline" onClick={() => router.push("/search")}>Search listings</button>
          <button className="outline" onClick={() => router.push("/profile")}>My profile</button>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="section-title">Featured listings</div>
        {fetchError && <p style={{ color: "#b91c1c" }}>{fetchError}</p>}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {listings.length ? listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          )) : (
            <p>No listings available yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
