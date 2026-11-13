/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const target = (process.env.API_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/,'');
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};
export default nextConfig;
