import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = /** @type {import('next').NextConfig} */ ({
  reactStrictMode: true,
  output: 'export',
  distDir: '.next',
  typedRoutes: true,
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    unoptimized: true,
  },
  
});

export default nextConfig;
