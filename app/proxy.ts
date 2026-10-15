import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware Next 16 (ex-`middleware.ts`), repris de Fridge : rafraîchit les
 * cookies de session Supabase et renvoie vers la connexion toute page de
 * l'appli sans session. Rien n'est public : tout appartient à un passage. Le
 * vrai verrou reste le RLS ; cette redirection n'évite qu'un écran vide.
 */

// Pages accessibles sans session. `/invitation/` : la page présente le passage
// avant de proposer de créer un compte ou de se connecter. `/api/` : la
// passerelle appelle /api/passerelle avec sa clé, sans compte.
const PUBLIC_PREFIXES = ['/auth/', '/api/', '/invitation/']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() lit le JWT dans les cookies sans appel réseau : plus fiable que
  // getUser() dans le middleware, où une coupure réseau provoquerait une fausse déconnexion.
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname, search } = request.nextUrl
  const isPublic = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    if (pathname !== '/') url.searchParams.set('redirect', pathname + search)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // fichiers/ : notice, liste d'achat et pièces à imprimer (scripts/montage.mjs), sans donnée
    // personnelle. Ouverts dans un nouvel onglet, qui sur iPhone n'a pas la session de l'appli.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon|fichiers/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
