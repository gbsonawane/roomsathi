import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function IndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ color: "#1a3c34", marginBottom: "8px" }}>Loading RoomSathi...</h2>
        <div className="spinner"></div>
      </div>
      <style jsx>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #1a3c34;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 16px auto 0;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
