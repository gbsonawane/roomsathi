import { withSentryConfig } from "@sentry/nextjs";

const isProd =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

if (isProd && !process.env.NEXT_PUBLIC_FASTAPI_URL) {
  throw new Error(
    "NEXT_PUBLIC_FASTAPI_URL must be set for production builds. " +
      "Refusing to fall back to localhost."
  );
}

if (!process.env.NEXT_PUBLIC_FASTAPI_URL) {
  console.error(
    "[RoomSathi] WARNING: NEXT_PUBLIC_FASTAPI_URL is not set. " +
      "Set it in frontend/.env (e.g. http://localhost:8000 for local dev)."
  );
}

const nextConfig = {
  reactStrictMode: true,
  env: {
    // No localhost fallback — undefined if unset (api.js will error loudly)
    NEXT_PUBLIC_FASTAPI_URL: process.env.NEXT_PUBLIC_FASTAPI_URL || "",
  },
  images: {
    domains: [
      "maps.googleapis.com",
      "myapp-photo-storage-024863981383-eu-north-1-an.s3.amazonaws.com",
      "myapp-photo-storage-024863981383-eu-north-1-an.s3.eu-north-1.amazonaws.com",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com",
              "connect-src 'self' https://api.razorpay.com",
              "frame-src https://checkout.razorpay.com https://accounts.google.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "roomsathi",
  project: "roomsathi-frontend",
});
