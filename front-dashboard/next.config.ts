import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Server configuration
  serverExternalPackages: [],
  // Environment variables configuration
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000',
  },
  // Public runtime config for client-side access
  publicRuntimeConfig: {
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://162.19.25.155:5000',
  },
};

export default nextConfig;
