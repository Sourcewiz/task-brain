/** @type {import('next').NextConfig} */
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')

const nextConfig = {
  reactStrictMode: true,
  // Some Indian ISPs block *.supabase.co. The browser talks to Supabase through
  // this app's own domain (/sb/...), and Vercel forwards the call server side.
  async rewrites() {
    if (!supabaseUrl) return []
    return [
      { source: '/sb/:path*', destination: `${supabaseUrl}/:path*` },
    ]
  },
}
module.exports = nextConfig
