/** @type {import('next').NextConfig} */
const r2Host = process.env.NEXT_PUBLIC_R2_PUBLIC_HOSTNAME;

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      ...(r2Host
        ? [
            {
              protocol: 'https',
              hostname: r2Host,
              pathname: '/**',
            },
          ]
        : []),
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
