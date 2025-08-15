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
  

  env: {
    PORT: (process.env.PORT || 3000).toString(),
  },
};

export default nextConfig;