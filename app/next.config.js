/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache du routeur côté téléphone (repris de Fridge). Les pages sont
  // dynamiques (le layout lit la session) ; elles n'ont aucune donnée serveur
  // (tout vient de PassageDataProvider) : les garder ne montre rien de périmé.
  // - static : pages préchargées en entier (les onglets, prefetch={true}), 1 h ;
  // - dynamic : pages ouvertes sans préchargement, 5 min.
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 3600,
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self'",
              // Supabase : API, et Realtime pour suivre les portes en direct
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "worker-src 'self'",
              "manifest-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        // Le service worker doit toujours être revalidé, sinon une mise à jour
        // peut rester bloquée derrière le cache du navigateur.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
