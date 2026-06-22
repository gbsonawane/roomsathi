import { useRouter } from "next/router";
import Navbar from "./Navbar";

export default function Layout({ children }) {
  const router = useRouter();
  
  // Routes that should NOT show the default user Navbar or container padding
  const noLayoutRoutes = ["/login", "/signup", "/admin", "/"];
  const showLayout = !noLayoutRoutes.includes(router.pathname);

  if (!showLayout) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <main>{children}</main>
      </div>
    </>
  );
}
