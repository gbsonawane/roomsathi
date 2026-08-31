export function SkeletonLine({ width = "100%", height = "16px", style = {} }) {
  return (
    <div
      className="skeleton-shimmer shimmer-bg"
      style={{
        width,
        height,
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: "4px",
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <SkeletonLine height="180px" style={{ borderRadius: "8px" }} />
      <SkeletonLine width="60%" height="20px" />
      <SkeletonLine width="40%" height="16px" />
      <SkeletonLine width="80%" height="14px" />
      <div style={{ display: "flex", gap: "8px" }}>
        <SkeletonLine width="30%" height="14px" />
        <SkeletonLine width="30%" height="14px" />
      </div>
    </div>
  );
}

export function SkeletonListingGrid({ count = 6 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonNotificationRow() {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <SkeletonLine width="40%" height="14px" />
        <SkeletonLine width="15%" height="12px" />
      </div>
      <SkeletonLine width="70%" height="12px" />
    </div>
  );
}
