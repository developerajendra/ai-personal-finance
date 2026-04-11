/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Next.js 14 syntax for external server packages (moved to top-level in v15)
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "better-sqlite3", "pdf-parse", "exceljs"],
  },

  webpack: (config, { dev, isServer }) => {
    // Prevent browser bundle from trying to polyfill Node-only modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      net: false,
      tls: false,
      child_process: false,
    };

    // Improve HMR and file watching in development
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
