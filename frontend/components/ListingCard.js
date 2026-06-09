import Link from "next/link";

export default function ListingCard({ listing }) {
  return (
    <Link href={`/listing/${listing.id}`} className="card" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 8px" }}>{listing.title || `${listing.property_type} in ${listing.area}`}</h2>
          <p style={{ margin: 0, color: "#475569" }}>{listing.city}, {listing.area}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>₹{listing.rent}</div>
          <div style={{ color: "#475569" }}>Deposit ₹{listing.deposit}</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="status-pill">{listing.property_type}</span>
        <span className="status-pill">{listing.gender_preference}</span>
        <span className="status-pill">{listing.furnishing}</span>
      </div>
    </Link>
  );
}
