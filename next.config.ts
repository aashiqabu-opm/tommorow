import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the tracing root to this project — silences the multi-lockfile
  // warning caused by a stray package-lock.json in the home directory.
  outputFileTracingRoot: __dirname,
  // Native/WASM libs used only in the gmail-sync route — keep them external so
  // they load at runtime instead of being bundled.
  serverExternalPackages: ['imapflow', 'mailparser', 'mupdf'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
