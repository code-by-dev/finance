/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },

  output: 'standalone',
  
  // Remove PORT from env to avoid conflicts with server.js
  // The server.js file handles PORT configuration
};

export default nextConfig;