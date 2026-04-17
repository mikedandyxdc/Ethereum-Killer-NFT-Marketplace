/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — produces minimal self-contained build for Docker
  // Required for the Docker deployment setup. Outputs to .next/standalone/
  output: 'standalone',
  reactStrictMode: true,
  // Stub React Native async-storage module — @metamask/sdk (pulled in via wagmi/connectors)
  // tries to import it but it doesn't exist in browser environments. Standard fix per:
  // https://github.com/rainbow-me/rainbowkit/issues/2555
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, '@react-native-async-storage/async-storage': false }
    return config
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/nfts/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'image/jpeg',
          },
        ],
      },
      {
        source: '/nfts_thumbnail/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'image/jpeg',
          },
        ],
      },
      {
        source: '/nfts_full/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'image/jpeg',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
