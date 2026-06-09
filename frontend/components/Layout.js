import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="container">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
