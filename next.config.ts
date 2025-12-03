import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side external packages - prevents bundling of problematic packages
  // These are Node.js-specific packages used by WalletConnect/pino
  serverExternalPackages: [
    "pino",
    "pino-pretty", 
    "thread-stream",
  ],
  
  // Webpack configuration fallback for non-Turbopack builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
