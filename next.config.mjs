/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 uses this (NOT serverExternalPackages)
  experimental: {
    serverComponentsExternalPackages: ["onnxruntime-node", "@xenova/transformers"]
  },

  // Extra safety: keep native deps out of the server bundle
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("onnxruntime-node");
      config.externals.push("@xenova/transformers");
    }
    return config;
  }
};

export default nextConfig;
