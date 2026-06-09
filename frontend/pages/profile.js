import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return <p>Loading profile…</p>;
  }

  if (!user) {
    return <p>Please sign in to view your profile.</p>;
  }

  return (
    <div>
      <h1 className="page-title">My profile</h1>
      <div className="card" style={{ maxWidth: 540 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Account details</div>
          <p><strong>Name:</strong> {user.full_name}</p>
          <p><strong>Email:</strong> {user.email || "Not set"}</p>
          <p><strong>Phone:</strong> {user.phone || "Not set"}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Subscription</div>
          <p><strong>Plan:</strong> {user.plan_type || "free"}</p>
          <p><strong>Verified:</strong> {user.is_verified ? "Yes" : "No"}</p>
          <p><strong>Role:</strong> {user.role}</p>
        </div>
      </div>
    </div>
  );
}
