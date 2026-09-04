/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@magicscript/core'],
  // Allows local validation to use an isolated output directory when another
  // Next process still holds a handle on the default .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
