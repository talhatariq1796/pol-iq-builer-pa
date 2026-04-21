/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@arcgis/core', '@kepler.gl/components', '@kepler.gl/actions', '@kepler.gl/reducers'],
  reactStrictMode: false,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_ARCGIS_API_KEY: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/arcgis/:path*',
        destination: 'https://services.arcgisonline.com/:path*',
      },
    ]
  },
  webpack: (config, { isServer, dev }) => {

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      // Exclude ONNX Node.js binaries from client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };
    }
    
    // Ignore ONNX Node.js native binaries
    config.externals = config.externals || [];
    config.externals.push({
      'onnxruntime-node': 'onnxruntime-node'
    });
    
    // Ignore .node files  
    config.module.rules.push({
      test: /\.node$/,
      loader: 'ignore-loader'
    });
    
    // Handle Kepler.gl and other large modules - but simplify for development
    if (dev) {
      // Simplified chunking for development to avoid Fast Refresh module conflicts
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'async', // Only async chunks in development
          cacheGroups: {
            default: false,
            vendors: false, // Disable vendor chunking in development
          },
        },
      };
    } else {
      // Full chunking optimization for production
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          maxSize: 2000000,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            anthropic: {
              test: /[\\/]node_modules[\\/]@anthropic-ai[\\/]/,
              name: 'anthropic',
              chunks: 'all',
              priority: 15,
              enforce: false,
            },
            kepler: {
              test: /[\\/]node_modules[\\/]@kepler\.gl[\\/]/,
              name: 'kepler',
              chunks: 'all',
              priority: 10,
              maxSize: 3000000,
            },
            vendor: {
              test: /[\\/]node_modules[\\/](?!(@anthropic-ai|@kepler\.gl))/,
              name: 'vendors',
              chunks: 'all',
              priority: 5,
              maxSize: 2000000,
              enforce: false,
            },
          },
        },
      };
    }
    
    // Increase timeout for large modules
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    
    config.module.rules.push({
      test: /\.d\.ts$/,
      loader: 'ignore-loader'
    });
    
    return config;
  },
}

module.exports = nextConfig // Force rebuild Thu Nov 13 13:32:41 EST 2025
