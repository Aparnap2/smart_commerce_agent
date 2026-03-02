/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@copilotkit/react-ui",
    "@copilotkit/react-core",
    "@copilotkit/runtime",
    "streamdown",
    "shiki"
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
