/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/telegram',
        destination: '/api/telegram/webhook',
      },
    ];
  },
};

module.exports = nextConfig;