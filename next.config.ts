import type { NextConfig } from "next";

// The backend is the Python FastAPI app in ./backend.
// On Vercel (and under `vercel dev`), the top-level rewrites in vercel.json send /api/* straight to the
// "backend" service, so requests never reach Next.js and no proxy is needed. For plain `npm run dev` with a
// separately started uvicorn, Next.js proxies /api/* to API_URL instead.
const API_URL = process.env.API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL) return [];
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
