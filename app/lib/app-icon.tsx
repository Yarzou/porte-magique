import { ICON_COLOR } from '@/lib/app'

/**
 * Dessin de l'icône (porte entrouverte blanche sur fond vert), rendu en PNG par
 * app/icon.tsx et app/apple-icon.tsx via ImageResponse. Le dessin occupe
 * ~56 % du côté : il reste dans la zone sûre d'une icône « maskable ».
 */
export function AppIconArt({ size }: { size: number }) {
  const glyph = Math.round(size * 0.56)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ICON_COLOR,
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 20H2" />
        <path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z" />
        <path d="M11 4H8a2 2 0 0 0-2 2v14" />
        <path d="M14 12h.01" />
        <path d="M22 20h-3" />
      </svg>
    </div>
  )
}
