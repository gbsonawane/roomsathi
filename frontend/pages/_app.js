import Head from "next/head";
import "../styles/globals.css";
import { AuthProvider } from "../context/AuthContext";
import Layout from "../components/Layout";
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function App({ Component, pageProps }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <AuthProvider>
        <Head>
          <title>RoomSathi - Find Rooms &amp; Roommates in Pune</title>
          <meta name="description" content="Hyperlocal room and roommate finder platform in Pune." />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        </Head>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
