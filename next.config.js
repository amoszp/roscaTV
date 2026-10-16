/** @type {import('next').NextConfig} */
const defaultCache = require('next-pwa/cache')

const withPWA = require('next-pwa')({
  dest: 'public',
  // The app's own API (sign-in, library sync) always goes to the network.
  runtimeCaching: [
    { urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'GET' },
    { urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'POST' },
    { urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'PUT' },
    { urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'DELETE' },
    ...defaultCache,
  ],
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);