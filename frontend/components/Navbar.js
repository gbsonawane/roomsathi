import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <div className="toolbar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/home" className="link-button">
          RoomSathi
        </Link>
        <Link href="/home" className="link-button">
          Home
        </Link>
        <Link href="/search" className="link-button">
          Search
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {user ? (
          <>
            <span>{user.full_name}</span>
            <button className="outline" onClick={() => {
              logout();
              router.push("/");
            }}>
              Logout
            </button>
            <Link href="/profile" className="outline">
              Profile
            </Link>
          </>
        ) : (
          <Link href="/" className="outline">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
